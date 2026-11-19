import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';
import { TokenService } from '../src/auth/token.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { UserRole, UserStatus, TenantStatus, BranchStatus, AssignmentStatus } from '@gymos/shared-types';

describe('Branch Security & Authorization Audit (E2E Integration & Penetration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHasher: PasswordHasherService;
  let tokenService: TokenService;

  // Organizations
  let orgAlpha: { id: string; name: string; slug: string };
  let orgBeta: { id: string; name: string; slug: string };

  // Users & Tokens
  let ownerAlpha: { id: string; email: string; token: string; orgUserId: string };
  let trainerAlpha: { id: string; email: string; token: string; orgUserId: string };
  let receptionistAlpha: { id: string; email: string; token: string; orgUserId: string };
  let ownerBeta: { id: string; email: string; token: string; orgUserId: string };

  // Branches
  let branchAlpha1Id: string; // Active - Trainer assigned, Receptionist assigned
  let branchAlpha2Id: string; // Active - Unassigned to Trainer & Receptionist
  let branchAlphaInactiveId: string; // Inactive
  let branchAlphaClosedId: string; // Closed
  let branchBeta1Id: string; // Belongs to Org Beta

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

    const defaultPassword = 'SecureSecurityTest2026!';
    const passwordHash = await passwordHasher.hashPassword(defaultPassword);
    const timestamp = Date.now();

    // 1. Seed Organizations, Users, Branches, and Assignments cleanly outside RLS
    await prisma.withSuperAdminContext(async (tx) => {
      // Org Alpha
      const oAlpha = await tx.organization.create({
        data: {
          name: `Alpha Security Org ${timestamp}`,
          slug: `alpha-sec-${timestamp}`,
          status: TenantStatus.ACTIVE,
        },
      });
      orgAlpha = { id: oAlpha.id, name: oAlpha.name, slug: oAlpha.slug };

      // Org Beta
      const oBeta = await tx.organization.create({
        data: {
          name: `Beta Security Org ${timestamp}`,
          slug: `beta-sec-${timestamp}`,
          status: TenantStatus.ACTIVE,
        },
      });
      orgBeta = { id: oBeta.id, name: oBeta.name, slug: oBeta.slug };

      // Users for Org Alpha: Owner, Trainer, Receptionist
      const uOwnerA = await tx.user.create({
        data: {
          email: `owner-sec-alpha-${timestamp}@gymos.test`,
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
      ownerAlpha = { id: uOwnerA.id, email: uOwnerA.email, token: '', orgUserId: ouOwnerA.id };

      const uTrainerA = await tx.user.create({
        data: {
          email: `trainer-sec-alpha-${timestamp}@gymos.test`,
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
      trainerAlpha = { id: uTrainerA.id, email: uTrainerA.email, token: '', orgUserId: ouTrainerA.id };

      const uReceptA = await tx.user.create({
        data: {
          email: `recept-sec-alpha-${timestamp}@gymos.test`,
          passwordHash,
          firstName: 'Alpha',
          lastName: 'Receptionist',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      const ouReceptA = await tx.organizationUser.create({
        data: {
          organizationId: orgAlpha.id,
          userId: uReceptA.id,
          role: UserRole.RECEPTIONIST,
        },
      });
      receptionistAlpha = { id: uReceptA.id, email: uReceptA.email, token: '', orgUserId: ouReceptA.id };

      // User for Org Beta: Owner Beta
      const uOwnerB = await tx.user.create({
        data: {
          email: `owner-sec-beta-${timestamp}@gymos.test`,
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
      ownerBeta = { id: uOwnerB.id, email: uOwnerB.email, token: '', orgUserId: ouOwnerB.id };

      // Branches in Org Alpha
      const bAlpha1 = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Downtown (Assigned)',
          slug: 'alpha-downtown',
          branchCode: `ADW-${timestamp.toString().slice(-4)}`,
          status: BranchStatus.ACTIVE,
        },
      });
      branchAlpha1Id = bAlpha1.id;

      const bAlpha2 = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Uptown (Unassigned)',
          slug: 'alpha-uptown',
          branchCode: `AUP-${timestamp.toString().slice(-4)}`,
          status: BranchStatus.ACTIVE,
        },
      });
      branchAlpha2Id = bAlpha2.id;

      const bAlphaInact = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Maintenance Branch',
          slug: 'alpha-maintenance',
          branchCode: `AMN-${timestamp.toString().slice(-4)}`,
          status: BranchStatus.INACTIVE,
        },
      });
      branchAlphaInactiveId = bAlphaInact.id;

      const bAlphaClosed = await tx.branch.create({
        data: {
          organizationId: orgAlpha.id,
          name: 'Alpha Ceased Operations',
          slug: 'alpha-closed',
          branchCode: `ACL-${timestamp.toString().slice(-4)}`,
          status: BranchStatus.CLOSED,
        },
      });
      branchAlphaClosedId = bAlphaClosed.id;

      // Branch in Org Beta
      const bBeta1 = await tx.branch.create({
        data: {
          organizationId: orgBeta.id,
          name: 'Beta Central Branch',
          slug: 'beta-central',
          branchCode: `BCT-${timestamp.toString().slice(-4)}`,
          status: BranchStatus.ACTIVE,
        },
      });
      branchBeta1Id = bBeta1.id;

      // Assign Trainer & Receptionist to Branch Alpha 1 ONLY
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          organizationUserId: trainerAlpha.orgUserId,
          status: AssignmentStatus.ACTIVE,
          assignedBy: ownerAlpha.id,
        },
      });

      await tx.branchStaffAssignment.create({
        data: {
          organizationId: orgAlpha.id,
          branchId: branchAlpha1Id,
          organizationUserId: receptionistAlpha.orgUserId,
          status: AssignmentStatus.ACTIVE,
          assignedBy: ownerAlpha.id,
        },
      });
    });

    // Generate JWT access tokens
    const [tOwnerA, tTrainerA, tReceptA, tOwnerB] = await Promise.all([
      tokenService.issueTokens(ownerAlpha.id, ownerAlpha.email, false, orgAlpha.id, UserRole.GYM_OWNER),
      tokenService.issueTokens(trainerAlpha.id, trainerAlpha.email, false, orgAlpha.id, UserRole.TRAINER),
      tokenService.issueTokens(receptionistAlpha.id, receptionistAlpha.email, false, orgAlpha.id, UserRole.RECEPTIONIST),
      tokenService.issueTokens(ownerBeta.id, ownerBeta.email, false, orgBeta.id, UserRole.GYM_OWNER),
    ]);

    ownerAlpha.token = tOwnerA.accessToken;
    trainerAlpha.token = tTrainerA.accessToken;
    receptionistAlpha.token = tReceptA.accessToken;
    ownerBeta.token = tOwnerB.accessToken;
  });

  afterAll(async () => {
    // Teardown test data outside RLS
    await prisma.withSuperAdminContext(async (tx) => {
      const orgIds = [orgAlpha?.id, orgBeta?.id].filter(Boolean);
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
        trainerAlpha?.id,
        receptionistAlpha?.id,
        ownerBeta?.id,
      ].filter(Boolean);
      await tx.user.deleteMany({
        where: { id: { in: userIds } },
      });
    });

    await app.close();
  });

  describe('Check 1: Owner Organization-Wide Access Policy', () => {
    it('1.1 Owner can access assigned Branch 1 via x-branch-id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('x-branch-id', branchAlpha1Id)
        .expect(200);

      expect(res.body.data.branch).toBeDefined();
      expect(res.body.data.branch.id).toBe(branchAlpha1Id);
      expect(res.body.data.branch.name).toBe('Alpha Downtown (Assigned)');
    });

    it('1.2 Owner can access unassigned Branch 2 via x-branch-id (org-wide authority)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('x-branch-id', branchAlpha2Id)
        .expect(200);

      expect(res.body.data.branch).toBeDefined();
      expect(res.body.data.branch.id).toBe(branchAlpha2Id);
      expect(res.body.data.branch.name).toBe('Alpha Uptown (Unassigned)');
    });
  });

  describe('Check 2: Staff Branch Restriction Enforcement', () => {
    it('2.1 Assigned Trainer can access Branch 1 via x-branch-id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .set('x-branch-id', branchAlpha1Id)
        .expect(200);

      expect(res.body.data.branch.id).toBe(branchAlpha1Id);
    });

    it('2.2 Unassigned Trainer is FORBIDDEN (403) from accessing Branch 2 via x-branch-id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .set('x-branch-id', branchAlpha2Id)
        .expect(403);

      expect(res.body.message).toContain('You are not assigned to this branch');
    });

    it('2.3 Assigned Receptionist can access Branch 1 via x-branch-id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .set('x-branch-id', branchAlpha1Id)
        .expect(200);

      expect(res.body.data.branch.id).toBe(branchAlpha1Id);
    });

    it('2.4 Unassigned Receptionist is FORBIDDEN (403) from accessing Branch 2 via x-branch-id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${receptionistAlpha.token}`)
        .set('x-branch-id', branchAlpha2Id)
        .expect(403);

      expect(res.body.message).toContain('You are not assigned to this branch');
    });
  });

  describe('Check 3: Cross-Tenant Branch Isolation', () => {
    it('3.1 Owner Alpha cannot access Branch Beta via x-branch-id (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('x-branch-id', branchBeta1Id)
        .expect(404);

      expect(res.body.message).toContain('Branch not found in current organization');
    });

    it('3.2 Staff Trainer Alpha cannot access Branch Beta via x-branch-id (404 Not Found)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .set('x-branch-id', branchBeta1Id)
        .expect(404);

      expect(res.body.message).toContain('Branch not found in current organization');
    });
  });

  describe('Check 4: Inactive and Closed Branch Protection', () => {
    it('4.1 Inactive branch access is blocked for operational workflows (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('x-branch-id', branchAlphaInactiveId)
        .expect(400);

      expect(res.body.message).toContain('Branch is inactive and cannot be used for operational workflows');
    });

    it('4.2 Closed branch access is blocked for operational workflows (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('x-branch-id', branchAlphaClosedId)
        .expect(400);

      expect(res.body.message).toContain('Branch is closed and cannot be used for operational workflows');
    });
  });

  describe('Check 5: Header Validation & Attack Vectors', () => {
    it('5.1 Missing branch context header returns 400 Bad Request on required endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        // No x-branch-id header
        .expect(400);

      expect(res.body.message).toContain('Branch context required');
    });

    it('5.2 Malformed non-UUID x-branch-id is rejected (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('x-branch-id', 'invalid-non-uuid-string')
        .expect(400);

      expect(res.body.message).toContain('Invalid branch ID format');
    });

    it('5.3 SQL Injection payload in x-branch-id is safely rejected (400 Bad Request)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('x-branch-id', "'; DROP TABLE branches; --")
        .expect(400);

      expect(res.body.message).toContain('Invalid branch ID format');
    });

    it('5.4 Non-existent branch UUID is rejected (404 Not Found)', async () => {
      const randomUuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/current-context')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('x-branch-id', randomUuid)
        .expect(404);

      expect(res.body.message).toContain('Branch not found in current organization');
    });

    it('5.5 Selected branch endpoint validates requested x-branch-id', async () => {
      // Valid branch
      const resValid = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/selected')
        .set('Authorization', `Bearer ${ownerAlpha.token}`)
        .set('x-branch-id', branchAlpha2Id)
        .expect(200);
      expect(resValid.body.data.selectedBranch.id).toBe(branchAlpha2Id);

      // Unassigned staff requested branch rejected with 403
      await request(app.getHttpServer())
        .get('/api/v1/auth/organizations/current/branches/selected')
        .set('Authorization', `Bearer ${trainerAlpha.token}`)
        .set('x-branch-id', branchAlpha2Id)
        .expect(403);
    });
  });

  describe('Check 6: Concurrent Execution and Context Safety', () => {
    it('6.1 Parallel requests maintain thread-safe isolated branch contexts', async () => {
      const results = await Promise.all([
        // Request 1: Owner Alpha -> Branch 1 (Valid)
        request(app.getHttpServer())
          .get('/api/v1/auth/organizations/current/branches/current-context')
          .set('Authorization', `Bearer ${ownerAlpha.token}`)
          .set('x-branch-id', branchAlpha1Id),

        // Request 2: Owner Alpha -> Branch 2 (Valid)
        request(app.getHttpServer())
          .get('/api/v1/auth/organizations/current/branches/current-context')
          .set('Authorization', `Bearer ${ownerAlpha.token}`)
          .set('x-branch-id', branchAlpha2Id),

        // Request 3: Trainer Alpha -> Branch 1 (Valid assigned)
        request(app.getHttpServer())
          .get('/api/v1/auth/organizations/current/branches/current-context')
          .set('Authorization', `Bearer ${trainerAlpha.token}`)
          .set('x-branch-id', branchAlpha1Id),

        // Request 4: Trainer Alpha -> Branch 2 (Forbidden unassigned)
        request(app.getHttpServer())
          .get('/api/v1/auth/organizations/current/branches/current-context')
          .set('Authorization', `Bearer ${trainerAlpha.token}`)
          .set('x-branch-id', branchAlpha2Id),

        // Request 5: Owner Beta -> Branch Beta 1 (Valid)
        request(app.getHttpServer())
          .get('/api/v1/auth/organizations/current/branches/current-context')
          .set('Authorization', `Bearer ${ownerBeta.token}`)
          .set('x-branch-id', branchBeta1Id),

        // Request 6: Owner Beta -> Branch Alpha 1 (Cross-tenant 404)
        request(app.getHttpServer())
          .get('/api/v1/auth/organizations/current/branches/current-context')
          .set('Authorization', `Bearer ${ownerBeta.token}`)
          .set('x-branch-id', branchAlpha1Id),
      ]);

      expect(results[0].status).toBe(200);
      expect(results[0].body.data.branch.id).toBe(branchAlpha1Id);

      expect(results[1].status).toBe(200);
      expect(results[1].body.data.branch.id).toBe(branchAlpha2Id);

      expect(results[2].status).toBe(200);
      expect(results[2].body.data.branch.id).toBe(branchAlpha1Id);

      expect(results[3].status).toBe(403);

      expect(results[4].status).toBe(200);
      expect(results[4].body.data.branch.id).toBe(branchBeta1Id);

      expect(results[5].status).toBe(404);
    });
  });

  describe('Check 7: PostgreSQL Database Level RLS Verification', () => {
    it('7.1 RLS prevents application database role from reading cross-tenant branches', async () => {
      await prisma.withTenantContext(orgAlpha.id, async (tx) => {
        // Querying for Beta branch while in Alpha tenant context
        const crossTenantBranch = await tx.branch.findUnique({
          where: { id: branchBeta1Id },
        });

        // PostgreSQL RLS policy filters out rows where organization_id != app.current_tenant_id
        expect(crossTenantBranch).toBeNull();
      });
    });

    it('7.2 RLS prevents application database role from inserting branch into foreign tenant', async () => {
      await expect(
        prisma.withTenantContext(orgAlpha.id, async (tx) => {
          await tx.branch.create({
            data: {
              organizationId: orgBeta.id, // Foreign organization ID
              name: 'Injected Foreign Branch',
              slug: 'injected-foreign-branch',
              branchCode: 'INJ-001',
              status: BranchStatus.ACTIVE,
            },
          });
        }),
      ).rejects.toThrow();
    });
  });
});
