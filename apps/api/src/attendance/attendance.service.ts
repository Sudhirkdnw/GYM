import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  Prisma,
  AttendanceMethod,
  AttendanceStatus,
  PassStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { BranchContextService } from '../common/tenant/branch-context.service';
import { EnvelopeEncryptionService } from './encryption/envelope-encryption.service';
import { RedisService } from '../common/redis/redis.service';
import { QrTokenService } from './qr-token.service';
import { PhysicalPasscodeService } from './physical-passcode.service';
import {
  AttendanceHistoryQueryInput,
  KioskCheckInInput,
} from '@gymos/validation';
import {
  AuthenticatedUserContext,
  CheckInRequest,
  ManualCheckInRequest,
  CheckInResponse,
  CheckOutResponse,
  AttendanceSettingsData,
  AttendanceSettingsUpdate,
  AttendanceFloorSummary,
  AttendanceRecordData,
  MemberAccessPassData,
  DynamicPassTokenResponse,
  PublicPassResponse,
  KioskTokenResponse,
  KioskInfoResponse,
  KioskCheckInResponse,
  PaginatedResult,
  UserRole,
} from '@gymos/shared-types';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchContextService: BranchContextService,
    private readonly qrTokenService: QrTokenService,
    private readonly physicalPasscodeService: PhysicalPasscodeService,
    private readonly envelopeEncryptionService: EnvelopeEncryptionService,
    private readonly redisService: RedisService,
  ) {}

  // =========================================================================
  // 1. AUTHORITATIVE CHECK-IN VALIDATION PIPELINE
  // =========================================================================

  /**
   * Authoritative entrypoint for member check-in validation.
   * Dispatches validation and records rejection outbox events if validation fails.
   */
  async checkIn(
    organizationId: string,
    branchId: string,
    dto: CheckInRequest | ManualCheckInRequest,
    user: AuthenticatedUserContext,
  ): Promise<CheckInResponse> {
    try {
      return await this.validateAndCheckIn(organizationId, branchId, dto, user);
    } catch (err: any) {
      if (err instanceof HttpException) {
        const response: any = err.getResponse();
        const rejectionCode = response?.code || (typeof response === 'string' ? response : err.name);
        const rejectionReason = response?.message || err.message;

        await this.prisma
          .withTenantContext(organizationId, async (tx) => {
            const memberId = 'memberId' in dto ? dto.memberId : null;
            const maybeMethod = (dto as unknown as { method?: AttendanceMethod }).method;
            const method = maybeMethod || AttendanceMethod.MANUAL_STAFF;
            await tx.attendanceOutboxEvent.create({
              data: {
                organizationId,
                aggregateId: memberId || branchId,
                eventType: 'attendance.rejected',
                payload: {
                  branchId,
                  memberId,
                  rejectionCode,
                  rejectionReason,
                  method,
                  rejectedAt: new Date().toISOString(),
                  verifiedById: user?.id ?? null,
                },
                idempotencyKey: `attendance_rejected_${branchId}_${Date.now()}_${Math.random()
                  .toString(36)
                  .substring(2, 9)}`,
              },
            });
          })
          .catch(() => {});
      }
      throw err;
    }
  }

  /**
   * Executes the 14-step authoritative server-side check-in validation sequence.
   * Atomic, multi-tenant, concurrency-safe, and fail-closed.
   */
  async validateAndCheckIn(
    organizationId: string,
    branchId: string,
    dto: CheckInRequest | ManualCheckInRequest,
    user: AuthenticatedUserContext,
  ): Promise<CheckInResponse> {
    // Step 1: Resolve authenticated staff identity and verify authorization
    if (!user || !user.id) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role === UserRole.MEMBER && !user.isSuperAdmin) {
      throw new ForbiddenException(
        'Members are not authorized to operate check-in scanners',
      );
    }

    // Step 2: Validate branch access & active operational status for staff
    const branch = await this.branchContextService.validateBranchAccess(
      organizationId,
      branchId,
      user,
    );

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // Step 6: Resolve organization & branch timezone
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { timezone: true },
      });
      const timezone = branch.timezone || org?.timezone || 'UTC';
      const now = new Date();
      const { localDate, localTime } = this.getLocalTimeAndDate(now, timezone);

      // Step 8: Deterministic Settings Resolution (Branch -> Org -> System Default)
      const settings = await this.resolveSettings(tx, organizationId, branchId);

      // Step 12: Operating Hours Policy
      if (!settings.allowOffHoursCheckIn) {
        const isWithin = this.isWithinOperatingHours(
          localTime,
          settings.operatingHoursStart,
          settings.operatingHoursEnd,
        );
        if (!isWithin) {
          throw new ForbiddenException({
            statusCode: HttpStatus.FORBIDDEN,
            error: 'Forbidden',
            message: `Branch is currently closed. Operating hours: ${settings.operatingHoursStart} - ${settings.operatingHoursEnd} (${timezone})`,
            code: 'OUTSIDE_OPERATING_HOURS',
          });
        }
      }

      // Step 3 & 4: Resolve QR Token or Physical Pass Credential & Verify Pass Status
      const resolved = await this.resolveMemberAndPass(
        tx,
        organizationId,
        dto,
        branchId,
      );
      const { member, pass, method } = resolved;

      // Step 5: Verify Active Member Status
      if (member.status !== 'ACTIVE') {
        const code =
          member.status === 'SUSPENDED'
            ? 'MEMBER_SUSPENDED'
            : 'MEMBER_INACTIVE';
        throw new ForbiddenException({
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: `Member profile is ${member.status.toLowerCase()}`,
          code,
        });
      }

      // Step 7, 8, 9, 10: Authoritative Membership Subscription Validation
      const { membership, daysRemaining } = await this.validateMembership(
        tx,
        organizationId,
        member.id,
        branchId,
        localDate,
      );

      // Step 11: Configurable Overdue Dues Policy Evaluation
      const duesNotice = await this.validateFinancialDues(
        tx,
        organizationId,
        member.id,
        localDate,
        settings,
      );

      // Step 13: Anti-Passback Cooldown & Active Session Check
      await this.validateAntiPassback(
        tx,
        organizationId,
        member.id,
        settings.cooldownMinutes,
        now,
      );

      // Step 14: Atomic Attendance Record Creation
      try {
        const record = await tx.attendanceRecord.create({
          data: {
            organizationId,
            branchId,
            memberId: member.id,
            membershipId: membership.id,
            method,
            status: AttendanceStatus.CHECKED_IN,
            checkInTime: now,
            verifiedById: user.id,
            notes: dto.notes ?? null,
          },
          include: {
            member: true,
            branch: true,
            membership: { include: { plan: true } },
          },
        });

        // Update pass last scanned tracking if pass exists
        if (pass) {
          await tx.memberAccessPass.update({
            where: { id: pass.id },
            data: {
              lastScannedAt: now,
              lastScannedBranchId: branchId,
            },
          });
        }

        // Transactional Outbox Event
        await tx.attendanceOutboxEvent.create({
          data: {
            organizationId,
            aggregateId: record.id,
            eventType: 'attendance.checked_in',
            payload: {
              attendanceId: record.id,
              memberId: member.id,
              branchId,
              membershipId: membership.id,
              checkInTime: now.toISOString(),
              method,
              verifiedById: user.id,
            },
            idempotencyKey: `attendance_checkin_${record.id}`,
          },
        });

        // Milestone Outbox Event (visits milestone: 10, 50, 100, 250, 500)
        const totalVisits = await tx.attendanceRecord.count({
          where: {
            organizationId,
            memberId: member.id,
            status: { in: [AttendanceStatus.CHECKED_IN, AttendanceStatus.CHECKED_OUT, AttendanceStatus.AUTO_CHECKED_OUT] },
          },
        });
        const milestones = [10, 50, 100, 250, 500];
        if (milestones.includes(totalVisits)) {
          await tx.attendanceOutboxEvent.create({
            data: {
              organizationId,
              aggregateId: member.id,
              eventType: 'attendance.milestone_reached',
              payload: {
                memberId: member.id,
                branchId,
                milestoneType: 'TOTAL_VISITS',
                milestoneValue: totalVisits,
                reachedAt: now.toISOString(),
              },
              idempotencyKey: `attendance_milestone_visits_${member.id}_${totalVisits}`,
            },
          });
        }

        return {
          success: true,
          record: this.mapRecordToDto(record),
          member: {
            id: member.id,
            memberNumber: member.memberNumber,
            firstName: member.firstName,
            lastName: member.lastName,
            photoUrl: member.profilePhotoKey,
            phone: member.phone,
          },
          membership: {
            id: membership.id,
            planName: membership.plan.name,
            endDate: membership.endDate.toISOString().slice(0, 10),
            daysRemaining,
          },
          duesNotice,
        };
      } catch (err: any) {
        if (
          err.code === 'P2002' ||
          (err.message &&
            err.message.includes('idx_attendance_records_active_session'))
        ) {
          throw new ConflictException({
            statusCode: HttpStatus.CONFLICT,
            error: 'Conflict',
            message: 'Member is already checked in',
            code: 'ALREADY_CHECKED_IN',
          });
        }
        throw err;
      }
    });
  }

  // =========================================================================
  // 2. CHECK-OUT ROUTINE
  // =========================================================================

  /**
   * Authoritatively checks out a member. Idempotent: returns existing checkout if already completed.
   */
  async checkOut(
    organizationId: string,
    attendanceId: string,
    user: AuthenticatedUserContext,
    notes?: string,
  ): Promise<CheckOutResponse> {
    if (!user || !user.id) {
      throw new ForbiddenException('Authentication required');
    }

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const record = await tx.attendanceRecord.findUnique({
        where: { id: attendanceId },
        include: {
          member: true,
          branch: true,
          membership: { include: { plan: true } },
        },
      });

      if (!record || record.organizationId !== organizationId) {
        throw new NotFoundException('Attendance record not found');
      }

      // Idempotency: If already checked out, return existing state
      if (record.status !== AttendanceStatus.CHECKED_IN) {
        return {
          success: true,
          record: this.mapRecordToDto(record),
          durationMinutes: record.durationMinutes ?? 0,
        };
      }

      const now = new Date();
      const durationMinutes = Math.max(
        1,
        Math.round((now.getTime() - record.checkInTime.getTime()) / (1000 * 60)),
      );

      const updated = await tx.attendanceRecord.update({
        where: { id: attendanceId },
        data: {
          status: AttendanceStatus.CHECKED_OUT,
          checkOutTime: now,
          durationMinutes,
          notes: notes
            ? record.notes
              ? `${record.notes}; ${notes}`
              : notes
            : record.notes,
        },
        include: {
          member: true,
          branch: true,
          membership: { include: { plan: true } },
        },
      });

      await tx.attendanceOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: record.id,
          eventType: 'attendance.checked_out',
          payload: {
            attendanceId: record.id,
            memberId: record.memberId,
            branchId: record.branchId,
            checkOutTime: now.toISOString(),
            durationMinutes,
            verifiedById: user.id,
          },
          idempotencyKey: `attendance_checkout_${record.id}`,
        },
      });

      return {
        success: true,
        record: this.mapRecordToDto(updated),
        durationMinutes,
      };
    });
  }

  // =========================================================================
  // 3. SETTINGS RESOLUTION & MANAGEMENT
  // =========================================================================

  /**
   * Deterministic settings precedence:
   * 1. Branch override (branchId = current branch)
   * 2. Organization default (branchId = null)
   * 3. Hardcoded system default
   */
  async resolveSettings(
    tx: Prisma.TransactionClient,
    organizationId: string,
    branchId: string,
  ): Promise<AttendanceSettingsData> {
    if (branchId) {
      const branchSettings = await tx.attendanceSettings.findUnique({
        where: {
          unique_org_branch_attendance_settings: {
            organizationId,
            branchId,
          },
        },
      });
      if (branchSettings) return this.mapSettingsToDto(branchSettings);
    }

    const orgSettings = await tx.attendanceSettings.findFirst({
      where: {
        organizationId,
        branchId: null,
      },
    });
    if (orgSettings) return this.mapSettingsToDto(orgSettings);

    return {
      id: 'system-default',
      organizationId,
      branchId: null,
      allowCheckInWithDues: false,
      maxOverdueGraceDays: 0,
      cooldownMinutes: 10,
      requireCheckOut: false,
      autoCheckOutHours: 3,
      operatingHoursStart: '05:00',
      operatingHoursEnd: '23:00',
      allowOffHoursCheckIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async getAttendanceSettings(
    organizationId: string,
    branchId?: string | null,
  ): Promise<AttendanceSettingsData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      return this.resolveSettings(tx, organizationId, branchId || '');
    });
  }

  async updateAttendanceSettings(
    organizationId: string,
    branchId: string | null | undefined,
    dto: AttendanceSettingsUpdate,
  ): Promise<AttendanceSettingsData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const targetBranchId = branchId || null;

      const existing = await tx.attendanceSettings.findFirst({
        where: {
          organizationId,
          branchId: targetBranchId,
        },
      });

      if (existing) {
        const updated = await tx.attendanceSettings.update({
          where: { id: existing.id },
          data: {
            ...(dto.allowCheckInWithDues !== undefined && {
              allowCheckInWithDues: dto.allowCheckInWithDues,
            }),
            ...(dto.maxOverdueGraceDays !== undefined && {
              maxOverdueGraceDays: dto.maxOverdueGraceDays,
            }),
            ...(dto.cooldownMinutes !== undefined && {
              cooldownMinutes: dto.cooldownMinutes,
            }),
            ...(dto.requireCheckOut !== undefined && {
              requireCheckOut: dto.requireCheckOut,
            }),
            ...(dto.autoCheckOutHours !== undefined && {
              autoCheckOutHours: dto.autoCheckOutHours,
            }),
            ...(dto.operatingHoursStart !== undefined && {
              operatingHoursStart: dto.operatingHoursStart,
            }),
            ...(dto.operatingHoursEnd !== undefined && {
              operatingHoursEnd: dto.operatingHoursEnd,
            }),
            ...(dto.allowOffHoursCheckIn !== undefined && {
              allowOffHoursCheckIn: dto.allowOffHoursCheckIn,
            }),
          },
        });
        return this.mapSettingsToDto(updated);
      } else {
        const created = await tx.attendanceSettings.create({
          data: {
            organizationId,
            branchId: targetBranchId,
            allowCheckInWithDues: dto.allowCheckInWithDues ?? false,
            maxOverdueGraceDays: dto.maxOverdueGraceDays ?? 0,
            cooldownMinutes: dto.cooldownMinutes ?? 10,
            requireCheckOut: dto.requireCheckOut ?? false,
            autoCheckOutHours: dto.autoCheckOutHours ?? 3,
            operatingHoursStart: dto.operatingHoursStart ?? '05:00',
            operatingHoursEnd: dto.operatingHoursEnd ?? '23:00',
            allowOffHoursCheckIn: dto.allowOffHoursCheckIn ?? false,
          },
        });
        return this.mapSettingsToDto(created);
      }
    });
  }

  // =========================================================================
  // 4. LIVE FLOOR OCCUPANCY & HEADCOUNT
  // =========================================================================

  async getLiveFloorSummary(
    organizationId: string,
    branchId: string,
    user?: AuthenticatedUserContext,
  ): Promise<AttendanceFloorSummary> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      if (
        user &&
        (user.role === UserRole.RECEPTIONIST || user.role === UserRole.TRAINER)
      ) {
        const assignment = await tx.branchStaffAssignment.findFirst({
          where: {
            organizationId,
            organizationUser: { userId: user.id },
            branchId,
            status: 'ACTIVE',
          },
        });
        if (!assignment) {
          throw new ForbiddenException('You do not have access to this branch');
        }
      }

      const activeRecords = await tx.attendanceRecord.findMany({
        where: {
          organizationId,
          branchId,
          status: AttendanceStatus.CHECKED_IN,
        },
        include: {
          member: true,
          branch: true,
          membership: { include: { plan: true } },
        },
        orderBy: { checkInTime: 'desc' },
      });

      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { timezone: true },
      });
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { timezone: true },
      });
      const timezone = branch?.timezone || org?.timezone || 'UTC';
      const todayStart = this.getLocalMidnightUtc(timezone);

      const totalToday = await tx.attendanceRecord.count({
        where: {
          organizationId,
          branchId,
          checkInTime: { gte: todayStart },
        },
      });

      return {
        currentCount: activeRecords.length,
        activeSessions: activeRecords.map((r) => this.mapRecordToDto(r)),
        peakTodayCount: Math.max(activeRecords.length, totalToday),
        totalCheckInsToday: totalToday,
      };
    });
  }

  // =========================================================================
  // 4B. ATTENDANCE HISTORY & RECORDS
  // =========================================================================

  async getAttendanceRecords(
    organizationId: string,
    query: AttendanceHistoryQueryInput,
    user?: AuthenticatedUserContext,
  ): Promise<PaginatedResult<AttendanceRecordData>> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const where: Prisma.AttendanceRecordWhereInput = {
        organizationId,
      };

      if (
        user &&
        (user.role === UserRole.RECEPTIONIST || user.role === UserRole.TRAINER)
      ) {
        const userAssignments = await tx.branchStaffAssignment.findMany({
          where: {
            organizationId,
            organizationUser: { userId: user.id },
            status: 'ACTIVE',
          },
          select: { branchId: true },
        });

        const assignedBranchIds = userAssignments.map((a) => a.branchId);
        if (query.branchId && !assignedBranchIds.includes(query.branchId)) {
          throw new ForbiddenException('You do not have access to this branch');
        }

        where.branchId = query.branchId ? query.branchId : { in: assignedBranchIds };
      } else if (query.branchId) {
        where.branchId = query.branchId;
      }

      if (query.memberId) {
        where.memberId = query.memberId;
      }

      if (query.status) {
        where.status = query.status as AttendanceStatus;
      }

      if (query.method) {
        where.method = query.method as AttendanceMethod;
      }

      if (query.startDate || query.endDate) {
        where.checkInTime = {};
        if (query.startDate) {
          where.checkInTime.gte = new Date(`${query.startDate}T00:00:00.000Z`);
        }
        if (query.endDate) {
          where.checkInTime.lte = new Date(`${query.endDate}T23:59:59.999Z`);
        }
      }

      if (query.search && query.search.trim()) {
        const term = query.search.trim();
        where.OR = [
          { member: { firstName: { contains: term, mode: 'insensitive' } } },
          { member: { lastName: { contains: term, mode: 'insensitive' } } },
          { member: { memberNumber: { contains: term, mode: 'insensitive' } } },
          { member: { phone: { contains: term, mode: 'insensitive' } } },
        ];
      }

      const page = Math.max(1, query.page || 1);
      const limit = Math.min(100, Math.max(1, query.limit || 20));
      const skip = (page - 1) * limit;

      const sortBy = query.sortBy || 'checkInTime';
      const sortOrder = query.sortOrder || 'desc';

      const [total, records] = await Promise.all([
        tx.attendanceRecord.count({ where }),
        tx.attendanceRecord.findMany({
          where,
          include: {
            branch: { select: { id: true, name: true } },
            member: {
              select: {
                id: true,
                memberNumber: true,
                firstName: true,
                lastName: true,
                phone: true,
                profilePhotoKey: true,
              },
            },
            membership: {
              select: {
                id: true,
                plan: { select: { name: true } },
              },
            },
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit,
        }),
      ]);

      const mapped = records.map((r) => this.mapRecordToDto(r));
      const totalPages = Math.ceil(total / limit) || 1;
      return {
        items: mapped,
        data: mapped,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      } as any;
    });
  }

  // =========================================================================
  // 5. MEMBER ACCESS PASS MANAGEMENT
  // =========================================================================

  async issuePass(
    organizationId: string,
    memberId: string,
    generatePhysicalBadge = false,
  ): Promise<{ pass: MemberAccessPassData; rawPhysicalPasscode?: string }> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.member.findUnique({
        where: { id: memberId },
      });

      if (!member || member.organizationId !== organizationId) {
        throw new NotFoundException('Member not found');
      }

      const creds = await this.qrTokenService.generatePassCredentials(
        organizationId,
        generatePhysicalBadge,
      );

      const existing = await tx.memberAccessPass.findUnique({
        where: { memberId },
      });

      let pass: any;
      if (existing) {
        pass = await tx.memberAccessPass.update({
          where: { id: existing.id },
          data: {
            hmacSecretEncrypted: creds.hmacSecretEncrypted,
            status: PassStatus.ACTIVE,
            passCodeHash: creds.passCodeHash ?? existing.passCodeHash,
            passCodeSalt: creds.passCodeSalt ?? existing.passCodeSalt,
            passCodeMasked: creds.passCodeMasked ?? existing.passCodeMasked,
            revokedAt: null,
            revokedById: null,
            revocationReason: null,
          },
        });
      } else {
        pass = await tx.memberAccessPass.create({
          data: {
            organizationId,
            memberId,
            hmacSecretEncrypted: creds.hmacSecretEncrypted,
            status: PassStatus.ACTIVE,
            passCodeHash: creds.passCodeHash,
            passCodeSalt: creds.passCodeSalt,
            passCodeMasked: creds.passCodeMasked,
          },
        });
      }

      return {
        pass: this.mapPassToDto(pass),
        rawPhysicalPasscode: creds.rawPhysicalPasscode,
      };
    });
  }

  async revokePass(
    organizationId: string,
    passId: string,
    reason: string,
    user: AuthenticatedUserContext,
  ): Promise<MemberAccessPassData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const pass = await tx.memberAccessPass.findUnique({
        where: { id: passId },
      });

      if (!pass || pass.organizationId !== organizationId) {
        throw new NotFoundException('Access pass not found');
      }

      const updated = await tx.memberAccessPass.update({
        where: { id: passId },
        data: {
          status: PassStatus.REVOKED,
          revokedAt: new Date(),
          revokedById: user.id,
          revocationReason: reason,
        },
      });

      return this.mapPassToDto(updated);
    });
  }

  async getMemberPass(
    organizationId: string,
    memberId: string,
  ): Promise<MemberAccessPassData | null> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const pass = await tx.memberAccessPass.findUnique({
        where: { memberId },
      });

      if (!pass || pass.organizationId !== organizationId) {
        return null;
      }

      return this.mapPassToDto(pass);
    });
  }

  async generateDynamicPassToken(
    organizationId: string,
    memberId: string,
  ): Promise<DynamicPassTokenResponse> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const pass = await tx.memberAccessPass.findUnique({
        where: { memberId },
      });

      if (!pass || pass.organizationId !== organizationId) {
        throw new NotFoundException('Member access pass not found');
      }

      if (pass.status !== PassStatus.ACTIVE) {
        throw new ForbiddenException({
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: `Access pass is ${pass.status.toLowerCase()}`,
          code: pass.status === 'SUSPENDED' ? 'PASS_SUSPENDED' : 'PASS_REVOKED',
        });
      }

      const rawSecret = this.qrTokenService.decryptSigningSecret(
        pass.hmacSecretEncrypted,
      );

      const dynamicToken = this.qrTokenService.generateDynamicToken(
        memberId,
        organizationId,
        pass.id,
        rawSecret,
      );

      return {
        token: dynamicToken.token,
        expiresAt: dynamicToken.expiresAt,
        refreshIntervalSeconds: dynamicToken.refreshIntervalSeconds,
      };
    });
  }

  async revokePassByMemberId(
    organizationId: string,
    memberId: string,
    reason: string,
    user: AuthenticatedUserContext,
    issueReplacement = false,
  ): Promise<MemberAccessPassData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const pass = await tx.memberAccessPass.findUnique({
        where: { memberId },
      });

      if (!pass || pass.organizationId !== organizationId) {
        throw new NotFoundException('Member access pass not found');
      }

      const revoked = await this.revokePass(organizationId, pass.id, reason, user);

      if (issueReplacement) {
        await this.issuePass(organizationId, memberId, false);
      }

      return revoked;
    });
  }

  async generateSignedWebPassToken(
    organizationId: string,
    memberId: string,
  ): Promise<{ passToken: string; webPassUrl: string }> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      let pass = await tx.memberAccessPass.findUnique({
        where: { memberId },
      });

      if (!pass || pass.organizationId !== organizationId) {
        const issued = await this.issuePass(organizationId, memberId, false);
        pass = await tx.memberAccessPass.findUnique({
          where: { id: issued.pass.id },
        });
      }

      if (!pass || pass.status !== PassStatus.ACTIVE) {
        throw new ForbiddenException('Member access pass is not active');
      }

      const passToken = this.envelopeEncryptionService.signWebPassToken({
        orgId: organizationId,
        memberId,
        passId: pass.id,
      });

      return {
        passToken,
        webPassUrl: `/p/${passToken}`,
      };
    });
  }

  async resolvePublicWebPass(passToken: string): Promise<PublicPassResponse> {
    let tokenPayload: { orgId: string; memberId: string; passId: string };
    try {
      tokenPayload = this.envelopeEncryptionService.verifyWebPassToken(passToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired web pass token');
    }

    const { orgId, memberId, passId } = tokenPayload;

    return this.prisma.withTenantContext(orgId, async (tx) => {
      const pass = await tx.memberAccessPass.findUnique({
        where: { id: passId },
      });

      if (!pass || pass.organizationId !== orgId || pass.memberId !== memberId) {
        throw new NotFoundException('Access pass not found');
      }

      if (pass.status !== PassStatus.ACTIVE) {
        throw new ForbiddenException({
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: `Access pass is ${pass.status.toLowerCase()}`,
          code: pass.status === 'SUSPENDED' ? 'PASS_SUSPENDED' : 'PASS_REVOKED',
        });
      }

      const member = await tx.member.findUnique({
        where: { id: memberId },
        select: {
          firstName: true,
          memberNumber: true,
          profilePhotoKey: true,
        },
      });

      if (!member) {
        throw new NotFoundException('Member not found');
      }

      const rawSecret = this.qrTokenService.decryptSigningSecret(
        pass.hmacSecretEncrypted,
      );

      const dynamicToken = this.qrTokenService.generateDynamicToken(
        memberId,
        orgId,
        pass.id,
        rawSecret,
      );

      return {
        member: {
          firstName: member.firstName,
          memberNumber: member.memberNumber,
          photoUrl: member.profilePhotoKey,
        },
        pass: {
          status: pass.status as any,
          passCodeMasked: pass.passCodeMasked,
        },
        dynamicToken: {
          token: dynamicToken.token,
          expiresAt: dynamicToken.expiresAt,
          refreshIntervalSeconds: dynamicToken.refreshIntervalSeconds,
        },
      };
    });
  }

  async refreshPublicWebPass(
    passToken: string,
    clientIp?: string,
  ): Promise<{ dynamicToken: DynamicPassTokenResponse }> {
    let tokenPayload: { orgId: string; memberId: string; passId: string };
    try {
      tokenPayload = this.envelopeEncryptionService.verifyWebPassToken(passToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired web pass token');
    }

    const { orgId, memberId, passId } = tokenPayload;

    const rateLimitKey = `webpass:refresh:${passId}${clientIp ? `:${clientIp}` : ''}`;
    const count = await this.redisService.incrementRateLimit(rateLimitKey, 60);
    if (count > 10) {
      throw new HttpException(
        'Too many pass refresh requests. Please wait before retrying.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return this.prisma.withTenantContext(orgId, async (tx) => {
      const pass = await tx.memberAccessPass.findUnique({
        where: { id: passId },
      });

      if (!pass || pass.organizationId !== orgId || pass.memberId !== memberId) {
        throw new NotFoundException('Access pass not found');
      }

      if (pass.status !== PassStatus.ACTIVE) {
        throw new ForbiddenException({
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: `Access pass is ${pass.status.toLowerCase()}`,
          code: pass.status === 'SUSPENDED' ? 'PASS_SUSPENDED' : 'PASS_REVOKED',
        });
      }

      const rawSecret = this.qrTokenService.decryptSigningSecret(
        pass.hmacSecretEncrypted,
      );

      const dynamicToken = this.qrTokenService.generateDynamicToken(
        memberId,
        orgId,
        pass.id,
        rawSecret,
      );

      return {
        dynamicToken: {
          token: dynamicToken.token,
          expiresAt: dynamicToken.expiresAt,
          refreshIntervalSeconds: dynamicToken.refreshIntervalSeconds,
        },
      };
    });
  }

  // =========================================================================
  // 6. PRIVATE INTERNAL VALIDATION HELPERS
  // =========================================================================

  private async resolveMemberAndPass(
    tx: Prisma.TransactionClient,
    organizationId: string,
    dto: CheckInRequest | ManualCheckInRequest,
    branchId: string,
  ): Promise<{
    member: any;
    pass: any | null;
    method: AttendanceMethod;
  }> {
    // Case A: Manual Staff Check-In
    if ('memberId' in dto && dto.memberId) {
      const member = await tx.member.findUnique({
        where: { id: dto.memberId },
      });

      if (!member || member.organizationId !== organizationId) {
        throw new NotFoundException({
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Member not found in current organization',
          code: 'MEMBER_NOT_FOUND',
        });
      }

      const pass = await tx.memberAccessPass.findUnique({
        where: { memberId: member.id },
      });

      if (pass) {
        if (pass.status === PassStatus.REVOKED) {
          throw new ForbiddenException({
            statusCode: HttpStatus.FORBIDDEN,
            error: 'Forbidden',
            message: 'Member access pass has been revoked',
            code: 'PASS_REVOKED',
          });
        }
        if (pass.status === PassStatus.SUSPENDED) {
          throw new ForbiddenException({
            statusCode: HttpStatus.FORBIDDEN,
            error: 'Forbidden',
            message: 'Member access pass is suspended',
            code: 'PASS_SUSPENDED',
          });
        }
      }

      return {
        member,
        pass,
        method: AttendanceMethod.MANUAL_STAFF,
      };
    }

    // Case B: QR Scan / Credential Token Check-In
    const qrRequest = dto as CheckInRequest;
    const rawToken = qrRequest.qrToken?.trim();

    if (!rawToken) {
      throw new BadRequestException('QR token or pass credential is required');
    }

    // Dynamic QR Token (GYMOS:V1:<payload> or v1.<payload>)
    if (rawToken.startsWith('GYMOS:V1:') || rawToken.startsWith('v1.')) {
      // 1. Decode token payload unverified to identify the pass
      const unverified = this.qrTokenService.decodeTokenPayloadUnverified(rawToken);

      // 2. Fetch pass from database
      const pass = await tx.memberAccessPass.findUnique({
        where: { id: unverified.pid },
      });

      if (!pass || pass.organizationId !== organizationId) {
        throw new NotFoundException({
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Access pass not found in organization',
          code: 'PASS_NOT_FOUND',
        });
      }

      if (pass.status === PassStatus.REVOKED) {
        throw new ForbiddenException({
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: 'Access pass has been revoked',
          code: 'PASS_REVOKED',
        });
      }
      if (pass.status === PassStatus.SUSPENDED) {
        throw new ForbiddenException({
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: 'Access pass is suspended',
          code: 'PASS_SUSPENDED',
        });
      }

      // 3. Decrypt HMAC secret & cryptographically verify signature & expiration
      const decryptedSecret = this.qrTokenService.decryptSigningSecret(
        pass.hmacSecretEncrypted,
      );
      const payload = this.qrTokenService.parseAndVerifyDynamicToken(
        rawToken,
        decryptedSecret,
        organizationId,
      );

      // 4. Atomically consume nonce in Redis (replay prevention)
      await this.qrTokenService.verifyAndConsumeNonce(
        organizationId,
        payload.nce,
      );

      // 5. Fetch member
      const member = await tx.member.findUnique({
        where: { id: pass.memberId },
      });

      if (!member || member.organizationId !== organizationId) {
        throw new NotFoundException({
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'Member associated with pass not found',
          code: 'MEMBER_NOT_FOUND',
        });
      }

      return {
        member,
        pass,
        method: qrRequest.method || AttendanceMethod.QR_SCAN,
      };
    }

    // Case C: Physical Badge Passcode / Card
    let cleanCode = rawToken;
    let passIdHint: string | null = null;

    if (rawToken.startsWith('GYMOS:PASS:')) {
      const afterPrefix = rawToken.replace('GYMOS:PASS:', '');
      const colonIndex = afterPrefix.indexOf(':');
      if (colonIndex !== -1) {
        passIdHint = afterPrefix.substring(0, colonIndex);
        cleanCode = afterPrefix.substring(colonIndex + 1);
      } else {
        cleanCode = afterPrefix;
      }
    }

    // Two-tier rate limiting:
    // 1. Terminal / Branch level rate limit (prevents rapid code spraying)
    await this.physicalPasscodeService.checkTerminalRateLimit(
      organizationId,
      branchId,
    );
    // 2. Badge-specific rate limit (prevents targeted brute-force on a single badge)
    // Uses HMAC derived identifier; raw code is NEVER in Redis keys or logs
    await this.physicalPasscodeService.checkBadgeRateLimit(
      organizationId,
      cleanCode,
    );

    let pass: any = null;

    if (passIdHint) {
      pass = await tx.memberAccessPass.findUnique({
        where: { id: passIdHint },
      });
    } else {
      const masked = this.physicalPasscodeService.maskPasscode(cleanCode);
      pass = await tx.memberAccessPass.findFirst({
        where: {
          organizationId,
          passCodeMasked: masked,
        },
      });
    }

    if (
      !pass ||
      pass.organizationId !== organizationId ||
      !pass.passCodeHash ||
      !pass.passCodeSalt
    ) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid badge passcode credential',
        code: 'INVALID_PASSCODE',
      });
    }

    const isValidPasscode = await this.physicalPasscodeService.verifyPasscode(
      cleanCode,
      pass.passCodeHash,
      pass.passCodeSalt,
      organizationId,
    );

    if (!isValidPasscode) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Invalid badge passcode credential',
        code: 'INVALID_PASSCODE',
      });
    }

    // Reset badge-specific rate limit upon successful verification
    await this.physicalPasscodeService.resetBadgeRateLimit(
      organizationId,
      cleanCode,
    );

    if (pass.status === PassStatus.REVOKED) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message: 'Access pass has been revoked',
        code: 'PASS_REVOKED',
      });
    }
    if (pass.status === PassStatus.SUSPENDED) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message: 'Access pass is suspended',
        code: 'PASS_SUSPENDED',
      });
    }

    const member = await tx.member.findUnique({
      where: { id: pass.memberId },
    });

    if (!member || member.organizationId !== organizationId) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        error: 'Not Found',
        message: 'Member associated with badge not found',
        code: 'MEMBER_NOT_FOUND',
      });
    }

    return {
      member,
      pass,
      method: qrRequest.method || AttendanceMethod.RFID_CARD,
    };
  }

  private async validateMembership(
    tx: Prisma.TransactionClient,
    organizationId: string,
    memberId: string,
    branchId: string,
    localDate: string,
  ): Promise<{
    membership: any;
    daysRemaining: number;
  }> {
    const memberships = await tx.memberMembership.findMany({
      where: {
        organizationId,
        memberId,
        status: 'ACTIVE',
      },
      include: {
        plan: {
          include: {
            branchScopes: true,
          },
        },
        freezes: {
          where: { status: 'ACTIVE' },
        },
      },
      orderBy: { endDate: 'desc' },
    });

    if (!memberships || memberships.length === 0) {
      const other = await tx.memberMembership.findFirst({
        where: { organizationId, memberId },
        orderBy: { endDate: 'desc' },
      });
      if (other && other.status === 'EXPIRED') {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: `Membership expired on ${other.endDate.toISOString().slice(0, 10)}`,
          code: 'MEMBERSHIP_EXPIRED',
        });
      }
      if (other && other.status === 'FROZEN') {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Membership is currently frozen',
          code: 'MEMBERSHIP_FROZEN',
        });
      }
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Member has no active membership subscription',
        code: 'NO_ACTIVE_MEMBERSHIP',
      });
    }

    let eligibleMembership: any = null;
    let lastRejection: {
      code: string;
      message: string;
      statusCode?: number;
    } | null = null;

    for (const m of memberships) {
      const startDateStr = m.startDate.toISOString().slice(0, 10);
      const endDateStr = m.endDate.toISOString().slice(0, 10);

      if (localDate < startDateStr) {
        lastRejection = {
          code: 'MEMBERSHIP_NOT_STARTED',
          message: `Membership does not start until ${startDateStr}`,
        };
        continue;
      }

      if (localDate > endDateStr) {
        lastRejection = {
          code: 'MEMBERSHIP_EXPIRED',
          message: `Membership expired on ${endDateStr}`,
        };
        continue;
      }

      const activeFreeze = m.freezes?.[0];
      if (activeFreeze) {
        const fStart = activeFreeze.startDate.toISOString().slice(0, 10);
        const fEnd = activeFreeze.endDate
          ? activeFreeze.endDate.toISOString().slice(0, 10)
          : null;
        if (localDate >= fStart && (!fEnd || localDate <= fEnd)) {
          lastRejection = {
            code: 'MEMBERSHIP_FROZEN',
            message: `Membership is currently frozen (started ${fStart}${fEnd ? `, until ${fEnd}` : ''})`,
          };
          continue;
        }
      }

      const plan = m.plan;
      if (plan.scope === 'SINGLE_BRANCH') {
        if (m.homeBranchId !== branchId) {
          lastRejection = {
            code: 'BRANCH_ACCESS_DENIED',
            message: 'Membership plan is restricted to home branch only',
            statusCode: HttpStatus.FORBIDDEN,
          };
          continue;
        }
      } else if (plan.scope === 'MULTI_BRANCH') {
        const isHome = m.homeBranchId === branchId;
        const isInScopes = plan.branchScopes.some(
          (b: any) => b.branchId === branchId,
        );
        if (!isHome && !isInScopes) {
          lastRejection = {
            code: 'BRANCH_ACCESS_DENIED',
            message: 'Membership plan is not eligible for this branch',
            statusCode: HttpStatus.FORBIDDEN,
          };
          continue;
        }
      }

      eligibleMembership = m;
      break;
    }

    if (!eligibleMembership) {
      if (lastRejection) {
        if (lastRejection.statusCode === HttpStatus.FORBIDDEN) {
          throw new ForbiddenException({
            statusCode: HttpStatus.FORBIDDEN,
            error: 'Forbidden',
            message: lastRejection.message,
            code: lastRejection.code,
          });
        }
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: lastRejection.message,
          code: lastRejection.code,
        });
      }
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: 'Member has no valid membership for this branch and date',
        code: 'NO_ACTIVE_MEMBERSHIP',
      });
    }

    const endDateStr = eligibleMembership.endDate.toISOString().slice(0, 10);
    const daysRemaining = this.calculateDaysRemaining(endDateStr, localDate);

    return {
      membership: eligibleMembership,
      daysRemaining,
    };
  }

  private async validateFinancialDues(
    tx: Prisma.TransactionClient,
    organizationId: string,
    memberId: string,
    localDate: string,
    settings: AttendanceSettingsData,
  ): Promise<{
    hasDues: boolean;
    overdueAmount: number;
    invoiceNumber?: string;
  } | null> {
    const openInvoices = await tx.invoice.findMany({
      where: {
        organizationId,
        memberId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'] },
        balanceDue: { gt: 0 },
      },
      orderBy: { dueDate: 'asc' },
    });

    if (!openInvoices || openInvoices.length === 0) {
      return null;
    }

    let totalOverdueAmount = 0;
    let oldestOverdueInvoice: (typeof openInvoices)[0] | null = null;
    let maxDaysOverdue = 0;

    for (const inv of openInvoices) {
      const invDueDateStr = inv.dueDate.toISOString().slice(0, 10);
      if (invDueDateStr < localDate || inv.status === 'OVERDUE') {
        const dueAmount = Number(inv.balanceDue);
        totalOverdueAmount += dueAmount;
        if (!oldestOverdueInvoice) {
          oldestOverdueInvoice = inv;
          const diffMs =
            new Date(localDate).getTime() - new Date(invDueDateStr).getTime();
          maxDaysOverdue = Math.max(
            0,
            Math.floor(diffMs / (1000 * 60 * 60 * 24)),
          );
        }
      }
    }

    if (totalOverdueAmount <= 0) {
      return null;
    }

    if (!settings.allowCheckInWithDues) {
      if (maxDaysOverdue > settings.maxOverdueGraceDays) {
        throw new HttpException(
          {
            statusCode: HttpStatus.PAYMENT_REQUIRED,
            error: 'Payment Required',
            message: `Check-in blocked: Member has ₹${totalOverdueAmount.toFixed(2)} in overdue payments (${maxDaysOverdue} days overdue, exceeding grace period of ${settings.maxOverdueGraceDays} days)`,
            code: 'OVERDUE_PAYMENT_BLOCKED',
            overdueAmount: totalOverdueAmount,
            invoiceNumber: oldestOverdueInvoice?.invoiceNumber,
          },
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    return {
      hasDues: true,
      overdueAmount: totalOverdueAmount,
      invoiceNumber: oldestOverdueInvoice?.invoiceNumber,
    };
  }

  private async validateAntiPassback(
    tx: Prisma.TransactionClient,
    organizationId: string,
    memberId: string,
    cooldownMinutes: number,
    now: Date,
  ): Promise<void> {
    const latestRecord = await tx.attendanceRecord.findFirst({
      where: {
        organizationId,
        memberId,
      },
      orderBy: { checkInTime: 'desc' },
    });

    if (!latestRecord) return;

    if (latestRecord.status === AttendanceStatus.CHECKED_IN) {
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: 'Member is already checked in',
        code: 'ALREADY_CHECKED_IN',
      });
    }

    const elapsedMs = now.getTime() - latestRecord.checkInTime.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

    if (elapsedMinutes < cooldownMinutes) {
      const remaining = cooldownMinutes - elapsedMinutes;
      throw new ConflictException({
        statusCode: HttpStatus.CONFLICT,
        error: 'Conflict',
        message: `Anti-passback cooldown active. Please wait ${remaining} minute(s) before checking in again.`,
        code: 'COOLDOWN_ACTIVE',
      });
    }
  }

  // =========================================================================
  // 7. UTILITY & MAPPING METHODS
  // =========================================================================

  private getLocalTimeAndDate(
    date: Date,
    timezone: string,
  ): { localDate: string; localTime: string } {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      });
      const parts = formatter.formatToParts(date);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
      const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
      return {
        localDate: `${y}-${m}-${d}`,
        localTime: `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`,
      };
    } catch {
      return {
        localDate: date.toISOString().slice(0, 10),
        localTime: date.toISOString().slice(11, 16),
      };
    }
  }

  getLocalMidnightUtc(timezone: string, date: Date = new Date()): Date {
    try {
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        timeZoneName: 'longOffset',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = fmt.formatToParts(date);
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      const tzPart =
        parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT';
      let offset = 'Z';
      if (tzPart.startsWith('GMT+') || tzPart.startsWith('GMT-')) {
        offset = tzPart.replace('GMT', '');
      }
      return new Date(`${y}-${m}-${d}T00:00:00.000${offset}`);
    } catch {
      const fallback = new Date(date);
      fallback.setUTCHours(0, 0, 0, 0);
      return fallback;
    }
  }

  isWithinOperatingHours(
    localTime: string,
    start: string,
    end: string,
  ): boolean {
    const s = (start || '00:00').trim();
    const e = (end || '23:59').trim();
    const t = localTime.trim();

    if (s === e) {
      // 24-hour gym operation (e.g. 00:00 to 00:00 or identical boundaries)
      return true;
    }
    if (s < e) {
      return t >= s && t <= e;
    } else {
      // Overnight window (e.g. 20:00 to 04:00)
      return t >= s || t <= e;
    }
  }

  private calculateDaysRemaining(endDate: string, localDate: string): number {
    const end = new Date(endDate);
    const now = new Date(localDate);
    const diffMs = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  private mapRecordToDto(record: any): AttendanceRecordData {
    const toIso = (d: any) =>
      d instanceof Date ? d.toISOString() : typeof d === 'string' ? d : new Date().toISOString();

    return {
      id: record.id,
      organizationId: record.organizationId,
      branchId: record.branchId,
      branchName: record.branch?.name ?? '',
      memberId: record.memberId,
      memberNumber: record.member?.memberNumber ?? '',
      memberName: record.member
        ? `${record.member.firstName} ${record.member.lastName}`
        : '',
      memberPhotoUrl: record.member?.profilePhotoKey ?? null,
      membershipId: record.membershipId ?? null,
      planName: record.membership?.plan?.name ?? null,
      checkInTime: toIso(record.checkInTime),
      checkOutTime: record.checkOutTime
        ? toIso(record.checkOutTime)
        : null,
      durationMinutes: record.durationMinutes ?? null,
      method: record.method as any,
      status: record.status as any,
      verifiedById: record.verifiedById ?? null,
      notes: record.notes ?? null,
      rejectionReason: record.rejectionReason ?? null,
      createdAt: toIso(record.createdAt),
      updatedAt: toIso(record.updatedAt),
    };
  }

  private mapSettingsToDto(settings: any): AttendanceSettingsData {
    const toIso = (d: any) =>
      d instanceof Date ? d.toISOString() : typeof d === 'string' ? d : new Date().toISOString();

    return {
      id: settings.id,
      organizationId: settings.organizationId,
      branchId: settings.branchId ?? null,
      allowCheckInWithDues: settings.allowCheckInWithDues,
      maxOverdueGraceDays: settings.maxOverdueGraceDays,
      cooldownMinutes: settings.cooldownMinutes,
      requireCheckOut: settings.requireCheckOut,
      autoCheckOutHours: settings.autoCheckOutHours,
      operatingHoursStart: settings.operatingHoursStart,
      operatingHoursEnd: settings.operatingHoursEnd,
      allowOffHoursCheckIn: settings.allowOffHoursCheckIn,
      createdAt: toIso(settings.createdAt),
      updatedAt: toIso(settings.updatedAt),
    };
  }

  private mapPassToDto(pass: any): MemberAccessPassData {
    const toIso = (d: any) =>
      d instanceof Date ? d.toISOString() : typeof d === 'string' ? d : new Date().toISOString();

    return {
      id: pass.id,
      organizationId: pass.organizationId,
      memberId: pass.memberId,
      passCodeMasked: pass.passCodeMasked ?? null,
      status: pass.status as any,
      issuedAt: toIso(pass.issuedAt),
      revokedAt: pass.revokedAt ? toIso(pass.revokedAt) : null,
      revocationReason: pass.revocationReason ?? null,
      lastScannedAt: pass.lastScannedAt ? toIso(pass.lastScannedAt) : null,
      lastScannedBranchId: pass.lastScannedBranchId ?? null,
      createdAt: toIso(pass.createdAt),
      updatedAt: toIso(pass.updatedAt),
    };
  }

  // =========================================================================
  // 8. COUNTER KIOSK DAILY QR METHODS
  // =========================================================================

  private getKioskSigningSecret(): string {
    return process.env.JWT_SECRET || 'gymos_kiosk_secret_key_2026';
  }

  private signKioskPayload(payload: { org: string; brn: string; dat: string; exp: number; iat: number }): string {
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.getKioskSigningSecret())
      .update(payloadB64)
      .digest('hex');
    return `${payloadB64}.${signature}`;
  }

  private verifyAndDecodeKioskToken(token: string): { org: string; brn: string; dat: string; exp: number; iat: number } {
    if (!token || typeof token !== 'string') {
      throw new BadRequestException('Kiosk token is required');
    }
    const parts = token.split('.');
    if (parts.length !== 2) {
      throw new BadRequestException('Invalid kiosk token structure');
    }
    const [payloadB64, signature] = parts;
    if (!payloadB64 || !signature) {
      throw new BadRequestException('Invalid kiosk token components');
    }
    const expectedSig = crypto
      .createHmac('sha256', this.getKioskSigningSecret())
      .update(payloadB64)
      .digest('hex');

    if (
      signature.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))
    ) {
      throw new BadRequestException('Invalid or tampered kiosk QR token');
    }

    try {
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
      if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
        throw new BadRequestException('This QR code has expired. Please refresh the gym desk QR.');
      }
      return payload;
    } catch {
      throw new BadRequestException('Corrupted kiosk QR token payload');
    }
  }

  async getKioskDailyToken(
    organizationId: string,
    branchId?: string,
  ): Promise<KioskTokenResponse> {
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }

    const branch = await this.prisma.withSuperAdminContext(async (tx) => {
      if (branchId) {
        return tx.branch.findFirst({
          where: { id: branchId, organizationId },
          include: { organization: true },
        });
      }
      return tx.branch.findFirst({
        where: { organizationId, status: 'ACTIVE' },
        include: { organization: true },
        orderBy: { createdAt: 'asc' },
      });
    });

    if (!branch || branch.status !== 'ACTIVE') {
      throw new NotFoundException('Active branch not found for this gym');
    }

    const resolvedBranchId = branch.id;
    const timezone = branch.timezone || branch.organization?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const { localDate } = this.getLocalTimeAndDate(now, timezone);

    const payload = {
      org: organizationId,
      brn: resolvedBranchId,
      dat: localDate,
      iat: Math.floor(now.getTime() / 1000),
      exp: Math.floor(now.getTime() / 1000) + 86400 * 2, // 48-hour validity buffer
    };

    const kioskToken = this.signKioskPayload(payload);
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const checkInUrl = `${baseUrl.replace(/\/$/, '')}/checkin?token=${encodeURIComponent(kioskToken)}`;

    return {
      kioskToken,
      branchId: resolvedBranchId,
      branchName: branch.name,
      organizationName: branch.organization.name,
      date: localDate,
      checkInUrl,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  }

  async getKioskInfo(kioskToken: string): Promise<KioskInfoResponse> {
    const payload = this.verifyAndDecodeKioskToken(kioskToken);

    const branch = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.branch.findFirst({
        where: { id: payload.brn, organizationId: payload.org },
        include: { organization: true },
      });
    });

    if (!branch || branch.status !== 'ACTIVE') {
      throw new NotFoundException('Branch is not active or not found');
    }

    const timezone = branch.timezone || branch.organization?.timezone || 'Asia/Kolkata';
    const now = new Date();
    const { localDate } = this.getLocalTimeAndDate(now, timezone);

    if (payload.dat !== localDate) {
      throw new BadRequestException("This desk QR code is for a different date. Please scan today's QR code.");
    }

    return {
      valid: true,
      organizationName: branch.organization.name,
      branchName: branch.name,
      date: payload.dat,
    };
  }

  async kioskCheckIn(dto: KioskCheckInInput): Promise<KioskCheckInResponse> {
    const payload = this.verifyAndDecodeKioskToken(dto.kioskToken);
    const { org: organizationId, brn: branchId } = payload;

    const raw = dto.identifier.trim();
    const digitsOnly = raw.replace(/\D/g, '');

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Resolve organization & branch
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        include: { organization: true },
      });

      if (!branch || branch.status !== 'ACTIVE') {
        throw new ForbiddenException('Branch is currently inactive');
      }

      const timezone = branch.timezone || branch.organization.timezone || 'Asia/Kolkata';
      const now = new Date();
      const { localDate, localTime } = this.getLocalTimeAndDate(now, timezone);

      // Verify date matches current local date
      if (payload.dat !== localDate) {
        throw new BadRequestException("This desk QR code has expired. Please scan today's fresh QR code.");
      }

      // 2. Resolve Settings & Operating Hours
      const settings = await this.resolveSettings(tx, organizationId, branchId);
      if (!settings.allowOffHoursCheckIn) {
        const isWithin = this.isWithinOperatingHours(
          localTime,
          settings.operatingHoursStart,
          settings.operatingHoursEnd,
        );
        if (!isWithin) {
          throw new ForbiddenException({
            statusCode: HttpStatus.FORBIDDEN,
            error: 'Forbidden',
            message: `Branch is currently closed. Operating hours: ${settings.operatingHoursStart} - ${settings.operatingHoursEnd}`,
            code: 'OUTSIDE_OPERATING_HOURS',
          });
        }
      }

      // 3. Find Member
      const member = await tx.member.findFirst({
        where: {
          organizationId,
          OR: [
            { phone: raw },
            ...(digitsOnly.length >= 10 ? [{ phone: { endsWith: digitsOnly.slice(-10) } }] : []),
            { memberNumber: { equals: raw, mode: 'insensitive' } },
            ...(raw.length === 36 ? [{ id: raw }] : []),
          ],
        },
        include: { branch: true },
      });

      if (!member) {
        throw new NotFoundException({
          statusCode: HttpStatus.NOT_FOUND,
          error: 'Not Found',
          message: 'No registered member found with this phone number or ID. Please check with the front desk.',
          code: 'MEMBER_NOT_FOUND',
        });
      }

      // 4. Verify Active Status
      if (member.status !== 'ACTIVE') {
        throw new ForbiddenException({
          statusCode: HttpStatus.FORBIDDEN,
          error: 'Forbidden',
          message: `Member profile is ${member.status.toLowerCase()}. Please visit the reception desk.`,
          code: 'MEMBER_INACTIVE',
        });
      }

      // 5. Validate Membership
      const { membership, daysRemaining } = await this.validateMembership(
        tx,
        organizationId,
        member.id,
        branchId,
        localDate,
      );

      // 6. Validate Financial Dues
      await this.validateFinancialDues(
        tx,
        organizationId,
        member.id,
        localDate,
        settings,
      );

      // 7. Validate Anti-Passback & Active Session
      await this.validateAntiPassback(
        tx,
        organizationId,
        member.id,
        settings.cooldownMinutes,
        now,
      );

      // 8. Create Attendance Record
      const record = await tx.attendanceRecord.create({
        data: {
          organizationId,
          branchId,
          memberId: member.id,
          membershipId: membership.id,
          method: AttendanceMethod.KIOSK,
          status: AttendanceStatus.CHECKED_IN,
          checkInTime: now,
          verifiedById: null,
          notes: 'Self-service counter QR check-in',
        },
        include: {
          member: true,
          branch: true,
          membership: { include: { plan: true } },
        },
      });

      // 9. Outbox event
      await tx.attendanceOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: record.id,
          eventType: 'attendance.checked_in',
          payload: {
            attendanceId: record.id,
            memberId: member.id,
            branchId,
            membershipId: membership.id,
            checkInTime: now.toISOString(),
            method: AttendanceMethod.KIOSK,
            verifiedById: null,
          },
          idempotencyKey: `attendance_checkin_${record.id}`,
        },
      });

      return {
        success: true,
        message: `Welcome, ${member.firstName}! Check-in confirmed.`,
        member: {
          id: member.id,
          memberNumber: member.memberNumber,
          firstName: member.firstName,
          lastName: member.lastName,
        },
        membership: {
          planName: membership.plan.name,
          daysRemaining,
        },
        checkInTime: now.toISOString(),
      };
    });
  }
}
