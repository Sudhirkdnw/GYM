import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PasswordHasherService } from './password-hasher.service';
import { TokenService, GeneratedTokens } from './token.service';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { AppLoggerService } from '../logging/app-logger.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  SelectOrganizationDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './dto';
import {
  UserRole,
  UserStatus,
  TenantStatus,
  Permission,
} from '@gymos/shared-types';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isSuperAdmin: boolean;
    emailVerified: boolean;
    status: UserStatus;
  };
  organization?: {
    id: string;
    name: string;
    slug: string;
    role: UserRole;
    permissions: Permission[];
  };
  tokens: GeneratedTokens;
  devTokenNotice?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHasher: PasswordHasherService,
    private readonly tokenService: TokenService,
    private readonly tenantContextService: TenantContextService,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Registers a new global user, optional organization, and assigns GYM_OWNER role.
   */
  async register(
    dto: RegisterDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    // Check if email already exists
    const existingUser = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.user.findUnique({
        where: { email: normalizedEmail },
      });
    });

    if (existingUser) {
      this.logger.warn(
        `Registration failed: Email ${normalizedEmail} already exists`,
        'AuthService',
      );
      throw new ConflictException(
        'An account with this email address already exists',
      );
    }

    const passwordHash = await this.passwordHasher.hashPassword(dto.password);

    // Create user and initial organization in transaction
    const result = await this.prisma.withSuperAdminContext(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          status: UserStatus.ACTIVE,
          emailVerified: false,
        },
      });

      let orgRecord = null;
      let orgUserRecord = null;

      if (dto.gymName) {
        const baseSlug =
          dto.slug ||
          dto.gymName
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        // Ensure unique slug
        let finalSlug = baseSlug || 'gym';
        const existingSlug = await tx.organization.findUnique({
          where: { slug: finalSlug },
        });
        if (existingSlug) {
          finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
        }

        orgRecord = await tx.organization.create({
          data: {
            name: dto.gymName.trim(),
            slug: finalSlug,
            status: TenantStatus.ACTIVE,
          },
        });

        orgUserRecord = await tx.organizationUser.create({
          data: {
            organizationId: orgRecord.id,
            userId: user.id,
            role: UserRole.GYM_OWNER,
          },
        });
      }

      return { user, orgRecord, orgUserRecord };
    });

    // Create single-use email verification token
    const verificationToken =
      await this.tokenService.createEmailVerificationToken(result.user.id);

    this.logger.log(
      `Email verification token dispatched for user ${result.user.id}`,
      'AuthService',
    );

    const orgId = result.orgRecord?.id;
    const orgRole = result.orgUserRecord?.role as UserRole | undefined;

    const tokens = await this.tokenService.issueTokens(
      result.user.id,
      result.user.email,
      result.user.isSuperAdmin,
      orgId,
      orgRole,
      ipAddress,
      userAgent,
    );

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        isSuperAdmin: result.user.isSuperAdmin,
        emailVerified: result.user.emailVerified,
        status: result.user.status as UserStatus,
      },
      organization: result.orgRecord && orgRole
        ? {
            id: result.orgRecord.id,
            name: result.orgRecord.name,
            slug: result.orgRecord.slug,
            role: orgRole,
            permissions: this.tokenService.getPermissionsForRole(
              orgRole,
              result.user.isSuperAdmin,
            ),
          }
        : undefined,
      tokens,
      devTokenNotice:
        process.env.NODE_ENV !== 'production'
          ? `Verification Token: ${verificationToken}`
          : undefined,
    };
  }

  /**
   * Authenticates user credentials with Argon2id and issues session tokens.
   */
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.user.findUnique({
        where: { email: normalizedEmail },
      });
    });

    if (!user) {
      // Execute dummy verify to protect against timing attacks
      await this.passwordHasher.verifyPassword(
        '$argon2id$v=19$m=65536,t=3,p=4$dummyhashfordummycheck1234567890$dummy',
        dto.password,
      );
      this.logger.warn(
        `Login failed: User not found for email ${normalizedEmail}`,
        'AuthService',
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordHasher.verifyPassword(
      user.passwordHash,
      dto.password,
    );

    if (!isPasswordValid) {
      this.logger.warn(
        `Login failed: Invalid password for user ${user.id}`,
        'AuthService',
      );
      throw new UnauthorizedException('Invalid email or password');
    }

    // Status checks
    if (user.status === UserStatus.SUSPENDED) {
      this.logger.warn(
        `Login blocked: User ${user.id} is suspended`,
        'AuthService',
      );
      throw new UnauthorizedException(
        'Account is suspended. Please contact support.',
      );
    }

    if (user.status === UserStatus.INACTIVE) {
      this.logger.warn(
        `Login blocked: User ${user.id} is inactive`,
        'AuthService',
      );
      throw new UnauthorizedException('Account is inactive.');
    }

    // Update last login timestamp
    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    });

    // Resolve target organization
    let selectedOrg: {
      id: string;
      name: string;
      slug: string;
      role: UserRole;
    } | null = null;

    if (dto.organizationId) {
      const membership = await this.tenantContextService.resolveMembership(
        user.id,
        dto.organizationId,
      );
      selectedOrg = {
        id: membership.organizationId,
        name: membership.organizationName,
        slug: membership.organizationSlug,
        role: membership.role,
      };
    } else {
      // Find first active membership
      const defaultMembership = await this.prisma.withSuperAdminContext(
        async (tx) => {
          return tx.organizationUser.findFirst({
            where: {
              userId: user.id,
              organization: { status: TenantStatus.ACTIVE },
            },
            include: { organization: true },
            orderBy: { createdAt: 'asc' },
          });
        },
      );

      if (defaultMembership) {
        selectedOrg = {
          id: defaultMembership.organizationId,
          name: defaultMembership.organization.name,
          slug: defaultMembership.organization.slug,
          role: defaultMembership.role as UserRole,
        };
      }
    }

    const tokens = await this.tokenService.issueTokens(
      user.id,
      user.email,
      user.isSuperAdmin,
      selectedOrg?.id,
      selectedOrg?.role,
      ipAddress,
      userAgent,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
        emailVerified: user.emailVerified,
        status: user.status as UserStatus,
      },
      organization: selectedOrg
        ? {
            id: selectedOrg.id,
            name: selectedOrg.name,
            slug: selectedOrg.slug,
            role: selectedOrg.role,
            permissions: this.tokenService.getPermissionsForRole(
              selectedOrg.role,
              user.isSuperAdmin,
            ),
          }
        : undefined,
      tokens,
    };
  }

  /**
   * Refreshes access token with rotation and reuse detection.
   */
  async refresh(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<GeneratedTokens> {
    const rotated = await this.tokenService.rotateRefreshToken(
      rawRefreshToken,
      ipAddress,
      userAgent,
    );

    const user = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.user.findUnique({
        where: { id: rotated.userId },
      });
    });

    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('User account is invalid or suspended');
    }

    const defaultMembership = await this.prisma.withSuperAdminContext(
      async (tx) => {
        return tx.organizationUser.findFirst({
          where: {
            userId: user.id,
            organization: { status: TenantStatus.ACTIVE },
          },
          include: { organization: true },
          orderBy: { createdAt: 'asc' },
        });
      },
    );

    const role = defaultMembership?.role as UserRole | undefined;
    const organizationId = defaultMembership?.organizationId;

    const permissions = this.tokenService.getPermissionsForRole(
      role,
      user.isSuperAdmin,
    );

    const accessToken = this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      organizationId,
      role,
      permissions,
    });

    return {
      accessToken,
      refreshToken: rotated.newRefreshToken,
      expiresIn: 900,
    };
  }

  /**
   * Logs out a session by revoking the refresh token.
   */
  async logout(rawRefreshToken?: string): Promise<{ success: boolean }> {
    if (rawRefreshToken) {
      await this.tokenService.revokeRefreshToken(rawRefreshToken);
    }
    return { success: true };
  }

  /**
   * Requests a password reset link. Always returns a generic message to prevent account enumeration.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ message: string; devTokenNotice?: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.user.findUnique({
        where: { email: normalizedEmail },
      });
    });

    let devToken: string | undefined;

    if (user && user.status !== UserStatus.SUSPENDED) {
      const resetToken = await this.tokenService.createPasswordResetToken(user.id);
      devToken = resetToken;
      this.logger.log(
        `Password reset token dispatched for user ${user.id}`,
        'AuthService',
      );
    }

    return {
      message:
        'If an active account exists for this email, password reset instructions have been dispatched.',
      devTokenNotice:
        process.env.NODE_ENV !== 'production' && devToken
          ? `Reset Token: ${devToken}`
          : undefined,
    };
  }

  /**
   * Resets password using a validated single-use reset token and revokes existing sessions.
   */
  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const userId = await this.tokenService.consumePasswordResetToken(dto.token);

    const passwordHash = await this.passwordHasher.hashPassword(dto.newPassword);

    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { passwordHash },
      });
    });

    // Revoke all active sessions for security
    await this.tokenService.revokeAllUserTokens(userId);

    this.logger.log(
      `Password successfully reset for user ${userId}. All prior sessions revoked.`,
      'AuthService',
    );

    return {
      message: 'Password reset successful. Please log in with your new credentials.',
    };
  }

  /**
   * Verifies user email with single-use verification token.
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    const userId = await this.tokenService.consumeEmailVerificationToken(token);

    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          emailVerified: true,
          emailVerifiedAt: new Date(),
          status: UserStatus.ACTIVE,
        },
      });
    });

    return {
      message: 'Email successfully verified. Your account is now active.',
    };
  }

  /**
   * Returns current authenticated user and tenant profile.
   */
  async getMe(userId: string, organizationId?: string) {
    const user = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatarUrl: true,
          isSuperAdmin: true,
          emailVerified: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    let organization = null;

    if (organizationId) {
      try {
        const membership = await this.tenantContextService.resolveMembership(
          userId,
          organizationId,
        );
        organization = {
          id: membership.organizationId,
          name: membership.organizationName,
          slug: membership.organizationSlug,
          role: membership.role,
          permissions: this.tokenService.getPermissionsForRole(
            membership.role,
            user.isSuperAdmin,
          ),
        };
      } catch {
        // User may not belong to this org anymore
        this.logger.warn(`Could not resolve membership for user ${userId} in org ${organizationId}`, 'AuthService');
      }
    }

    return {
      user,
      organization,
    };
  }

  /**
   * Lists all organizations the user is authorized for.
   */
  async getUserOrganizations(userId: string, isSuperAdmin = false) {
    if (isSuperAdmin) {
      // Super admins can view all organizations on the platform
      return this.prisma.withSuperAdminContext(async (tx) => {
        const orgs = await tx.organization.findMany({
          orderBy: { name: 'asc' },
        });

        return orgs.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          role: 'SUPER_ADMIN',
          permissions: this.tokenService.getPermissionsForRole(undefined, true),
        }));
      });
    }

    return this.prisma.withSuperAdminContext(async (tx) => {
      const memberships = await tx.organizationUser.findMany({
        where: {
          userId,
          organization: { status: TenantStatus.ACTIVE },
        },
        include: {
          organization: true,
        },
        orderBy: { organization: { name: 'asc' } },
      });

      return memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        status: m.organization.status,
        role: m.role as UserRole,
        permissions: this.tokenService.getPermissionsForRole(
          m.role as UserRole,
          false,
        ),
      }));
    });
  }

  /**
   * Switches organization context and issues an updated access token.
   */
  async selectOrganization(
    userId: string,
    dto: SelectOrganizationDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponse> {
    const user = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.user.findUnique({
        where: { id: userId },
      });
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    let role: UserRole | undefined;
    let orgDetails: { id: string; name: string; slug: string };

    if (user.isSuperAdmin) {
      // Super Admin can select any active organization
      const org = await this.prisma.withSuperAdminContext(async (tx) => {
        return tx.organization.findUnique({
          where: { id: dto.organizationId },
        });
      });

      if (!org || org.status !== TenantStatus.ACTIVE) {
        throw new NotFoundException('Organization not found or inactive');
      }

      orgDetails = org;
      // Super admin retains super admin permissions
    } else {
      // Regular user membership verification
      const membership = await this.tenantContextService.resolveMembership(
        userId,
        dto.organizationId,
      );

      role = membership.role;
      orgDetails = {
        id: membership.organizationId,
        name: membership.organizationName,
        slug: membership.organizationSlug,
      };
    }

    const tokens = await this.tokenService.issueTokens(
      user.id,
      user.email,
      user.isSuperAdmin,
      orgDetails.id,
      role,
      ipAddress,
      userAgent,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
        emailVerified: user.emailVerified,
        status: user.status as UserStatus,
      },
      organization: {
        id: orgDetails.id,
        name: orgDetails.name,
        slug: orgDetails.slug,
        role: role || (UserRole.GYM_ADMIN as UserRole),
        permissions: this.tokenService.getPermissionsForRole(
          role,
          user.isSuperAdmin,
        ),
      },
      tokens,
    };
  }

  /**
   * Lists active sessions for current user.
   */
  async listSessions(userId: string) {
    return this.tokenService.listUserSessions(userId);
  }

  /**
   * Revokes a session for current user.
   */
  async revokeSession(userId: string, sessionId: string) {
    await this.tokenService.revokeSession(userId, sessionId);
    return { success: true, message: 'Session revoked successfully' };
  }

  /**
   * Updates profile information for the authenticated user.
   */
  async updateProfile(userId: string, dto: UpdateProfileDto, _ipAddress?: string) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!existing) {
        throw new NotFoundException('User profile not found');
      }

      const updateData: any = {};
      if (dto.firstName !== undefined && dto.firstName !== null) {
        const val = typeof dto.firstName === 'string' ? dto.firstName.trim() : '';
        if (val) updateData.firstName = val;
      }
      if (dto.lastName !== undefined && dto.lastName !== null) {
        const val = typeof dto.lastName === 'string' ? dto.lastName.trim() : '';
        if (val) updateData.lastName = val;
      }
      if (dto.phone !== undefined) {
        if (dto.phone && typeof dto.phone === 'string' && dto.phone.trim() !== '') {
          updateData.phone = dto.phone.trim();
        } else {
          updateData.phone = null;
        }
      }
      if (dto.avatarUrl !== undefined) {
        if (dto.avatarUrl && typeof dto.avatarUrl === 'string' && dto.avatarUrl.trim() !== '') {
          updateData.avatarUrl = dto.avatarUrl.trim();
        } else {
          updateData.avatarUrl = null;
        }
      }

      if (dto.email && typeof dto.email === 'string') {
        const normalizedEmail = dto.email.trim().toLowerCase();
        if (normalizedEmail && normalizedEmail !== existing.email.toLowerCase()) {
          const emailTaken = await tx.user.findUnique({
            where: { email: normalizedEmail },
          });
          if (emailTaken && emailTaken.id !== userId) {
            throw new ConflictException('Email address is already in use by another account');
          }
          updateData.email = normalizedEmail;
        }
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          avatarUrl: true,
          isSuperAdmin: true,
          emailVerified: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
        },
      });

      this.logger.log(`User profile updated for user ${userId}`, 'AuthService');

      return updated;
    });
  }

  /**
   * Securely changes password for the authenticated user after verifying current password.
   */
  async changePassword(userId: string, dto: ChangePasswordDto, _ipAddress?: string) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User profile not found');
      }

      // Verify current password
      const isCurrentValid = await this.passwordHasher.verifyPassword(
        user.passwordHash,
        dto.currentPassword,
      );

      if (!isCurrentValid) {
        throw new BadRequestException('Current password does not match our records');
      }

      if (!dto.newPassword || dto.newPassword.length < 8) {
        throw new BadRequestException('New password must be at least 8 characters long');
      }

      const newPasswordHash = await this.passwordHasher.hashPassword(dto.newPassword);

      await tx.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      this.logger.log(`Password changed successfully for user ${userId}`, 'AuthService');

      return {
        success: true,
        message: 'Password changed successfully',
      };
    });
  }
}
