import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { MembershipsService } from './memberships.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CurrentTenant } from '../common/auth/current-tenant.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  Permission,
  AuthenticatedUserContext,
  PlanStatus,
  MembershipPlanData,
  MemberMembershipData,
  MembershipDetailData,
  PaginatedResult,
} from '@gymos/shared-types';
import {
  createMembershipPlanSchema,
  CreateMembershipPlanInput,
  updateMembershipPlanSchema,
  UpdateMembershipPlanInput,
  updatePlanStatusSchema,
  UpdatePlanStatusInput,
  assignMembershipSchema,
  AssignMembershipInput,
  renewMembershipSchema,
  RenewMembershipInput,
  freezeMembershipSchema,
  FreezeMembershipInput,
  thawMembershipSchema,
  ThawMembershipInput,
  cancelMembershipSchema,
  CancelMembershipInput,
  planQuerySchema,
  PlanQueryInput,
  subscriptionQuerySchema,
  SubscriptionQueryInput,
} from '@gymos/validation';

@Controller('memberships')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  // ---------------------------------------------------------------------------
  // MEMBERSHIP PLAN ENDPOINTS
  // ---------------------------------------------------------------------------

  @Post('plans')
  @RequirePermissions(Permission.MEMBERSHIP_PLAN_MANAGE)
  async createPlan(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(createMembershipPlanSchema)) dto: CreateMembershipPlanInput,
    @Req() req: Request,
  ): Promise<MembershipPlanData> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.createPlan(
      targetOrgId,
      user.id,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get('plans')
  @RequirePermissions(Permission.MEMBERSHIP_PLAN_READ)
  async listPlans(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query(new ZodValidationPipe(planQuerySchema)) query: PlanQueryInput,
  ): Promise<PaginatedResult<MembershipPlanData>> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.listPlans(targetOrgId, query);
  }

  @Get('plans/:id')
  @RequirePermissions(Permission.MEMBERSHIP_PLAN_READ)
  async getPlan(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') planId: string,
  ): Promise<MembershipPlanData> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.getPlanById(targetOrgId, planId);
  }

  @Patch('plans/:id')
  @RequirePermissions(Permission.MEMBERSHIP_PLAN_MANAGE)
  async updatePlan(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') planId: string,
    @Body(new ZodValidationPipe(updateMembershipPlanSchema)) dto: UpdateMembershipPlanInput,
    @Req() req: Request,
  ): Promise<MembershipPlanData> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.updatePlan(
      targetOrgId,
      user.id,
      planId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Patch('plans/:id/status')
  @RequirePermissions(Permission.MEMBERSHIP_PLAN_MANAGE)
  async updatePlanStatus(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') planId: string,
    @Body(new ZodValidationPipe(updatePlanStatusSchema)) dto: UpdatePlanStatusInput,
    @Req() req: Request,
  ): Promise<MembershipPlanData> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.updatePlanStatus(
      targetOrgId,
      user.id,
      planId,
      dto.status as unknown as PlanStatus,
      req.ip,
      req.headers['user-agent'],
    );
  }

  // ---------------------------------------------------------------------------
  // SUBSCRIPTION ASSIGNMENT & LIFECYCLE
  // ---------------------------------------------------------------------------

  @Post('subscriptions')
  @RequirePermissions(Permission.MEMBER_SUBSCRIPTION_ASSIGN)
  async assignMembership(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(assignMembershipSchema)) dto: AssignMembershipInput,
    @Req() req: Request,
  ): Promise<MemberMembershipData> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.assignMembership(
      targetOrgId,
      user.id,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Get('subscriptions')
  @RequirePermissions(Permission.MEMBER_SUBSCRIPTION_READ)
  async listSubscriptions(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query(new ZodValidationPipe(subscriptionQuerySchema)) query: SubscriptionQueryInput,
  ): Promise<PaginatedResult<MemberMembershipData>> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.listSubscriptions(targetOrgId, query);
  }

  @Get('subscriptions/:id')
  @RequirePermissions(Permission.MEMBER_SUBSCRIPTION_READ)
  async getSubscription(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') membershipId: string,
  ): Promise<MembershipDetailData> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.getSubscriptionById(targetOrgId, membershipId);
  }

  @Get('members/:memberId')
  @RequirePermissions(Permission.MEMBER_SUBSCRIPTION_READ)
  async getMemberSubscriptions(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('memberId') memberId: string,
  ): Promise<MemberMembershipData[]> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.getMemberSubscriptions(targetOrgId, memberId);
  }

  @Post('subscriptions/:id/renew')
  @RequirePermissions(Permission.MEMBER_SUBSCRIPTION_RENEW)
  async renewMembership(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') membershipId: string,
    @Body(new ZodValidationPipe(renewMembershipSchema)) dto: RenewMembershipInput,
    @Req() req: Request,
  ): Promise<MemberMembershipData> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.renewMembership(
      targetOrgId,
      user.id,
      membershipId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('subscriptions/:id/freeze')
  @RequirePermissions(Permission.MEMBER_SUBSCRIPTION_FREEZE)
  async freezeMembership(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') membershipId: string,
    @Body(new ZodValidationPipe(freezeMembershipSchema)) dto: FreezeMembershipInput,
    @Req() req: Request,
  ): Promise<MemberMembershipData> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.freezeMembership(
      targetOrgId,
      user.id,
      membershipId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('subscriptions/:id/thaw')
  @RequirePermissions(Permission.MEMBER_SUBSCRIPTION_FREEZE)
  async thawMembership(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') membershipId: string,
    @Body(new ZodValidationPipe(thawMembershipSchema)) dto: ThawMembershipInput,
    @Req() req: Request,
  ): Promise<MemberMembershipData> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.thawMembership(
      targetOrgId,
      user.id,
      membershipId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('subscriptions/:id/cancel')
  @RequirePermissions(Permission.MEMBER_SUBSCRIPTION_CANCEL)
  async cancelMembership(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') membershipId: string,
    @Body(new ZodValidationPipe(cancelMembershipSchema)) dto: CancelMembershipInput,
    @Req() req: Request,
  ): Promise<MemberMembershipData> {
    const targetOrgId = orgId || user.organizationId;
    if (!targetOrgId) {
      throw new BadRequestException('Organization context is required');
    }
    return this.membershipsService.cancelMembership(
      targetOrgId,
      user.id,
      membershipId,
      dto,
      req.ip,
      req.headers['user-agent'],
    );
  }

  @Post('process-expiries')
  @RequirePermissions(Permission.MEMBER_SUBSCRIPTION_ASSIGN)
  async processExpiries(
    @CurrentTenant() orgId: string | null,
  ): Promise<{ expiredCount: number }> {
    return this.membershipsService.processExpiries(orgId || undefined);
  }
}
