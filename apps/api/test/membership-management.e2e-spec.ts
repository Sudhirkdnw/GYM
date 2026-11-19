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
  PlanDurationType,
  PlanScope,
  PlanStatus,
  MembershipStatus,
} from '@gymos/shared-types';

describe('Stage 2.5: Membership & Subscription Management (E2E Integration & Security)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHasher: PasswordHasherService;
  let tokenService: TokenService;

  // Organizations
  let orgAlpha: { id: string; name: string };
  let orgBeta: { id: string; name: string };

  // Staff Users & Auth Tokens
  let ownerAlpha: { id: string; email: string; token: string };
  let receptionistAlpha: { id: string; email: string; token: string };
  let trainerAlpha: { id: string; email: string; token: string };
  let ownerBeta: { id: string; email: string; token: string };

  // Branches
  let branchAlpha1Id: string;
  let branchAlpha2Id: string;
  let branchBeta1Id: string;

  // Seed Members
  let memberAlphaId: string;
  let memberBetaId: string;

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

    const defaultPassword = 'SecureMembershipPass2026!';
    const passwordHash = await passwordHasher.hashPassword(defaultPassword);
    const timestamp = Date.now();

    // Seed test organizations, branches, staff, and members
    await prisma.withSuperAdminContext(async (tx) => {
      // 1. Org Alpha
      const oAlpha = await tx.organization.create({
        data: {
          name: `Alpha Fitness MS_${timestamp}`,
          slug: `alpha-fitness-ms-${timestamp}`,
          status: TenantStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      });
      orgAlpha = { id: oAlpha.id, name: oAlpha.name };

      // 2. Org Beta (Isolation test tenant)
      const oBeta = await tx.organization.create({
        data: {
          name: `Beta Gyms MS_${timestamp}`,
          slug: `beta-gyms-ms-${timestamp}`,
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
          name: 'Alpha Main Downtown',
          slug: `alpha-main-${timestamp}`,
          branchCode: `AMD${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
        },
      });
      branchAlpha1Id = bAlpha1.id;

      const bAlpha2 = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Uptown Express',
          slug: `alpha-uptown-${timestamp}`,
          branchCode: `AUP${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
        },
      });
      branchAlpha2Id = bAlpha2.id;

      // 4. Branch in Beta
      const bBeta1 = await tx.branch.create({
        data: {
          organizationId: orgBeta.id,
          name: 'Beta Central',
          slug: `beta-central-${timestamp}`,
          branchCode: `BCT${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
        },
      });
      branchBeta1Id = bBeta1.id;

      // 5. Users
      // Alpha Owner
      const uOwnerAlpha = await tx.user.create({
        data: {
          email: `owner.alpha.${timestamp}@testgym.com`,
          passwordHash,
          firstName: 'Arthur',
          lastName: 'AlphaOwner',
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
      ownerAlpha = {
        id: uOwnerAlpha.id,
        email: uOwnerAlpha.email,
        token: '',
      };

      // Alpha Receptionist
      const uReceptAlpha = await tx.user.create({
        data: {
          email: `recept.alpha.${timestamp}@testgym.com`,
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
      receptionistAlpha = {
        id: uReceptAlpha.id,
        email: uReceptAlpha.email,
        token: '',
      };

      // Alpha Trainer
      const uTrainerAlpha = await tx.user.create({
        data: {
          email: `trainer.alpha.${timestamp}@testgym.com`,
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
      trainerAlpha = {
        id: uTrainerAlpha.id,
        email: uTrainerAlpha.email,
        token: '',
      };

      // Beta Owner
      const uOwnerBeta = await tx.user.create({
        data: {
          email: `owner.beta.${timestamp}@testgym.com`,
          passwordHash,
          firstName: 'Brian',
          lastName: 'BetaOwner',
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
      ownerBeta = {
        id: uOwnerBeta.id,
        email: uOwnerBeta.email,
        token: '',
      };

      // Seed Members
      const mAlpha = await tx.member.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          memberNumber: `ALPH-${timestamp % 10000}-001`,
          firstName: 'John',
          lastName: 'Doe',
          phone: `+9198765${timestamp % 100000}`,
          status: MemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
      memberAlphaId = mAlpha.id;

      const mBeta = await tx.member.create({
        data: {
          organizationId: orgBeta.id,
          branchId: branchBeta1Id,
          memberNumber: `BETA-${timestamp % 10000}-001`,
          firstName: 'Jane',
          lastName: 'Smith',
          phone: `+9199887${timestamp % 100000}`,
          status: MemberStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
      memberBetaId = mBeta.id;
    });

    // Generate tokens
    const [tOwnerA, tRecepA, tTrainerA, tOwnerB] = await Promise.all([
      tokenService.issueTokens(ownerAlpha.id, ownerAlpha.email, false, orgAlpha.id, UserRole.GYM_OWNER),
      tokenService.issueTokens(receptionistAlpha.id, receptionistAlpha.email, false, orgAlpha.id, UserRole.RECEPTIONIST),
      tokenService.issueTokens(trainerAlpha.id, trainerAlpha.email, false, orgAlpha.id, UserRole.TRAINER),
      tokenService.issueTokens(ownerBeta.id, ownerBeta.email, false, orgBeta.id, UserRole.GYM_OWNER),
    ]);

    ownerAlpha.token = tOwnerA.accessToken;
    receptionistAlpha.token = tRecepA.accessToken;
    trainerAlpha.token = tTrainerA.accessToken;
    ownerBeta.token = tOwnerB.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // ===========================================================================
  // 1. MEMBERSHIP PLAN MANAGEMENT & BRANCH SCOPING
  // ===========================================================================
  describe('Membership Plan Management', () => {
    let createdPlanId: string;
    const planCode = `QTR-${Date.now() % 10000}`;

    it('should allow GYM_OWNER to create a multi-branch membership plan', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Quarterly Premium Fitness',
          code: planCode,
          description: 'Access to gym floor, locker, and steam room',
          durationType: PlanDurationType.MONTHS,
          durationValue: 3,
          price: 5499,
          registrationFee: 500,
          currency: 'INR',
          scope: PlanScope.MULTI_BRANCH,
          branchIds: [branchAlpha1Id, branchAlpha2Id],
          maxFreezeDays: 15,
          maxFreezes: 2,
          gracePeriodDays: 5,
          features: ['Gym Floor', 'Locker Room', 'Steam Bath'],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Quarterly Premium Fitness');
      expect(res.body.data.code).toBe(planCode);
      expect(res.body.data.price).toBe(5499);
      expect(res.body.data.registrationFee).toBe(500);
      expect(res.body.data.branchIds).toContain(branchAlpha1Id);
      expect(res.body.data.branchIds).toContain(branchAlpha2Id);

      createdPlanId = res.body.data.id;
    });

    it('should reject duplicate plan code within the same organization', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Duplicate Plan Code',
          code: planCode,
          durationType: PlanDurationType.MONTHS,
          durationValue: 1,
          price: 2000,
          scope: PlanScope.ALL_BRANCHES,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already exists');
    });

    it('should allow RECEPTIONIST to list membership plans', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${receptionistAlpha.token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      const found = res.body.data.items.find((p: any) => p.id === createdPlanId);
      expect(found).toBeDefined();
    });

    it('should allow GYM_OWNER to toggle plan status to INACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/memberships/plans/${createdPlanId}/status`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ status: PlanStatus.INACTIVE });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(PlanStatus.INACTIVE);

      // Restore to ACTIVE for following subscription tests
      await request(app.getHttpServer())
        .patch(`/api/v1/memberships/plans/${createdPlanId}/status`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ status: PlanStatus.ACTIVE });
    });
  });

  // ===========================================================================
  // 2. SUBSCRIPTION ASSIGNMENT & IMMUTABLE PRICING SNAPSHOTS
  // ===========================================================================
  describe('Subscription Assignment & Pricing Snapshots', () => {
    let testPlanId: string;
    let assignedMembershipId: string;

    beforeAll(async () => {
      // Create a dedicated annual plan
      const planRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Annual Gold Pass',
          code: `GOLD-${Date.now() % 10000}`,
          durationType: PlanDurationType.YEARS,
          durationValue: 1,
          price: 12000,
          registrationFee: 1000,
          currency: 'INR',
          scope: PlanScope.ALL_BRANCHES,
          maxFreezeDays: 30,
          maxFreezes: 2,
        });
      testPlanId = planRes.body.data.id;
    });

    it('should assign membership with exact inclusive date bounds and immutable pricing snapshot', async () => {
      const startDate = '2026-01-01';
      const discountAmount = 1000;
      const taxRate = 18; // 18% GST

      // Subtotal before tax: (12000 base + 1000 reg) - 1000 discount = 12000
      // Tax: 12000 * 0.18 = 2160
      // Final price: 14160

      const res = await request(app.getHttpServer())
        .post('/api/v1/memberships/subscriptions')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlphaId,
          planId: testPlanId,
          homeBranchId: branchAlpha1Id,
          startDate,
          discountAmount,
          discountReason: 'New Year Early Bird Special',
          taxRate,
          notes: 'Customer paid upfront via card',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const sub = res.body.data;
      assignedMembershipId = sub.id;

      expect(sub.memberId).toBe(memberAlphaId);
      expect(sub.planId).toBe(testPlanId);
      expect(sub.startDate).toBe('2026-01-01');
      // 1 year inclusive from 2026-01-01 ends 2026-12-31
      expect(sub.endDate).toBe('2026-12-31');
      expect(sub.basePrice).toBe(12000);
      expect(sub.registrationFee).toBe(1000);
      expect(sub.discountAmount).toBe(1000);
      expect(sub.taxRate).toBe(18);
      expect(sub.taxAmount).toBe(2160);
      expect(sub.finalPrice).toBe(14160);

      // Verify immutable pricing snapshot contents
      expect(sub.pricingSnapshot).toBeDefined();
      expect(sub.pricingSnapshot.basePrice).toBe(12000);
      expect(sub.pricingSnapshot.finalPrice).toBe(14160);
      expect(sub.pricingSnapshot.discountReason).toBe('New Year Early Bird Special');
      expect(sub.pricingSnapshot.capturedAt).toBeDefined();

      // Verify transactional outbox event was recorded in DB
      const outboxEvent = await prisma.withSuperAdminContext(async (tx) => {
        return tx.membershipOutboxEvent.findFirst({
          where: { aggregateId: assignedMembershipId, eventType: 'membership.created' },
        });
      });
      expect(outboxEvent).toBeDefined();
      expect(outboxEvent?.status).toBe('PENDING');

      // Verify immutable membership history
      const history = await prisma.withSuperAdminContext(async (tx) => {
        return tx.membershipHistory.findFirst({
          where: { membershipId: assignedMembershipId, action: 'ASSIGNED' },
        });
      });
      expect(history).toBeDefined();
    });

    it('should reject membership assignment if plan is not allowed for selected branch', async () => {
      // Create single branch plan only valid for branchAlpha2
      const singleBranchPlan = await request(app.getHttpServer())
        .post('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Alpha 2 Exclusive',
          code: `EXCL-${Date.now() % 10000}`,
          durationType: PlanDurationType.MONTHS,
          durationValue: 1,
          price: 1500,
          scope: PlanScope.SINGLE_BRANCH,
          branchIds: [branchAlpha2Id],
        });

      // Attempt assigning at branchAlpha1
      const res = await request(app.getHttpServer())
        .post('/api/v1/memberships/subscriptions')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlphaId,
          planId: singleBranchPlan.body.data.id,
          homeBranchId: branchAlpha1Id,
          startDate: '2026-02-01',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not valid for branch');
    });
  });

  // ===========================================================================
  // 3. RENEWAL WORKFLOWS & SEAMLESS CHAINING
  // ===========================================================================
  describe('Membership Renewal Workflows', () => {
    let initialMembershipId: string;
    let planId: string;

    beforeAll(async () => {
      const planRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Monthly Recurring Standard',
          code: `MTH-${Date.now() % 10000}`,
          durationType: PlanDurationType.MONTHS,
          durationValue: 1,
          price: 2500,
          scope: PlanScope.ALL_BRANCHES,
        });
      planId = planRes.body.data.id;

      // Assign first membership starting today
      const today = new Date().toISOString().split('T')[0];
      const assignRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/subscriptions')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlphaId,
          planId,
          homeBranchId: branchAlpha1Id,
          startDate: today,
        });
      initialMembershipId = assignRes.body.data.id;
    });

    it('should seamlessly chain renewal start date to the day after current expiry', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/memberships/subscriptions/${initialMembershipId}/renew`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({
          discountAmount: 200,
          discountReason: 'Renewal loyalty discount',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const renewed = res.body.data;
      expect(renewed.previousMembershipId).toBe(initialMembershipId);
      expect(renewed.renewalCount).toBe(1);
      expect(renewed.discountAmount).toBe(200);

      // Verify outbox event for renewal
      const outbox = await prisma.withSuperAdminContext(async (tx) => {
        return tx.membershipOutboxEvent.findFirst({
          where: { aggregateId: renewed.id, eventType: 'membership.renewed' },
        });
      });
      expect(outbox).toBeDefined();

      // Verify previous membership history recorded RENEWED
      const history = await prisma.withSuperAdminContext(async (tx) => {
        return tx.membershipHistory.findFirst({
          where: { membershipId: initialMembershipId, action: 'RENEWED' },
        });
      });
      expect(history).toBeDefined();
    });
  });

  // ===========================================================================
  // 4. FREEZE & THAW DATE SHIFTING
  // ===========================================================================
  describe('Freeze & Thaw Management', () => {
    let freezeMembershipId: string;
    let initialEndDate: string;

    beforeAll(async () => {
      const planRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Freezable Pass',
          code: `FRZ-${Date.now() % 10000}`,
          durationType: PlanDurationType.MONTHS,
          durationValue: 3,
          price: 6000,
          scope: PlanScope.ALL_BRANCHES,
          maxFreezes: 2,
          maxFreezeDays: 30,
        });

      const today = new Date().toISOString().split('T')[0];
      const assignRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/subscriptions')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlphaId,
          planId: planRes.body.data.id,
          homeBranchId: branchAlpha1Id,
          startDate: today,
        });
      freezeMembershipId = assignRes.body.data.id;
      initialEndDate = assignRes.body.data.endDate;
    });

    it('should place an active membership on freeze', async () => {
      const today = new Date().toISOString().split('T')[0];
      const res = await request(app.getHttpServer())
        .post(`/api/v1/memberships/subscriptions/${freezeMembershipId}/freeze`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({
          startDate: today,
          reason: 'Medical recovery after knee sprain',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(MembershipStatus.FROZEN);
      expect(res.body.data.freezeCount).toBe(1);

      // Verify freeze outbox event
      const outbox = await prisma.withSuperAdminContext(async (tx) => {
        return tx.membershipOutboxEvent.findFirst({
          where: { aggregateId: freezeMembershipId, eventType: 'membership.frozen' },
        });
      });
      expect(outbox).toBeDefined();
    });

    it('should reject thawing if membership is not frozen', async () => {
      // Find a non-frozen membership
      const otherSub = await prisma.withSuperAdminContext(async (tx) => {
        return tx.memberMembership.findFirst({
          where: { organizationId: orgAlpha.id, status: 'ACTIVE' },
        });
      });
      if (otherSub) {
        const res = await request(app.getHttpServer())
          .post(`/api/v1/memberships/subscriptions/${otherSub.id}/thaw`)
          .set('Authorization', `Bearer ${receptionistAlpha.token}`)
          .send({});
        expect(res.status).toBe(400);
      }
    });

    it('should thaw membership and push end date forward by exact frozen days', async () => {
      // We simulate thawing 10 days after freeze start
      const freezeRecord = await prisma.withSuperAdminContext(async (tx) => {
        return tx.membershipFreeze.findFirst({
          where: { membershipId: freezeMembershipId, status: 'ACTIVE' },
        });
      });
      expect(freezeRecord).toBeDefined();

      const thawDateObj = new Date(freezeRecord!.startDate);
      thawDateObj.setUTCDate(thawDateObj.getUTCDate() + 10);
      const thawDateStr = thawDateObj.toISOString().split('T')[0];

      const res = await request(app.getHttpServer())
        .post(`/api/v1/memberships/subscriptions/${freezeMembershipId}/thaw`)
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({
          thawDate: thawDateStr,
          reason: 'Cleared by physician to resume workouts',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(MembershipStatus.ACTIVE);
      expect(res.body.data.totalFreezeDaysUsed).toBe(10);

      // Verify end date was shifted forward by 10 days
      const expectedNewEndDate = new Date(new Date(initialEndDate).getTime() + 10 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
      expect(res.body.data.endDate).toBe(expectedNewEndDate);

      // Verify outbox event for thawed
      const outbox = await prisma.withSuperAdminContext(async (tx) => {
        return tx.membershipOutboxEvent.findFirst({
          where: { aggregateId: freezeMembershipId, eventType: 'membership.thawed' },
        });
      });
      expect(outbox).toBeDefined();
    });
  });

  // ===========================================================================
  // 5. CANCELLATION & TERMINATION
  // ===========================================================================
  describe('Membership Cancellation', () => {
    let cancelMembershipId: string;

    beforeAll(async () => {
      const planRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Cancellable Pass',
          code: `CAN-${Date.now() % 10000}`,
          durationType: PlanDurationType.MONTHS,
          durationValue: 1,
          price: 2000,
          scope: PlanScope.ALL_BRANCHES,
        });

      const assignRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/subscriptions')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlphaId,
          planId: planRes.body.data.id,
          homeBranchId: branchAlpha1Id,
        });
      cancelMembershipId = assignRes.body.data.id;
    });

    it('should cancel active membership with mandatory reason', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/memberships/subscriptions/${cancelMembershipId}/cancel`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          reason: 'Member relocated to another state',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe(MembershipStatus.CANCELLED);
      expect(res.body.data.cancellationReason).toBe('Member relocated to another state');

      // Verify outbox event for cancelled
      const outbox = await prisma.withSuperAdminContext(async (tx) => {
        return tx.membershipOutboxEvent.findFirst({
          where: { aggregateId: cancelMembershipId, eventType: 'membership.cancelled' },
        });
      });
      expect(outbox).toBeDefined();
    });

    it('should reject cancelling an already cancelled membership', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/memberships/subscriptions/${cancelMembershipId}/cancel`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          reason: 'Attempting redundant cancellation',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already CANCELLED');
    });
  });

  // ===========================================================================
  // 6. TENANT ISOLATION & POSTGRESQL RLS ENFORCEMENT
  // ===========================================================================
  describe('Tenant Isolation & RLS Enforcement', () => {
    let alphaPlanId: string;
    let alphaSubscriptionId: string;

    beforeAll(async () => {
      const planRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Alpha Secret Plan',
          code: `SEC-${Date.now() % 10000}`,
          durationType: PlanDurationType.MONTHS,
          durationValue: 1,
          price: 5000,
          scope: PlanScope.ALL_BRANCHES,
        });
      alphaPlanId = planRes.body.data.id;

      const subRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/subscriptions')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberAlphaId,
          planId: alphaPlanId,
          homeBranchId: branchAlpha1Id,
        });
      alphaSubscriptionId = subRes.body.data.id;
    });

    it('should prevent Org Beta user from accessing Org Alpha membership plan', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/memberships/plans/${alphaPlanId}`)
        .set('Authorization', `Bearer ${ownerBeta.token}`);

      expect(res.status).toBe(404);
    });

    it('should prevent Org Beta user from accessing Org Alpha subscription', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/memberships/subscriptions/${alphaSubscriptionId}`)
        .set('Authorization', `Bearer ${ownerBeta.token}`);

      expect(res.status).toBe(404);
    });

    it('should prevent Org Beta user from renewing or cancelling Org Alpha subscription', async () => {
      const resRenew = await request(app.getHttpServer())
        .post(`/api/v1/memberships/subscriptions/${alphaSubscriptionId}/renew`)
        .set('Authorization', `Bearer ${ownerBeta.token}`)
        .send({});
      expect(resRenew.status).toBe(404);

      const resCancel = await request(app.getHttpServer())
        .post(`/api/v1/memberships/subscriptions/${alphaSubscriptionId}/cancel`)
        .set('Authorization', `Bearer ${ownerBeta.token}`)
        .send({ reason: 'Malicious cross-tenant attempt' });
      expect(resCancel.status).toBe(404);
    });

    it('should prevent Org Alpha from assigning membership to Org Beta member', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memberships/subscriptions')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          memberId: memberBetaId,
          planId: alphaPlanId,
          homeBranchId: branchAlpha1Id,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('not found');
    });

    it('should not leak Alpha subscriptions in Beta subscriptions listing', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/memberships/subscriptions')
        .set('Authorization', `Bearer ${ownerBeta.token}`);

      expect(res.status).toBe(200);
      const items = res.body.data.items || [];
      const foundAlpha = items.find((s: any) => s.id === alphaSubscriptionId);
      expect(foundAlpha).toBeUndefined();
    });
  });

  // ===========================================================================
  // 7. RBAC PERMISSION ENFORCEMENT
  // ===========================================================================
  describe('RBAC Permission Enforcement', () => {
    it('should allow RECEPTIONIST to assign and renew subscriptions', async () => {
      // Create a plan as owner first
      const planRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Receptionist Accessible Plan',
          code: `RCP-${Date.now() % 10000}`,
          durationType: PlanDurationType.MONTHS,
          durationValue: 1,
          price: 1800,
          scope: PlanScope.ALL_BRANCHES,
        });

      const assignRes = await request(app.getHttpServer())
        .post('/api/v1/memberships/subscriptions')
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({
          memberId: memberAlphaId,
          planId: planRes.body.data.id,
          homeBranchId: branchAlpha1Id,
        });

      expect(assignRes.status).toBe(201);
    });

    it('should forbid TRAINER from creating membership plans (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/memberships/plans')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .send({
          name: 'Trainer Unauthorized Plan',
          code: `TRN-${Date.now() % 10000}`,
          durationType: PlanDurationType.MONTHS,
          durationValue: 1,
          price: 999,
          scope: PlanScope.ALL_BRANCHES,
        });

      expect(res.status).toBe(403);
    });

    it('should forbid TRAINER from assigning membership plans (403 Forbidden)', async () => {
      // Find any plan
      const plan = await prisma.withSuperAdminContext(async (tx) => {
        return tx.membershipPlan.findFirst({
          where: { organizationId: orgAlpha.id },
        });
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/memberships/subscriptions')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .send({
          memberId: memberAlphaId,
          planId: plan!.id,
          homeBranchId: branchAlpha1Id,
        });

      expect(res.status).toBe(403);
    });
  });
});
