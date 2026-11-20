import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { PrismaService } from '../database/prisma.service';
import { BranchContextService } from '../common/tenant/branch-context.service';
import { QrTokenService } from './qr-token.service';
import { PhysicalPasscodeService } from './physical-passcode.service';
import {
  AttendanceStatus,
  PassStatus,
  UserRole,
  BranchStatus,
  AuthenticatedUserContext,
} from '@gymos/shared-types';

describe('Stage 2.7 Step 4: AttendanceService & Validation Engine', () => {
  let service: AttendanceService;
  let mockPrisma: any;
  let mockBranchContext: any;
  let mockQrTokenService: any;
  let mockPhysicalPasscodeService: any;

  const orgId = '11111111-1111-1111-1111-111111111111';
  const branchId = '22222222-2222-2222-2222-222222222222';
  const otherBranchId = '22222222-2222-2222-2222-333333333333';
  const memberId = '33333333-3333-3333-3333-333333333333';
  const passId = '44444444-4444-4444-4444-444444444444';
  const staffUserId = '55555555-5555-5555-5555-555555555555';

  const staffUser: AuthenticatedUserContext = {
    id: staffUserId,
    email: 'staff@gymos.com',
    firstName: 'Front',
    lastName: 'Desk',
    role: UserRole.RECEPTIONIST,
    organizationId: orgId,
    isSuperAdmin: false,
  };

  const branchData = {
    id: branchId,
    organizationId: orgId,
    name: 'Downtown Club',
    slug: 'downtown-club',
    branchCode: 'DWT01',
    timezone: 'UTC',
    status: BranchStatus.ACTIVE,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    mockBranchContext = {
      validateBranchAccess: jest.fn().mockResolvedValue(branchData),
    };

    mockQrTokenService = {
      decodeTokenPayloadUnverified: jest.fn().mockReturnValue({
        sub: memberId,
        pid: passId,
        org: orgId,
        nce: 'nonce-1234567890abcdef',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 90,
      }),
      parseAndVerifyDynamicToken: jest.fn().mockReturnValue({
        sub: memberId,
        pid: passId,
        org: orgId,
        nce: 'nonce-1234567890abcdef',
      }),
      verifyAndConsumeNonce: jest.fn().mockResolvedValue(undefined),
      generateDynamicToken: jest.fn().mockReturnValue({
        token: 'GYMOS:V1:valid-token',
        expiresAt: new Date(Date.now() + 90000).toISOString(),
        refreshIntervalSeconds: 45,
      }),
      decryptSigningSecret: jest.fn().mockReturnValue('32-byte-hex-secret'),
      generatePassCredentials: jest.fn().mockResolvedValue({
        hmacSecretEncrypted: 'enc:v1:secret',
      }),
    };

    mockPhysicalPasscodeService = {
      checkRateLimit: jest.fn().mockResolvedValue(undefined),
      resetRateLimit: jest.fn().mockResolvedValue(undefined),
      checkTerminalRateLimit: jest.fn().mockResolvedValue(undefined),
      checkBadgeRateLimit: jest.fn().mockResolvedValue(undefined),
      resetBadgeRateLimit: jest.fn().mockResolvedValue(undefined),
      maskPasscode: jest.fn().mockReturnValue('A7K9-****-****-Q4V6'),
      verifyPasscode: jest.fn().mockResolvedValue(true),
    };

    // Transaction mock
    mockPrisma = {
      withTenantContext: jest.fn().mockImplementation((_tenantId, cb) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BranchContextService, useValue: mockBranchContext },
        { provide: QrTokenService, useValue: mockQrTokenService },
        { provide: PhysicalPasscodeService, useValue: mockPhysicalPasscodeService },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      organization: {
        findUnique: jest.fn().mockResolvedValue({ timezone: 'UTC' }),
      },
      attendanceSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      member: {
        findUnique: jest.fn().mockResolvedValue({
          id: memberId,
          organizationId: orgId,
          memberNumber: 'M-1001',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+919876543210',
          status: 'ACTIVE',
        }),
      },
      memberAccessPass: {
        findUnique: jest.fn().mockResolvedValue({
          id: passId,
          organizationId: orgId,
          memberId,
          status: PassStatus.ACTIVE,
          hmacSecretEncrypted: 'enc:v1:secret',
        }),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      memberMembership: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sub-1',
            organizationId: orgId,
            memberId,
            homeBranchId: branchId,
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            status: 'ACTIVE',
            plan: {
              id: 'plan-1',
              name: 'Annual Gold All-Access',
              scope: 'ALL_BRANCHES',
              branchScopes: [],
            },
            freezes: [],
          },
        ]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      attendanceRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((args) => ({
          id: 'rec-123',
          ...args.data,
          checkInTime: new Date(),
          member: {
            id: memberId,
            memberNumber: 'M-1001',
            firstName: 'John',
            lastName: 'Doe',
            phone: '+919876543210',
          },
          branch: { id: branchId, name: 'Downtown Club' },
          membership: {
            id: 'sub-1',
            plan: { name: 'Annual Gold All-Access' },
          },
        })),
        update: jest.fn().mockImplementation((args) => ({
          id: args.where.id,
          status: args.data.status,
          checkOutTime: args.data.checkOutTime,
          durationMinutes: args.data.durationMinutes,
          checkInTime: new Date(Date.now() - 60 * 60 * 1000),
          member: { memberNumber: 'M-1001', firstName: 'John', lastName: 'Doe' },
        })),
      },
      attendanceOutboxEvent: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
  });

  describe('1. Staff Identity & Branch Authorization', () => {
    it('should reject check-in if user has MEMBER role (not staff)', async () => {
      const memberUser = { ...staffUser, role: UserRole.MEMBER };

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          memberUser as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject check-in if staff is not authorized for branch', async () => {
      mockBranchContext.validateBranchAccess.mockRejectedValueOnce(
        new ForbiddenException('You are not assigned to this branch'),
      );

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Deterministic Settings Resolution', () => {
    it('should prioritize branch settings over organization settings', async () => {
      mockTx.attendanceSettings.findUnique.mockResolvedValueOnce({
        id: 'branch-settings',
        organizationId: orgId,
        branchId,
        allowCheckInWithDues: true,
        maxOverdueGraceDays: 14,
        cooldownMinutes: 5,
        requireCheckOut: true,
        autoCheckOutHours: 4,
        operatingHoursStart: '06:00',
        operatingHoursEnd: '22:00',
        allowOffHoursCheckIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const settings = await service.resolveSettings(mockTx, orgId, branchId);
      expect(settings.cooldownMinutes).toBe(5);
      expect(settings.maxOverdueGraceDays).toBe(14);
      expect(settings.allowCheckInWithDues).toBe(true);
    });

    it('should fall back to organization defaults if branch settings do not exist', async () => {
      mockTx.attendanceSettings.findUnique.mockResolvedValueOnce(null);
      mockTx.attendanceSettings.findFirst.mockResolvedValueOnce({
        id: 'org-settings',
        organizationId: orgId,
        branchId: null,
        allowCheckInWithDues: false,
        maxOverdueGraceDays: 7,
        cooldownMinutes: 15,
        requireCheckOut: false,
        autoCheckOutHours: 3,
        operatingHoursStart: '05:00',
        operatingHoursEnd: '23:00',
        allowOffHoursCheckIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const settings = await service.resolveSettings(mockTx, orgId, branchId);
      expect(settings.cooldownMinutes).toBe(15);
      expect(settings.maxOverdueGraceDays).toBe(7);
      expect(settings.allowCheckInWithDues).toBe(false);
    });

    it('should fall back to system defaults if neither branch nor org settings exist', async () => {
      mockTx.attendanceSettings.findUnique.mockResolvedValueOnce(null);
      mockTx.attendanceSettings.findFirst.mockResolvedValueOnce(null);

      const settings = await service.resolveSettings(mockTx, orgId, branchId);
      expect(settings.cooldownMinutes).toBe(10);
      expect(settings.maxOverdueGraceDays).toBe(0);
      expect(settings.allowCheckInWithDues).toBe(false);
      expect(settings.operatingHoursStart).toBe('05:00');
      expect(settings.operatingHoursEnd).toBe('23:00');
    });
  });

  describe('3. Operating Hours Enforcement', () => {
    describe('isWithinOperatingHours unit logic', () => {
      it('should admit at exact opening boundary (inclusive)', () => {
        expect(service.isWithinOperatingHours('06:00', '06:00', '22:00')).toBe(true);
      });

      it('should admit at exact closing boundary (inclusive)', () => {
        expect(service.isWithinOperatingHours('22:00', '06:00', '22:00')).toBe(true);
      });

      it('should reject one minute before opening boundary', () => {
        expect(service.isWithinOperatingHours('05:59', '06:00', '22:00')).toBe(false);
      });

      it('should reject one minute after closing boundary', () => {
        expect(service.isWithinOperatingHours('22:01', '06:00', '22:00')).toBe(false);
      });

      it('should support overnight operating hours (e.g. 20:00 to 04:00)', () => {
        // Opening boundary
        expect(service.isWithinOperatingHours('20:00', '20:00', '04:00')).toBe(true);
        // Closing boundary
        expect(service.isWithinOperatingHours('04:00', '20:00', '04:00')).toBe(true);
        // Late evening inside
        expect(service.isWithinOperatingHours('23:45', '20:00', '04:00')).toBe(true);
        // Early morning inside
        expect(service.isWithinOperatingHours('02:30', '20:00', '04:00')).toBe(true);
        // Outside before opening
        expect(service.isWithinOperatingHours('19:59', '20:00', '04:00')).toBe(false);
        // Outside after closing
        expect(service.isWithinOperatingHours('04:01', '20:00', '04:00')).toBe(false);
        // Afternoon outside
        expect(service.isWithinOperatingHours('14:00', '20:00', '04:00')).toBe(false);
      });

      it('should treat start === end as 24-hour operation (admit at any time)', () => {
        expect(service.isWithinOperatingHours('00:00', '00:00', '00:00')).toBe(true);
        expect(service.isWithinOperatingHours('12:34', '00:00', '00:00')).toBe(true);
        expect(service.isWithinOperatingHours('23:59', '00:00', '00:00')).toBe(true);
      });
    });

    it('should reject check-in outside operating hours when off-hours not permitted', async () => {
      mockTx.attendanceSettings.findFirst.mockResolvedValueOnce({
        id: 'org-settings',
        organizationId: orgId,
        branchId: null,
        allowCheckInWithDues: false,
        maxOverdueGraceDays: 0,
        cooldownMinutes: 10,
        requireCheckOut: false,
        autoCheckOutHours: 3,
        operatingHoursStart: '01:00',
        operatingHoursEnd: '02:00', // Branch is closed at current time
        allowOffHoursCheckIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({
          code: 'OUTSIDE_OPERATING_HOURS',
        }),
      });
    });

    it('should prioritize branch override settings over organization defaults', async () => {
      // Branch override allows 24-hour checkin
      mockTx.attendanceSettings.findUnique.mockResolvedValueOnce({
        id: 'branch-settings',
        organizationId: orgId,
        branchId,
        allowCheckInWithDues: false,
        maxOverdueGraceDays: 0,
        cooldownMinutes: 10,
        requireCheckOut: false,
        autoCheckOutHours: 3,
        operatingHoursStart: '00:00',
        operatingHoursEnd: '00:00', // 24-hour branch override
        allowOffHoursCheckIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const settings = await service.resolveSettings(mockTx, orgId, branchId);
      expect(settings.id).toBe('branch-settings');
      expect(settings.operatingHoursStart).toBe('00:00');
    });

    it('should format rejection message with branch timezone', async () => {
      mockBranchContext.validateBranchAccess.mockResolvedValueOnce({
        ...branchData,
        timezone: 'Asia/Kolkata',
      });

      mockTx.attendanceSettings.findFirst.mockResolvedValueOnce({
        id: 'org-settings',
        organizationId: orgId,
        branchId: null,
        allowCheckInWithDues: false,
        maxOverdueGraceDays: 0,
        cooldownMinutes: 10,
        requireCheckOut: false,
        autoCheckOutHours: 3,
        operatingHoursStart: '02:00',
        operatingHoursEnd: '03:00', // closed
        allowOffHoursCheckIn: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.checkIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toMatchObject({
        status: 403,
        response: expect.objectContaining({
          code: 'OUTSIDE_OPERATING_HOURS',
          message: expect.stringContaining('(Asia/Kolkata)'),
        }),
      });
    });
  });

  describe('4. Member & Pass Status Validation', () => {
    it('should reject if member is INACTIVE or SUSPENDED', async () => {
      mockTx.member.findUnique.mockResolvedValueOnce({
        id: memberId,
        organizationId: orgId,
        memberNumber: 'M-1001',
        status: 'SUSPENDED',
      });

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if access pass is SUSPENDED', async () => {
      mockTx.memberAccessPass.findUnique.mockResolvedValueOnce({
        id: passId,
        organizationId: orgId,
        memberId,
        status: PassStatus.SUSPENDED,
      });

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject if access pass is REVOKED', async () => {
      mockTx.memberAccessPass.findUnique.mockResolvedValueOnce({
        id: passId,
        organizationId: orgId,
        memberId,
        status: PassStatus.REVOKED,
      });

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Membership & Freeze & Branch Scope Validation', () => {
    it('should reject if member has no active subscription', async () => {
      mockTx.memberMembership.findMany.mockResolvedValueOnce([]);

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if membership has not started yet', async () => {
      mockTx.memberMembership.findMany.mockResolvedValueOnce([
        {
          id: 'sub-future',
          organizationId: orgId,
          memberId,
          startDate: new Date('2030-01-01'), // Future date
          endDate: new Date('2030-12-31'),
          status: 'ACTIVE',
          plan: { scope: 'ALL_BRANCHES', branchScopes: [] },
          freezes: [],
        },
      ]);

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if membership is expired', async () => {
      mockTx.memberMembership.findMany.mockResolvedValueOnce([
        {
          id: 'sub-past',
          organizationId: orgId,
          memberId,
          startDate: new Date('2020-01-01'),
          endDate: new Date('2020-12-31'), // Expired date
          status: 'ACTIVE',
          plan: { scope: 'ALL_BRANCHES', branchScopes: [] },
          freezes: [],
        },
      ]);

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if membership has an active freeze', async () => {
      mockTx.memberMembership.findMany.mockResolvedValueOnce([
        {
          id: 'sub-frozen',
          organizationId: orgId,
          memberId,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'ACTIVE',
          plan: { scope: 'ALL_BRANCHES', branchScopes: [] },
          freezes: [
            {
              id: 'frz-1',
              startDate: new Date('2026-01-01'),
              endDate: new Date('2026-12-31'),
              status: 'ACTIVE',
            },
          ],
        },
      ]);

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if single-branch plan is scanned at a different branch', async () => {
      mockTx.memberMembership.findMany.mockResolvedValueOnce([
        {
          id: 'sub-single',
          organizationId: orgId,
          memberId,
          homeBranchId: otherBranchId, // Home branch is different
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'ACTIVE',
          plan: {
            name: 'Single Branch Plan',
            scope: 'SINGLE_BRANCH',
            branchScopes: [],
          },
          freezes: [],
        },
      ]);

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should accept multi-branch plan if current branch is in plan branch scopes', async () => {
      mockTx.memberMembership.findMany.mockResolvedValueOnce([
        {
          id: 'sub-multi',
          organizationId: orgId,
          memberId,
          homeBranchId: otherBranchId,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          status: 'ACTIVE',
          plan: {
            name: 'Multi-Branch Plan',
            scope: 'MULTI_BRANCH',
            branchScopes: [{ branchId }], // current branch is authorized
          },
          freezes: [],
        },
      ]);

      const res = await service.validateAndCheckIn(
        orgId,
        branchId,
        { branchId, qrToken: 'GYMOS:V1:valid-token' },
        staffUser,
      );

      expect(res.success).toBe(true);
      expect(res.membership?.planName).toBe('Multi-Branch Plan');
    });
  });

  describe('6. Financial Overdue Dues Policy', () => {
    it('should BLOCK check-in with 402 if overdue amount exceeds grace period and allowCheckInWithDues is false', async () => {
      mockTx.attendanceSettings.findFirst.mockResolvedValueOnce({
        id: 'org-settings',
        organizationId: orgId,
        branchId: null,
        allowCheckInWithDues: false,
        maxOverdueGraceDays: 5,
        cooldownMinutes: 10,
        requireCheckOut: false,
        autoCheckOutHours: 3,
        operatingHoursStart: '00:00',
        operatingHoursEnd: '23:59',
        allowOffHoursCheckIn: true,
      });

      mockTx.invoice.findMany.mockResolvedValueOnce([
        {
          id: 'inv-1',
          invoiceNumber: 'INV-2026-0001',
          status: 'OVERDUE',
          dueDate: new Date('2026-01-01'), // 30+ days overdue
          balanceDue: 2500.0,
        },
      ]);

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(HttpException);
    });

    it('should ALLOW WITH WARNING if overdue invoice is within grace period', async () => {
      mockTx.attendanceSettings.findFirst.mockResolvedValueOnce({
        id: 'org-settings',
        organizationId: orgId,
        branchId: null,
        allowCheckInWithDues: false,
        maxOverdueGraceDays: 30, // 30 days grace
        cooldownMinutes: 10,
        requireCheckOut: false,
        autoCheckOutHours: 3,
        operatingHoursStart: '00:00',
        operatingHoursEnd: '23:59',
        allowOffHoursCheckIn: true,
      });

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      mockTx.invoice.findMany.mockResolvedValueOnce([
        {
          id: 'inv-1',
          invoiceNumber: 'INV-2026-0001',
          status: 'OVERDUE',
          dueDate: yesterday, // 1 day overdue <= 30 grace
          balanceDue: 1500.0,
        },
      ]);

      const res = await service.validateAndCheckIn(
        orgId,
        branchId,
        { branchId, qrToken: 'GYMOS:V1:valid-token' },
        staffUser,
      );

      expect(res.success).toBe(true);
      expect(res.duesNotice).toBeDefined();
      expect(res.duesNotice?.hasDues).toBe(true);
      expect(res.duesNotice?.overdueAmount).toBe(1500.0);
    });

    it('should ignore VOID invoices completely', async () => {
      mockTx.invoice.findMany.mockResolvedValueOnce([]); // VOID invoices are filtered out by query

      const res = await service.validateAndCheckIn(
        orgId,
        branchId,
        { branchId, qrToken: 'GYMOS:V1:valid-token' },
        staffUser,
      );

      expect(res.success).toBe(true);
      expect(res.duesNotice).toBeNull();
    });
  });

  describe('7. Anti-Passback Cooldown & Concurrency Protection', () => {
    it('should reject check-in with 409 if member is currently CHECKED_IN', async () => {
      mockTx.attendanceRecord.findFirst.mockResolvedValueOnce({
        id: 'existing-active-session',
        status: AttendanceStatus.CHECKED_IN,
        checkInTime: new Date(),
      });

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject check-in with 409 if scanned within anti-passback cooldown window', async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

      mockTx.attendanceRecord.findFirst.mockResolvedValueOnce({
        id: 'previous-session',
        status: AttendanceStatus.CHECKED_OUT,
        checkInTime: fiveMinutesAgo,
      });

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should catch PostgreSQL unique constraint violation P2002 and translate to 409 Conflict', async () => {
      mockTx.attendanceRecord.create.mockRejectedValueOnce({
        code: 'P2002',
        message: 'Unique constraint failed on idx_attendance_records_active_session',
      });

      await expect(
        service.validateAndCheckIn(
          orgId,
          branchId,
          { branchId, qrToken: 'GYMOS:V1:valid-token' },
          staffUser,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('8. Check-Out Processing', () => {
    it('should successfully check out an active attendance session and compute duration', async () => {
      const checkInTime = new Date(Date.now() - 90 * 60 * 1000); // 90 minutes ago
      mockTx.attendanceRecord.findUnique.mockResolvedValueOnce({
        id: 'rec-123',
        organizationId: orgId,
        status: AttendanceStatus.CHECKED_IN,
        checkInTime,
      });

      const res = await service.checkOut(orgId, 'rec-123', staffUser, 'Left gym');

      expect(res.success).toBe(true);
      expect(res.durationMinutes).toBe(90);
      expect(mockTx.attendanceOutboxEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'attendance.checked_out',
          }),
        }),
      );
    });

    it('should be idempotent: return existing record if already checked out', async () => {
      mockTx.attendanceRecord.findUnique.mockResolvedValueOnce({
        id: 'rec-123',
        organizationId: orgId,
        status: AttendanceStatus.CHECKED_OUT,
        checkInTime: new Date(Date.now() - 60 * 60 * 1000),
        durationMinutes: 60,
      });

      const res = await service.checkOut(orgId, 'rec-123', staffUser);

      expect(res.success).toBe(true);
      expect(res.durationMinutes).toBe(60);
      expect(mockTx.attendanceRecord.update).not.toHaveBeenCalled();
    });
  });
});
