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
} from '@gymos/shared-types';

describe('Stage 2.4: Gym Member Management (E2E Integration & Security)', () => {
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
  let ownerBeta: { id: string; email: string; token: string };

  // Branches
  let branchAlpha1Id: string;
  let branchAlpha2Id: string;
  let branchBeta1Id: string;

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

    const defaultPassword = 'SecureMemberPassword2026!';
    const passwordHash = await passwordHasher.hashPassword(defaultPassword);
    const timestamp = Date.now();

    // Seed test organizations, branches, and staff users
    await prisma.withSuperAdminContext(async (tx) => {
      // Org Alpha
      const oAlpha = await tx.organization.create({
        data: {
          name: `Alpha Fitness ${timestamp}`,
          slug: `alpha-fitness-${timestamp}`,
          status: TenantStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
          currency: 'INR',
        },
      });
      orgAlpha = { id: oAlpha.id, name: oAlpha.name };

      // Org Beta
      const oBeta = await tx.organization.create({
        data: {
          name: `Beta Gyms ${timestamp}`,
          slug: `beta-gyms-${timestamp}`,
          status: TenantStatus.ACTIVE,
        },
      });
      orgBeta = { id: oBeta.id, name: oBeta.name };

      // Branches in Alpha
      const bAlpha1 = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Downtown',
          slug: `alpha-downtown-${timestamp}`,
          branchCode: `ADW${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
        },
      });
      branchAlpha1Id = bAlpha1.id;

      const bAlpha2 = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Uptown',
          slug: `alpha-uptown-${timestamp}`,
          branchCode: `AUP${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
        },
      });
      branchAlpha2Id = bAlpha2.id;

      // Branch in Beta
      const bBeta1 = await tx.branch.create({
        data: {
          organizationId: orgBeta.id,
          name: 'Beta Central',
          slug: `beta-central-${timestamp}`,
          branchCode: `BCT${timestamp % 10000}`,
          status: BranchStatus.ACTIVE,
          timezone: 'Asia/Kolkata',
        },
      });
      branchBeta1Id = bBeta1.id;

      // User: Owner Alpha
      const uOwnerA = await tx.user.create({
        data: {
          email: `owner-alpha-${timestamp}@membertest.com`,
          passwordHash,
          firstName: 'Alpha',
          lastName: 'Owner',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uOwnerA.id,
          role: UserRole.GYM_OWNER,
        },
      });
      ownerAlpha = { id: uOwnerA.id, email: uOwnerA.email, token: '' };

      // User: Receptionist Alpha
      const uRecepA = await tx.user.create({
        data: {
          email: `recep-alpha-${timestamp}@membertest.com`,
          passwordHash,
          firstName: 'Alpha',
          lastName: 'Receptionist',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouRecepA = await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uRecepA.id,
          role: UserRole.RECEPTIONIST,
        },
      });
      // Assign receptionist to branchAlpha1
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          organizationUserId: ouRecepA.id,
          status: 'ACTIVE',
        },
      });
      receptionistAlpha = { id: uRecepA.id, email: uRecepA.email, token: '' };

      // User: Trainer Alpha (No MEMBER_CREATE permission)
      const uTrainerA = await tx.user.create({
        data: {
          email: `trainer-alpha-${timestamp}@membertest.com`,
          passwordHash,
          firstName: 'Alpha',
          lastName: 'Trainer',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouTrainerA = await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uTrainerA.id,
          role: UserRole.TRAINER,
        },
      });
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          organizationUserId: ouTrainerA.id,
          status: 'ACTIVE',
        },
      });
      trainerAlpha = { id: uTrainerA.id, email: uTrainerA.email, token: '' };

      // User: Owner Beta
      const uOwnerB = await tx.user.create({
        data: {
          email: `owner-beta-${timestamp}@membertest.com`,
          passwordHash,
          firstName: 'Beta',
          lastName: 'Owner',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: orgBeta.id,
          userId: uOwnerB.id,
          role: UserRole.GYM_OWNER,
        },
      });
      ownerBeta = { id: uOwnerB.id, email: uOwnerB.email, token: '' };
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
    // Teardown test data
    await prisma.withSuperAdminContext(async (tx) => {
      const orgIds = [orgAlpha?.id, orgBeta?.id].filter(Boolean);
      await tx.memberTransfer.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await tx.member.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await tx.organizationMemberSequence.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await tx.branchStaffAssignment.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await tx.branch.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await tx.auditLog.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await tx.organizationUser.deleteMany({
        where: { organizationId: { in: orgIds } },
      });
      await tx.organization.deleteMany({
        where: { id: { in: orgIds } },
      });
      const userIds = [
        ownerAlpha?.id,
        receptionistAlpha?.id,
        trainerAlpha?.id,
        ownerBeta?.id,
      ].filter(Boolean);
      await tx.refreshToken.deleteMany({
        where: { userId: { in: userIds } },
      });
      await tx.user.deleteMany({
        where: { id: { in: userIds } },
      });
    });

    await app.close();
  });

  describe('1. Member Registration & Validation', () => {

    it('should successfully register a member with sequential member number MEM-00001', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          firstName: 'Ramesh',
          lastName: 'Kumar',
          phone: '+919876543210',
          email: 'ramesh.kumar@example.com',
          gender: 'MALE',
          dateOfBirth: '1990-05-15',
          city: 'Mumbai',
          state: 'Maharashtra',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.memberNumber).toBe('MEM-00001');
      expect(res.body.data.firstName).toBe('Ramesh');
      expect(res.body.data.lastName).toBe('Kumar');
      expect(res.body.data.branchId).toBe(branchAlpha1Id);
      expect(res.body.data.status).toBe(MemberStatus.ACTIVE);
    });

    it('should allow Receptionist to register a member', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          firstName: 'Priya',
          lastName: 'Sharma',
          phone: '+919876543211',
          gender: 'FEMALE',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.memberNumber).toBe('MEM-00002');
    });

    it('should forbid Trainer from registering a member (missing MEMBER_CREATE)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          firstName: 'Unauthorized',
          lastName: 'TrainerAdd',
          phone: '+919876543299',
        })
        .expect(403);
    });

    it('should allow shared phone numbers (family members sharing contact info)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          firstName: 'Suresh',
          lastName: 'Kumar',
          phone: '+919876543210', // Same phone as Ramesh Kumar
          email: 'ramesh.kumar@example.com', // Same email
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.memberNumber).toBe('MEM-00003');
      expect(res.body.data.phone).toBe('+919876543210');
    });

    it('should reject registration when branch belongs to another organization (cross-tenant)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchBeta1Id, // Branch belonging to Org Beta
          firstName: 'Hacker',
          lastName: 'CrossOrg',
          phone: '+919876543999',
        })
        .expect(400);

      expect(res.body.message).toContain('not found or inactive');
    });

    it('should reject registration with missing required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/members')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          branchId: branchAlpha1Id,
          // Missing firstName and lastName and phone
        })
        .expect(400);
    });
  });

  describe('2. Member Directory, Filtering & Cross-Tenant Isolation', () => {
    it('should list members with server-side pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/members?page=1&limit=2')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(2);
      expect(res.body.data.meta.total).toBe(3);
      expect(res.body.data.meta.totalPages).toBe(2);
    });

    it('should search members by name, phone, or memberNumber', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/members?search=Priya')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(1);
      expect(res.body.data.items[0].firstName).toBe('Priya');
    });

    it('should guarantee cross-tenant isolation: Org Beta cannot see Org Alpha members', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/members')
        .set('Authorization', `Bearer ${ownerBeta.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBe(0);
      expect(res.body.data.meta.total).toBe(0);
    });
  });

  describe('3. Member Profile, Updates & Status Lifecycle', () => {
    let testMemberId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/members?search=MEM-00001')
        .set('Authorization', `Bearer ${ownerAlpha.token}`);
      testMemberId = res.body.data.items[0].id;
    });

    it('should retrieve single member details by ID', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/members/${testMemberId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(testMemberId);
      expect(res.body.data.firstName).toBe('Ramesh');
      expect(Array.isArray(res.body.data.transfers)).toBe(true);
    });

    it('should prevent cross-tenant member lookup (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/members/${testMemberId}`)
        .set('Authorization', `Bearer ${ownerBeta.token}`)
        .expect(404);
    });

    it('should update member contact and personal details', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/members/${testMemberId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          preferredName: 'Ram',
          city: 'Pune',
          emergencyContactName: 'Anita Kumar',
          emergencyContactPhone: '+919876543999',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.preferredName).toBe('Ram');
      expect(res.body.data.city).toBe('Pune');
      expect(res.body.data.emergencyContactName).toBe('Anita Kumar');
    });

    it('should update member status from ACTIVE to SUSPENDED with audit', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/members/${testMemberId}/status`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          status: MemberStatus.SUSPENDED,
          reason: 'Non-payment of membership fees',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(MemberStatus.SUSPENDED);
    });

    it('should reactivate a SUSPENDED member back to ACTIVE', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/members/${testMemberId}/status`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          status: MemberStatus.ACTIVE,
          reason: 'Fees cleared',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(MemberStatus.ACTIVE);
    });
  });

  describe('4. Branch Transfers & Archival Lifecycle', () => {
    let transferMemberId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/members?search=Priya')
        .set('Authorization', `Bearer ${ownerAlpha.token}`);
      transferMemberId = res.body.data.items[0].id;
    });

    it('should transfer member between branches in the same organization and log transfer history', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/members/${transferMemberId}/transfer`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          targetBranchId: branchAlpha2Id,
          reason: 'Member relocated to Uptown',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.branchId).toBe(branchAlpha2Id);

      // Verify transfer history in detail lookup
      const detailRes = await request(app.getHttpServer())
        .get(`/api/v1/members/${transferMemberId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(detailRes.body.data.transfers.length).toBe(1);
      expect(detailRes.body.data.transfers[0].fromBranchId).toBe(branchAlpha1Id);
      expect(detailRes.body.data.transfers[0].toBranchId).toBe(branchAlpha2Id);
      expect(detailRes.body.data.transfers[0].reason).toBe('Member relocated to Uptown');
    });

    it('should reject branch transfer to the branch the member is already assigned to', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/members/${transferMemberId}/transfer`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          targetBranchId: branchAlpha2Id, // Already at Alpha2
        })
        .expect(400);
    });

    it('should reject branch transfer to a branch from a different organization', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/members/${transferMemberId}/transfer`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          targetBranchId: branchBeta1Id, // Org Beta branch
        })
        .expect(400);
    });

    it('should archive a member successfully', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/members/${transferMemberId}/archive`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          reason: 'Member moved out of country',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(MemberStatus.ARCHIVED);
      expect(res.body.data.archivedAt).toBeDefined();
    });

    it('should reject modifications to an archived member', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/members/${transferMemberId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          firstName: 'AttemptEdit',
        })
        .expect(400);
    });

    it('should reject status changes from ARCHIVED (terminal state)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/members/${transferMemberId}/status`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          status: MemberStatus.ACTIVE,
        })
        .expect(400);
    });

    it('should reject transfer of an archived member', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/members/${transferMemberId}/transfer`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          targetBranchId: branchAlpha1Id,
        })
        .expect(400);
    });
  });

  describe('5. PostgreSQL Row-Level Security Verification', () => {
    it('should block cross-tenant database reads when queried with a foreign tenant context', async () => {
      // Query member table under Org Beta's context
      const membersInBetaContext = await prisma.withTenantContext(orgBeta.id, async (tx) => {
        return tx.member.findMany();
      });

      // No Org Alpha members should be returned
      expect(membersInBetaContext.length).toBe(0);
    });

    it('should enforce RLS when querying member_transfers under foreign tenant context', async () => {
      const transfersInBetaContext = await prisma.withTenantContext(orgBeta.id, async (tx) => {
        return tx.memberTransfer.findMany();
      });

      expect(transfersInBetaContext.length).toBe(0);
    });
  });
});
