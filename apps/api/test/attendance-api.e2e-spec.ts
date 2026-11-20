import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';
import { TokenService } from '../src/auth/token.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import {
  UserRole,
  UserStatus,
  TenantStatus,
  BranchStatus,
  MemberStatus,
  MembershipStatus,
  PassStatus,
  AttendanceStatus,
} from '@gymos/shared-types';

describe('Stage 2.7 Step 5: Attendance Controller & RBAC Matrix (E2E Integration & Security)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHasher: PasswordHasherService;
  let tokenService: TokenService;

  // Organizations
  let orgAlpha: { id: string; name: string };
  let orgBeta: { id: string; name: string };

  // Users & Tokens
  let ownerAlpha: { id: string; email: string; token: string };
  let receptionistAlpha: { id: string; email: string; token: string };
  let trainerAlpha: { id: string; email: string; token: string };
  let memberUserAlpha: { id: string; email: string; token: string };
  let superAdminUser: { id: string; email: string; token: string };
  let ownerBeta: { id: string; email: string; token: string };

  // Branches
  let branchAlpha1Id: string;
  let branchAlpha2Id: string;
  let branchBeta1Id: string;

  // Member
  let memberAlphaId: string;
  let memberPassAlphaId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.setGlobalPrefix('api');
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    await app.init();

    prisma = app.get(PrismaService);
    passwordHasher = app.get(PasswordHasherService);
    tokenService = app.get(TokenService);

    const defaultPassword = 'SecureAttendancePass2026!';
    const passwordHash = await passwordHasher.hashPassword(defaultPassword);
    const timestamp = Date.now();

    await prisma.withSuperAdminContext(async (tx) => {
      // 1. Org Alpha
      const oAlpha = await tx.organization.create({
        data: {
          name: `Alpha Fitness Att_${timestamp}`,
          slug: `alpha-att-${timestamp}`,
          status: TenantStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      });
      orgAlpha = { id: oAlpha.id, name: oAlpha.name };

      // 2. Org Beta (Isolation tenant)
      const oBeta = await tx.organization.create({
        data: {
          name: `Beta Gyms Att_${timestamp}`,
          slug: `beta-att-${timestamp}`,
          status: TenantStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      });
      orgBeta = { id: oBeta.id, name: oBeta.name };

      // 3. Branches in Alpha
      const bAlpha1 = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Delhi Central',
          slug: `alpha-delhi-${timestamp}`,
          branchCode: `ADC${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          state: '07',
          city: 'New Delhi',
        },
      });
      branchAlpha1Id = bAlpha1.id;

      const bAlpha2 = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Gurgaon Express',
          slug: `alpha-ggn-${timestamp}`,
          branchCode: `AGG${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          state: '06',
          city: 'Gurgaon',
        },
      });
      branchAlpha2Id = bAlpha2.id;

      // 4. Branch in Beta
      const bBeta1 = await tx.branch.create({
        data: {
          organizationId: orgBeta.id,
          name: 'Beta Bandra West',
          slug: `beta-bandra-${timestamp}`,
          branchCode: `BBW${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          state: '27',
          city: 'Mumbai',
        },
      });
      branchBeta1Id = bBeta1.id;

      // 5. Staff Users in Alpha
      // Owner
      const uOwnerAlpha = await tx.user.create({
        data: {
          email: `owner.alpha.${timestamp}@atttest.com`,
          passwordHash,
          firstName: 'Arthur',
          lastName: 'Owner',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uOwnerAlpha.id,
          role: UserRole.GYM_OWNER,
        },
      });
      ownerAlpha = { id: uOwnerAlpha.id, email: uOwnerAlpha.email, token: '' };

      // Receptionist (Assigned to Branch 1 ONLY)
      const uReceptAlpha = await tx.user.create({
        data: {
          email: `recept.alpha.${timestamp}@atttest.com`,
          passwordHash,
          firstName: 'Rachel',
          lastName: 'Receptionist',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouRecept = await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uReceptAlpha.id,
          role: UserRole.RECEPTIONIST,
        },
      });
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          organizationUserId: ouRecept.id,
          status: 'ACTIVE',
        },
      });
      receptionistAlpha = { id: uReceptAlpha.id, email: uReceptAlpha.email, token: '' };

      // Trainer
      const uTrainerAlpha = await tx.user.create({
        data: {
          email: `trainer.alpha.${timestamp}@atttest.com`,
          passwordHash,
          firstName: 'Tom',
          lastName: 'Trainer',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouTrainer = await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uTrainerAlpha.id,
          role: UserRole.TRAINER,
        },
      });
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          organizationUserId: ouTrainer.id,
          status: 'ACTIVE',
        },
      });
      trainerAlpha = { id: uTrainerAlpha.id, email: uTrainerAlpha.email, token: '' };

      // Member User
      const uMemberAlpha = await tx.user.create({
        data: {
          email: `member.alpha.${timestamp}@atttest.com`,
          passwordHash,
          firstName: 'Mani',
          lastName: 'Member',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uMemberAlpha.id,
          role: UserRole.MEMBER,
        },
      });
      memberUserAlpha = { id: uMemberAlpha.id, email: uMemberAlpha.email, token: '' };

      // Super Admin
      const uSuper = await tx.user.create({
        data: {
          email: `super.${timestamp}@atttest.com`,
          passwordHash,
          firstName: 'Super',
          lastName: 'Admin',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      superAdminUser = { id: uSuper.id, email: uSuper.email, token: '' };

      // Owner in Beta
      const uOwnerBeta = await tx.user.create({
        data: {
          email: `owner.beta.${timestamp}@atttest.com`,
          passwordHash,
          firstName: 'Bob',
          lastName: 'OwnerBeta',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: orgBeta.id,
          userId: uOwnerBeta.id,
          role: UserRole.GYM_OWNER,
        },
      });
      ownerBeta = { id: uOwnerBeta.id, email: uOwnerBeta.email, token: '' };

      // 6. Member in Alpha
      const mAlpha = await tx.member.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          memberNumber: `ATT-${timestamp % 10000}-001`,
          firstName: 'Vikram',
          lastName: 'Malhotra',
          phone: `+9198100${timestamp % 100000}`,
          status: MemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
      memberAlphaId = mAlpha.id;

      // Active Membership for Member
      const plan = await tx.membershipPlan.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Annual Pass',
          code: `PLAN-${timestamp}`,
          price: 12000,
          durationValue: 12,
        },
      });

      await tx.memberMembership.create({
        data: {
          organizationId: orgAlpha.id,
          memberId: mAlpha.id,
          planId: plan.id,
          homeBranchId: branchAlpha1Id,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2027-01-01'),
          originalEndDate: new Date('2027-01-01'),
          basePrice: 12000,
          finalPrice: 12000,
          status: MembershipStatus.ACTIVE,
          pricingSnapshot: {},
        },
      });
    });

    // Generate tokens
    const [tOwnerA, tRecepA, tTrainerA, tMemberA, tSuper, tOwnerB] = await Promise.all([
      tokenService.issueTokens(ownerAlpha.id, ownerAlpha.email, false, orgAlpha.id, UserRole.GYM_OWNER),
      tokenService.issueTokens(receptionistAlpha.id, receptionistAlpha.email, false, orgAlpha.id, UserRole.RECEPTIONIST),
      tokenService.issueTokens(trainerAlpha.id, trainerAlpha.email, false, orgAlpha.id, UserRole.TRAINER),
      tokenService.issueTokens(memberUserAlpha.id, memberUserAlpha.email, false, orgAlpha.id, UserRole.MEMBER),
      tokenService.issueTokens(superAdminUser.id, superAdminUser.email, true),
      tokenService.issueTokens(ownerBeta.id, ownerBeta.email, false, orgBeta.id, UserRole.GYM_OWNER),
    ]);

    ownerAlpha.token = tOwnerA.accessToken;
    receptionistAlpha.token = tRecepA.accessToken;
    trainerAlpha.token = tTrainerA.accessToken;
    memberUserAlpha.token = tMemberA.accessToken;
    superAdminUser.token = tSuper.accessToken;
    ownerBeta.token = tOwnerB.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // 1. RBAC PERMISSIONS ENFORCEMENT MATRIX
  // ===========================================================================
  describe('1. RBAC Permissions Enforcement Matrix', () => {
    it('MEMBER role must have ZERO staff attendance permissions (Deny by default 403)', async () => {
      // Check-in
      const resCheckIn = await request(app.getHttpServer())
        .post('/api/v1/attendance/scan')
        .set('Authorization', `Bearer ${memberUserAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          qrToken: 'GYMOS:V1:invalid.token.here',
        });
      expect(resCheckIn.status).toBe(403);

      // Manual check-in
      const resManual = await request(app.getHttpServer())
        .post('/api/v1/attendance/manual')
        .set('Authorization', `Bearer ${memberUserAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlphaId,
        });
      expect(resManual.status).toBe(403);

      // Floor
      const resFloor = await request(app.getHttpServer())
        .get(`/api/v1/attendance/floor?branchId=${branchAlpha1Id}`)
        .set('Authorization', `Bearer ${memberUserAlpha.token}`);
      expect(resFloor.status).toBe(403);

      // Records
      const resRecords = await request(app.getHttpServer())
        .get('/api/v1/attendance/records')
        .set('Authorization', `Bearer ${memberUserAlpha.token}`);
      expect(resRecords.status).toBe(403);

      // Settings
      const resSettings = await request(app.getHttpServer())
        .get('/api/v1/attendance/settings')
        .set('Authorization', `Bearer ${memberUserAlpha.token}`);
      expect(resSettings.status).toBe(403);
    });

    it('TRAINER role can view records & floor occupancy, but cannot check in or manage settings', async () => {
      // Allowed: floor occupancy
      const resFloor = await request(app.getHttpServer())
        .get(`/api/v1/attendance/floor?branchId=${branchAlpha1Id}`)
        .set('Authorization', `Bearer ${trainerAlpha.token}`);
      expect(resFloor.status).toBe(200);

      // Allowed: records query
      const resRecords = await request(app.getHttpServer())
        .get('/api/v1/attendance/records')
        .set('Authorization', `Bearer ${trainerAlpha.token}`);
      expect(resRecords.status).toBe(200);

      // Denied: check-in (403)
      const resCheckIn = await request(app.getHttpServer())
        .post('/api/v1/attendance/scan')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          qrToken: 'GYMOS:V1:dummy.token.payload',
        });
      expect(resCheckIn.status).toBe(403);

      // Denied: settings manage (403)
      const resSettings = await request(app.getHttpServer())
        .patch('/api/v1/attendance/settings')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .send({
          allowCheckInWithDues: true,
        });
      expect(resSettings.status).toBe(403);
    });

    it('RECEPTIONIST role can check in, check out, and issue passes, but CANNOT update settings', async () => {
      // Allowed: settings read
      const resGetSettings = await request(app.getHttpServer())
        .get('/api/v1/attendance/settings')
        .set('Authorization', `Bearer ${receptionistAlpha.token}`);
      expect(resGetSettings.status).toBe(200);

      // Denied: settings update (403)
      const resPatchSettings = await request(app.getHttpServer())
        .patch('/api/v1/attendance/settings')
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({
          allowCheckInWithDues: true,
        });
      expect(resPatchSettings.status).toBe(403);
    });

    it('SUPER_ADMIN has zero tenant attendance permissions (403 Denied)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/attendance/records')
        .set('Authorization', `Bearer ${superAdminUser.token}`);
      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // 2. TENANT & BRANCH ISOLATION
  // ===========================================================================
  describe('2. Multi-Tenant Boundary & Branch Scoping', () => {
    it('Org Beta owner cannot query attendance records of Org Alpha', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/attendance/records?branchId=${branchAlpha1Id}`)
        .set('Authorization', `Bearer ${ownerBeta.token}`);
      // Since branchAlpha1Id does not belong to Org Beta, it returns 0 items for Beta
      expect(res.status).toBe(200);
      const body = res.body.data || res.body;
      expect(body.items.length).toBe(0);
      expect(branchBeta1Id).toBeDefined();
    });

    it('Receptionist assigned to Branch 1 cannot query live floor of Branch 2 (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/attendance/floor?branchId=${branchAlpha2Id}`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`);
      expect(res.status).toBe(403);
    });
  });

  // ===========================================================================
  // 3. PASS ISSUANCE, WEB PASS FLOW & DYNAMIC ROLLING QR
  // ===========================================================================
  describe('3. Pass Issuance & Public Mobile Web Pass Flow', () => {
    let publicPassToken: string;

    it('should issue an access pass for member with physical badge passcode', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/attendance/members/${memberAlphaId}/pass/issue`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ generatePhysicalBadge: true });

      expect(res.status).toBe(201);
      const data = res.body.data || res.body;
      expect(data.pass).toBeDefined();
      expect(data.pass.status).toBe(PassStatus.ACTIVE);
      expect(data.rawPhysicalPasscode).toBeDefined();
      expect(data.rawPhysicalPasscode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
      memberPassAlphaId = data.pass.id;
      expect(memberPassAlphaId).toBeDefined();
    });

    it('should generate signed web pass link for member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/attendance/members/${memberAlphaId}/pass/web-link`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`);

      expect(res.status).toBe(200);
      const data = res.body.data || res.body;
      expect(data.passToken).toBeDefined();
      expect(data.webPassUrl).toBeDefined();
      publicPassToken = data.passToken;
    });

    it('public mobile web pass view should return minimal PII with security headers', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/attendance/public/pass/${publicPassToken}`);

      expect(res.status).toBe(200);
      // Security headers
      expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate');
      expect(res.headers['referrer-policy']).toBe('no-referrer');

      const data = res.body.data || res.body;
      // Minimal PII: only firstName and memberNumber, NO phone, NO email
      expect(data.member.firstName).toBe('Vikram');
      expect(data.member.memberNumber).toBeDefined();
      expect(data.member.phone).toBeUndefined();
      expect(data.member.email).toBeUndefined();

      // Dynamic QR token included
      expect(data.dynamicToken).toBeDefined();
      expect(data.dynamicToken.token).toMatch(/^GYMOS:V1:/);
      expect(data.dynamicToken.refreshIntervalSeconds).toBe(45);
    });

    it('public pass refresh should return a new dynamic token and rate-limit excessive calls', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/attendance/public/pass/${publicPassToken}/refresh`);

      expect(res.status).toBe(201);
      expect(res.headers['cache-control']).toBe('no-store, no-cache, must-revalidate');
      const data = res.body.data || res.body;
      expect(data.dynamicToken.token).toMatch(/^GYMOS:V1:/);
    });

    it('public pass view should reject corrupted or forged tokens with 401 Unauthorized', async () => {
      const forgedToken = `${publicPassToken.slice(0, -6)}FFFFFF`;
      const res = await request(app.getHttpServer())
        .get(`/api/v1/attendance/public/pass/${forgedToken}`);

      expect(res.status).toBe(401);
    });
  });

  // ===========================================================================
  // 4. CHECK-IN, LIVE OCCUPANCY & CHECK-OUT LIFECYCLE
  // ===========================================================================
  describe('4. Full Check-In -> Live Floor -> Check-Out Lifecycle', () => {
    let activeAttendanceId: string;

    it('should check in member via manual staff check-in', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/attendance/manual')
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          memberId: memberAlphaId,
          notes: 'Leg day session',
        });

      expect(res.status).toBe(201);
      const data = res.body.data || res.body;
      expect(data.success).toBe(true);
      expect(data.record).toBeDefined();
      expect(data.record.status).toBe(AttendanceStatus.CHECKED_IN);
      activeAttendanceId = data.record.id;
    });

    it('should display member in live floor occupancy roster', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/attendance/floor?branchId=${branchAlpha1Id}`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`);

      expect(res.status).toBe(200);
      const data = res.body.data || res.body;
      expect(data.currentCount).toBe(1);
      expect(data.activeSessions.length).toBe(1);
      expect(data.activeSessions[0].id).toBe(activeAttendanceId);
      expect(data.activeSessions[0].memberId).toBe(memberAlphaId);
    });

    it('should check out member by attendance ID', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/attendance/${activeAttendanceId}/checkout`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({ notes: 'Workout completed' });

      expect(res.status).toBe(201);
      const data = res.body.data || res.body;
      expect(data.success).toBe(true);
      expect(data.record.status).toBe(AttendanceStatus.CHECKED_OUT);
      expect(data.record.checkOutTime).toBeDefined();
    });

    it('live floor occupancy should now be zero after check-out', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/attendance/floor?branchId=${branchAlpha1Id}`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`);

      expect(res.status).toBe(200);
      const data = res.body.data || res.body;
      expect(data.currentCount).toBe(0);
      expect(data.activeSessions.length).toBe(0);
    });

    it('should retrieve completed attendance session in history query', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/attendance/records?memberId=${memberAlphaId}`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`);

      expect(res.status).toBe(200);
      const data = res.body.data || res.body;
      expect(data.items.length).toBeGreaterThanOrEqual(1);
      expect(data.items[0].id).toBe(activeAttendanceId);
      expect(data.items[0].status).toBe(AttendanceStatus.CHECKED_OUT);
    });
  });

  // ===========================================================================
  // 5. SETTINGS GET & UPDATE
  // ===========================================================================
  describe('5. Attendance Settings Management', () => {
    it('GYM_OWNER should be able to update attendance settings via PATCH', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/attendance/settings')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          allowCheckInWithDues: true,
          maxOverdueGraceDays: 7,
          cooldownMinutes: 15,
          requireCheckOut: true,
          autoCheckOutHours: 4,
          operatingHoursStart: '05:30',
          operatingHoursEnd: '22:30',
          allowOffHoursCheckIn: false,
        });

      expect(res.status).toBe(200);
      const data = res.body.data || res.body;
      expect(data.allowCheckInWithDues).toBe(true);
      expect(data.maxOverdueGraceDays).toBe(7);
      expect(data.cooldownMinutes).toBe(15);
      expect(data.operatingHoursStart).toBe('05:30');
    });

    it('should retrieve the updated settings via GET /attendance/settings', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/attendance/settings')
        .set('Authorization', `Bearer ${ownerAlpha.token}`);

      expect(res.status).toBe(200);
      const data = res.body.data || res.body;
      expect(data.allowCheckInWithDues).toBe(true);
      expect(data.maxOverdueGraceDays).toBe(7);
      expect(data.cooldownMinutes).toBe(15);
    });
  });
});
