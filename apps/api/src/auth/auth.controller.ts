import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  SelectOrganizationDto,
  RefreshTokenDto,
  UpdateProfileDto,
  ChangePasswordDto,
} from './dto';
import {
  Public,
  CurrentUser,
  CurrentTenant,
} from '../common/auth';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  registerUserSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  selectOrganizationSchema,
} from '@gymos/validation';
import { AUTH_CONFIG } from '@gymos/config';
import { AuthenticatedUserContext } from '@gymos/shared-types';
import { EntitlementService } from '../common/entitlements/entitlement.service';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly entitlementService: EntitlementService,
  ) {}

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie(AUTH_CONFIG.COOKIE_ACCESS_TOKEN, accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: AUTH_CONFIG.ACCESS_TOKEN_EXPIRY_SECONDS * 1000,
    });

    res.cookie(AUTH_CONFIG.COOKIE_REFRESH_TOKEN, refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: AUTH_CONFIG.REFRESH_TOKEN_EXPIRY_SECONDS * 1000,
    });
  }

  private clearAuthCookies(res: Response): void {
    res.clearCookie(AUTH_CONFIG.COOKIE_ACCESS_TOKEN, { path: '/' });
    res.clearCookie(AUTH_CONFIG.COOKIE_REFRESH_TOKEN, { path: '/' });
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register a new user and create an organization' })
  @SwaggerApiResponse({
    status: 201,
    description: 'User registered successfully and session established',
  })
  @SwaggerApiResponse({ status: 409, description: 'Email address already exists' })
  async register(
    @Body(new ZodValidationPipe(registerUserSchema)) dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.register(dto, ipAddress, userAgent);

    this.setAuthCookies(
      res,
      result.tokens.accessToken,
      result.tokens.refreshToken,
    );

    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Login successful and session cookies issued',
  })
  @SwaggerApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.login(dto, ipAddress, userAgent);

    this.setAuthCookies(
      res,
      result.tokens.accessToken,
      result.tokens.refreshToken,
    );

    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @SwaggerApiResponse({ status: 200, description: 'Tokens rotated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Invalid or revoked refresh token' })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      req.cookies?.[AUTH_CONFIG.COOKIE_REFRESH_TOKEN] || dto.refreshToken;

    if (!token) {
      throw new UnauthorizedException('No refresh token provided');
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const tokens = await this.authService.refresh(token, ipAddress, userAgent);

    this.setAuthCookies(res, tokens.accessToken, tokens.refreshToken);

    return tokens;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke active refresh token and clear cookies' })
  @SwaggerApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token =
      req.cookies?.[AUTH_CONFIG.COOKIE_REFRESH_TOKEN] || dto?.refreshToken;

    if (token) {
      await this.authService.logout(token);
    }

    this.clearAuthCookies(res);

    return { success: true, message: 'Logged out successfully' };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset token link' })
  @SwaggerApiResponse({
    status: 200,
    description: 'Generic success confirmation message',
  })
  async forgotPassword(
    @Body(new ZodValidationPipe(forgotPasswordSchema)) dto: ForgotPasswordDto,
  ) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using single-use reset token' })
  @SwaggerApiResponse({ status: 200, description: 'Password reset successful' })
  @SwaggerApiResponse({
    status: 400,
    description: 'Invalid, expired, or already used reset token',
  })
  async resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) dto: ResetPasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.resetPassword(dto);
    this.clearAuthCookies(res);
    return result;
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address with verification token' })
  @SwaggerApiResponse({ status: 200, description: 'Email verified successfully' })
  @SwaggerApiResponse({
    status: 400,
    description: 'Invalid, expired, or used verification token',
  })
  async verifyEmail(
    @Body(new ZodValidationPipe(verifyEmailSchema)) dto: VerifyEmailDto,
  ) {
    return this.authService.verifyEmail(dto.token);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get profile and permissions of authenticated user' })
  @SwaggerApiResponse({ status: 200, description: 'Current user profile details' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthenticated' })
  async getMe(
    @CurrentUser() user: AuthenticatedUserContext,
    @CurrentTenant() organizationId: string | null,
  ) {
    return this.authService.getMe(user.id, organizationId || undefined);
  }

  @Put('me/profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update profile details for the authenticated user' })
  @SwaggerApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.authService.updateProfile(user.id, dto, ipAddress);
  }

  @Put('me/password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for the authenticated user' })
  @SwaggerApiResponse({ status: 200, description: 'Password changed successfully' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.authService.changePassword(user.id, dto, ipAddress);
  }

  @Get('me/entitlements')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get active feature entitlements and limits for current gym' })
  @SwaggerApiResponse({ status: 200, description: 'Effective entitlements context' })
  async getMyEntitlements(
    @CurrentTenant() organizationId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    if (!organizationId) {
      if (user.isSuperAdmin) {
        return {
          organizationId: null,
          planCode: 'super_admin',
          planName: 'Platform Super Admin',
          subscriptionStatus: 'ACTIVE',
          isSubscriptionActive: true,
          expiresAt: '2099-12-31',
          features: {},
          quotas: {},
        };
      }
      throw new UnauthorizedException('Organization context required to retrieve entitlements');
    }
    return this.entitlementService.getEffectiveEntitlements(organizationId);
  }

  @Get('organizations')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all organizations the authenticated user belongs to',
  })
  @SwaggerApiResponse({ status: 200, description: 'List of authorized organizations' })
  async getOrganizations(@CurrentUser() user: AuthenticatedUserContext) {
    return this.authService.getUserOrganizations(user.id, user.isSuperAdmin);
  }

  @Post('organizations/:organizationId/select')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Select active organization context and rotate access token',
  })
  @SwaggerApiResponse({
    status: 200,
    description: 'Switched organization context with new tokens',
  })
  @SwaggerApiResponse({
    status: 403,
    description: 'Not a member of target organization',
  })
  async selectOrganization(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param(new ZodValidationPipe(selectOrganizationSchema))
    dto: SelectOrganizationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await this.authService.selectOrganization(
      user.id,
      dto,
      ipAddress,
      userAgent,
    );

    this.setAuthCookies(
      res,
      result.tokens.accessToken,
      result.tokens.refreshToken,
    );

    return result;
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all active user sessions' })
  @SwaggerApiResponse({ status: 200, description: 'Active user sessions' })
  async listSessions(@CurrentUser() user: AuthenticatedUserContext) {
    return this.authService.listSessions(user.id);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific active session' })
  @SwaggerApiResponse({ status: 200, description: 'Session revoked successfully' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') sessionId: string,
  ) {
    return this.authService.revokeSession(user.id, sessionId);
  }
}
