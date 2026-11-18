import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { ForbiddenException } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { UserRole, UserStatus } from '@gymos/shared-types';

describe('Multi-Tenant Row-Level Security & Isolation (e2e)', () => {
  let prisma: PrismaService;
  let tenantService: TenantContextService;
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    tenantService = moduleFixture.get<TenantContextService>(TenantContextService);
    await prisma.$connect();

    // 1. Seed two completely separate organizations using Super Admin context
    tenantAId = randomUUID();
    tenantBId = randomUUID();
    userAId = randomUUID();
    userBId = randomUUID();

    await prisma.withSuperAdminContext(async (tx) => {
      // Create Tenant A
      await tx.organization.create({
        data: {
          id: tenantAId,
          name: 'Tenant Alpha Fitness',
          slug: `alpha-${Date.now()}`,
        },
      });

      // Create Tenant B
      await tx.organization.create({
        data: {
          id: tenantBId,
          name: 'Tenant Beta Gym',
          slug: `beta-${Date.now()}`,
        },
      });

      // Create Global Users
      await tx.user.create({
        data: {
          id: userAId,
          email: `alpha-owner-${Date.now()}@alpha.com`,
          passwordHash: 'dummy-hash-alpha',
          firstName: 'Alpha',
          lastName: 'Owner',
          status: UserStatus.ACTIVE,
        },
      });

      await tx.user.create({
        data: {
          id: userBId,
          email: `beta-owner-${Date.now()}@beta.com`,
          passwordHash: 'dummy-hash-beta',
          firstName: 'Beta',
          lastName: 'Owner',
          status: UserStatus.ACTIVE,
        },
      });

      // Associate User A to Tenant A
      await tx.organizationUser.create({
        data: {
          organizationId: tenantAId,
          userId: userAId,
          role: UserRole.ORG_OWNER,
        },
      });

      // Associate User B to Tenant B
      await tx.organizationUser.create({
        data: {
          organizationId: tenantBId,
          userId: userBId,
          role: UserRole.ORG_OWNER,
        },
      });

      // Create Audit Logs for both tenants
      await tx.auditLog.create({
        data: {
          organizationId: tenantAId,
          userId: userAId,
          action: 'TENANT_CREATED',
          entity: 'organization',
          entityId: tenantAId,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: tenantBId,
          userId: userBId,
          action: 'TENANT_CREATED',
          entity: 'organization',
          entityId: tenantBId,
        },
      });
    });
  });

  afterAll(async () => {
    // Clean up seeded data in super admin context
    await prisma.withSuperAdminContext(async (tx) => {
      await tx.auditLog.deleteMany({
        where: { organizationId: { in: [tenantAId, tenantBId] } },
      });
      await tx.organizationUser.deleteMany({
        where: { organizationId: { in: [tenantAId, tenantBId] } },
      });
      await tx.organization.deleteMany({
        where: { id: { in: [tenantAId, tenantBId] } },
      });
      await tx.user.deleteMany({
        where: { id: { in: [userAId, userBId] } },
      });
    });

    await prisma.$disconnect();
  });

  describe('PHASE 5: PostgreSQL Database Role Security Attributes Verification', () => {
    it('1. should verify connected role is gymos_user without BYPASSRLS or SUPERUSER privileges', async () => {
      const roleInfo = await prisma.$queryRaw<Array<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>>`
        SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
      `;
      expect(roleInfo.length).toBe(1);
      expect(roleInfo[0]?.rolname).toBe('gymos_user');
      expect(roleInfo[0]?.rolsuper).toBe(false);
      expect(roleInfo[0]?.rolbypassrls).toBe(false);
    });

    it('2. should verify RLS is ENABLED and FORCED on tenant-owned tables', async () => {
      const tables = await prisma.$queryRaw<Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>>`
        SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('organizations', 'organization_users', 'audit_logs')
        ORDER BY c.relname;
      `;
      expect(tables.length).toBe(3);
      for (const t of tables) {
        expect(t.relrowsecurity).toBe(true);
        expect(t.relforcerowsecurity).toBe(true);
      }
    });
  });

  describe('PHASE 6: Core Multi-Tenant Isolation & Penetration Tests', () => {
    it('Test 1: Organization A can read its own records', async () => {
      await prisma.withTenantContext(tenantAId, async (tx) => {
        const orgs = await tx.organization.findMany();
        expect(orgs).toHaveLength(1);
        expect(orgs[0]?.id).toBe(tenantAId);
        expect(orgs[0]?.name).toBe('Tenant Alpha Fitness');

        const orgUsers = await tx.organizationUser.findMany();
        expect(orgUsers).toHaveLength(1);
        expect(orgUsers[0]?.organizationId).toBe(tenantAId);
        expect(orgUsers[0]?.userId).toBe(userAId);
      });
    });

    it('Test 2: Organization A cannot read Organization B records', async () => {
      await prisma.withTenantContext(tenantAId, async (tx) => {
        const targetOrg = await tx.organization.findUnique({
          where: { id: tenantBId },
        });
        expect(targetOrg).toBeNull();

        const stolenUsers = await tx.organizationUser.findMany({
          where: { organizationId: tenantBId },
        });
        expect(stolenUsers).toHaveLength(0);

        const stolenLogs = await tx.auditLog.findMany({
          where: { organizationId: tenantBId },
        });
        expect(stolenLogs).toHaveLength(0);
      });
    });

    it('Test 3: Organization A cannot update Organization B records', async () => {
      await prisma.withTenantContext(tenantAId, async (tx) => {
        const updateResult = await tx.organization.updateMany({
          where: { id: tenantBId },
          data: { name: 'Hacked By Tenant Alpha' },
        });
        expect(updateResult.count).toBe(0);
      });

      // Verify data remains unmodified
      await prisma.withSuperAdminContext(async (tx) => {
        const betaOrg = await tx.organization.findUnique({ where: { id: tenantBId } });
        expect(betaOrg?.name).toBe('Tenant Beta Gym');
      });
    });

    it('Test 4: Organization A cannot delete Organization B records', async () => {
      await prisma.withTenantContext(tenantAId, async (tx) => {
        const deleteResult = await tx.auditLog.deleteMany({
          where: { organizationId: tenantBId },
        });
        expect(deleteResult.count).toBe(0);
      });

      // Verify in Super Admin context that Tenant Beta log was not deleted
      await prisma.withSuperAdminContext(async (tx) => {
        const betaLogs = await tx.auditLog.findMany({ where: { organizationId: tenantBId } });
        expect(betaLogs).toHaveLength(1);
      });
    });

    it('Test 5: Organization A cannot insert records belonging to Organization B', async () => {
      await expect(
        prisma.withTenantContext(tenantAId, async (tx) => {
          return tx.auditLog.create({
            data: {
              organizationId: tenantBId,
              userId: userAId,
              action: 'ILLEGAL_CROSS_TENANT_INJECTION',
              entity: 'audit_log',
              entityId: randomUUID(),
            },
          });
        }),
      ).rejects.toThrow();
    });

    it('Test 6: Missing tenant context denies protected access (Default Deny)', async () => {
      const orgs = await prisma.organization.findMany();
      expect(orgs).toHaveLength(0);

      const orgUsers = await prisma.organizationUser.findMany();
      expect(orgUsers).toHaveLength(0);

      const logs = await prisma.auditLog.findMany();
      expect(logs).toHaveLength(0);
    });

    it('Test 7: Invalid tenant context denies protected access', async () => {
      // 7a. Non-UUID format is rejected by input validator
      await expect(
        prisma.withTenantContext('invalid-uuid-1234', async (tx) => {
          return tx.organization.findMany();
        }),
      ).rejects.toThrow('Invalid tenant ID format');

      // 7b. Non-existent valid UUID returns 0 rows due to RLS
      const nonExistentTenantId = randomUUID();
      await prisma.withTenantContext(nonExistentTenantId, async (tx) => {
        const orgs = await tx.organization.findMany();
        expect(orgs).toHaveLength(0);
      });
    });

    it('Test 8: Unauthorized organization membership is rejected', async () => {
      // User A attempts to request Tenant B
      await expect(
        tenantService.resolveMembership(userAId, tenantBId),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Test 9: Cross-tenant foreign-key references are rejected', async () => {
      // Attempt to link a user to Tenant B while operating in Tenant A context
      await expect(
        prisma.withTenantContext(tenantAId, async (tx) => {
          return tx.organizationUser.create({
            data: {
              organizationId: tenantBId,
              userId: userAId,
              role: UserRole.MEMBER,
            },
          });
        }),
      ).rejects.toThrow();
    });

    it('Test 10: Concurrent requests do not leak tenant context', async () => {
      // Execute 20 concurrent interleaved operations between Tenant A and Tenant B
      const tasks = Array.from({ length: 20 }).map((_, index) => {
        const isTenantA = index % 2 === 0;
        const currentTenantId = isTenantA ? tenantAId : tenantBId;
        const expectedName = isTenantA ? 'Tenant Alpha Fitness' : 'Tenant Beta Gym';

        return prisma.withTenantContext(currentTenantId, async (tx) => {
          const org = await tx.organization.findFirst();
          expect(org).not.toBeNull();
          expect(org?.id).toBe(currentTenantId);
          expect(org?.name).toBe(expectedName);
          return org?.id;
        });
      });

      const results = await Promise.all(tasks);
      expect(results).toHaveLength(20);
    });

    it('Test 11: Connection reuse does not leak tenant context', async () => {
      // 1. Run query with Tenant A context
      await prisma.withTenantContext(tenantAId, async (tx) => {
        const orgs = await tx.organization.findMany();
        expect(orgs).toHaveLength(1);
      });

      // 2. Immediately execute an unscoped query on the same connection pool
      // Proves that SET LOCAL was discarded at transaction end
      const unscopedOrgs = await prisma.organization.findMany();
      expect(unscopedOrgs).toHaveLength(0);
    });

    it('Test 12: Transaction rollback and failure do not leave stale tenant context', async () => {
      // 1. Run a failing transaction for Tenant A that throws an error
      try {
        await prisma.withTenantContext(tenantAId, async (tx) => {
          await tx.organization.findMany();
          throw new Error('Intentional transaction abort');
        });
      } catch (err: unknown) {
        expect((err as Error).message).toBe('Intentional transaction abort');
      }

      // 2. Subsequent unscoped query must still have 0 tenant context
      const unscopedOrgs = await prisma.organization.findMany();
      expect(unscopedOrgs).toHaveLength(0);
    });
  });
});
