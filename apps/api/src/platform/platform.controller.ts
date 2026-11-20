import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SuperAdminGuard } from '../common/auth/super-admin.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { AuthenticatedUserContext } from '@gymos/shared-types';
import { PlatformService } from './platform.service';

@ApiTags('Platform Super Admin')
@Controller('platform')
@UseGuards(SuperAdminGuard)
export class PlatformController {
  constructor(private readonly platformService: PlatformService) {}

  /**
   * Platform Overview: High-level SaaS metrics, total gyms, active subscriptions, MRR.
   */
  @Get('overview')
  async getOverview() {
    return this.platformService.getOverview();
  }

  /**
   * List gym organizations with paginated metadata, subscriptions, and active usage counts.
   */
  @Get('organizations')
  async getOrganizations(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.platformService.getOrganizations({
      page,
      limit,
      search,
      status,
    });
  }

  /**
   * Register a new Gym Organization directly by Super Admin.
   */
  @Post('organizations')
  @ApiOperation({ summary: 'Register and onboard a new gym organization with owner account and SaaS plan' })
  async createOrganization(@Body() dto: any) {
    return this.platformService.createOrganization(dto);
  }

  /**
   * Change a gym's account status (ACTIVE, SUSPENDED, CANCELLED).
   */
  @Patch('organizations/:id/status')
  async updateOrgStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ) {
    return this.platformService.updateOrganizationStatus(id, status);
  }

  /**
   * List all available SaaS pricing plans and default feature mappings.
   */
  @Get('plans')
  async getPlans() {
    return this.platformService.getPlans();
  }

  /**
   * Create a new custom SaaS subscription plan with configurable features and quotas.
   */
  @Post('plans')
  async createPlan(@Body() body: any) {
    return this.platformService.createPlan(body);
  }

  /**
   * Update an existing SaaS subscription plan's pricing, features, and quotas.
   */
  @Patch('plans/:id')
  async updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: any,
  ) {
    return this.platformService.updatePlan(id, body);
  }

  /**
   * Delete or archive a SaaS subscription plan.
   */
  @Delete('plans/:id')
  async deletePlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformService.deletePlan(id);
  }

  /**
   * List all 49 features in the GymOS catalog grouped by category.
   */
  @Get('features')
  async getFeatureCatalog() {
    return this.platformService.getFeatureCatalog();
  }

  /**
   * Inspect a specific gym's subscription, plan defaults, overrides, and effective map.
   */
  @Get('organizations/:id/entitlements')
  async getOrgEntitlements(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformService.getOrganizationEntitlementDetails(id);
  }

  /**
   * 1-Click Feature Override / Quota update for a specific gym organization.
   */
  @Patch('organizations/:id/entitlements')
  async updateOrgEntitlements(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('overrides')
    overrides: Array<{
      featureKey: string;
      isEnabled: boolean;
      numericQuota?: number | null;
      reason?: string;
    }>,
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.platformService.setOrganizationEntitlements(
      id,
      overrides,
      user.id,
    );
  }

  /**
   * Assign or upgrade/downgrade a SaaS plan for a gym organization.
   */
  @Post('organizations/:id/plan')
  async assignOrgPlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      planCode: string;
      billingInterval?: string;
      agreedPrice?: number;
    },
    @CurrentUser() user: AuthenticatedUserContext,
  ) {
    return this.platformService.assignSubscriptionPlan(id, body, user.id);
  }

  /**
   * Delete a single gym organization permanently.
   */
  @Delete('organizations/:id')
  async deleteOrganization(@Param('id', ParseUUIDPipe) id: string) {
    return this.platformService.deleteOrganization(id);
  }

  /**
   * Bulk delete multiple gym organizations.
   */
  @Post('organizations/bulk-delete')
  async bulkDeleteOrganizations(@Body('ids') ids: string[]) {
    return this.platformService.bulkDeleteOrganizations(ids);
  }
}
