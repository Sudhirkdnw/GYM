import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Response, Request } from 'express';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import {
  AuthenticatedUserContext,
  UserRole,
  PassStatus,
  AttendanceStatus,
} from '@gymos/shared-types';

describe('AttendanceController (Unit)', () => {
  let controller: AttendanceController;
  let attendanceService: Partial<Record<keyof AttendanceService, jest.Mock>>;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockBranchId = '22222222-2222-2222-2222-222222222222';
  const mockMemberId = '33333333-3333-3333-3333-333333333333';
  const mockAttendanceId = '44444444-4444-4444-4444-444444444444';

  const mockUser: AuthenticatedUserContext = {
    id: 'user-receptionist-1',
    email: 'frontdesk@gymos.test',
    firstName: 'Front',
    lastName: 'Desk',
    role: UserRole.RECEPTIONIST,
    organizationId: mockOrgId,
    isSuperAdmin: false,
    permissions: [],
  };

  beforeEach(async () => {
    attendanceService = {
      checkIn: jest.fn(),
      checkOut: jest.fn(),
      getLiveFloorSummary: jest.fn(),
      getAttendanceRecords: jest.fn(),
      getAttendanceSettings: jest.fn(),
      updateAttendanceSettings: jest.fn(),
      issuePass: jest.fn(),
      revokePass: jest.fn(),
      revokePassByMemberId: jest.fn(),
      getMemberPass: jest.fn(),
      generateDynamicPassToken: jest.fn(),
      generateSignedWebPassToken: jest.fn(),
      resolvePublicWebPass: jest.fn(),
      refreshPublicWebPass: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        {
          provide: AttendanceService,
          useValue: attendanceService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AttendanceController>(AttendanceController);
  });

  describe('1. Check-In Endpoints', () => {
    it('scanCheckIn: should delegate check-in to AttendanceService with correct arguments', async () => {
      const dto = {
        branchId: mockBranchId,
        qrToken: 'GYMOS:V1:header.payload.sig',
        method: 'QR_SCAN' as const,
        notes: 'Morning session',
      };

      const expectedResponse = {
        success: true,
        member: {
          id: mockMemberId,
          memberNumber: 'M-1001',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+919876543210',
        },
      };

      attendanceService.checkIn!.mockResolvedValue(expectedResponse);

      const result = await controller.scanCheckIn(mockOrgId, mockUser, dto as any);

      expect(attendanceService.checkIn).toHaveBeenCalledWith(
        mockOrgId,
        mockBranchId,
        expect.objectContaining({
          branchId: mockBranchId,
          qrToken: 'GYMOS:V1:header.payload.sig',
          method: 'QR_SCAN',
        }),
        mockUser,
      );
      expect(result).toBe(expectedResponse);
    });

    it('checkInAlias: should delegate check-in via alias /check-in', async () => {
      const dto = {
        branchId: mockBranchId,
        qrToken: 'GYMOS:V1:header.payload.sig',
        method: 'QR_SCAN' as const,
      };

      attendanceService.checkIn!.mockResolvedValue({ success: true });

      const result = await controller.checkInAlias(mockOrgId, mockUser, dto as any);

      expect(attendanceService.checkIn).toHaveBeenCalledWith(
        mockOrgId,
        mockBranchId,
        expect.objectContaining({ qrToken: 'GYMOS:V1:header.payload.sig' }),
        mockUser,
      );
      expect(result).toEqual({ success: true });
    });

    it('manualCheckIn: should route manual staff check-in to service with MANUAL_STAFF method', async () => {
      const dto = {
        branchId: mockBranchId,
        memberId: mockMemberId,
        notes: 'Phone battery died',
      };

      attendanceService.checkIn!.mockResolvedValue({ success: true });

      await controller.manualCheckIn(mockOrgId, mockUser, dto);

      expect(attendanceService.checkIn).toHaveBeenCalledWith(
        mockOrgId,
        mockBranchId,
        {
          branchId: mockBranchId,
          memberId: mockMemberId,
          notes: 'Phone battery died',
        },
        mockUser,
      );
    });

    it('manualCheckInAlias: should route manual check-in via alias /manual-check-in', async () => {
      const dto = {
        branchId: mockBranchId,
        memberId: mockMemberId,
      };

      attendanceService.checkIn!.mockResolvedValue({ success: true });

      await controller.manualCheckInAlias(mockOrgId, mockUser, dto);

      expect(attendanceService.checkIn).toHaveBeenCalledWith(
        mockOrgId,
        mockBranchId,
        expect.objectContaining({ memberId: mockMemberId }),
        mockUser,
      );
    });
  });

  describe('2. Check-Out Endpoints', () => {
    it('checkOutById: should delegate checkout by URL param attendanceId', async () => {
      const expectedResponse = {
        success: true,
        durationMinutes: 65,
        record: { id: mockAttendanceId, status: AttendanceStatus.CHECKED_OUT },
      };

      attendanceService.checkOut!.mockResolvedValue(expectedResponse);

      const result = await controller.checkOutById(
        mockOrgId,
        mockUser,
        mockAttendanceId,
        'Finished workout',
      );

      expect(attendanceService.checkOut).toHaveBeenCalledWith(
        mockOrgId,
        mockAttendanceId,
        mockUser,
        'Finished workout',
      );
      expect(result).toBe(expectedResponse);
    });

    it('checkOutBody: should delegate checkout via body payload', async () => {
      const expectedResponse = {
        success: true,
        durationMinutes: 45,
        record: { id: mockAttendanceId, status: AttendanceStatus.CHECKED_OUT },
      };

      attendanceService.checkOut!.mockResolvedValue(expectedResponse);

      const result = await controller.checkOutBody(mockOrgId, mockUser, {
        attendanceId: mockAttendanceId,
        notes: 'Cardio session done',
      });

      expect(attendanceService.checkOut).toHaveBeenCalledWith(
        mockOrgId,
        mockAttendanceId,
        mockUser,
        'Cardio session done',
      );
      expect(result).toBe(expectedResponse);
    });
  });

  describe('3. Floor Occupancy Endpoints', () => {
    it('getLiveFloor: should query live floor occupancy with branchId from query', async () => {
      const expectedSummary = {
        currentCount: 12,
        activeSessions: [],
        peakTodayCount: 25,
        totalCheckInsToday: 48,
      };

      attendanceService.getLiveFloorSummary!.mockResolvedValue(expectedSummary);

      const result = await controller.getLiveFloor(
        mockOrgId,
        mockUser,
        null,
        mockBranchId,
      );

      expect(attendanceService.getLiveFloorSummary).toHaveBeenCalledWith(
        mockOrgId,
        mockBranchId,
        mockUser,
      );
      expect(result).toBe(expectedSummary);
    });

    it('getLiveFloor: should fallback to BranchContext branchId if query param omitted', async () => {
      attendanceService.getLiveFloorSummary!.mockResolvedValue({ currentCount: 5 });

      await controller.getLiveFloor(
        mockOrgId,
        mockUser,
        { id: mockBranchId } as any,
        undefined,
      );

      expect(attendanceService.getLiveFloorSummary).toHaveBeenCalledWith(
        mockOrgId,
        mockBranchId,
        mockUser,
      );
    });

    it('getLiveFloor: should throw BadRequestException if no branchId can be resolved', async () => {
      await expect(
        controller.getLiveFloor(mockOrgId, mockUser, null, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('getLiveFloorAlias: should query live floor via /live alias', async () => {
      attendanceService.getLiveFloorSummary!.mockResolvedValue({ currentCount: 8 });

      const result = await controller.getLiveFloorAlias(
        mockOrgId,
        mockUser,
        null,
        mockBranchId,
      );

      expect(attendanceService.getLiveFloorSummary).toHaveBeenCalledWith(
        mockOrgId,
        mockBranchId,
        mockUser,
      );
      expect(result).toEqual({ currentCount: 8 });
    });
  });

  describe('4. Attendance History & Records', () => {
    it('getRecords: should query paginated attendance history', async () => {
      const query = {
        page: 1,
        limit: 20,
        branchId: mockBranchId,
        sortBy: 'checkInTime' as const,
        sortOrder: 'desc' as const,
      };

      const expectedResult = {
        items: [],
        data: [],
        meta: {
          total: 0,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      attendanceService.getAttendanceRecords!.mockResolvedValue(expectedResult);

      const result = await controller.getRecords(mockOrgId, mockUser, query);

      expect(attendanceService.getAttendanceRecords).toHaveBeenCalledWith(
        mockOrgId,
        query,
        mockUser,
      );
      expect(result).toBe(expectedResult);
    });

    it('getHistoryAlias: should query records via /history alias', async () => {
      const query = {
        page: 2,
        limit: 10,
        sortBy: 'checkInTime' as const,
        sortOrder: 'asc' as const,
      };

      attendanceService.getAttendanceRecords!.mockResolvedValue({ items: [] });

      await controller.getHistoryAlias(mockOrgId, mockUser, query);

      expect(attendanceService.getAttendanceRecords).toHaveBeenCalledWith(
        mockOrgId,
        query,
        mockUser,
      );
    });
  });

  describe('5. Settings Endpoints', () => {
    it('getSettings: should retrieve settings for branch or organization default', async () => {
      const mockSettings = {
        id: 'settings-1',
        organizationId: mockOrgId,
        branchId: mockBranchId,
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

      attendanceService.getAttendanceSettings!.mockResolvedValue(mockSettings);

      const result = await controller.getSettings(mockOrgId, mockBranchId);

      expect(attendanceService.getAttendanceSettings).toHaveBeenCalledWith(
        mockOrgId,
        mockBranchId,
      );
      expect(result).toBe(mockSettings);
    });

    it('updateSettings: should update settings via PATCH', async () => {
      const dto = {
        branchId: mockBranchId,
        allowCheckInWithDues: true,
        maxOverdueGraceDays: 5,
        cooldownMinutes: 15,
        requireCheckOut: true,
        autoCheckOutHours: 4,
        operatingHoursStart: '06:00',
        operatingHoursEnd: '22:00',
        allowOffHoursCheckIn: false,
      };

      attendanceService.updateAttendanceSettings!.mockResolvedValue({ ...dto, id: 'settings-1' });

      const result = await controller.updateSettings(mockOrgId, dto);

      expect(attendanceService.updateAttendanceSettings).toHaveBeenCalledWith(
        mockOrgId,
        mockBranchId,
        dto,
      );
      expect(result).toEqual(expect.objectContaining({ allowCheckInWithDues: true }));
    });

    it('updateSettingsPut: should update settings via PUT alias', async () => {
      const dto = {
        branchId: null,
        allowCheckInWithDues: false,
        maxOverdueGraceDays: 0,
        cooldownMinutes: 10,
        requireCheckOut: false,
        autoCheckOutHours: 3,
        operatingHoursStart: '05:00',
        operatingHoursEnd: '23:00',
        allowOffHoursCheckIn: false,
      };

      attendanceService.updateAttendanceSettings!.mockResolvedValue({ id: 'settings-org' });

      await controller.updateSettingsPut(mockOrgId, dto);

      expect(attendanceService.updateAttendanceSettings).toHaveBeenCalledWith(
        mockOrgId,
        null,
        dto,
      );
    });
  });

  describe('6. Member Access Pass Endpoints', () => {
    it('issuePassForMember: should issue access pass for member with physical badge flag', async () => {
      const expectedPass = {
        pass: {
          id: 'pass-1',
          organizationId: mockOrgId,
          memberId: mockMemberId,
          status: PassStatus.ACTIVE,
          issuedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        rawPhysicalPasscode: 'A7K9-3M8P-2X5R-Q4V6',
      };

      attendanceService.issuePass!.mockResolvedValue(expectedPass);

      const result = await controller.issuePassForMember(mockOrgId, mockMemberId, {
        generatePhysicalBadge: true,
      });

      expect(attendanceService.issuePass).toHaveBeenCalledWith(
        mockOrgId,
        mockMemberId,
        true,
      );
      expect(result).toBe(expectedPass);
    });

    it('issuePassBody: should issue pass with memberId in body', async () => {
      attendanceService.issuePass!.mockResolvedValue({ pass: { id: 'pass-2' } });

      await controller.issuePassBody(mockOrgId, mockMemberId, {
        generatePhysicalBadge: false,
      });

      expect(attendanceService.issuePass).toHaveBeenCalledWith(
        mockOrgId,
        mockMemberId,
        false,
      );
    });

    it('issuePassBody: should throw BadRequestException if memberId is missing in body', async () => {
      await expect(
        controller.issuePassBody(mockOrgId, '', { generatePhysicalBadge: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('revokePassForMember: should revoke member pass by memberId with reason and replacement flag', async () => {
      attendanceService.revokePassByMemberId!.mockResolvedValue({
        id: 'pass-1',
        status: PassStatus.REVOKED,
      });

      const result = await controller.revokePassForMember(
        mockOrgId,
        mockUser,
        mockMemberId,
        {
          reason: 'Lost phone and badge',
          issueReplacement: true,
        },
      );

      expect(attendanceService.revokePassByMemberId).toHaveBeenCalledWith(
        mockOrgId,
        mockMemberId,
        'Lost phone and badge',
        mockUser,
        true,
      );
      expect(result.status).toBe(PassStatus.REVOKED);
    });

    it('revokePassById: should revoke pass by pass ID', async () => {
      const passId = 'pass-uuid-999';
      attendanceService.revokePass!.mockResolvedValue({
        id: passId,
        status: PassStatus.REVOKED,
      });

      await controller.revokePassById(mockOrgId, mockUser, passId, {
        reason: 'Subscription expired and unrenewed',
        issueReplacement: false,
      });

      expect(attendanceService.revokePass).toHaveBeenCalledWith(
        mockOrgId,
        passId,
        'Subscription expired and unrenewed',
        mockUser,
      );
    });

    it('getMemberPass: should return pass metadata or throw NotFoundException', async () => {
      attendanceService.getMemberPass!.mockResolvedValue({
        id: 'pass-1',
        status: PassStatus.ACTIVE,
      });

      const result = await controller.getMemberPass(mockOrgId, mockMemberId);
      expect(result.id).toBe('pass-1');

      attendanceService.getMemberPass!.mockResolvedValue(null);
      await expect(
        controller.getMemberPass(mockOrgId, 'non-existent-member'),
      ).rejects.toThrow(NotFoundException);
    });

    it('getDynamicToken: should generate fresh dynamic token for member pass', async () => {
      const mockToken = {
        token: 'GYMOS:V1:h.p.s',
        expiresAt: new Date(Date.now() + 90000).toISOString(),
        refreshIntervalSeconds: 45,
      };

      attendanceService.generateDynamicPassToken!.mockResolvedValue(mockToken);

      const result = await controller.getDynamicToken(mockOrgId, mockMemberId);
      expect(attendanceService.generateDynamicPassToken).toHaveBeenCalledWith(
        mockOrgId,
        mockMemberId,
      );
      expect(result).toBe(mockToken);
    });

    it('getWebPassLink: should generate signed web pass link', async () => {
      const mockLink = {
        passToken: 'signed.bearer.token',
        webPassUrl: '/p/signed.bearer.token',
      };

      attendanceService.generateSignedWebPassToken!.mockResolvedValue(mockLink);

      const result = await controller.getWebPassLink(mockOrgId, mockMemberId);
      expect(attendanceService.generateSignedWebPassToken).toHaveBeenCalledWith(
        mockOrgId,
        mockMemberId,
      );
      expect(result).toBe(mockLink);
    });
  });

  describe('7. Public Signed Web Pass Flow', () => {
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockRes = {
        setHeader: jest.fn(),
      };
    });

    it('getPublicPass: should set security headers and return public pass data', async () => {
      const passToken = 'signed.webpass.token';
      const mockPublicData = {
        member: {
          firstName: 'Alice',
          memberNumber: 'M-2002',
          photoUrl: null,
        },
        pass: {
          status: PassStatus.ACTIVE,
          passCodeMasked: 'A7K9-****-****-Q4V6',
        },
        dynamicToken: {
          token: 'GYMOS:V1:h.p.s',
          expiresAt: new Date(Date.now() + 90000).toISOString(),
          refreshIntervalSeconds: 45,
        },
      };

      attendanceService.resolvePublicWebPass!.mockResolvedValue(mockPublicData);

      const result = await controller.getPublicPass(passToken, mockRes as Response);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'no-referrer',
      );
      expect(attendanceService.resolvePublicWebPass).toHaveBeenCalledWith(passToken);
      expect(result).toBe(mockPublicData);
    });

    it('refreshPublicPass: should set security headers, extract client IP and return fresh token', async () => {
      const passToken = 'signed.webpass.token';
      const mockReq = {
        ip: '192.168.1.100',
        headers: {},
      } as Partial<Request>;

      const mockRefreshData = {
        dynamicToken: {
          token: 'GYMOS:V1:h2.p2.s2',
          expiresAt: new Date(Date.now() + 90000).toISOString(),
          refreshIntervalSeconds: 45,
        },
      };

      attendanceService.refreshPublicWebPass!.mockResolvedValue(mockRefreshData);

      const result = await controller.refreshPublicPass(
        passToken,
        mockReq as Request,
        mockRes as Response,
      );

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Referrer-Policy',
        'no-referrer',
      );
      expect(attendanceService.refreshPublicWebPass).toHaveBeenCalledWith(
        passToken,
        '192.168.1.100',
      );
      expect(result).toBe(mockRefreshData);
    });
  });
});
