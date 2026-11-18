import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
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
} from './dto/organization.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

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
}
