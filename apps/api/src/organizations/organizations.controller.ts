import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CurrentTenant } from '../common/auth/current-tenant.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Permission, AuthenticatedUserContext, OrganizationProfile } from '@gymos/shared-types';
import {
  updateOrganizationProfileSchema,
  UpdateOrganizationProfileInput,
  updateOrganizationSettingsSchema,
  UpdateOrganizationSettingsInput,
  createOrganizationSchema,
  CreateOrganizationInput,
} from './dto/organization.dto';
import {
  GeneralSettingsDto,
  GymSmtpConfigDto,
  GymWhatsAppConfigDto,
  GymNotificationSettingsDto,
  TestOrgSmtpDto,
  TestOrgWhatsAppDto,
} from './dto/organization-settings.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions(Permission.PLATFORM_ORGANIZATIONS_MANAGE)
  async createOrganization(
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(createOrganizationSchema))
    dto: CreateOrganizationInput,
    @Req() req: Request,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.organizationsService.createOrganization(
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Get('current')
  @RequirePermissions(Permission.ORGANIZATION_PROFILE_READ)
  async getCurrentOrganization(
    @CurrentTenant() orgId: string | null,
  ): Promise<OrganizationProfile> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.organizationsService.getCurrentOrganization(orgId);
  }

  @Patch('current')
  @RequirePermissions(Permission.ORGANIZATION_PROFILE_UPDATE)
  async updateCurrentOrganization(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(updateOrganizationProfileSchema))
    dto: UpdateOrganizationProfileInput,
    @Req() req: Request,
  ): Promise<OrganizationProfile> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.organizationsService.updateCurrentOrganization(
      orgId,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Get('current/members')
  @RequirePermissions(Permission.ORGANIZATION_BRANCH_STAFF_READ)
  async getOrganizationMembers(
    @CurrentTenant() orgId: string | null,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.organizationsService.getOrganizationMembers(orgId);
  }

  @Get('current/settings')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_READ)
  async getCurrentSettings(
    @CurrentTenant() orgId: string | null,
  ): Promise<{ timezone: string; currency: string }> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.organizationsService.getCurrentSettings(orgId);
  }

  @Patch('current/settings')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_UPDATE)
  async updateCurrentSettings(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(updateOrganizationSettingsSchema))
    dto: UpdateOrganizationSettingsInput,
    @Req() req: Request,
  ): Promise<{ timezone: string; currency: string }> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.organizationsService.updateCurrentSettings(
      orgId,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // =========================================================================
  // GYM PERSONAL SETTINGS: GENERAL, CUSTOM SMTP & WHATSAPP API
  // =========================================================================

  @Get('current/settings/overview')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_READ)
  async getOrganizationSettingsOverview(
    @CurrentTenant() orgId: string | null,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.organizationsService.getOrganizationSettingsOverview(orgId);
  }

  @Get('current/settings/general')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_READ)
  async getGeneralSettings(
    @CurrentTenant() orgId: string | null,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.organizationsService.getGeneralSettings(orgId);
  }

  @Patch('current/settings/general')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_UPDATE)
  async updateGeneralSettings(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: GeneralSettingsDto,
    @Req() req: Request,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.organizationsService.updateGeneralSettings(
      orgId,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // --- SMTP ---
  @Get('current/settings/email')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_READ)
  async getOrgSmtpConfig(
    @CurrentTenant() orgId: string | null,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.organizationsService.getOrgSmtpConfig(orgId);
  }

  @Patch('current/settings/email')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_UPDATE)
  async updateOrgSmtpConfig(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: GymSmtpConfigDto,
    @Req() req: Request,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.organizationsService.updateOrgSmtpConfig(
      orgId,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Post('current/settings/email/test-connection')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_MANAGE)
  async testOrgSmtpConnection(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.organizationsService.testOrgSmtpConnection(orgId, user.id, ipAddress);
  }

  @Post('current/settings/email/test-send')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_MANAGE)
  async sendOrgTestEmail(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: TestOrgSmtpDto,
    @Req() req: Request,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.organizationsService.sendOrgTestEmail(orgId, dto, user.id, ipAddress);
  }

  // --- WHATSAPP ---
  @Get('current/settings/whatsapp')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_READ)
  async getOrgWhatsAppConfig(
    @CurrentTenant() orgId: string | null,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.organizationsService.getOrgWhatsAppConfig(orgId);
  }

  @Patch('current/settings/whatsapp')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_UPDATE)
  async updateOrgWhatsAppConfig(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: GymWhatsAppConfigDto,
    @Req() req: Request,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.organizationsService.updateOrgWhatsAppConfig(
      orgId,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Post('current/settings/whatsapp/test-connection')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_MANAGE)
  async verifyOrgWhatsAppConnection(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Req() req: Request,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.organizationsService.verifyOrgWhatsAppConnection(orgId, user.id, ipAddress);
  }

  @Post('current/settings/whatsapp/test-send')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_MANAGE)
  async sendOrgTestWhatsAppMessage(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: TestOrgWhatsAppDto,
    @Req() req: Request,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    return this.organizationsService.sendOrgTestWhatsAppMessage(orgId, dto, user.id, ipAddress);
  }

  // --- NOTIFICATIONS ---
  @Get('current/settings/notifications')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_READ)
  async getOrgNotificationSettings(
    @CurrentTenant() orgId: string | null,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.organizationsService.getOrgNotificationSettings(orgId);
  }

  @Patch('current/settings/notifications')
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_UPDATE)
  async updateOrgNotificationSettings(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body() dto: GymNotificationSettingsDto,
    @Req() req: Request,
  ) {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.organizationsService.updateOrgNotificationSettings(
      orgId,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }
}
