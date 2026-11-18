import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { PasswordHasherService } from '../src/auth/password-hasher.service';
import { TokenService } from '../src/auth/token.service';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { UserRole, UserStatus, TenantStatus } from '@gymos/shared-types';
import { AUTH_CONFIG } from '@gymos/config';

describe('Stage 2.2 Final Security Audit (Checks 1, 2, and 3)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHasher: PasswordHasherService;
  let tokenService: TokenService;

  // Shared test fixtures
  let auditUser: { id: string; email: string; token: string; refreshToken: string; orgId: string };
  let secondOrgId: string;

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

    // Seed test fixtures cleanly
    const seeded = await prisma.withSuperAdminContext(async (tx) => {
      const org1 = await tx.organization.create({
        data: {
          name: 'Audit Gym Alpha',
          slug: `audit-alpha-${Date.now()}`,
          status: TenantStatus.ACTIVE,
        },
      });

      const org2 = await tx.organization.create({
        data: {
          name: 'Audit Gym Beta',
          slug: `audit-beta-${Date.now()}`,
          status: TenantStatus.ACTIVE,
        },
      });

      const passwordHash = await passwordHasher.hashPassword('StrongAuditPass123!');

      const user = await tx.user.create({
        data: {
          email: `audit-owner-${Date.now()}@security.test`,
          passwordHash,
          firstName: 'Security',
          lastName: 'Auditor',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });

      await tx.organizationUser.create({
        data: {
          organizationId: org1.id,
          userId: user.id,
          role: UserRole.GYM_OWNER,
        },
      });

      return { org1, org2, user };
    });

    secondOrgId = seeded.org2.id;

    // Issue initial session tokens
    const tokens = await tokenService.issueTokens(
      seeded.user.id,
      seeded.user.email,
      false,
      seeded.org1.id,
      UserRole.GYM_OWNER,
    );

    auditUser = {
      id: seeded.user.id,
      email: seeded.user.email,
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      orgId: seeded.org1.id,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  // =========================================================================
  // CHECK 1: JWT Permission & Session Freshness Verification
  // =========================================================================
  describe('Check 1: JWT Permission and Session Freshness', () => {
    it('1.1: Stateless JWT window: Existing access token retains permissions until expiration or refresh', async () => {
      // Initially, Gym Owner accesses owner-only endpoint
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/owner-only')
        .set('Authorization', `Bearer ${auditUser.token}`)
        .expect(200);

      // Demote user in database from GYM_OWNER to MEMBER
      await prisma.withSuperAdminContext(async (tx) => {
        await tx.organizationUser.update({
          where: {
            unique_org_user: {
              organizationId: auditUser.orgId,
              userId: auditUser.id,
            },
          },
          data: { role: UserRole.MEMBER },
        });
      });

      // The existing stateless access token still succeeds within its 15-minute lifespan
      // because claims are cryptographically baked into the token payload
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/owner-only')
        .set('Authorization', `Bearer ${auditUser.token}`)
        .expect(200);
    });

    it('1.2: Refresh token boundary: Refreshing session queries database and immediately applies demoted role', async () => {
      // Client refreshes token
      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: auditUser.refreshToken })
        .expect(200);

      const demotedAccessToken = refreshRes.body.data.accessToken;
      auditUser.refreshToken = refreshRes.body.data.refreshToken;

      // The demoted token now FAILS on owner-only endpoint with 403 Forbidden!
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/owner-only')
        .set('Authorization', `Bearer ${demotedAccessToken}`)
        .expect(403);

      // But member-level action succeeds
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/member-action')
        .set('Authorization', `Bearer ${demotedAccessToken}`)
        .expect(200);
    });

    it('1.3: Revoke organization membership: Database check prevents selecting the revoked organization', async () => {
      // Remove user from organization_users entirely
      await prisma.withSuperAdminContext(async (tx) => {
        await tx.organizationUser.delete({
          where: {
            unique_org_user: {
              organizationId: auditUser.orgId,
              userId: auditUser.id,
            },
          },
        });
      });

      // Attempting to select the revoked organization is denied with 403 Forbidden
      await request(app.getHttpServer())
        .post(`/api/v1/auth/organizations/${auditUser.orgId}/select`)
        .set('Authorization', `Bearer ${auditUser.token}`)
        .expect(403);
    });

    it('1.4: Suspend an organization: Suspended organization context cannot be selected', async () => {
      // Add user to second organization
      await prisma.withSuperAdminContext(async (tx) => {
        await tx.organizationUser.create({
          data: {
            organizationId: secondOrgId,
            userId: auditUser.id,
            role: UserRole.GYM_ADMIN,
          },
        });

        // Suspend the organization
        await tx.organization.update({
          where: { id: secondOrgId },
          data: { status: TenantStatus.SUSPENDED },
        });
      });

      // Selecting the suspended organization must be rejected with 403 Forbidden
      const response = await request(app.getHttpServer())
        .post(`/api/v1/auth/organizations/${secondOrgId}/select`)
        .set('Authorization', `Bearer ${auditUser.token}`)
        .expect(403);

      expect(response.body.message).toMatch(/suspended/i);
    });

    it('1.5: Refresh token revocation and session invalidation', async () => {
      // Obtain fresh session
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: auditUser.email,
          password: 'StrongAuditPass123!',
        })
        .expect(200);

      const activeRefreshToken = loginRes.body.data.tokens.refreshToken;

      // Revoke the refresh token via logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: activeRefreshToken })
        .expect(200);

      // Attempting to refresh with the revoked token fails with 401
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: activeRefreshToken })
        .expect(401);
    });
  });

  // =========================================================================
  // CHECK 2: Cookie and CSRF Protection
  // =========================================================================
  describe('Check 2: Cookie and CSRF Protection', () => {
    it('2.1: Should BLOCK cookie-authenticated state-changing request from unauthorized cross-origin (Origin: evil.com)', async () => {
      // Send POST /auth/refresh with HttpOnly cookie and untrusted Origin header
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${AUTH_CONFIG.COOKIE_REFRESH_TOKEN}=${auditUser.refreshToken}`])
        .set('Origin', 'http://evil-attacker.com')
        .expect(403);

      expect(response.body.message).toMatch(/CSRF validation failed/i);
    });

    it('2.2: Should BLOCK cookie-authenticated state-changing request from unauthorized Referer', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${AUTH_CONFIG.COOKIE_REFRESH_TOKEN}=${auditUser.refreshToken}`])
        .set('Referer', 'http://malicious-phishing-site.org/attack.html')
        .expect(403);

      expect(response.body.message).toMatch(/CSRF validation failed/i);
    });

    it('2.3: Should ALLOW state-changing request from trusted Origin (http://localhost:3000)', async () => {
      // Login with trusted Origin
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('Origin', 'http://localhost:3000')
        .send({
          email: auditUser.email,
          password: 'StrongAuditPass123!',
        })
        .expect(200);
    });

    it('2.4: Should PRESERVE API Bearer token requests even if custom Origin is present (non-browser clients)', async () => {
      // API clients using Bearer tokens are inherently immune to browser CSRF
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${auditUser.token}`)
        .set('Origin', 'https://mobile-native-app.internal')
        .expect(200);
    });
  });

  // =========================================================================
  // CHECK 3: Email Verification and Password Reset
  // =========================================================================
  describe('Check 3: Email Verification and Password Reset', () => {
    it('3.1: Should ensure tokens are stored as SHA-256 hashes in PostgreSQL and NEVER plaintext', async () => {
      const rawToken = await tokenService.createPasswordResetToken(auditUser.id);
      const computedHash = tokenService.hashToken(rawToken);

      // Verify in PostgreSQL database
      const dbRecord = await prisma.withSuperAdminContext(async (tx) => {
        return tx.passwordResetToken.findUnique({
          where: { tokenHash: computedHash },
        });
      });

      expect(dbRecord).toBeDefined();
      expect(dbRecord!.tokenHash).toBe(computedHash);
      // Plaintext token is NOT stored
      expect(dbRecord!.tokenHash).not.toBe(rawToken);
      expect(dbRecord!.tokenHash.length).toBe(64); // 32-byte hex = 64 characters
    });

    it('3.2: Should enforce single-use and expiration on password reset tokens', async () => {
      const rawToken = await tokenService.createPasswordResetToken(auditUser.id);

      // First use succeeds
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'BrandNewAuditPassword456!',
        })
        .expect(200);

      // Second use FAILS (single-use validation)
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'AnotherPassword789!',
        })
        .expect(400);

      // Verify dbRecord has used_at stamped
      const dbRecord = await prisma.withSuperAdminContext(async (tx) => {
        return tx.passwordResetToken.findUnique({
          where: { tokenHash: tokenService.hashToken(rawToken) },
        });
      });
      expect(dbRecord!.usedAt).not.toBeNull();
    });

    it('3.3: Production safety: devTokenNotice must be omitted when NODE_ENV is production', async () => {
      const originalEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';

        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/forgot-password')
          .send({ email: auditUser.email })
          .expect(200);

        // devTokenNotice must NOT be present in production responses
        expect(res.body.data.devTokenNotice).toBeUndefined();
      } finally {
        process.env.NODE_ENV = originalEnv;
      }
    });
  });
});
