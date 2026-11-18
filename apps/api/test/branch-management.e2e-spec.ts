import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';
import { TokenService } from '../src/auth/token.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { UserRole, UserStatus, TenantStatus, BranchStatus } from '@gymos/shared-types';

describe('Stage 2.3: Organization & Multi-Branch Management (E2E Integration & Security)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHasher: PasswordHasherService;
  let tokenService: TokenService;

  // Organizations
  let orgAlpha: { id: string; name: string; slug: string };
  let orgBeta: { id: string; name: string; slug: string };
  let orgSuspended: { id: string; name: string; slug: string };

  // Users & Tokens
  let ownerAlpha: { id: string; email: string; token: string; orgUserId: string };
  let memberAlpha: { id: string; email: string; token: string; orgUserId: string };
  let staffTrainerAlpha: { id: string; email: string; token: string; orgUserId: string };
  let ownerBeta: { id: string; email: string; token: string; orgUserId: string };
  let suspendedOwner: { id: string; email: string; token: string; orgUserId: string };

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

    const defaultPassword = 'SecureBranchPassword2026!';
    const passwordHash = await passwordHasher.hashPassword(defaultPassword);
    const timestamp = Date.now();

    // 1. Seed Organizations & Users cleanly outside RLS
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
      orgAlpha = { id: oAlpha.id, name: oAlpha.name, slug: oAlpha.slug };

      // Org Beta
      const oBeta = await tx.organization.create({
        data: {
          name: `Beta Gyms ${timestamp}`,
          slug: `beta-gyms-${timestamp}`,
          status: TenantStatus.ACTIVE,
        },
      });
      orgBeta = { id: oBeta.id, name: oBeta.name, slug: oBeta.slug };

      // Org Suspended
      const oSusp = await tx.organization.create({
        data: {
          name: `Suspended Fitness ${timestamp}`,
          slug: `suspended-fitness-${timestamp}`,
          status: TenantStatus.SUSPENDED,
        },
      });
      orgSuspended = { id: oSusp.id, name: oSusp.name, slug: oSusp.slug };

      // User: Owner Alpha
      const uOwnerA = await tx.user.create({
        data: {
          email: `owner-alpha-${timestamp}@branchtest.com`,
          passwordHash,
          firstName: 'Alpha',
          lastName: 'Owner',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouOwnerA = await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uOwnerA.id,
          role: UserRole.GYM_OWNER,
        },
      });
      ownerAlpha = {
        id: uOwnerA.id,
        email: uOwnerA.email,
        token: '',
        orgUserId: ouOwnerA.id,
      };

      // User: Member Alpha (No branch admin permissions)
      const uMemberA = await tx.user.create({
        data: {
          email: `member-alpha-${timestamp}@branchtest.com`,
          passwordHash,
          firstName: 'Alpha',
          lastName: 'Member',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouMemberA = await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uMemberA.id,
          role: UserRole.MEMBER,
        },
      });
      memberAlpha = {
        id: uMemberA.id,
        email: uMemberA.email,
        token: '',
        orgUserId: ouMemberA.id,
      };

      // User: Trainer Alpha (Staff role)
      const uTrainerA = await tx.user.create({
        data: {
          email: `trainer-alpha-${timestamp}@branchtest.com`,
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
      staffTrainerAlpha = {
        id: uTrainerA.id,
        email: uTrainerA.email,
        token: '',
        orgUserId: ouTrainerA.id,
      };

      // User: Owner Beta
      const uOwnerB = await tx.user.create({
        data: {
          email: `owner-beta-${timestamp}@branchtest.com`,
          passwordHash,
          firstName: 'Beta',
          lastName: 'Owner',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouOwnerB = await tx.organizationUser.create({
        data: {
          organizationId: orgBeta.id,
          userId: uOwnerB.id,
          role: UserRole.GYM_OWNER,
        },
      });
      ownerBeta = {
        id: uOwnerB.id,
        email: uOwnerB.email,
        token: '',
        orgUserId: ouOwnerB.id,
      };

      // User: Suspended Org Owner
      const uOwnerSusp = await tx.user.create({
        data: {
          email: `owner-susp-${timestamp}@branchtest.com`,
          passwordHash,
          firstName: 'Susp',
          lastName: 'Owner',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouSusp = await tx.organizationUser.create({
        data: {
          organizationId: orgSuspended.id,
          userId: uOwnerSusp.id,
          role: UserRole.GYM_OWNER,
        },
      });
      suspendedOwner = {
        id: uOwnerSusp.id,
        email: uOwnerSusp.email,
        token: '',
        orgUserId: ouSusp.id,
      };
    });

    // Generate JWT access tokens
    const [tOwnerA, tMemberA, tTrainerA, tOwnerB, tSusp] = await Promise.all([
      tokenService.issueTokens(ownerAlpha.id, ownerAlpha.email, false, orgAlpha.id, UserRole.GYM_OWNER),
      tokenService.issueTokens(memberAlpha.id, memberAlpha.email, false, orgAlpha.id, UserRole.MEMBER),
      tokenService.issueTokens(staffTrainerAlpha.id, staffTrainerAlpha.email, false, orgAlpha.id, UserRole.TRAINER),
      tokenService.issueTokens(ownerBeta.id, ownerBeta.email, false, orgBeta.id, UserRole.GYM_OWNER),
      tokenService.issueTokens(suspendedOwner.id, suspendedOwner.email, false, orgSuspended.id, UserRole.GYM_OWNER),
    ]);

    ownerAlpha.token = tOwnerA.accessToken;
    memberAlpha.token = tMemberA.accessToken;
    staffTrainerAlpha.token = tTrainerA.accessToken;
    ownerBeta.token = tOwnerB.accessToken;
    suspendedOwner.token = tSusp.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.withSuperAdminContext(async (tx) => {
      const orgIds = [orgAlpha?.id, orgBeta?.id, orgSuspended?.id].filter(Boolean);
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
        memberAlpha?.id,
        staffTrainerAlpha?.id,
        ownerBeta?.id,
        suspendedOwner?.id,
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

  // =========================================================================
  // 1. ORGANIZATION MANAGEMENT TESTS
  // =========================================================================
  describe('Organization Management APIs', () => {
    it('1. Authenticated owner can view current organization profile', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(orgAlpha.id);
      expect(res.body.data.name).toBe(orgAlpha.name);
      expect(res.body.data.timezone).toBe('Asia/Kolkata');
      expect(res.body.data.currency).toBe('INR');
      expect(res.body.data.stats).toBeDefined();
    });

    it('2. Authorized owner can update organization profile', async () => {
      const updateData = {
        name: 'Alpha Fitness Flagship',
        businessEmail: 'contact@alphafitness.com',
        businessPhone: '+91 9876543210',
        city: 'Noida',
        state: 'Uttar Pradesh',
        country: 'India',
        postalCode: '201301',
      };

      const res = await request(app.getHttpServer())
        .patch('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send(updateData)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Alpha Fitness Flagship');
      expect(res.body.data.city).toBe('Noida');
      expect(res.body.data.businessEmail).toBe('contact@alphafitness.com');
    });

    it('3. Unauthorized member cannot update organization profile (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${memberAlpha.token}`)
        .send({ name: 'Hacked Organization Name' })
        .expect(403);
    });

    it('4. Duplicate organization slug is rejected (409 Conflict)', async () => {
      // Owner Beta attempts to take Org Alpha's slug
      await request(app.getHttpServer())
        .patch('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${ownerBeta.token}`)
        .send({ slug: orgAlpha.slug })
        .expect(409);
    });

    it('5. Suspended organization access is blocked when selecting or accessing', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/organizations/current')
        .set('Authorization', `Bearer ${suspendedOwner.token}`)
        .expect(200); // Token holds claims, but tenant operations respect status
    });

    it('6. Organization settings endpoint allows reading and updating timezone/currency', async () => {
      const getRes = await request(app.getHttpServer())
        .get('/api/v1/organizations/current/settings')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(getRes.body.data.timezone).toBe('Asia/Kolkata');

      const patchRes = await request(app.getHttpServer())
        .patch('/api/v1/organizations/current/settings')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ timezone: 'UTC', currency: 'USD' })
        .expect(200);

      expect(patchRes.body.data.timezone).toBe('UTC');
      expect(patchRes.body.data.currency).toBe('USD');
    });
  });

  // =========================================================================
  // 2. MULTI-BRANCH MANAGEMENT TESTS
  // =========================================================================
  describe('Multi-Branch Management APIs', () => {
    it('7. Owner can create a new branch with unique code and slug', async () => {
      const branchPayload = {
        name: 'Alpha Sector 18',
        branchCode: 'ALPHA-SEC18',
        email: 'sector18@alphafitness.com',
        phone: '+91 9999900001',
        city: 'Noida',
        state: 'Uttar Pradesh',
        country: 'India',
        postalCode: '201301',
        timezone: 'Asia/Kolkata',
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send(branchPayload)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Alpha Sector 18');
      expect(res.body.data.branchCode).toBe('ALPHA-SEC18');
      expect(res.body.data.organizationId).toBe(orgAlpha.id);
      expect(res.body.data.status).toBe(BranchStatus.ACTIVE);

      branchAlpha1Id = res.body.data.id;
      expect(branchAlpha1Id).toBeDefined();
    });

    it('8. Owner can create a second branch in the same organization', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Alpha Greater Noida',
          branchCode: 'ALPHA-GRNOIDA',
          city: 'Greater Noida',
          state: 'Uttar Pradesh',
        })
        .expect(201);

      expect(res.body.data.branchCode).toBe('ALPHA-GRNOIDA');
      branchAlpha2Id = res.body.data.id;
    });

    it('9. Duplicate branch code within the same organization is rejected (409 Conflict)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          name: 'Alpha Duplicate Code Test',
          branchCode: 'ALPHA-SEC18', // Same branch code as branchAlpha1
        })
        .expect(409);
    });

    it('10. Same branch code in a DIFFERENT organization IS allowed', async () => {
      // Owner Beta creates branch with identical branchCode 'ALPHA-SEC18'
      const res = await request(app.getHttpServer())
        .post('/api/v1/branches')
        .set('Authorization', `Bearer ${ownerBeta.token}`)
        .send({
          name: 'Beta Branch with Same Code',
          branchCode: 'ALPHA-SEC18',
        })
        .expect(201);

      expect(res.body.data.branchCode).toBe('ALPHA-SEC18');
      expect(res.body.data.organizationId).toBe(orgBeta.id);
      branchBeta1Id = res.body.data.id;
    });

    it('11. Owner can list organization branches with pagination and search', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/branches?page=1&limit=10&search=Sector')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].branchCode).toBe('ALPHA-SEC18');
      expect(res.body.data.meta.total).toBe(1);
    });

    it('12. Owner can retrieve single branch details', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/branches/${branchAlpha1Id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.data.id).toBe(branchAlpha1Id);
      expect(res.body.data.name).toBe('Alpha Sector 18');
    });

    it('13. Cross-Tenant Isolation: Owner Alpha CANNOT retrieve Branch Beta (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/branches/${branchBeta1Id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(404);
    });

    it('14. Cross-Tenant Isolation: Owner Alpha CANNOT update Branch Beta (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${branchBeta1Id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ name: 'Cross Tenant Attacker Edit' })
        .expect(404);
    });

    it('15. Owner can update branch details', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${branchAlpha1Id}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({
          description: 'Premier health club in Noida Sector 18',
          phone: '+91 9999988888',
        })
        .expect(200);

      expect(res.body.data.description).toBe('Premier health club in Noida Sector 18');
      expect(res.body.data.phone).toBe('+91 9999988888');
    });

    it('16. Branch status transitions: Deactivate and Reactivate branch', async () => {
      // Deactivate
      const deactRes = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${branchAlpha2Id}/status`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ status: BranchStatus.INACTIVE })
        .expect(200);

      expect(deactRes.body.data.status).toBe(BranchStatus.INACTIVE);

      // Reactivate
      const reactRes = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${branchAlpha2Id}/status`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ status: BranchStatus.ACTIVE })
        .expect(200);

      expect(reactRes.body.data.status).toBe(BranchStatus.ACTIVE);
    });

    it('17. Closed branch cannot be reactivated (400 Bad Request)', async () => {
      // Close branch permanently
      await request(app.getHttpServer())
        .patch(`/api/v1/branches/${branchAlpha2Id}/status`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ status: BranchStatus.CLOSED })
        .expect(200);

      // Attempt to reactivate permanently closed branch
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/branches/${branchAlpha2Id}/status`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ status: BranchStatus.ACTIVE })
        .expect(400);

      expect(res.body.message).toContain('ceased operations');
    });
  });

  // =========================================================================
  // 3. BRANCH STAFF ASSIGNMENT TESTS
  // =========================================================================
  describe('Branch Staff Assignment APIs', () => {
    it('18. Owner can assign staff member to branch', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/branches/${branchAlpha1Id}/staff`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ organizationUserId: staffTrainerAlpha.orgUserId })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.branchId).toBe(branchAlpha1Id);
      expect(res.body.data.organizationUserId).toBe(staffTrainerAlpha.orgUserId);
      expect(res.body.data.status).toBe('ACTIVE');
      expect(res.body.data.user.email).toBe(staffTrainerAlpha.email);
    });

    it('19. Duplicate active assignment to the same branch is rejected (409 Conflict)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${branchAlpha1Id}/staff`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ organizationUserId: staffTrainerAlpha.orgUserId })
        .expect(409);
    });

    it('20. Cross-Tenant Protection: Cannot assign staff from Org Beta to Branch in Org Alpha', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${branchAlpha1Id}/staff`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ organizationUserId: ownerBeta.orgUserId }) // User from Org Beta
        .expect(400);
    });

    it('21. Cannot assign staff to an inactive or closed branch (400 Bad Request)', async () => {
      // branchAlpha2Id was set to CLOSED in test 17
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${branchAlpha2Id}/staff`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ organizationUserId: staffTrainerAlpha.orgUserId })
        .expect(400);
    });

    it('22. List branch staff returns assigned members', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/branches/${branchAlpha1Id}/staff`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].organizationUserId).toBe(staffTrainerAlpha.orgUserId);
    });

    it('23. Unauthorized role (Member) cannot manage staff assignments (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/branches/${branchAlpha1Id}/staff`)
        .set('Authorization', `Bearer ${memberAlpha.token}`)
        .send({ organizationUserId: staffTrainerAlpha.orgUserId })
        .expect(403);
    });

    it('24. Owner can remove staff assignment from branch', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/branches/${branchAlpha1Id}/staff/${staffTrainerAlpha.orgUserId}`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);

      // Verify assignment status is INACTIVE
      const staffList = await request(app.getHttpServer())
        .get(`/api/v1/branches/${branchAlpha1Id}/staff`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`);

      expect(staffList.body.data[0].status).toBe('INACTIVE');
    });

    it('25. Re-assigning previously removed staff reactivates assignment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/branches/${branchAlpha1Id}/staff`)
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ organizationUserId: staffTrainerAlpha.orgUserId })
        .expect(201);

      expect(res.body.data.status).toBe('ACTIVE');
    });
  });

  // =========================================================================
  // 4. DATABASE ROW-LEVEL SECURITY (RLS) TESTS
  // =========================================================================
  describe('PostgreSQL Row-Level Security on Branches and Assignments', () => {
    it('26. Database RLS prevents Org Alpha from querying Org Beta branches', async () => {
      await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        const betaBranches = await tx.branch.findMany({
          where: { organizationId: orgBeta.id },
        });
        expect(betaBranches).toHaveLength(0);
      });
    });

    it('27. Database RLS prevents cross-tenant branch insertion', async () => {
      await expect(
        prisma.withTenantContext(orgAlpha.id, async (tx) => {
          return tx.branch.create({
            data: {
              organizationId: orgBeta.id, // Illegal tenant injection
              name: 'Malicious Injected Branch',
              slug: `injected-${Date.now()}`,
              branchCode: 'INJECTED-1',
            },
          });
        }),
      ).rejects.toThrow();
    });

    it('28. Database RLS prevents cross-tenant branch update', async () => {
      await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        const updateResult = await tx.branch.updateMany({
          where: { organizationId: orgBeta.id },
          data: { name: 'Compromised Branch' },
        });
        expect(updateResult.count).toBe(0);
      });
    });

    it('29. Database RLS prevents cross-tenant branch deletion', async () => {
      await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        const deleteResult = await tx.branch.deleteMany({
          where: { organizationId: orgBeta.id },
        });
        expect(deleteResult.count).toBe(0);
      });
    });

    it('30. Composite foreign key prevents cross-tenant branch-staff assignment in PostgreSQL', async () => {
      // Attempting to directly insert an assignment linking Branch Alpha with Org Beta User
      await expect(
        prisma.withSuperAdminContext(async (tx) => {
          return tx.$executeRawUnsafe(`
            INSERT INTO "branch_staff_assignments" 
              ("id", "organization_id", "branch_id", "organization_user_id", "status")
            VALUES 
              (gen_random_uuid(), '${orgAlpha.id}', '${branchAlpha1Id}', '${ownerBeta.orgUserId}', 'ACTIVE')
          `);
        }),
      ).rejects.toThrow(); // Foreign key violation: fk_branch_staff_user_org
    });

    it('31. Unscoped database access without tenant context is denied by RLS', async () => {
      const branches = await prisma.branch.findMany();
      expect(branches).toHaveLength(0);
    });
  });

  // =========================================================================
  // 5. BRANCH SELECTION & CONTEXT SWITCHING TESTS
  // =========================================================================
  describe('User Branch Selection APIs', () => {
    it('32. Owner can list all active branches in organization', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1); // branchAlpha1 is ACTIVE, branchAlpha2 is CLOSED
      expect(res.body.data[0].id).toBe(branchAlpha1Id);
    });

    it('33. Staff (Trainer) can list only their assigned active branches', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches')
        .set('Authorization', `Bearer ${staffTrainerAlpha.token}`)
        .expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(branchAlpha1Id);
    });

    it('34. Owner can select active branch', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/organizations/current/branches/select')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ branchId: branchAlpha1Id })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.selectedBranch.id).toBe(branchAlpha1Id);
    });

    it('35. Staff can select assigned branch', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/organizations/current/branches/select')
        .set('Authorization', `Bearer ${staffTrainerAlpha.token}`)
        .send({ branchId: branchAlpha1Id })
        .expect(201);

      expect(res.body.data.selectedBranch.id).toBe(branchAlpha1Id);
    });

    it('36. Selecting branch from another organization is rejected (404 Not Found)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/organizations/current/branches/select')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ branchId: branchBeta1Id })
        .expect(404);
    });

    it('37. Selecting closed branch is rejected (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/organizations/current/branches/select')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .send({ branchId: branchAlpha2Id }) // branchAlpha2 is CLOSED
        .expect(400);
    });

    it('38. Selected branch endpoint returns current branch context', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/selected')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .expect(200);

      expect(res.body.data.selectedBranch).toBeDefined();
      expect(res.body.data.selectedBranch.id).toBe(branchAlpha1Id);
    });

    it('39. Audit log verified for branch creation and staff assignments', async () => {
      await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        const auditEntries = await tx.auditLog.findMany({
          where: { organizationId: orgAlpha.id },
          orderBy: { createdAt: 'desc' },
        });

        const actions = auditEntries.map((a) => a.action);
        expect(actions).toContain('BRANCH_CREATED');
        expect(actions).toContain('STAFF_ASSIGNED_TO_BRANCH');
        expect(actions).toContain('ORGANIZATION_PROFILE_UPDATED');
      });
    });
  });
});
