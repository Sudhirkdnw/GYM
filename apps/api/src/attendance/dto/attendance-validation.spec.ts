import {
  checkInSchema,
  manualCheckInSchema,
  checkOutSchema,
  attendanceHistoryQuerySchema,
  updateAttendanceSettingsSchema,
  issueMemberPassSchema,
  revokeMemberPassSchema,
} from '@gymos/validation';

describe('Stage 2.7: Attendance Zod Validation Schemas', () => {
  const validBranchId = '11111111-1111-4111-8111-111111111111';
  const validMemberId = '22222222-2222-4222-8222-222222222222';
  const validAttendanceId = '33333333-3333-4333-8333-333333333333';

  describe('checkInSchema', () => {
    it('should validate a valid QR check-in request with defaults', () => {
      const input = {
        branchId: validBranchId,
        qrToken: 'GYMOS:V1:header.payload.signature',
      };
      const parsed = checkInSchema.parse(input);
      expect(parsed.branchId).toBe(validBranchId);
      expect(parsed.qrToken).toBe(input.qrToken);
      expect(parsed.method).toBe('QR_SCAN');
    });

    it('should allow valid optional method and notes', () => {
      const input = {
        branchId: validBranchId,
        qrToken: 'GYMOS:PASS:A7K9-W3M2-X8P1-Q4V6',
        method: 'KIOSK',
        notes: 'Front-desk kiosk self-scan',
      };
      const parsed = checkInSchema.parse(input);
      expect(parsed.method).toBe('KIOSK');
      expect(parsed.notes).toBe('Front-desk kiosk self-scan');
    });

    it('should reject invalid branchId format', () => {
      expect(() =>
        checkInSchema.parse({
          branchId: 'not-a-uuid',
          qrToken: 'GYMOS:V1:validtoken',
        }),
      ).toThrow();
    });

    it('should reject qrToken shorter than 5 characters', () => {
      expect(() =>
        checkInSchema.parse({
          branchId: validBranchId,
          qrToken: 'abc',
        }),
      ).toThrow();
    });

    it('should reject qrToken exceeding 500 characters', () => {
      expect(() =>
        checkInSchema.parse({
          branchId: validBranchId,
          qrToken: 'a'.repeat(501),
        }),
      ).toThrow();
    });

    it('should reject invalid attendance method enum', () => {
      expect(() =>
        checkInSchema.parse({
          branchId: validBranchId,
          qrToken: 'GYMOS:V1:validtoken',
          method: 'BIOMETRIC_IRIS',
        }),
      ).toThrow();
    });

    it('should reject notes exceeding 255 characters', () => {
      expect(() =>
        checkInSchema.parse({
          branchId: validBranchId,
          qrToken: 'GYMOS:V1:validtoken',
          notes: 'x'.repeat(256),
        }),
      ).toThrow();
    });
  });

  describe('manualCheckInSchema', () => {
    it('should validate valid branchId and memberId', () => {
      const input = {
        branchId: validBranchId,
        memberId: validMemberId,
        notes: 'Forgot physical card',
      };
      const parsed = manualCheckInSchema.parse(input);
      expect(parsed.branchId).toBe(validBranchId);
      expect(parsed.memberId).toBe(validMemberId);
    });

    it('should reject non-UUID memberId', () => {
      expect(() =>
        manualCheckInSchema.parse({
          branchId: validBranchId,
          memberId: 'invalid-id',
        }),
      ).toThrow();
    });
  });

  describe('checkOutSchema', () => {
    it('should validate valid attendanceId', () => {
      const parsed = checkOutSchema.parse({ attendanceId: validAttendanceId });
      expect(parsed.attendanceId).toBe(validAttendanceId);
    });

    it('should reject non-UUID attendanceId', () => {
      expect(() => checkOutSchema.parse({ attendanceId: '123' })).toThrow();
    });
  });

  describe('attendanceHistoryQuerySchema', () => {
    it('should apply defaults for page, limit, sortBy, and sortOrder', () => {
      const parsed = attendanceHistoryQuerySchema.parse({});
      expect(parsed.page).toBe(1);
      expect(parsed.limit).toBe(20);
      expect(parsed.sortBy).toBe('checkInTime');
      expect(parsed.sortOrder).toBe('desc');
    });

    it('should coerce string page and limit correctly', () => {
      const parsed = attendanceHistoryQuerySchema.parse({
        page: '3',
        limit: '50',
      });
      expect(parsed.page).toBe(3);
      expect(parsed.limit).toBe(50);
    });

    it('should reject limit exceeding 100', () => {
      expect(() =>
        attendanceHistoryQuerySchema.parse({
          limit: 101,
        }),
      ).toThrow();
    });

    it('should reject negative page numbers', () => {
      expect(() =>
        attendanceHistoryQuerySchema.parse({
          page: -1,
        }),
      ).toThrow();
    });

    it('should accept valid date filters in YYYY-MM-DD format', () => {
      const parsed = attendanceHistoryQuerySchema.parse({
        startDate: '2026-11-01',
        endDate: '2026-11-20',
      });
      expect(parsed.startDate).toBe('2026-11-01');
      expect(parsed.endDate).toBe('2026-11-20');
    });

    it('should reject malformed date format', () => {
      expect(() =>
        attendanceHistoryQuerySchema.parse({
          startDate: '20-11-2026',
        }),
      ).toThrow();
    });

    it('should validate status and method filters', () => {
      const parsed = attendanceHistoryQuerySchema.parse({
        status: 'CHECKED_IN',
        method: 'QR_SCAN',
      });
      expect(parsed.status).toBe('CHECKED_IN');
      expect(parsed.method).toBe('QR_SCAN');
    });
  });

  describe('updateAttendanceSettingsSchema', () => {
    it('should apply default policies for organization-level settings', () => {
      const parsed = updateAttendanceSettingsSchema.parse({});
      expect(parsed.allowCheckInWithDues).toBe(false);
      expect(parsed.maxOverdueGraceDays).toBe(0);
      expect(parsed.cooldownMinutes).toBe(10);
      expect(parsed.autoCheckOutHours).toBe(3);
      expect(parsed.operatingHoursStart).toBe('05:00');
      expect(parsed.operatingHoursEnd).toBe('23:00');
      expect(parsed.allowOffHoursCheckIn).toBe(false);
    });

    it('should accept valid branch-specific override settings', () => {
      const input = {
        branchId: validBranchId,
        allowCheckInWithDues: true,
        maxOverdueGraceDays: 7,
        cooldownMinutes: 15,
        autoCheckOutHours: 4,
        operatingHoursStart: '06:00',
        operatingHoursEnd: '22:00',
      };
      const parsed = updateAttendanceSettingsSchema.parse(input);
      expect(parsed.branchId).toBe(validBranchId);
      expect(parsed.allowCheckInWithDues).toBe(true);
      expect(parsed.maxOverdueGraceDays).toBe(7);
      expect(parsed.cooldownMinutes).toBe(15);
      expect(parsed.autoCheckOutHours).toBe(4);
    });

    it('should validate operating hours in HH:mm format', () => {
      expect(() =>
        updateAttendanceSettingsSchema.parse({
          operatingHoursStart: '25:00',
        }),
      ).toThrow();

      expect(() =>
        updateAttendanceSettingsSchema.parse({
          operatingHoursEnd: '09:65',
        }),
      ).toThrow();
    });

    it('should reject cooldownMinutes exceeding 120 minutes', () => {
      expect(() =>
        updateAttendanceSettingsSchema.parse({
          cooldownMinutes: 121,
        }),
      ).toThrow();
    });

    it('should reject cooldownMinutes less than 1 minute', () => {
      expect(() =>
        updateAttendanceSettingsSchema.parse({
          cooldownMinutes: 0,
        }),
      ).toThrow();
    });

    it('should reject autoCheckOutHours exceeding 24', () => {
      expect(() =>
        updateAttendanceSettingsSchema.parse({
          autoCheckOutHours: 25,
        }),
      ).toThrow();
    });

    it('should reject maxOverdueGraceDays exceeding 90', () => {
      expect(() =>
        updateAttendanceSettingsSchema.parse({
          maxOverdueGraceDays: 91,
        }),
      ).toThrow();
    });
  });

  describe('issueMemberPassSchema & revokeMemberPassSchema', () => {
    it('should validate pass issuance request with defaults', () => {
      const parsed = issueMemberPassSchema.parse({});
      expect(parsed.generatePhysicalBadge).toBe(false);
    });

    it('should validate pass revocation with valid reason', () => {
      const parsed = revokeMemberPassSchema.parse({
        reason: 'Physical card lost at gym locker',
        issueReplacement: true,
      });
      expect(parsed.reason).toBe('Physical card lost at gym locker');
      expect(parsed.issueReplacement).toBe(true);
    });

    it('should reject revocation reason shorter than 3 characters', () => {
      expect(() =>
        revokeMemberPassSchema.parse({
          reason: 'no',
        }),
      ).toThrow();
    });

    it('should reject revocation reason exceeding 255 characters', () => {
      expect(() =>
        revokeMemberPassSchema.parse({
          reason: 'a'.repeat(256),
        }),
      ).toThrow();
    });
  });
});
