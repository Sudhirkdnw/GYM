import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { UserRole, UserStatus } from '@gymos/shared-types';

describe('Multi-Tenant Row-Level Security & Isolation (e2e)', () => {
  let prisma: PrismaService;
  let tenantAId: string;
  let tenantBId: string;
  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
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

  describe('PostgreSQL Kernel Security Attributes Verification', () => {
    it('should verify connected role is gymos_user without BYPASSRLS or SUPERUSER privileges', async () => {
      const roleInfo = await prisma.$queryRaw<Array<{ rolname: string; rolsuper: boolean; rolbypassrls: boolean }>>`
        SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user;
      `;
      expect(roleInfo.length).toBe(1);
      expect(roleInfo[0]?.rolname).toBe('gymos_user');
      expect(roleInfo[0]?.rolsuper).toBe(false);
      expect(roleInfo[0]?.rolbypassrls).toBe(false);
    });

    it('should verify RLS is ENABLED and FORCED on tenant-owned tables', async () => {
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

  describe('Default Deny Isolation (No Tenant Context Set)', () => {
    it('should return 0 organizations when no tenant context is established', async () => {
      const orgs = await prisma.organization.findMany();
      expect(orgs).toHaveLength(0);
    });

    it('should return 0 organization_users when no tenant context is established', async () => {
      const orgUsers = await prisma.organizationUser.findMany();
      expect(orgUsers).toHaveLength(0);
    });

    it('should return 0 audit_logs when no tenant context is established', async () => {
      const logs = await prisma.auditLog.findMany();
      expect(logs).toHaveLength(0);
    });
  });

  describe('Tenant Scoped Access (Tenant Alpha Context)', () => {
    it('should only see Tenant Alpha and never Tenant Beta', async () => {
      await prisma.withTenantContext(tenantAId, async (tx) => {
        const orgs = await tx.organization.findMany();
        expect(orgs).toHaveLength(1);
        expect(orgs[0]?.id).toBe(tenantAId);
        expect(orgs[0]?.name).toBe('Tenant Alpha Fitness');
      });
    });

    it('should only see Tenant Alpha users and audit logs', async () => {
      await prisma.withTenantContext(tenantAId, async (tx) => {
        const orgUsers = await tx.organizationUser.findMany();
        expect(orgUsers).toHaveLength(1);
        expect(orgUsers[0]?.organizationId).toBe(tenantAId);
        expect(orgUsers[0]?.userId).toBe(userAId);

        const logs = await tx.auditLog.findMany();
        expect(logs).toHaveLength(1);
        expect(logs[0]?.organizationId).toBe(tenantAId);
      });
    });
  });

  describe('Cross-Tenant Penetration Attacks (Tenant Alpha Attempting to Access Tenant Beta)', () => {
    it('Penetration Attack 1 [SELECT]: Tenant Alpha attempting to read Tenant Beta by ID returns null', async () => {
      await prisma.withTenantContext(tenantAId, async (tx) => {
        const targetOrg = await tx.organization.findUnique({
          where: { id: tenantBId },
        });
        expect(targetOrg).toBeNull();
      });
    });

    it('Penetration Attack 2 [SELECT FILTER]: Tenant Alpha searching explicitly for Tenant Beta records returns empty array', async () => {
      await prisma.withTenantContext(tenantAId, async (tx) => {
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

    it('Penetration Attack 3 [INSERT TAMPERING]: Tenant Alpha attempting to insert row into Tenant Beta fails with RLS policy error', async () => {
      await expect(
        prisma.withTenantContext(tenantAId, async (tx) => {
          // Attempt to illegally insert an audit log into Tenant Beta's partition
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

    it('Penetration Attack 4 [UPDATE TAMPERING]: Tenant Alpha attempting to update Tenant Beta organization fails or affects 0 rows', async () => {
      await prisma.withTenantContext(tenantAId, async (tx) => {
        // Attempt to update Tenant Beta's name
        const updateResult = await tx.organization.updateMany({
          where: { id: tenantBId },
          data: { name: 'Hacked By Tenant Alpha' },
        });
        expect(updateResult.count).toBe(0);
      });

      // Verify in Super Admin context that Tenant Beta remained unmodified
      await prisma.withSuperAdminContext(async (tx) => {
        const betaOrg = await tx.organization.findUnique({ where: { id: tenantBId } });
        expect(betaOrg?.name).toBe('Tenant Beta Gym');
      });
    });

    it('Penetration Attack 5 [DELETE TAMPERING]: Tenant Alpha attempting to delete Tenant Beta records affects 0 rows', async () => {
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
  });

  describe('Super Admin Cross-Tenant Scoping', () => {
    it('should allow Super Admin to query across all tenants simultaneously', async () => {
      await prisma.withSuperAdminContext(async (tx) => {
        const allOrgs = await tx.organization.findMany({
          where: { id: { in: [tenantAId, tenantBId] } },
        });
        expect(allOrgs).toHaveLength(2);
      });
    });
  });
});
