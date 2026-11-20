import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { AttendanceService } from '../src/attendance/attendance.service';
import { QrTokenService } from '../src/attendance/qr-token.service';
import { PhysicalPasscodeService } from '../src/attendance/physical-passcode.service';
import { RedisService } from '../src/common/redis/redis.service';
import {
  UserRole,
  TenantStatus,
  BranchStatus,
  MemberStatus,
  PlanScope,
  PlanStatus,
  MembershipStatus,
  FreezeStatus,
  InvoiceStatus,
  PassStatus,
  AttendanceStatus,
  AttendanceMethod,
  AuthenticatedUserContext,
} from '@gymos/shared-types';

describe('Stage 2.7 Step 4: Real PostgreSQL Attendance Engine Integration Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let attendanceService: AttendanceService;
  let qrTokenService: QrTokenService;
  let physicalPasscodeService: PhysicalPasscodeService;
  let redisService: RedisService;

  // Organizations
  let orgAlphaId: string;
  let orgBetaId: string;

  // Branches
  let branchAlpha1Id: string;
  let branchAlpha2Id: string;
  let branchBeta1Id: string;

  // Staff Contexts
  let staffAlpha1: AuthenticatedUserContext;
  let staffBeta1: AuthenticatedUserContext;

  // Members
  let memberActiveId: string;
  let memberExpiredId: string;
  let memberFrozenId: string;
  let memberSingleBranchId: string;
  let memberDuesId: string;
  let memberBetaId: string;

  // Passes
  let activePass: any;
  let activePassSecret: string;
  let physicalPasscode: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);
    attendanceService = app.get(AttendanceService);
    qrTokenService = app.get(QrTokenService);
    physicalPasscodeService = app.get(PhysicalPasscodeService);
    redisService = app.get(RedisService);

    // =======================================================================
    // SEED DATABASE FOR E2E INTEGRATION
    // =======================================================================

    await prisma.withSuperAdminContext(async (tx) => {
      // 1. Organizations
      const orgAlpha = await tx.organization.create({
        data: {
          name: 'Alpha Fitness Club',
          slug: `alpha-fit-${Date.now()}`,
          status: TenantStatus.ACTIVE,
          timezone: 'UTC',
        },
      });
      orgAlphaId = orgAlpha.id;

      const orgBeta = await tx.organization.create({
        data: {
          name: 'Beta Iron Gym',
          slug: `beta-iron-${Date.now()}`,
          status: TenantStatus.ACTIVE,
          timezone: 'UTC',
        },
      });
      orgBetaId = orgBeta.id;

      // 2. Branches
      const branchAlpha1 = await tx.branch.create({
        data: {
          organizationId: orgAlphaId,
          name: 'Alpha Downtown',
          slug: `alpha-dt-${Date.now()}`,
          branchCode: `ADT${Math.floor(Math.random() * 899 + 100)}`,
          status: BranchStatus.ACTIVE,
          timezone: 'UTC',
        },
      });
      branchAlpha1Id = branchAlpha1.id;

      const branchAlpha2 = await tx.branch.create({
        data: {
          organizationId: orgAlphaId,
          name: 'Alpha Uptown',
          slug: `alpha-up-${Date.now()}`,
          branchCode: `AUP${Math.floor(Math.random() * 899 + 100)}`,
          status: BranchStatus.ACTIVE,
          timezone: 'UTC',
        },
      });
      branchAlpha2Id = branchAlpha2.id;

      const branchBeta1 = await tx.branch.create({
        data: {
          organizationId: orgBetaId,
          name: 'Beta Central',
          slug: `beta-cen-${Date.now()}`,
          branchCode: `BCN${Math.floor(Math.random() * 899 + 100)}`,
          status: BranchStatus.ACTIVE,
          timezone: 'UTC',
        },
      });
      branchBeta1Id = branchBeta1.id;

      // 3. Staff Users & Assignments
      const userAlpha = await tx.user.create({
        data: {
          email: `staff-alpha-${Date.now()}@gymos.test`,
          passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$abcdefg',
          firstName: 'Alpha',
          lastName: 'Staff',
        },
      });
      const orgUserAlpha = await tx.organizationUser.create({
        data: {
          organizationId: orgAlphaId,
          userId: userAlpha.id,
          role: UserRole.RECEPTIONIST,
        },
      });
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlphaId,
          branchId: branchAlpha1Id,
          organizationUserId: orgUserAlpha.id,
          status: 'ACTIVE',
        },
      });
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlphaId,
          branchId: branchAlpha2Id,
          organizationUserId: orgUserAlpha.id,
          status: 'ACTIVE',
        },
      });
      staffAlpha1 = {
        id: userAlpha.id,
        email: userAlpha.email,
        firstName: 'Alpha',
        lastName: 'Staff',
        role: UserRole.RECEPTIONIST,
        organizationId: orgAlphaId,
        isSuperAdmin: false,
      };

      const userBeta = await tx.user.create({
        data: {
          email: `staff-beta-${Date.now()}@gymos.test`,
          passwordHash: '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$abcdefg',
          firstName: 'Beta',
          lastName: 'Staff',
        },
      });
      const orgUserBeta = await tx.organizationUser.create({
        data: {
          organizationId: orgBetaId,
          userId: userBeta.id,
          role: UserRole.RECEPTIONIST,
        },
      });
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgBetaId,
          branchId: branchBeta1Id,
          organizationUserId: orgUserBeta.id,
          status: 'ACTIVE',
        },
      });
      staffBeta1 = {
        id: userBeta.id,
        email: userBeta.email,
        firstName: 'Beta',
        lastName: 'Staff',
        role: UserRole.RECEPTIONIST,
        organizationId: orgBetaId,
        isSuperAdmin: false,
      };
    });

    // Tenant-isolated seeds for Org Alpha (strictly conforms to Zero-Bypass RLS)
    await prisma.withTenantContext(orgAlphaId, async (tx) => {
      // 4. Default Attendance Settings for Org Alpha
      await tx.attendanceSettings.create({
        data: {
          organizationId: orgAlphaId,
          branchId: null,
          allowCheckInWithDues: false,
          maxOverdueGraceDays: 5,
          cooldownMinutes: 10,
          requireCheckOut: false,
          autoCheckOutHours: 3,
          operatingHoursStart: '00:00',
          operatingHoursEnd: '23:59',
          allowOffHoursCheckIn: true,
        },
      });

      // 5. Membership Plans
      const allBranchesPlan = await tx.membershipPlan.create({
        data: {
          organizationId: orgAlphaId,
          name: 'All-Access Annual',
          code: `ALL-${Date.now()}`,
          durationValue: 12,
          price: 15000,
          scope: PlanScope.ALL_BRANCHES,
          status: PlanStatus.ACTIVE,
        },
      });

      const singleBranchPlan = await tx.membershipPlan.create({
        data: {
          organizationId: orgAlphaId,
          name: 'Single Branch Local',
          code: `SGL-${Date.now()}`,
          durationValue: 6,
          price: 8000,
          scope: PlanScope.SINGLE_BRANCH,
          status: PlanStatus.ACTIVE,
        },
      });

      // 6. Members
      const mActive = await tx.member.create({
        data: {
          organizationId: orgAlphaId,
          branchId: branchAlpha1Id,
          memberNumber: `M-ACT-${Date.now().toString().slice(-4)}`,
          firstName: 'Active',
          lastName: 'Member',
          phone: '+919800000001',
          status: MemberStatus.ACTIVE,
        },
      });
      memberActiveId = mActive.id;

      const mExpired = await tx.member.create({
        data: {
          organizationId: orgAlphaId,
          branchId: branchAlpha1Id,
          memberNumber: `M-EXP-${Date.now().toString().slice(-4)}`,
          firstName: 'Expired',
          lastName: 'Member',
          phone: '+919800000002',
          status: MemberStatus.ACTIVE,
        },
      });
      memberExpiredId = mExpired.id;

      const mFrozen = await tx.member.create({
        data: {
          organizationId: orgAlphaId,
          branchId: branchAlpha1Id,
          memberNumber: `M-FRZ-${Date.now().toString().slice(-4)}`,
          firstName: 'Frozen',
          lastName: 'Member',
          phone: '+919800000003',
          status: MemberStatus.ACTIVE,
        },
      });
      memberFrozenId = mFrozen.id;

      const mSingle = await tx.member.create({
        data: {
          organizationId: orgAlphaId,
          branchId: branchAlpha1Id,
          memberNumber: `M-SGL-${Date.now().toString().slice(-4)}`,
          firstName: 'SingleBranch',
          lastName: 'Member',
          phone: '+919800000004',
          status: MemberStatus.ACTIVE,
        },
      });
      memberSingleBranchId = mSingle.id;

      const mDues = await tx.member.create({
        data: {
          organizationId: orgAlphaId,
          branchId: branchAlpha1Id,
          memberNumber: `M-DUE-${Date.now().toString().slice(-4)}`,
          firstName: 'Dues',
          lastName: 'Member',
          phone: '+919800000005',
          status: MemberStatus.ACTIVE,
        },
      });
      memberDuesId = mDues.id;

      // 7. Subscriptions
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);

      const pastStart = new Date('2020-01-01');
      const pastEnd = new Date('2020-12-31');

      await tx.memberMembership.create({
        data: {
          organizationId: orgAlphaId,
          memberId: memberActiveId,
          planId: allBranchesPlan.id,
          homeBranchId: branchAlpha1Id,
          startDate: new Date('2026-01-01'),
          endDate: nextYear,
          originalEndDate: nextYear,
          basePrice: 15000,
          finalPrice: 15000,
          status: MembershipStatus.ACTIVE,
          pricingSnapshot: {},
        },
      });

      await tx.memberMembership.create({
        data: {
          organizationId: orgAlphaId,
          memberId: memberExpiredId,
          planId: allBranchesPlan.id,
          homeBranchId: branchAlpha1Id,
          startDate: pastStart,
          endDate: pastEnd,
          originalEndDate: pastEnd,
          basePrice: 15000,
          finalPrice: 15000,
          status: MembershipStatus.EXPIRED,
          pricingSnapshot: {},
        },
      });

      const frozenSub = await tx.memberMembership.create({
        data: {
          organizationId: orgAlphaId,
          memberId: memberFrozenId,
          planId: allBranchesPlan.id,
          homeBranchId: branchAlpha1Id,
          startDate: new Date('2026-01-01'),
          endDate: nextYear,
          originalEndDate: nextYear,
          basePrice: 15000,
          finalPrice: 15000,
          status: MembershipStatus.FROZEN,
          pricingSnapshot: {},
        },
      });
      await tx.membershipFreeze.create({
        data: {
          organizationId: orgAlphaId,
          membershipId: frozenSub.id,
          startDate: new Date('2026-01-01'),
          endDate: nextYear,
          status: FreezeStatus.ACTIVE,
          frozenBy: staffAlpha1.id,
        },
      });

      await tx.memberMembership.create({
        data: {
          organizationId: orgAlphaId,
          memberId: memberSingleBranchId,
          planId: singleBranchPlan.id,
          homeBranchId: branchAlpha1Id,
          startDate: new Date('2026-01-01'),
          endDate: nextYear,
          originalEndDate: nextYear,
          basePrice: 8000,
          finalPrice: 8000,
          status: MembershipStatus.ACTIVE,
          pricingSnapshot: {},
        },
      });

      await tx.memberMembership.create({
        data: {
          organizationId: orgAlphaId,
          memberId: memberDuesId,
          planId: allBranchesPlan.id,
          homeBranchId: branchAlpha1Id,
          startDate: new Date('2026-01-01'),
          endDate: nextYear,
          originalEndDate: nextYear,
          basePrice: 15000,
          finalPrice: 15000,
          status: MembershipStatus.ACTIVE,
          pricingSnapshot: {},
        },
      });

      // 8. Access Passes
      activePassSecret = crypto.randomBytes(32).toString('hex');
      const encSecret = qrTokenService['envelopeEncryptionService'].encrypt(activePassSecret);

      physicalPasscode = physicalPasscodeService.generatePasscode();
      const pSalt = physicalPasscodeService.generateSalt();
      const pHash = await physicalPasscodeService.hashPasscode(physicalPasscode, pSalt, orgAlphaId);
      const pMasked = physicalPasscodeService.maskPasscode(physicalPasscode);

      activePass = await tx.memberAccessPass.create({
        data: {
          organizationId: orgAlphaId,
          memberId: memberActiveId,
          hmacSecretEncrypted: encSecret,
          passCodeHash: pHash,
          passCodeSalt: pSalt,
          passCodeMasked: pMasked,
          status: PassStatus.ACTIVE,
        },
      });
    });

    // Tenant-isolated seeds for Org Beta
    await prisma.withTenantContext(orgBetaId, async (tx) => {
      const mBeta = await tx.member.create({
        data: {
          organizationId: orgBetaId,
          branchId: branchBeta1Id,
          memberNumber: `M-BET-${Date.now().toString().slice(-4)}`,
          firstName: 'Beta',
          lastName: 'Member',
          phone: '+919800000006',
          status: MemberStatus.ACTIVE,
        },
      });
      memberBetaId = mBeta.id;
    });
  });

  afterAll(async () => {
    // Teardown created test data
    if (orgAlphaId && orgBetaId) {
      await prisma.withTenantContext(orgAlphaId, async (tx) => {
        await tx.attendanceRecord.deleteMany({ where: { organizationId: orgAlphaId } });
        await tx.attendanceOutboxEvent.deleteMany({ where: { organizationId: orgAlphaId } });
        await tx.attendanceSettings.deleteMany({ where: { organizationId: orgAlphaId } });
        await tx.memberAccessPass.deleteMany({ where: { organizationId: orgAlphaId } });
        await tx.invoice.deleteMany({ where: { organizationId: orgAlphaId } });
        await tx.membershipFreeze.deleteMany({ where: { organizationId: orgAlphaId } });
        await tx.memberMembership.deleteMany({ where: { organizationId: orgAlphaId } });
        await tx.membershipPlan.deleteMany({ where: { organizationId: orgAlphaId } });
        await tx.member.deleteMany({ where: { organizationId: orgAlphaId } });
      });

      await prisma.withTenantContext(orgBetaId, async (tx) => {
        await tx.member.deleteMany({ where: { organizationId: orgBetaId } });
      });

      await prisma.withSuperAdminContext(async (tx) => {
        await tx.branchStaffAssignment.deleteMany({
          where: { organizationId: { in: [orgAlphaId, orgBetaId] } },
        });
        await tx.branch.deleteMany({
          where: { organizationId: { in: [orgAlphaId, orgBetaId] } },
        });
        await tx.organizationUser.deleteMany({
          where: { organizationId: { in: [orgAlphaId, orgBetaId] } },
        });
        await tx.organization.deleteMany({
          where: { id: { in: [orgAlphaId, orgBetaId] } },
        });
      });
    }

    await app.close();
  });

  describe('1. Valid Member Check-In & Transactional Consistency', () => {
    let checkedInRecordId: string;

    it('should successfully check in member using dynamic QR token and record outbox event', async () => {
      const dynamicToken = qrTokenService.generateDynamicToken(
        memberActiveId,
        orgAlphaId,
        activePass.id,
        activePassSecret,
      );

      const res = await attendanceService.validateAndCheckIn(
        orgAlphaId,
        branchAlpha1Id,
        { branchId: branchAlpha1Id, qrToken: dynamicToken.token },
        staffAlpha1,
      );

      expect(res.success).toBe(true);
      expect(res.record).toBeDefined();
      expect(res.record?.status).toBe(AttendanceStatus.CHECKED_IN);
      expect(res.member.memberNumber).toContain('M-ACT');
      expect(res.membership?.planName).toBe('All-Access Annual');

      checkedInRecordId = res.record!.id;

      // Verify pass lastScannedAt was updated in real DB
      const updatedPass = await prisma.withTenantContext(orgAlphaId, async (tx) => {
        return tx.memberAccessPass.findUnique({
          where: { id: activePass.id },
        });
      });
      expect(updatedPass?.lastScannedAt).not.toBeNull();
      expect(updatedPass?.lastScannedBranchId).toBe(branchAlpha1Id);

      // Verify outbox event in DB
      const outbox = await prisma.withTenantContext(orgAlphaId, async (tx) => {
        return tx.attendanceOutboxEvent.findFirst({
          where: {
            organizationId: orgAlphaId,
            aggregateId: checkedInRecordId,
            eventType: 'attendance.checked_in',
          },
        });
      });
      expect(outbox).not.toBeNull();
    });

    it('should checkout member cleanly and calculate duration in minutes', async () => {
      const checkoutRes = await attendanceService.checkOut(
        orgAlphaId,
        checkedInRecordId,
        staffAlpha1,
        'Regular departure',
      );

      expect(checkoutRes.success).toBe(true);
      expect(checkoutRes.record.status).toBe(AttendanceStatus.CHECKED_OUT);
      expect(checkoutRes.durationMinutes).toBeGreaterThanOrEqual(1);

      // Verify outbox checkout event
      const outbox = await prisma.withTenantContext(orgAlphaId, async (tx) => {
        return tx.attendanceOutboxEvent.findFirst({
          where: {
            organizationId: orgAlphaId,
            aggregateId: checkedInRecordId,
            eventType: 'attendance.checked_out',
          },
        });
      });
      expect(outbox).not.toBeNull();
    });

    it('should be idempotent: subsequent checkout returns same record without duplicate update', async () => {
      const secondCheckout = await attendanceService.checkOut(
        orgAlphaId,
        checkedInRecordId,
        staffAlpha1,
      );

      expect(secondCheckout.success).toBe(true);
      expect(secondCheckout.record.status).toBe(AttendanceStatus.CHECKED_OUT);
    });
  });

  describe('2. PostgreSQL Partial Unique Index & Concurrency Race Protection', () => {
    it('should handle 10 simultaneous check-ins for the same member: exactly 1 succeeds, 9 fail with 409', async () => {
      // Clear any cooldown for memberActive by setting previous records far in the past
      await prisma.withTenantContext(orgAlphaId, async (tx) => {
        await tx.attendanceRecord.updateMany({
          where: { memberId: memberActiveId },
          data: {
            checkInTime: new Date(Date.now() - 60 * 60 * 1000),
            status: AttendanceStatus.CHECKED_OUT,
          },
        });
      });

      // Prepare 10 concurrent requests
      const promises = Array.from({ length: 10 }).map(async (_, idx) => {
        // Generate distinct fresh dynamic tokens to bypass single-use nonce
        const token = qrTokenService.generateDynamicToken(
          memberActiveId,
          orgAlphaId,
          activePass.id,
          activePassSecret,
        );

        try {
          const res = await attendanceService.validateAndCheckIn(
            orgAlphaId,
            branchAlpha1Id,
            { branchId: branchAlpha1Id, qrToken: token.token, notes: `Concurrent #${idx}` },
            staffAlpha1,
          );
          return { status: 'RESOLVED', res };
        } catch (err: any) {
          return { status: 'REJECTED', code: err.response?.code || err.message };
        }
      });

      const results = await Promise.all(promises);

      const resolved = results.filter((r) => r.status === 'RESOLVED');
      const rejected = results.filter((r) => r.status === 'REJECTED');

      expect(resolved.length).toBe(1);
      expect(rejected.length).toBe(9);
      expect(rejected.every((r) => r.code === 'ALREADY_CHECKED_IN')).toBe(true);

      // Verify DB has strictly ONE active record
      const activeCount = await prisma.withTenantContext(orgAlphaId, async (tx) => {
        return tx.attendanceRecord.count({
          where: {
            organizationId: orgAlphaId,
            memberId: memberActiveId,
            status: AttendanceStatus.CHECKED_IN,
          },
        });
      });
      expect(activeCount).toBe(1);

      // Cleanup: Checkout the active record
      const activeRecord = await prisma.withTenantContext(orgAlphaId, async (tx) => {
        return tx.attendanceRecord.findFirst({
          where: {
            organizationId: orgAlphaId,
            memberId: memberActiveId,
            status: AttendanceStatus.CHECKED_IN,
          },
        });
      });
      if (activeRecord) {
        await attendanceService.checkOut(orgAlphaId, activeRecord.id, staffAlpha1);
      }
    });
  });

  describe('3. Membership & Freeze & Branch Scoping Rules', () => {
    it('should reject check-in for expired membership (MEMBERSHIP_EXPIRED)', async () => {
      await expect(
        attendanceService.validateAndCheckIn(
          orgAlphaId,
          branchAlpha1Id,
          { branchId: branchAlpha1Id, memberId: memberExpiredId },
          staffAlpha1,
        ),
      ).rejects.toThrow(/Membership expired on/);
    });

    it('should reject check-in for frozen membership (MEMBERSHIP_FROZEN)', async () => {
      await expect(
        attendanceService.validateAndCheckIn(
          orgAlphaId,
          branchAlpha1Id,
          { branchId: branchAlpha1Id, memberId: memberFrozenId },
          staffAlpha1,
        ),
      ).rejects.toThrow(/Membership is currently frozen/);
    });

    it('should reject single-branch plan when scanned at an unauthorized branch (BRANCH_ACCESS_DENIED)', async () => {
      // Member has home branch Alpha 1, attempting check-in at Branch Alpha 2
      await expect(
        attendanceService.validateAndCheckIn(
          orgAlphaId,
          branchAlpha2Id,
          { branchId: branchAlpha2Id, memberId: memberSingleBranchId },
          staffAlpha1,
        ),
      ).rejects.toThrow(/restricted to home branch only/);
    });

    it('should accept single-branch plan when scanned at its home branch', async () => {
      const res = await attendanceService.validateAndCheckIn(
        orgAlphaId,
        branchAlpha1Id,
        { branchId: branchAlpha1Id, memberId: memberSingleBranchId },
        staffAlpha1,
      );

      expect(res.success).toBe(true);
      expect(res.membership?.planName).toBe('Single Branch Local');

      // Cleanup
      await attendanceService.checkOut(orgAlphaId, res.record!.id, staffAlpha1);
    });
  });

  describe('4. Financial Overdue Dues Policy Enforcement', () => {
    let overdueInvoiceId: string;

    it('should BLOCK check-in with 402 if overdue amount exceeds grace period and allowCheckInWithDues is false', async () => {
      // Create overdue invoice (30 days overdue > 5 days grace)
      const pastDueDate = new Date();
      pastDueDate.setDate(pastDueDate.getDate() - 30);

      const inv = await prisma.withTenantContext(orgAlphaId, async (tx) => {
        return tx.invoice.create({
          data: {
            organizationId: orgAlphaId,
            branchId: branchAlpha1Id,
            memberId: memberDuesId,
            invoiceNumber: `INV-${Date.now()}`,
            financialYear: '2026-2027',
            sequenceNumber: Math.floor(Math.random() * 9000 + 1000),
            issueDate: new Date('2026-01-01'),
            dueDate: pastDueDate,
            subtotal: 2500,
            taxableAmount: 2500,
            totalAmount: 2500,
            balanceDue: 2500,
            status: InvoiceStatus.OVERDUE,
            supplierSnapshot: {},
            customerSnapshot: {},
            taxSnapshot: {},
            placeOfSupply: '07',
            createdById: staffAlpha1.id,
          },
        });
      });
      overdueInvoiceId = inv.id;

      await expect(
        attendanceService.validateAndCheckIn(
          orgAlphaId,
          branchAlpha1Id,
          { branchId: branchAlpha1Id, memberId: memberDuesId },
          staffAlpha1,
        ),
      ).rejects.toThrow(/Check-in blocked: Member has ₹2500.00 in overdue payments/);
    });

    it('should ALLOW check-in with warning if allowCheckInWithDues is enabled in branch settings', async () => {
      // Create branch override setting with allowCheckInWithDues = true
      await attendanceService.updateAttendanceSettings(orgAlphaId, branchAlpha1Id, {
        allowCheckInWithDues: true,
      });

      const res = await attendanceService.validateAndCheckIn(
        orgAlphaId,
        branchAlpha1Id,
        { branchId: branchAlpha1Id, memberId: memberDuesId },
        staffAlpha1,
      );

      expect(res.success).toBe(true);
      expect(res.duesNotice).toBeDefined();
      expect(res.duesNotice?.hasDues).toBe(true);
      expect(res.duesNotice?.overdueAmount).toBe(2500);

      // Cleanup
      await attendanceService.checkOut(orgAlphaId, res.record!.id, staffAlpha1);
    });

    it('should completely ignore VOID invoices', async () => {
      // Revert branch override
      await attendanceService.updateAttendanceSettings(orgAlphaId, branchAlpha1Id, {
        allowCheckInWithDues: false,
      });

      // Mark the invoice as VOID
      await prisma.withTenantContext(orgAlphaId, async (tx) => {
        await tx.invoice.update({
          where: { id: overdueInvoiceId },
          data: { status: InvoiceStatus.VOID, voidedAt: new Date() },
        });

        // Clear any cooldown
        await tx.attendanceRecord.updateMany({
          where: { memberId: memberDuesId },
          data: { checkInTime: new Date(Date.now() - 60 * 60 * 1000) },
        });
      });

      const res = await attendanceService.validateAndCheckIn(
        orgAlphaId,
        branchAlpha1Id,
        { branchId: branchAlpha1Id, memberId: memberDuesId },
        staffAlpha1,
      );

      expect(res.success).toBe(true);
      expect(res.duesNotice).toBeNull(); // Void invoice ignored

      // Cleanup
      await attendanceService.checkOut(orgAlphaId, res.record!.id, staffAlpha1);
    });
  });

  describe('5. Physical Badge Passcode Verification', () => {
    it('should successfully check in using a physical badge passcode with Argon2id verification', async () => {
      // Clear cooldown for memberActive
      await prisma.withTenantContext(orgAlphaId, async (tx) => {
        await tx.attendanceRecord.updateMany({
          where: { memberId: memberActiveId },
          data: { checkInTime: new Date(Date.now() - 60 * 60 * 1000) },
        });
      });

      const res = await attendanceService.validateAndCheckIn(
        orgAlphaId,
        branchAlpha1Id,
        { branchId: branchAlpha1Id, qrToken: physicalPasscode },
        staffAlpha1,
      );

      expect(res.success).toBe(true);
      expect(res.record?.method).toBe(AttendanceMethod.RFID_CARD);

      // Cleanup
      await attendanceService.checkOut(orgAlphaId, res.record!.id, staffAlpha1);
    });

    it('should reject invalid physical badge passcode (INVALID_PASSCODE)', async () => {
      await expect(
        attendanceService.validateAndCheckIn(
          orgAlphaId,
          branchAlpha1Id,
          { branchId: branchAlpha1Id, qrToken: 'WRONG-PASS-CODE' },
          staffAlpha1,
        ),
      ).rejects.toThrow(/Invalid badge passcode credential/);
    });

    it('should lock out physical badge verification after 5 failed attempts (PASSCODE_RATE_LIMITED) with zero raw code in Redis', async () => {
      const attackingPasscode = 'B3K8-M2P7-W4X9-Q6V1';
      // Attempts 1 to 5: rejected with INVALID_PASSCODE
      for (let i = 1; i <= 5; i++) {
        await expect(
          attendanceService.validateAndCheckIn(
            orgAlphaId,
            branchAlpha1Id,
            { branchId: branchAlpha1Id, qrToken: attackingPasscode },
            staffAlpha1,
          ),
        ).rejects.toThrow(/Invalid badge passcode credential/);
      }

      // 6th attempt: rejected with 429 PASSCODE_RATE_LIMITED
      await expect(
        attendanceService.validateAndCheckIn(
          orgAlphaId,
          branchAlpha1Id,
          { branchId: branchAlpha1Id, qrToken: attackingPasscode },
          staffAlpha1,
        ),
      ).rejects.toMatchObject({
        status: 429,
        response: expect.objectContaining({
          code: 'PASSCODE_RATE_LIMITED',
        }),
      });

      // Verify Redis: raw passcode is NEVER stored in keys
      const client = redisService.getClient();
      const keys = await client.keys('*passcode*');
      expect(keys.length).toBeGreaterThan(0);
      for (const k of keys) {
        expect(k.includes(attackingPasscode)).toBe(false);
        expect(k.includes('B3K8')).toBe(false);
      }

      // Cleanup rate limit
      await physicalPasscodeService.resetBadgeRateLimit(orgAlphaId, attackingPasscode);
    });
  });

  describe('6. Cross-Tenant Isolation & RLS Security', () => {
    it('should reject Org Beta staff from checking in Org Alpha member', async () => {
      await expect(
        attendanceService.validateAndCheckIn(
          orgBetaId,
          branchBeta1Id,
          { branchId: branchBeta1Id, memberId: memberActiveId }, // Member belongs to Alpha, not Beta
          staffBeta1,
        ),
      ).rejects.toThrow(/Member not found in current organization/);
    });

    it('should reject Org Alpha staff from checking in Org Beta member', async () => {
      await expect(
        attendanceService.validateAndCheckIn(
          orgAlphaId,
          branchAlpha1Id,
          { branchId: branchAlpha1Id, memberId: memberBetaId }, // Member belongs to Beta, not Alpha
          staffAlpha1,
        ),
      ).rejects.toThrow(/Member not found in current organization/);
    });

    it('should enforce PostgreSQL RLS: query without tenant context yields 0 attendance records', async () => {
      // Direct raw query without app.current_tenant_id set
      const rows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, organization_id FROM attendance_records WHERE organization_id = '${orgAlphaId}'::uuid`,
      );

      expect(rows.length).toBe(0); // RLS filtered out all rows because session variable was not set
    });
  });

  describe('7. Operating Hours Enforcement in Real DB', () => {
    it('should reject check-in when current local time is outside branch operating hours', async () => {
      // Configure branch Alpha 1 settings with closed hours (e.g. 01:00 to 02:00)
      await prisma.withTenantContext(orgAlphaId, async (tx) => {
        const existing = await tx.attendanceSettings.findFirst({
          where: {
            organizationId: orgAlphaId,
            branchId: branchAlpha1Id,
          },
        });
        if (existing) {
          await tx.attendanceSettings.update({
            where: { id: existing.id },
            data: {
              operatingHoursStart: '01:00',
              operatingHoursEnd: '02:00',
              allowOffHoursCheckIn: false,
            },
          });
        } else {
          await tx.attendanceSettings.create({
            data: {
              organizationId: orgAlphaId,
              branchId: branchAlpha1Id,
              operatingHoursStart: '01:00',
              operatingHoursEnd: '02:00',
              allowOffHoursCheckIn: false,
              allowCheckInWithDues: false,
            },
          });
        }
      });

      const dynamicToken = qrTokenService.generateDynamicToken(
        memberActiveId,
        orgAlphaId,
        activePass.id,
        activePassSecret,
      );

      await expect(
        attendanceService.checkIn(
          orgAlphaId,
          branchAlpha1Id,
          { branchId: branchAlpha1Id, qrToken: dynamicToken.token },
          staffAlpha1,
        ),
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({
          code: 'OUTSIDE_OPERATING_HOURS',
        }),
      });
    });

    it('should permit check-in when allowOffHoursCheckIn is true even if outside hours', async () => {
      await prisma.withTenantContext(orgAlphaId, async (tx) => {
        const existing = await tx.attendanceSettings.findFirst({
          where: {
            organizationId: orgAlphaId,
            branchId: branchAlpha1Id,
          },
        });
        if (existing) {
          await tx.attendanceSettings.update({
            where: { id: existing.id },
            data: {
              allowOffHoursCheckIn: true,
            },
          });
        }
      });

      // Clear cooldown
      await prisma.withTenantContext(orgAlphaId, async (tx) => {
        await tx.attendanceRecord.updateMany({
          where: { memberId: memberActiveId },
          data: { checkInTime: new Date(Date.now() - 60 * 60 * 1000) },
        });
      });

      const dynamicToken = qrTokenService.generateDynamicToken(
        memberActiveId,
        orgAlphaId,
        activePass.id,
        activePassSecret,
      );

      const res = await attendanceService.checkIn(
        orgAlphaId,
        branchAlpha1Id,
        { branchId: branchAlpha1Id, qrToken: dynamicToken.token },
        staffAlpha1,
      );

      expect(res.success).toBe(true);

      // Cleanup
      await attendanceService.checkOut(orgAlphaId, res.record!.id, staffAlpha1);
    });

    it('should admit when operating hours are 24 hours (start === end)', async () => {
      await prisma.withTenantContext(orgAlphaId, async (tx) => {
        const existing = await tx.attendanceSettings.findFirst({
          where: {
            organizationId: orgAlphaId,
            branchId: branchAlpha1Id,
          },
        });
        if (existing) {
          await tx.attendanceSettings.update({
            where: { id: existing.id },
            data: {
              operatingHoursStart: '00:00',
              operatingHoursEnd: '00:00',
              allowOffHoursCheckIn: false,
            },
          });
        }
      });

      // Clear cooldown
      await prisma.withTenantContext(orgAlphaId, async (tx) => {
        await tx.attendanceRecord.updateMany({
          where: { memberId: memberActiveId },
          data: { checkInTime: new Date(Date.now() - 60 * 60 * 1000) },
        });
      });

      const dynamicToken = qrTokenService.generateDynamicToken(
        memberActiveId,
        orgAlphaId,
        activePass.id,
        activePassSecret,
      );

      const res = await attendanceService.checkIn(
        orgAlphaId,
        branchAlpha1Id,
        { branchId: branchAlpha1Id, qrToken: dynamicToken.token },
        staffAlpha1,
      );

      expect(res.success).toBe(true);

      // Cleanup & reset settings back to normal
      await attendanceService.checkOut(orgAlphaId, res.record!.id, staffAlpha1);
      await prisma.withTenantContext(orgAlphaId, async (tx) => {
        await tx.attendanceSettings.deleteMany({
          where: {
            organizationId: orgAlphaId,
            branchId: branchAlpha1Id,
          },
        });
      });
    });
  });
});
