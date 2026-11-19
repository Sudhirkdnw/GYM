import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AppLoggerService } from '../logging/app-logger.service';
import { MemberNumberService } from './member-number.service';
import {
  CreateMemberInput,
  UpdateMemberInput,
  UpdateMemberStatusInput,
  TransferMemberInput,
  ArchiveMemberInput,
  MemberQueryInput,
} from '@gymos/validation';
import {
  MemberData,
  MemberDetailData,
  MemberTransferData,
  MemberStatus,
  Gender,
  PaginatedResult,
  UserRole,
  AuthenticatedUserContext,
} from '@gymos/shared-types';

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly memberNumberService: MemberNumberService,
    private readonly logger: AppLoggerService,
  ) {}

  private mapMemberToData(
    m: any,
  ): MemberData {
    return {
      id: m.id,
      organizationId: m.organizationId,
      branchId: m.branchId,
      branchName: m.branch?.name,
      userId: m.userId,
      memberNumber: m.memberNumber,
      firstName: m.firstName,
      lastName: m.lastName,
      preferredName: m.preferredName,
      gender: m.gender as Gender | null,
      dateOfBirth: m.dateOfBirth ? m.dateOfBirth.toISOString().split('T')[0] : null,
      email: m.email,
      phone: m.phone,
      addressLine1: m.addressLine1,
      addressLine2: m.addressLine2,
      city: m.city,
      state: m.state,
      country: m.country,
      postalCode: m.postalCode,
      emergencyContactName: m.emergencyContactName,
      emergencyContactPhone: m.emergencyContactPhone,
      emergencyContactRelationship: m.emergencyContactRelationship,
      profilePhotoKey: m.profilePhotoKey,
      notes: m.notes,
      status: m.status as MemberStatus,
      joinedAt: m.joinedAt.toISOString(),
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      archivedAt: m.archivedAt ? m.archivedAt.toISOString() : null,
    };
  }

  private mapMemberToDetailData(
    m: any,
  ): MemberDetailData {
    const base = this.mapMemberToData(m);
    const transfers: MemberTransferData[] = (m.transfers || []).map((t: any) => ({
      id: t.id,
      organizationId: t.organizationId,
      memberId: t.memberId,
      fromBranchId: t.sourceBranchId,
      fromBranchName: t.sourceBranch?.name,
      toBranchId: t.destinationBranchId,
      toBranchName: t.destinationBranch?.name,
      reason: t.reason,
      transferredBy: t.transferredBy,
      transferredAt: t.transferredAt.toISOString(),
    }));

    return {
      ...base,
      transfers,
    };
  }

  /**
   * Registers a new member in the specified organization and branch.
   */
  async createMember(
    organizationId: string,
    branchId: string,
    userId: string,
    dto: CreateMemberInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MemberData> {
    const targetBranchId = dto.branchId || branchId;

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Verify branch exists and is active under this organization
      const branch = await tx.branch.findFirst({
        where: {
          id: targetBranchId,
          organizationId,
          status: 'ACTIVE',
        },
      });

      if (!branch) {
        throw new BadRequestException('Target branch not found or inactive in this organization');
      }

      // 2. Concurrency-safe atomic member number generation
      const memberNumber = await this.memberNumberService.generateMemberNumber(
        organizationId,
        tx,
      );

      // 3. Parse date values
      const dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
      const joinedAt = dto.joinedAt ? new Date(dto.joinedAt) : new Date();

      // 4. Create member record
      const member = await tx.member.create({
        data: {
          organizationId,
          branchId: targetBranchId,
          memberNumber,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          preferredName: dto.preferredName?.trim() || null,
          gender: dto.gender || null,
          dateOfBirth,
          email: dto.email?.trim() || null,
          phone: dto.phone.trim(),
          addressLine1: dto.addressLine1?.trim() || null,
          addressLine2: dto.addressLine2?.trim() || null,
          city: dto.city?.trim() || null,
          state: dto.state?.trim() || null,
          country: dto.country?.trim() || null,
          postalCode: dto.postalCode?.trim() || null,
          emergencyContactName: dto.emergencyContactName?.trim() || null,
          emergencyContactPhone: dto.emergencyContactPhone?.trim() || null,
          emergencyContactRelationship: dto.emergencyContactRelationship?.trim() || null,
          notes: dto.notes?.trim() || null,
          status: MemberStatus.ACTIVE,
          joinedAt,
        },
        include: {
          branch: {
            select: { name: true },
          },
        },
      });

      // 5. Emit audit log
      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'member.created',
        entity: 'member',
        entityId: member.id,
        metadata: {
          memberNumber: member.memberNumber,
          branchId: targetBranchId,
          branchName: branch.name,
          firstName: member.firstName,
          lastName: member.lastName,
          phone: member.phone,
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(
        `Member ${member.memberNumber} (${member.id}) created in org ${organizationId}, branch ${targetBranchId} by user ${userId}`,
        'MembersService',
      );

      return this.mapMemberToData(member);
    });
  }

  /**
   * Retrieves a paginated list of members with filters and search.
   */
  async findMembers(
    organizationId: string,
    query: MemberQueryInput,
    userContext?: AuthenticatedUserContext,
  ): Promise<PaginatedResult<MemberData>> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const where: Prisma.MemberWhereInput = {
        organizationId,
      };

      // Branch filter
      if (query.branchId) {
        where.branchId = query.branchId;
      }

      // Status filter
      if (query.status) {
        where.status = query.status;
      }

      // Staff branch scoping for Trainer / Receptionist
      if (
        userContext &&
        (userContext.role === UserRole.RECEPTIONIST ||
          userContext.role === UserRole.TRAINER)
      ) {
        const userAssignments = await tx.branchStaffAssignment.findMany({
          where: {
            organizationId,
            organizationUser: { userId: userContext.id },
            status: 'ACTIVE',
          },
          select: { branchId: true },
        });

        const assignedBranchIds = userAssignments.map((a) => a.branchId);
        if (query.branchId && !assignedBranchIds.includes(query.branchId)) {
          throw new ForbiddenException('You do not have access to this branch');
        }

        where.branchId = query.branchId ? query.branchId : { in: assignedBranchIds };
      }

      // Search across name, phone, email, member number
      if (query.search && query.search.trim()) {
        const term = query.search.trim();
        where.OR = [
          { firstName: { contains: term, mode: 'insensitive' } },
          { lastName: { contains: term, mode: 'insensitive' } },
          { memberNumber: { contains: term, mode: 'insensitive' } },
          { phone: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
        ];
      }

      const orderBy: Prisma.MemberOrderByWithRelationInput = {};
      const sortField = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'desc';
      orderBy[sortField as keyof Prisma.MemberOrderByWithRelationInput] = sortOrder;

      const [total, members] = await Promise.all([
        tx.member.count({ where }),
        tx.member.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            branch: {
              select: { name: true },
            },
          },
        }),
      ]);

      const items: MemberData[] = members.map((m) => this.mapMemberToData(m));
      const totalPages = Math.ceil(total / limit);

      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    });
  }

  /**
   * Retrieves single member by ID with branch and transfer history.
   */
  async findMemberById(
    organizationId: string,
    memberId: string,
  ): Promise<MemberDetailData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const member = await tx.member.findFirst({
        where: {
          id: memberId,
          organizationId,
        },
        include: {
          branch: {
            select: { name: true },
          },
          transfers: {
            include: {
              sourceBranch: {
                select: { name: true },
              },
              destinationBranch: {
                select: { name: true },
              },
            },
            orderBy: { transferredAt: 'desc' },
          },
        },
      });

      if (!member) {
        throw new NotFoundException(`Member with ID '${memberId}' not found`);
      }

      return this.mapMemberToDetailData(member);
    });
  }

  /**
   * Updates member personal and contact details.
   */
  async updateMember(
    organizationId: string,
    memberId: string,
    userId: string,
    dto: UpdateMemberInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MemberData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.member.findFirst({
        where: { id: memberId, organizationId },
      });

      if (!existing) {
        throw new NotFoundException(`Member with ID '${memberId}' not found`);
      }

      if (existing.status === MemberStatus.ARCHIVED) {
        throw new BadRequestException('Archived members cannot be modified');
      }

      const updateData: Prisma.MemberUpdateInput = {};
      if (dto.firstName !== undefined) updateData.firstName = dto.firstName.trim();
      if (dto.lastName !== undefined) updateData.lastName = dto.lastName.trim();
      if (dto.preferredName !== undefined) updateData.preferredName = dto.preferredName?.trim() || null;
      if (dto.gender !== undefined) updateData.gender = dto.gender || null;
      if (dto.dateOfBirth !== undefined) updateData.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
      if (dto.email !== undefined) updateData.email = dto.email?.trim() || null;
      if (dto.phone !== undefined) updateData.phone = dto.phone.trim();
      if (dto.addressLine1 !== undefined) updateData.addressLine1 = dto.addressLine1?.trim() || null;
      if (dto.addressLine2 !== undefined) updateData.addressLine2 = dto.addressLine2?.trim() || null;
      if (dto.city !== undefined) updateData.city = dto.city?.trim() || null;
      if (dto.state !== undefined) updateData.state = dto.state?.trim() || null;
      if (dto.country !== undefined) updateData.country = dto.country?.trim() || null;
      if (dto.postalCode !== undefined) updateData.postalCode = dto.postalCode?.trim() || null;
      if (dto.emergencyContactName !== undefined) updateData.emergencyContactName = dto.emergencyContactName?.trim() || null;
      if (dto.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = dto.emergencyContactPhone?.trim() || null;
      if (dto.emergencyContactRelationship !== undefined) updateData.emergencyContactRelationship = dto.emergencyContactRelationship?.trim() || null;
      if (dto.notes !== undefined) updateData.notes = dto.notes?.trim() || null;

      const updated = await tx.member.update({
        where: { id: memberId },
        data: updateData,
        include: {
          branch: {
            select: { name: true },
          },
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'member.updated',
        entity: 'member',
        entityId: memberId,
        metadata: {
          memberNumber: updated.memberNumber,
          changes: Object.keys(updateData),
        },
        ipAddress,
        userAgent,
      });

      return this.mapMemberToData(updated);
    });
  }

  /**
   * Updates member lifecycle status (ACTIVE, INACTIVE, SUSPENDED).
   */
  async updateMemberStatus(
    organizationId: string,
    memberId: string,
    userId: string,
    dto: UpdateMemberStatusInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MemberData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.member.findFirst({
        where: { id: memberId, organizationId },
      });

      if (!existing) {
        throw new NotFoundException(`Member with ID '${memberId}' not found`);
      }

      if (existing.status === MemberStatus.ARCHIVED) {
        throw new BadRequestException('Archived status is terminal and cannot be changed');
      }

      if (existing.status === dto.status) {
        throw new BadRequestException(`Member status is already '${dto.status}'`);
      }

      const updateData: Prisma.MemberUpdateInput = {
        status: dto.status,
      };

      if (dto.status === MemberStatus.ARCHIVED) {
        updateData.archivedAt = new Date();
      }

      const updated = await tx.member.update({
        where: { id: memberId },
        data: updateData,
        include: {
          branch: {
            select: { name: true },
          },
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'member.status_changed',
        entity: 'member',
        entityId: memberId,
        metadata: {
          memberNumber: existing.memberNumber,
          previousStatus: existing.status,
          newStatus: dto.status,
          reason: dto.reason || null,
        },
        ipAddress,
        userAgent,
      });

      return this.mapMemberToData(updated);
    });
  }

  /**
   * Transfers a member between branches within the same organization.
   */
  async transferMember(
    organizationId: string,
    memberId: string,
    userId: string,
    dto: TransferMemberInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MemberData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.member.findFirst({
        where: { id: memberId, organizationId },
        include: {
          branch: { select: { id: true, name: true } },
        },
      });

      if (!existing) {
        throw new NotFoundException(`Member with ID '${memberId}' not found`);
      }

      if (existing.status === MemberStatus.ARCHIVED) {
        throw new BadRequestException('Archived members cannot be transferred');
      }

      if (existing.branchId === dto.targetBranchId) {
        throw new BadRequestException('Member is already assigned to this branch');
      }

      const targetBranch = await tx.branch.findFirst({
        where: {
          id: dto.targetBranchId,
          organizationId,
          status: 'ACTIVE',
        },
      });

      if (!targetBranch) {
        throw new BadRequestException('Destination branch not found or inactive in this organization');
      }

      // Record transfer history
      await tx.memberTransfer.create({
        data: {
          organizationId,
          memberId: existing.id,
          sourceBranchId: existing.branchId,
          destinationBranchId: dto.targetBranchId,
          transferredBy: userId,
          reason: dto.reason?.trim() || null,
        },
      });

      // Update member's current branch
      const updated = await tx.member.update({
        where: { id: memberId },
        data: {
          branchId: dto.targetBranchId,
        },
        include: {
          branch: {
            select: { name: true },
          },
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'member.transferred',
        entity: 'member',
        entityId: memberId,
        metadata: {
          memberNumber: existing.memberNumber,
          sourceBranchId: existing.branchId,
          sourceBranchName: existing.branch?.name,
          destinationBranchId: targetBranch.id,
          destinationBranchName: targetBranch.name,
          reason: dto.reason || null,
        },
        ipAddress,
        userAgent,
      });

      return this.mapMemberToData(updated);
    });
  }

  /**
   * Archives a member, setting status to ARCHIVED and recording timestamp.
   */
  async archiveMember(
    organizationId: string,
    memberId: string,
    userId: string,
    dto: ArchiveMemberInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MemberData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.member.findFirst({
        where: { id: memberId, organizationId },
      });

      if (!existing) {
        throw new NotFoundException(`Member with ID '${memberId}' not found`);
      }

      if (existing.status === MemberStatus.ARCHIVED) {
        throw new BadRequestException('Member is already archived');
      }

      const updated = await tx.member.update({
        where: { id: memberId },
        data: {
          status: MemberStatus.ARCHIVED,
          archivedAt: new Date(),
        },
        include: {
          branch: {
            select: { name: true },
          },
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'member.archived',
        entity: 'member',
        entityId: memberId,
        metadata: {
          memberNumber: existing.memberNumber,
          reason: dto.reason || null,
        },
        ipAddress,
        userAgent,
      });

      return this.mapMemberToData(updated);
    });
  }
}
