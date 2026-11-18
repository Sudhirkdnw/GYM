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

describe('Authentication & RBAC E2E Security Suite (Stage 2.2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let passwordHasher: PasswordHasherService;
  let tokenService: TokenService;

  // Test state
  let testUserOwner: { id: string; email: string; token: string; refreshToken: string; orgId: string };
  let testUserAdmin: { id: string; email: string; token: string; orgId: string };
  let testUserReceptionist: { id: string; email: string; token: string; orgId: string };
  let testUserTrainer: { id: string; email: string; token: string; orgId: string };
  let testUserMember: { id: string; email: string; token: string; orgId: string };
  let testSuperAdmin: { id: string; email: string; token: string };
  let testSuspendedUser: { id: string; email: string };
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

    // Seed test data cleanly using withSuperAdminContext
    const seeded = await prisma.withSuperAdminContext(async (tx) => {
      // Create primary gym organization
      const org1 = await tx.organization.create({
        data: {
          name: 'Apex Fitness Alpha',
          slug: `apex-alpha-${Date.now()}`,
          status: TenantStatus.ACTIVE,
        },
      });

      // Create secondary gym organization
      const org2 = await tx.organization.create({
        data: {
          name: 'Apex Fitness Beta',
          slug: `apex-beta-${Date.now()}`,
          status: TenantStatus.ACTIVE,
        },
      });

      const passwordHash = await passwordHasher.hashPassword('StrongP@ssw0rd123');

      // 1. Gym Owner
      const owner = await tx.user.create({
        data: {
          email: `owner-${Date.now()}@apex.test`,
          passwordHash,
          firstName: 'Apex',
          lastName: 'Owner',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: org1.id,
          userId: owner.id,
          role: UserRole.GYM_OWNER,
        },
      });

      // 2. Gym Admin
      const admin = await tx.user.create({
        data: {
          email: `admin-${Date.now()}@apex.test`,
          passwordHash,
          firstName: 'Apex',
          lastName: 'Admin',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: org1.id,
          userId: admin.id,
          role: UserRole.GYM_ADMIN,
        },
      });

      // 3. Receptionist
      const receptionist = await tx.user.create({
        data: {
          email: `receptionist-${Date.now()}@apex.test`,
          passwordHash,
          firstName: 'Apex',
          lastName: 'Receptionist',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: org1.id,
          userId: receptionist.id,
          role: UserRole.RECEPTIONIST,
        },
      });

      // 4. Trainer
      const trainer = await tx.user.create({
        data: {
          email: `trainer-${Date.now()}@apex.test`,
          passwordHash,
          firstName: 'Apex',
          lastName: 'Trainer',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: org1.id,
          userId: trainer.id,
          role: UserRole.TRAINER,
        },
      });

      // 5. Member
      const member = await tx.user.create({
        data: {
          email: `member-${Date.now()}@apex.test`,
          passwordHash,
          firstName: 'Apex',
          lastName: 'Member',
          status: UserStatus.ACTIVE,
          emailVerified: true,
        },
      });
      await tx.organizationUser.create({
        data: {
          organizationId: org1.id,
          userId: member.id,
          role: UserRole.MEMBER,
        },
      });

      // 6. Super Admin
      const superAdmin = await tx.user.create({
        data: {
          email: `superadmin-${Date.now()}@platform.test`,
          passwordHash,
          firstName: 'Platform',
          lastName: 'SuperAdmin',
          status: UserStatus.ACTIVE,
          isSuperAdmin: true,
          emailVerified: true,
        },
      });

      // 7. Suspended User
      const suspended = await tx.user.create({
        data: {
          email: `suspended-${Date.now()}@apex.test`,
          passwordHash,
          firstName: 'Suspended',
          lastName: 'User',
          status: UserStatus.SUSPENDED,
          emailVerified: true,
        },
      });

      return { org1, org2, owner, admin, receptionist, trainer, member, superAdmin, suspended };
    });

    secondOrgId = seeded.org2.id;
    testSuspendedUser = { id: seeded.suspended.id, email: seeded.suspended.email };

    // Generate initial tokens (after transaction commits)
    const ownerTokens = await tokenService.issueTokens(
      seeded.owner.id,
      seeded.owner.email,
      false,
      seeded.org1.id,
      UserRole.GYM_OWNER,
    );
    testUserOwner = {
      id: seeded.owner.id,
      email: seeded.owner.email,
      token: ownerTokens.accessToken,
      refreshToken: ownerTokens.refreshToken,
      orgId: seeded.org1.id,
    };

    const adminTokens = await tokenService.issueTokens(
      seeded.admin.id,
      seeded.admin.email,
      false,
      seeded.org1.id,
      UserRole.GYM_ADMIN,
    );
    testUserAdmin = {
      id: seeded.admin.id,
      email: seeded.admin.email,
      token: adminTokens.accessToken,
      orgId: seeded.org1.id,
    };

    const receptionistTokens = await tokenService.issueTokens(
      seeded.receptionist.id,
      seeded.receptionist.email,
      false,
      seeded.org1.id,
      UserRole.RECEPTIONIST,
    );
    testUserReceptionist = {
      id: seeded.receptionist.id,
      email: seeded.receptionist.email,
      token: receptionistTokens.accessToken,
      orgId: seeded.org1.id,
    };

    const trainerTokens = await tokenService.issueTokens(
      seeded.trainer.id,
      seeded.trainer.email,
      false,
      seeded.org1.id,
      UserRole.TRAINER,
    );
    testUserTrainer = {
      id: seeded.trainer.id,
      email: seeded.trainer.email,
      token: trainerTokens.accessToken,
      orgId: seeded.org1.id,
    };

    const memberTokens = await tokenService.issueTokens(
      seeded.member.id,
      seeded.member.email,
      false,
      seeded.org1.id,
      UserRole.MEMBER,
    );
    testUserMember = {
      id: seeded.member.id,
      email: seeded.member.email,
      token: memberTokens.accessToken,
      orgId: seeded.org1.id,
    };

    const superAdminTokens = await tokenService.issueTokens(
      seeded.superAdmin.id,
      seeded.superAdmin.email,
      true,
      undefined,
      undefined,
    );
    testSuperAdmin = {
      id: seeded.superAdmin.id,
      email: seeded.superAdmin.email,
      token: superAdminTokens.accessToken,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Registration Flow', () => {
    const registerEmail = `newowner-${Date.now()}@gymos.test`;

    it('should successfully register a new user and organization with GYM_OWNER role', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: registerEmail,
          password: 'StrongPassword123!',
          firstName: 'Marcus',
          lastName: 'Aurelius',
          gymName: 'Stoic Athletics',
        })
        .expect(201);

      expect(response.body.data.user).toBeDefined();
      expect(response.body.data.user.email).toBe(registerEmail.toLowerCase());
      expect(response.body.data.organization).toBeDefined();
      expect(response.body.data.organization.name).toBe('Stoic Athletics');
      expect(response.body.data.organization.role).toBe(UserRole.GYM_OWNER);
      expect(response.body.data.tokens.accessToken).toBeDefined();

      // Check HttpOnly cookies were set
      const rawCookies = response.headers['set-cookie'];
      const cookieArray = Array.isArray(rawCookies)
        ? rawCookies
        : typeof rawCookies === 'string'
        ? [rawCookies]
        : [];
      expect(cookieArray.some((c) => c.includes(AUTH_CONFIG.COOKIE_ACCESS_TOKEN))).toBe(true);
      expect(cookieArray.some((c) => c.includes(AUTH_CONFIG.COOKIE_REFRESH_TOKEN))).toBe(true);
    });

    it('should reject registration when email already exists with 409 Conflict', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: registerEmail,
          password: 'AnotherPassword123!',
          firstName: 'Duplicate',
          lastName: 'User',
        })
        .expect(409);
    });

    it('should reject registration with weak password (<8 chars or no numbers/uppercase)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `weak-${Date.now()}@gymos.test`,
          password: 'weak',
          firstName: 'Weak',
          lastName: 'Password',
        })
        .expect(400);
    });
  });

  describe('2. Login Authentication & Status Checks', () => {
    it('should successfully authenticate with valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUserOwner.email,
          password: 'StrongP@ssw0rd123',
        })
        .expect(200);

      expect(response.body.data.user.id).toBe(testUserOwner.id);
      expect(response.body.data.organization.id).toBe(testUserOwner.orgId);
      expect(response.body.data.organization.role).toBe(UserRole.GYM_OWNER);
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });

    it('should reject invalid password with generic 401 error', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUserOwner.email,
          password: 'WrongPassword999!',
        })
        .expect(401);

      expect(response.body.message).toMatch(/invalid email or password/i);
    });

    it('should reject non-existent user with generic 401 error (prevent enumeration)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent-user-123456@gymos.test',
          password: 'SomePassword123!',
        })
        .expect(401);

      expect(response.body.message).toMatch(/invalid email or password/i);
    });

    it('should reject login for suspended user account with 401', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testSuspendedUser.email,
          password: 'StrongP@ssw0rd123',
        })
        .expect(401);

      expect(response.body.message).toMatch(/suspended/i);
    });
  });

  describe('3. Token Lifecycle, Rotation & Reuse Detection', () => {
    let activeRefreshToken: string;

    it('should rotate refresh token and issue a new access token', async () => {
      // First login to get a fresh refresh token
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUserOwner.email,
          password: 'StrongP@ssw0rd123',
        })
        .expect(200);

      activeRefreshToken = loginRes.body.data.tokens.refreshToken;

      // Rotate token
      const refreshRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: activeRefreshToken })
        .expect(200);

      expect(refreshRes.body.data.accessToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).toBeDefined();
      expect(refreshRes.body.data.refreshToken).not.toBe(activeRefreshToken);

      // Save new rotated token
      const newlyRotatedToken = refreshRes.body.data.refreshToken;

      // Test REUSE DETECTION: Replaying activeRefreshToken (which was already rotated)
      const reuseRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: activeRefreshToken })
        .expect(401);

      expect(reuseRes.body.message).toMatch(/reuse detected/i);

      // Now verify that the whole family was revoked: newlyRotatedToken should also be rejected!
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newlyRotatedToken })
        .expect(401);
    });

    it('should reject non-existent or malformed refresh token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'fake-refresh-token-1234567890' })
        .expect(401);
    });

    it('should revoke refresh token on logout', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUserOwner.email,
          password: 'StrongP@ssw0rd123',
        })
        .expect(200);

      const tokenToRevoke = loginRes.body.data.tokens.refreshToken;

      // Logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken: tokenToRevoke })
        .expect(200);

      // Refresh using revoked token should now fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokenToRevoke })
        .expect(401);
    });
  });

  describe('4. Password Reset & Email Verification Security', () => {
    it('should issue single-use password reset token and update password', async () => {
      const resetUserEmail = `reset-test-${Date.now()}@gymos.test`;
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: resetUserEmail,
          password: 'InitialPassword123!',
          firstName: 'Reset',
          lastName: 'Test',
        })
        .expect(201);

      const userId = regRes.body.data.user.id;

      // Create reset token directly via TokenService
      const rawToken = await tokenService.createPasswordResetToken(userId);

      // Reset password using the raw token
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'BrandNewPassword123!',
        })
        .expect(200);

      // Re-using the same token must be rejected (single-use validation)
      await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: rawToken,
          newPassword: 'AnotherPassword123!',
        })
        .expect(400);

      // Old password should fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: resetUserEmail,
          password: 'InitialPassword123!',
        })
        .expect(401);

      // New password should succeed
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: resetUserEmail,
          password: 'BrandNewPassword123!',
        })
        .expect(200);
    });

    it('should consume single-use email verification token', async () => {
      const verifyEmail = `verify-${Date.now()}@gymos.test`;
      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: verifyEmail,
          password: 'Password12345!',
          firstName: 'Verify',
          lastName: 'User',
        })
        .expect(201);

      const userId = regRes.body.data.user.id;
      const verificationToken = await tokenService.createEmailVerificationToken(userId);

      // Verify email
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      // Reusing token must fail
      await request(app.getHttpServer())
        .post('/api/v1/auth/verify-email')
        .send({ token: verificationToken })
        .expect(400);
    });
  });

  describe('5. RBAC Permission Matrix & Access Enforcement', () => {
    it('GYM_OWNER: should access owner settings and member actions', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/owner-only')
        .set('Authorization', `Bearer ${testUserOwner.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/admin-action')
        .set('Authorization', `Bearer ${testUserOwner.token}`)
        .expect(200);
    });

    it('GYM_ADMIN: should access admin actions, but DENIED owner settings (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/admin-action')
        .set('Authorization', `Bearer ${testUserAdmin.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/owner-only')
        .set('Authorization', `Bearer ${testUserAdmin.token}`)
        .expect(403);
    });

    it('RECEPTIONIST: should access payments manage, but DENIED admin settings (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/receptionist-action')
        .set('Authorization', `Bearer ${testUserReceptionist.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/admin-action')
        .set('Authorization', `Bearer ${testUserReceptionist.token}`)
        .expect(403);
    });

    it('TRAINER: should access trainer members read, but DENIED receptionist payments manage (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/trainer-action')
        .set('Authorization', `Bearer ${testUserTrainer.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/receptionist-action')
        .set('Authorization', `Bearer ${testUserTrainer.token}`)
        .expect(403);
    });

    it('MEMBER: should access member profile read, but DENIED trainer members read (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/member-action')
        .set('Authorization', `Bearer ${testUserMember.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/trainer-action')
        .set('Authorization', `Bearer ${testUserMember.token}`)
        .expect(403);
    });

    it('SUPER_ADMIN: should access platform-level endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/superadmin-only')
        .set('Authorization', `Bearer ${testSuperAdmin.token}`)
        .expect(200);
    });

    it('NON-SUPER_ADMIN: should be DENIED platform-level endpoints (403)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/superadmin-only')
        .set('Authorization', `Bearer ${testUserOwner.token}`)
        .expect(403);
    });

    it('UNAUTHENTICATED: should be DENIED access to protected endpoints (401)', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/test-rbac/owner-only')
        .expect(401);
    });
  });

  describe('6. Organization Context & Membership Validation', () => {
    it('should list all organizations user belongs to', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/organizations')
        .set('Authorization', `Bearer ${testUserOwner.token}`)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].id).toBe(testUserOwner.orgId);
    });

    it('should allow user to select an organization they belong to', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/auth/organizations/${testUserOwner.orgId}/select`)
        .set('Authorization', `Bearer ${testUserOwner.token}`)
        .expect(200);

      expect(response.body.data.organization.id).toBe(testUserOwner.orgId);
      expect(response.body.data.tokens.accessToken).toBeDefined();
    });

    it('should REJECT selecting an organization the user does NOT belong to (403)', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/auth/organizations/${secondOrgId}/select`)
        .set('Authorization', `Bearer ${testUserOwner.token}`)
        .expect(403);
    });

    it('should return current authenticated user profile via /auth/me', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${testUserOwner.token}`)
        .expect(200);

      expect(response.body.data.user.id).toBe(testUserOwner.id);
      expect(response.body.data.user.email).toBe(testUserOwner.email);
      expect(response.body.data.organization.id).toBe(testUserOwner.orgId);
    });
  });
});
