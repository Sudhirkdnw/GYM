import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AppLoggerService } from '../logging/app-logger.service';
import {
  Permission,
  UserRole,
  ROLE_PERMISSIONS,
  SUPER_ADMIN_PERMISSIONS,
} from '@gymos/shared-types';
import { AUTH_CONFIG } from '@gymos/config';

export interface JwtAccessTokenPayload {
  sub: string;
  email: string;
  isSuperAdmin: boolean;
  organizationId?: string;
  role?: UserRole;
  permissions: Permission[];
}

export interface GeneratedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class TokenService {
  private readonly jwtSecret: string;
  private readonly accessTokenExpiresIn: string;
  private readonly refreshTokenExpiresInDays: number;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('jwt.secret') ||
      'development-jwt-secret-min-16-chars-long';
    this.accessTokenExpiresIn =
      this.configService.get<string>('jwt.accessTokenExpiresIn') ||
      AUTH_CONFIG.ACCESS_TOKEN_EXPIRY;
    this.refreshTokenExpiresInDays =
      this.configService.get<number>('jwt.refreshTokenExpiresInDays') ||
      AUTH_CONFIG.REFRESH_TOKEN_EXPIRY_DAYS;
  }

  /**
   * Hashes a raw token string using SHA-256 for secure database storage.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Resolves explicit permissions based on user's role and super admin status.
   */
  getPermissionsForRole(role?: UserRole, isSuperAdmin = false): Permission[] {
    const permissions = new Set<Permission>();

    if (isSuperAdmin) {
      SUPER_ADMIN_PERMISSIONS.forEach((p) => permissions.add(p));
    }

    if (role && ROLE_PERMISSIONS[role]) {
      ROLE_PERMISSIONS[role].forEach((p) => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Generates a signed JWT Access Token.
   */
  generateAccessToken(payload: JwtAccessTokenPayload): string {
    return this.jwtService.sign(payload as unknown as Record<string, unknown>, {
      secret: this.jwtSecret,
      expiresIn: this.accessTokenExpiresIn as `${number}m`,
    });
  }

  /**
   * Generates a new Refresh Token, hashes it with SHA-256, and persists it in the database.
   */
  async createRefreshToken(
    userId: string,
    _organizationId?: string,
    family?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const tokenFamily = family || crypto.randomUUID();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTokenExpiresInDays);

    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.refreshToken.create({
        data: {
          userId,
          tokenHash,
          family: tokenFamily,
          expiresAt,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
    });

    return rawToken;
  }

  /**
   * Issues both Access Token and Refresh Token for a user.
   */
  async issueTokens(
    userId: string,
    email: string,
    isSuperAdmin: boolean,
    organizationId?: string,
    role?: UserRole,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<GeneratedTokens> {
    const permissions = this.getPermissionsForRole(role, isSuperAdmin);

    const payload: JwtAccessTokenPayload = {
      sub: userId,
      email,
      isSuperAdmin,
      organizationId,
      role,
      permissions,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = await this.createRefreshToken(
      userId,
      organizationId,
      undefined,
      ipAddress,
      userAgent,
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: AUTH_CONFIG.ACCESS_TOKEN_EXPIRY_SECONDS,
    };
  }

  /**
   * Validates a refresh token with rotation and reuse detection.
   * If a previously revoked token is submitted, invalidates the entire token family!
   */
  async rotateRefreshToken(
    rawRefreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<{
    userId: string;
    organizationId?: string;
    newRefreshToken: string;
  }> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.hashToken(rawRefreshToken);

    const existingToken = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.refreshToken.findUnique({
        where: { tokenHash },
      });
    });

    if (!existingToken) {
      this.logger.warn('Refresh attempt with unrecognized token hash', 'TokenService');
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Reuse detection: If token was already revoked, a breach or token theft may have occurred
    if (existingToken.isRevoked) {
      this.logger.error(
        `SECURITY ALERT: Refresh token reuse detected for user ${existingToken.userId}, family ${existingToken.family}! Revoking entire token family.`,
        undefined,
        'TokenService',
      );

      // Invalidate the entire token family
      await this.prisma.withSuperAdminContext(async (tx) => {
        await tx.refreshToken.updateMany({
          where: { family: existingToken.family },
          data: { isRevoked: true },
        });
      });

      throw new UnauthorizedException(
        'Security violation: Refresh token reuse detected. All sessions in this chain have been revoked.',
      );
    }

    // Expiry check
    if (new Date() > existingToken.expiresAt) {
      await this.prisma.withSuperAdminContext(async (tx) => {
        await tx.refreshToken.update({
          where: { id: existingToken.id },
          data: { isRevoked: true },
        });
      });
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Generate new rotated refresh token in the same family
    const newRawToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = this.hashToken(newRawToken);

    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + this.refreshTokenExpiresInDays);

    await this.prisma.withSuperAdminContext(async (tx) => {
      // Create new token in the same family
      await tx.refreshToken.create({
        data: {
          userId: existingToken.userId,
          tokenHash: newTokenHash,
          family: existingToken.family,
          expiresAt: newExpiresAt,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });

      // Revoke the old token and link to the new one
      await tx.refreshToken.update({
        where: { id: existingToken.id },
        data: {
          isRevoked: true,
          replacedByTokenHash: newTokenHash,
        },
      });
    });

    return {
      userId: existingToken.userId,
      newRefreshToken: newRawToken,
    };
  }

  /**
   * Revokes a specific refresh token.
   */
  async revokeRefreshToken(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);

    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { tokenHash, isRevoked: false },
        data: { isRevoked: true },
      });
    });
  }

  /**
   * Revokes all active refresh tokens for a user (e.g., on password reset or account suspension).
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    });
  }

  /**
   * Creates a secure password reset token with 1-hour expiry.
   */
  async createPasswordResetToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + AUTH_CONFIG.PASSWORD_RESET_EXPIRY_HOURS);

    await this.prisma.withSuperAdminContext(async (tx) => {
      // Invalidate any existing unused reset tokens for this user
      await tx.passwordResetToken.deleteMany({
        where: { userId, usedAt: null },
      });

      await tx.passwordResetToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });
    });

    return rawToken;
  }

  /**
   * Validates and marks a password reset token as used.
   */
  async consumePasswordResetToken(rawToken: string): Promise<string> {
    const tokenHash = this.hashToken(rawToken);

    const record = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.passwordResetToken.findUnique({
        where: { tokenHash },
      });
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (record.usedAt) {
      throw new BadRequestException('Password reset token has already been used');
    }

    if (new Date() > record.expiresAt) {
      throw new BadRequestException('Password reset token has expired');
    }

    // Mark as used
    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    });

    return record.userId;
  }

  /**
   * Creates an email verification token with 24-hour expiry.
   */
  async createEmailVerificationToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + AUTH_CONFIG.EMAIL_VERIFICATION_EXPIRY_HOURS);

    await this.prisma.withSuperAdminContext(async (tx) => {
      // Delete any previous unused verification tokens
      await tx.emailVerificationToken.deleteMany({
        where: { userId, usedAt: null },
      });

      await tx.emailVerificationToken.create({
        data: {
          userId,
          tokenHash,
          expiresAt,
        },
      });
    });

    return rawToken;
  }

  /**
   * Validates and consumes an email verification token.
   */
  async consumeEmailVerificationToken(rawToken: string): Promise<string> {
    const tokenHash = this.hashToken(rawToken);

    const record = await this.prisma.withSuperAdminContext(async (tx) => {
      return tx.emailVerificationToken.findUnique({
        where: { tokenHash },
      });
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (record.usedAt) {
      throw new BadRequestException('Verification token has already been used');
    }

    if (new Date() > record.expiresAt) {
      throw new BadRequestException('Verification token has expired');
    }

    // Mark as used
    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
    });

    return record.userId;
  }

  /**
   * Lists all active sessions for a user.
   */
  async listUserSessions(userId: string) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      return tx.refreshToken.findMany({
        where: {
          userId,
          isRevoked: false,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          family: true,
          ipAddress: true,
          userAgent: true,
          createdAt: true,
          expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  }

  /**
   * Revokes a specific session by session ID.
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    await this.prisma.withSuperAdminContext(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { id: sessionId, userId, isRevoked: false },
        data: { isRevoked: true },
      });
    });
  }
}
