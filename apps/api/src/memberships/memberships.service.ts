import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { AppLoggerService } from '../logging/app-logger.service';
import {
  CreateMembershipPlanInput,
  UpdateMembershipPlanInput,
  AssignMembershipInput,
  RenewMembershipInput,
  FreezeMembershipInput,
  ThawMembershipInput,
  CancelMembershipInput,
  PlanQueryInput,
  SubscriptionQueryInput,
} from '@gymos/validation';
import {
  PlanDurationType,
  PlanScope,
  PlanStatus,
  MembershipStatus,
  FreezeStatus,
  MembershipPlanData,
  PricingSnapshotData,
  MemberMembershipData,
  MembershipDetailData,
  MembershipFreezeData,
  MembershipHistoryData,
  PaginatedResult,
} from '@gymos/shared-types';

/**
 * Computes the inclusive end date for a membership based on duration type and value.
 * Handles calendar boundaries, leap years, and month-end dates.
 */
export function computeEndDate(
  startDate: Date,
  durationType: string,
  durationValue: number,
): Date {
  const y = startDate.getUTCFullYear();
  const m = startDate.getUTCMonth();
  const d = startDate.getUTCDate();

  if (durationType === 'DAYS') {
    return new Date(Date.UTC(y, m, d + durationValue - 1));
  }
  if (durationType === 'MONTHS') {
    const targetMonthIndex = m + durationValue;
    const targetYear = y + Math.floor(targetMonthIndex / 12);
    const targetMonth = targetMonthIndex % 12;
    const isStartEndOfMonth = d === new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

    if (isStartEndOfMonth) {
      return new Date(Date.UTC(targetYear, targetMonth + 1, 0));
    } else {
      const maxDaysInTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      const nextDay = Math.min(d, maxDaysInTargetMonth);
      const nextCycleDate = new Date(Date.UTC(targetYear, targetMonth, nextDay));
      nextCycleDate.setUTCDate(nextCycleDate.getUTCDate() - 1);
      return nextCycleDate;
    }
  }
  if (durationType === 'YEARS') {
    const targetYear = y + durationValue;
    const isStartEndOfMonth = d === new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    if (isStartEndOfMonth) {
      return new Date(Date.UTC(targetYear, m + 1, 0));
    }
    const maxDays = new Date(Date.UTC(targetYear, m + 1, 0)).getUTCDate();
    const nextDay = Math.min(d, maxDays);
    const nextCycle = new Date(Date.UTC(targetYear, m, nextDay));
    nextCycle.setUTCDate(nextCycle.getUTCDate() - 1);
    return nextCycle;
  }
  return new Date(Date.UTC(y, m + 1, d - 1));
}

@Injectable()
export class MembershipsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly logger: AppLoggerService,
  ) {}

  // ---------------------------------------------------------------------------
  // MAPPER HELPERS
  // ---------------------------------------------------------------------------

  private mapPlanToData(p: any): MembershipPlanData {
    return {
      id: p.id,
      organizationId: p.organizationId,
      name: p.name,
      code: p.code,
      description: p.description,
      durationType: p.durationType as unknown as PlanDurationType,
      durationValue: p.durationValue,
      price: Number(p.price),
      registrationFee: Number(p.registrationFee),
      currency: p.currency,
      scope: p.scope as unknown as PlanScope,
      maxFreezeDays: p.maxFreezeDays,
      maxFreezes: p.maxFreezes,
      gracePeriodDays: p.gracePeriodDays,
      features: (p.features as string[]) || [],
      status: p.status as unknown as PlanStatus,
      branchIds: p.branchScopes?.map((b: any) => b.branchId) || [],
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      subscriberCount: p._count?.subscriptions ?? undefined,
    };
  }

  private mapSubscriptionToData(s: any): MemberMembershipData {
    return {
      id: s.id,
      organizationId: s.organizationId,
      memberId: s.memberId,
      memberName: s.member ? `${s.member.firstName} ${s.member.lastName}` : undefined,
      memberNumber: s.member?.memberNumber,
      planId: s.planId,
      planName: s.plan?.name,
      planCode: s.plan?.code,
      homeBranchId: s.homeBranchId,
      homeBranchName: s.homeBranch?.name,
      startDate: s.startDate instanceof Date ? s.startDate.toISOString().split('T')[0] : String(s.startDate),
      endDate: s.endDate instanceof Date ? s.endDate.toISOString().split('T')[0] : String(s.endDate),
      originalEndDate: s.originalEndDate instanceof Date ? s.originalEndDate.toISOString().split('T')[0] : String(s.originalEndDate),
      basePrice: Number(s.basePrice),
      registrationFee: Number(s.registrationFee),
      discountAmount: Number(s.discountAmount),
      discountReason: s.discountReason,
      taxAmount: Number(s.taxAmount),
      taxRate: Number(s.taxRate),
      finalPrice: Number(s.finalPrice),
      currency: s.currency,
      pricingSnapshot: s.pricingSnapshot as PricingSnapshotData,
      totalFreezeDaysUsed: s.totalFreezeDaysUsed,
      freezeCount: s.freezeCount,
      renewalCount: s.renewalCount,
      previousMembershipId: s.previousMembershipId,
      status: s.status as unknown as MembershipStatus,
      autoRenew: s.autoRenew,
      notes: s.notes,
      cancelledAt: s.cancelledAt ? s.cancelledAt.toISOString() : null,
      cancellationReason: s.cancellationReason,
      cancelledBy: s.cancelledBy,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    };
  }

  private mapSubscriptionToDetail(s: any): MembershipDetailData {
    const base = this.mapSubscriptionToData(s);
    const freezes: MembershipFreezeData[] = (s.freezes || []).map((f: any) => ({
      id: f.id,
      organizationId: f.organizationId,
      membershipId: f.membershipId,
      startDate: f.startDate instanceof Date ? f.startDate.toISOString().split('T')[0] : String(f.startDate),
      endDate: f.endDate ? (f.endDate instanceof Date ? f.endDate.toISOString().split('T')[0] : String(f.endDate)) : null,
      actualThawDate: f.actualThawDate ? (f.actualThawDate instanceof Date ? f.actualThawDate.toISOString().split('T')[0] : String(f.actualThawDate)) : null,
      daysFrozen: f.daysFrozen,
      reason: f.reason,
      status: f.status as unknown as FreezeStatus,
      frozenBy: f.frozenBy,
      thawedBy: f.thawedBy,
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    }));

    const history: MembershipHistoryData[] = (s.history || []).map((h: any) => ({
      id: h.id,
      organizationId: h.organizationId,
      membershipId: h.membershipId,
      action: h.action,
      actorId: h.actorId,
      previousState: h.previousState,
      newState: h.newState,
      reason: h.reason,
      timestamp: h.timestamp.toISOString(),
    }));

    return {
      ...base,
      freezes,
      history,
      plan: s.plan ? this.mapPlanToData(s.plan) : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // MEMBERSHIP PLAN CRUD
  // ---------------------------------------------------------------------------

  async createPlan(
    organizationId: string,
    userId: string,
    dto: CreateMembershipPlanInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MembershipPlanData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // Check code uniqueness within org
      const existing = await tx.membershipPlan.findFirst({
        where: { organizationId, code: dto.code },
      });
      if (existing) {
        throw new BadRequestException(`A plan with code "${dto.code}" already exists in this organization`);
      }

      // If MULTI_BRANCH or SINGLE_BRANCH, validate branch IDs
      if (dto.branchIds && dto.branchIds.length > 0) {
        const branches = await tx.branch.findMany({
          where: { organizationId, id: { in: dto.branchIds } },
        });
        if (branches.length !== dto.branchIds.length) {
          throw new BadRequestException('One or more branch IDs are invalid or belong to another organization');
        }
      }

      const plan = await tx.membershipPlan.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          description: dto.description?.trim() || null,
          durationType: dto.durationType as any,
          durationValue: dto.durationValue,
          price: new Prisma.Decimal(dto.price),
          registrationFee: new Prisma.Decimal(dto.registrationFee ?? 0),
          currency: dto.currency || 'INR',
          scope: dto.scope as any,
          maxFreezeDays: dto.maxFreezeDays ?? 0,
          maxFreezes: dto.maxFreezes ?? 0,
          gracePeriodDays: dto.gracePeriodDays ?? 0,
          features: dto.features ?? [],
          status: 'ACTIVE',
          branchScopes: dto.branchIds && dto.branchIds.length > 0 ? {
            create: dto.branchIds.map((branchId) => ({
              organizationId,
              branchId,
            })),
          } : undefined,
        },
        include: {
          branchScopes: true,
          _count: { select: { subscriptions: true } },
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'membership_plan.created',
        entity: 'membership_plan',
        entityId: plan.id,
        metadata: {
          name: plan.name,
          code: plan.code,
          price: plan.price.toString(),
          durationType: plan.durationType,
          durationValue: plan.durationValue,
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(`Created membership plan "${plan.name}" (${plan.code}) in org ${organizationId}`);
      return this.mapPlanToData(plan);
    });
  }

  async updatePlan(
    organizationId: string,
    userId: string,
    planId: string,
    dto: UpdateMembershipPlanInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MembershipPlanData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.membershipPlan.findFirst({
        where: { id: planId, organizationId },
        include: { branchScopes: true },
      });
      if (!existing) {
        throw new NotFoundException('Membership plan not found');
      }

      // If updating branch scopes
      if (dto.branchIds !== undefined) {
        await tx.membershipPlanBranch.deleteMany({
          where: { planId, organizationId },
        });
        if (dto.branchIds.length > 0) {
          const branches = await tx.branch.findMany({
            where: { organizationId, id: { in: dto.branchIds } },
          });
          if (branches.length !== dto.branchIds.length) {
            throw new BadRequestException('One or more branch IDs are invalid or belong to another organization');
          }
          await tx.membershipPlanBranch.createMany({
            data: dto.branchIds.map((branchId) => ({
              organizationId,
              planId,
              branchId,
            })),
          });
        }
      }

      const updated = await tx.membershipPlan.update({
        where: { id: planId },
        data: {
          name: dto.name?.trim(),
          description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
          durationType: dto.durationType ? (dto.durationType as any) : undefined,
          durationValue: dto.durationValue,
          price: dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined,
          registrationFee: dto.registrationFee !== undefined ? new Prisma.Decimal(dto.registrationFee) : undefined,
          currency: dto.currency,
          scope: dto.scope ? (dto.scope as any) : undefined,
          maxFreezeDays: dto.maxFreezeDays,
          maxFreezes: dto.maxFreezes,
          gracePeriodDays: dto.gracePeriodDays,
          features: dto.features,
        },
        include: {
          branchScopes: true,
          _count: { select: { subscriptions: true } },
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'membership_plan.updated',
        entity: 'membership_plan',
        entityId: planId,
        metadata: { changes: dto },
        ipAddress,
        userAgent,
      });

      return this.mapPlanToData(updated);
    });
  }

  async updatePlanStatus(
    organizationId: string,
    userId: string,
    planId: string,
    status: PlanStatus,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MembershipPlanData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const existing = await tx.membershipPlan.findFirst({
        where: { id: planId, organizationId },
      });
      if (!existing) {
        throw new NotFoundException('Membership plan not found');
      }

      const updated = await tx.membershipPlan.update({
        where: { id: planId },
        data: { status: status as any },
        include: {
          branchScopes: true,
          _count: { select: { subscriptions: true } },
        },
      });

      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'membership_plan.status_updated',
        entity: 'membership_plan',
        entityId: planId,
        metadata: { oldStatus: existing.status, newStatus: status },
        ipAddress,
        userAgent,
      });

      return this.mapPlanToData(updated);
    });
  }

  async listPlans(organizationId: string, query: PlanQueryInput): Promise<PaginatedResult<MembershipPlanData>> {
    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const where: Prisma.MembershipPlanWhereInput = {
        organizationId,
        status: query.status ? (query.status as any) : undefined,
        scope: query.scope ? (query.scope as any) : undefined,
        ...(query.branchId
          ? {
              OR: [
                { scope: 'ALL_BRANCHES' as any },
                { branchScopes: { some: { branchId: query.branchId } } },
              ],
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        tx.membershipPlan.findMany({
          where,
          include: {
            branchScopes: true,
            _count: { select: { subscriptions: true } },
          },
          orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
          skip,
          take: limit,
        }),
        tx.membershipPlan.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);
      return {
        items: items.map((p) => this.mapPlanToData(p)),
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    });
  }

  async getPlanById(organizationId: string, planId: string): Promise<MembershipPlanData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const plan = await tx.membershipPlan.findFirst({
        where: { id: planId, organizationId },
        include: {
          branchScopes: true,
          _count: { select: { subscriptions: true } },
        },
      });
      if (!plan) {
        throw new NotFoundException('Membership plan not found');
      }
      return this.mapPlanToData(plan);
    });
  }

  // ---------------------------------------------------------------------------
  // SUBSCRIPTION ASSIGNMENT & LIFECYCLE
  // ---------------------------------------------------------------------------

  async assignMembership(
    organizationId: string,
    userId: string,
    dto: AssignMembershipInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MemberMembershipData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Verify Member exists and is active
      const member = await tx.member.findFirst({
        where: { id: dto.memberId, organizationId, status: 'ACTIVE' },
      });
      if (!member) {
        throw new BadRequestException('Target member not found or inactive in this organization');
      }

      // 2. Verify Plan exists and is active
      const plan = await tx.membershipPlan.findFirst({
        where: { id: dto.planId, organizationId, status: 'ACTIVE' },
        include: { branchScopes: true },
      });
      if (!plan) {
        throw new BadRequestException('Membership plan not found or inactive');
      }

      // 3. Verify Home Branch exists and matches plan scope
      const branch = await tx.branch.findFirst({
        where: { id: dto.homeBranchId, organizationId, status: 'ACTIVE' },
      });
      if (!branch) {
        throw new BadRequestException('Target branch not found or inactive');
      }

      if (plan.scope !== ('ALL_BRANCHES' as any)) {
        const allowedBranchIds = plan.branchScopes.map((bs) => bs.branchId);
        if (allowedBranchIds.length > 0 && !allowedBranchIds.includes(dto.homeBranchId)) {
          throw new BadRequestException(`Plan "${plan.name}" is not valid for branch "${branch.name}"`);
        }
      }

      // 4. Calculate Dates (inclusive)
      const startDate = dto.startDate ? new Date(`${dto.startDate}T00:00:00.000Z`) : new Date();
      startDate.setUTCHours(0, 0, 0, 0);
      const endDate = computeEndDate(startDate, plan.durationType, plan.durationValue);

      // 5. Pricing calculations & Snapshot
      const basePrice = Number(plan.price);
      const registrationFee = Number(plan.registrationFee);
      const discountAmount = Number(dto.discountAmount || 0);
      const taxRate = Number(dto.taxRate || 0);

      const subtotalBeforeTax = Math.max(0, basePrice + registrationFee - discountAmount);
      const taxAmount = Math.round((subtotalBeforeTax * (taxRate / 100)) * 100) / 100;
      const finalPrice = Math.round((subtotalBeforeTax + taxAmount) * 100) / 100;

      const pricingSnapshot: PricingSnapshotData = {
        planId: plan.id,
        planName: plan.name,
        planCode: plan.code,
        durationType: plan.durationType as unknown as PlanDurationType,
        durationValue: plan.durationValue,
        basePrice,
        registrationFee,
        discountAmount,
        discountReason: dto.discountReason || null,
        taxAmount,
        taxRate,
        finalPrice,
        currency: plan.currency,
        capturedAt: new Date().toISOString(),
      };

      // 6. Determine initial status
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const initialStatus = startDate > today ? 'PENDING' : 'ACTIVE';

      // 7. Create Membership Record
      const membership = await tx.memberMembership.create({
        data: {
          organizationId,
          memberId: member.id,
          planId: plan.id,
          homeBranchId: branch.id,
          startDate,
          endDate,
          originalEndDate: endDate,
          basePrice: new Prisma.Decimal(basePrice),
          registrationFee: new Prisma.Decimal(registrationFee),
          discountAmount: new Prisma.Decimal(discountAmount),
          discountReason: dto.discountReason || null,
          taxAmount: new Prisma.Decimal(taxAmount),
          taxRate: new Prisma.Decimal(taxRate),
          finalPrice: new Prisma.Decimal(finalPrice),
          currency: plan.currency,
          pricingSnapshot: pricingSnapshot as unknown as Prisma.InputJsonValue,
          status: initialStatus as any,
          autoRenew: dto.autoRenew ?? false,
          notes: dto.notes?.trim() || null,
        },
        include: {
          member: { select: { firstName: true, lastName: true, memberNumber: true } },
          plan: { select: { name: true, code: true } },
          homeBranch: { select: { name: true } },
        },
      });

      // 8. Record Immutable History
      await tx.membershipHistory.create({
        data: {
          organizationId,
          membershipId: membership.id,
          action: 'ASSIGNED',
          actorId: userId,
          newState: {
            status: initialStatus,
            planId: plan.id,
            planName: plan.name,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            finalPrice,
          },
          reason: 'Initial membership assignment',
        },
      });

      // 9. Transactional Outbox Event for Automation
      await tx.membershipOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: membership.id,
          eventType: 'membership.created',
          idempotencyKey: `outbox_membership_created_${membership.id}`,
          payload: {
            membershipId: membership.id,
            memberId: member.id,
            organizationId,
            planId: plan.id,
            planName: plan.name,
            status: initialStatus,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            finalPrice,
          },
          status: 'PENDING',
        },
      });

      // 10. Audit Log
      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'membership.assigned',
        entity: 'member_membership',
        entityId: membership.id,
        metadata: {
          memberId: member.id,
          planId: plan.id,
          planName: plan.name,
          finalPrice,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(`Assigned membership ${membership.id} (plan ${plan.name}) to member ${member.id}`);
      return this.mapSubscriptionToData(membership);
    });
  }

  async renewMembership(
    organizationId: string,
    userId: string,
    membershipId: string,
    dto: RenewMembershipInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MemberMembershipData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Fetch current membership
      const current = await tx.memberMembership.findFirst({
        where: { id: membershipId, organizationId },
        include: {
          member: true,
          plan: { include: { branchScopes: true } },
        },
      });
      if (!current) {
        throw new NotFoundException('Membership not found');
      }

      // 2. Fetch renewal plan (either specified in dto or same as current plan)
      const targetPlanId = dto.planId || current.planId;
      const plan = await tx.membershipPlan.findFirst({
        where: { id: targetPlanId, organizationId, status: 'ACTIVE' },
        include: { branchScopes: true },
      });
      if (!plan) {
        throw new BadRequestException('Selected renewal plan not found or inactive');
      }

      // 3. Determine start date: seamless extension or specified date
      let startDate: Date;
      if (dto.startDate) {
        startDate = new Date(`${dto.startDate}T00:00:00.000Z`);
        startDate.setUTCHours(0, 0, 0, 0);
      } else {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        // If current membership is still active, seamless start is day after current endDate
        if (current.status === ('ACTIVE' as any) && current.endDate >= today) {
          startDate = new Date(current.endDate);
          startDate.setUTCDate(startDate.getUTCDate() + 1);
        } else {
          startDate = today;
        }
      }

      const endDate = computeEndDate(startDate, plan.durationType, plan.durationValue);

      // 4. Pricing calculations
      const basePrice = Number(plan.price);
      // Renewals do not recharge registrationFee by default
      const registrationFee = 0;
      const discountAmount = Number(dto.discountAmount || 0);
      const taxRate = Number(dto.taxRate || 0);

      const subtotalBeforeTax = Math.max(0, basePrice + registrationFee - discountAmount);
      const taxAmount = Math.round((subtotalBeforeTax * (taxRate / 100)) * 100) / 100;
      const finalPrice = Math.round((subtotalBeforeTax + taxAmount) * 100) / 100;

      const pricingSnapshot: PricingSnapshotData = {
        planId: plan.id,
        planName: plan.name,
        planCode: plan.code,
        durationType: plan.durationType as unknown as PlanDurationType,
        durationValue: plan.durationValue,
        basePrice,
        registrationFee,
        discountAmount,
        discountReason: dto.discountReason || null,
        taxAmount,
        taxRate,
        finalPrice,
        currency: plan.currency,
        capturedAt: new Date().toISOString(),
      };

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const initialStatus = startDate > today ? 'PENDING' : 'ACTIVE';

      // 5. Create renewed membership linked to predecessor
      const renewed = await tx.memberMembership.create({
        data: {
          organizationId,
          memberId: current.memberId,
          planId: plan.id,
          homeBranchId: current.homeBranchId,
          startDate,
          endDate,
          originalEndDate: endDate,
          basePrice: new Prisma.Decimal(basePrice),
          registrationFee: new Prisma.Decimal(registrationFee),
          discountAmount: new Prisma.Decimal(discountAmount),
          discountReason: dto.discountReason || null,
          taxAmount: new Prisma.Decimal(taxAmount),
          taxRate: new Prisma.Decimal(taxRate),
          finalPrice: new Prisma.Decimal(finalPrice),
          currency: plan.currency,
          pricingSnapshot: pricingSnapshot as unknown as Prisma.InputJsonValue,
          status: initialStatus as any,
          renewalCount: current.renewalCount + 1,
          previousMembershipId: current.id,
          autoRenew: dto.autoRenew ?? current.autoRenew,
          notes: dto.notes?.trim() || null,
        },
        include: {
          member: { select: { firstName: true, lastName: true, memberNumber: true } },
          plan: { select: { name: true, code: true } },
          homeBranch: { select: { name: true } },
        },
      });

      // 6. History for previous membership and new membership
      await tx.membershipHistory.create({
        data: {
          organizationId,
          membershipId: current.id,
          action: 'RENEWED',
          actorId: userId,
          newState: { renewedToId: renewed.id },
          reason: `Renewed into membership ${renewed.id}`,
        },
      });

      await tx.membershipHistory.create({
        data: {
          organizationId,
          membershipId: renewed.id,
          action: 'ASSIGNED',
          actorId: userId,
          newState: {
            status: initialStatus,
            planId: plan.id,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            previousMembershipId: current.id,
          },
          reason: `Renewed from membership ${current.id}`,
        },
      });

      // 7. Transactional Outbox Event
      await tx.membershipOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: renewed.id,
          eventType: 'membership.renewed',
          idempotencyKey: `outbox_membership_renewed_${renewed.id}`,
          payload: {
            membershipId: renewed.id,
            previousMembershipId: current.id,
            memberId: current.memberId,
            organizationId,
            planId: plan.id,
            status: initialStatus,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            finalPrice,
          },
          status: 'PENDING',
        },
      });

      // 8. Audit Log
      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'membership.renewed',
        entity: 'member_membership',
        entityId: renewed.id,
        metadata: {
          previousMembershipId: current.id,
          memberId: current.memberId,
          planId: plan.id,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(`Renewed membership ${current.id} -> ${renewed.id} for member ${current.memberId}`);
      return this.mapSubscriptionToData(renewed);
    });
  }

  async freezeMembership(
    organizationId: string,
    userId: string,
    membershipId: string,
    dto: FreezeMembershipInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MemberMembershipData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const membership = await tx.memberMembership.findFirst({
        where: { id: membershipId, organizationId },
        include: {
          plan: true,
          freezes: { where: { status: 'ACTIVE' } },
        },
      });
      if (!membership) {
        throw new NotFoundException('Membership not found');
      }

      if (membership.status !== ('ACTIVE' as any)) {
        throw new BadRequestException(`Cannot freeze membership in ${membership.status} status`);
      }

      if (membership.freezes.length > 0) {
        throw new BadRequestException('Membership already has an active freeze in progress');
      }

      // Check plan freeze policies
      if (membership.plan.maxFreezes > 0 && membership.freezeCount >= membership.plan.maxFreezes) {
        throw new BadRequestException(`Maximum allowed freezes (${membership.plan.maxFreezes}) reached for this plan`);
      }

      if (membership.plan.maxFreezeDays > 0 && membership.totalFreezeDaysUsed >= membership.plan.maxFreezeDays) {
        throw new BadRequestException(`Maximum allowed freeze days (${membership.plan.maxFreezeDays}) reached for this plan`);
      }

      const freezeStartDate = new Date(`${dto.startDate}T00:00:00.000Z`);
      freezeStartDate.setUTCHours(0, 0, 0, 0);

      const freezeEndDate = dto.endDate ? new Date(`${dto.endDate}T00:00:00.000Z`) : null;
      if (freezeEndDate) {
        freezeEndDate.setUTCHours(0, 0, 0, 0);
        if (freezeEndDate < freezeStartDate) {
          throw new BadRequestException('Freeze end date cannot precede start date');
        }
      }

      // Create freeze record
      const freeze = await tx.membershipFreeze.create({
        data: {
          organizationId,
          membershipId: membership.id,
          startDate: freezeStartDate,
          endDate: freezeEndDate,
          reason: dto.reason?.trim() || null,
          status: 'ACTIVE',
          frozenBy: userId,
        },
      });

      // Update membership status
      const updated = await tx.memberMembership.update({
        where: { id: membership.id },
        data: {
          status: 'FROZEN',
          freezeCount: { increment: 1 },
        },
        include: {
          member: { select: { firstName: true, lastName: true, memberNumber: true } },
          plan: { select: { name: true, code: true } },
          homeBranch: { select: { name: true } },
        },
      });

      // Record History
      await tx.membershipHistory.create({
        data: {
          organizationId,
          membershipId: membership.id,
          action: 'FROZEN',
          actorId: userId,
          previousState: { status: membership.status },
          newState: {
            status: 'FROZEN',
            freezeId: freeze.id,
            freezeStartDate: freezeStartDate.toISOString().split('T')[0],
          },
          reason: dto.reason || 'Membership placed on freeze',
        },
      });

      // Outbox Event
      await tx.membershipOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: membership.id,
          eventType: 'membership.frozen',
          idempotencyKey: `outbox_membership_frozen_${freeze.id}`,
          payload: {
            membershipId: membership.id,
            freezeId: freeze.id,
            memberId: membership.memberId,
            organizationId,
            startDate: freezeStartDate.toISOString().split('T')[0],
            reason: dto.reason || null,
          },
          status: 'PENDING',
        },
      });

      // Audit Log
      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'membership.frozen',
        entity: 'member_membership',
        entityId: membership.id,
        metadata: {
          freezeId: freeze.id,
          startDate: freezeStartDate.toISOString().split('T')[0],
          reason: dto.reason,
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(`Frozen membership ${membership.id} for member ${membership.memberId}`);
      return this.mapSubscriptionToData(updated);
    });
  }

  async thawMembership(
    organizationId: string,
    userId: string,
    membershipId: string,
    dto: ThawMembershipInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MemberMembershipData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const membership = await tx.memberMembership.findFirst({
        where: { id: membershipId, organizationId },
        include: {
          freezes: {
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });
      if (!membership) {
        throw new NotFoundException('Membership not found');
      }

      if (membership.status !== ('FROZEN' as any)) {
        throw new BadRequestException(`Cannot thaw membership in ${membership.status} status`);
      }

      const activeFreeze = membership.freezes[0];
      if (!activeFreeze) {
        throw new BadRequestException('No active freeze record found for this membership');
      }

      const actualThawDate = dto.thawDate ? new Date(`${dto.thawDate}T00:00:00.000Z`) : new Date();
      actualThawDate.setUTCHours(0, 0, 0, 0);

      const freezeStartDate = new Date(activeFreeze.startDate);
      freezeStartDate.setUTCHours(0, 0, 0, 0);

      // Compute days frozen: min 1 day if thawed same day
      const diffMs = actualThawDate.getTime() - freezeStartDate.getTime();
      const daysFrozen = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

      // Shift membership endDate forward by daysFrozen
      const currentEndDate = new Date(membership.endDate);
      const newEndDate = new Date(currentEndDate.getTime() + daysFrozen * 24 * 60 * 60 * 1000);

      // Update Freeze Record
      await tx.membershipFreeze.update({
        where: { id: activeFreeze.id },
        data: {
          status: 'COMPLETED',
          actualThawDate,
          daysFrozen,
          thawedBy: userId,
        },
      });

      // Update Membership
      const updated = await tx.memberMembership.update({
        where: { id: membership.id },
        data: {
          status: 'ACTIVE',
          endDate: newEndDate,
          totalFreezeDaysUsed: { increment: daysFrozen },
        },
        include: {
          member: { select: { firstName: true, lastName: true, memberNumber: true } },
          plan: { select: { name: true, code: true } },
          homeBranch: { select: { name: true } },
        },
      });

      // Record History
      await tx.membershipHistory.create({
        data: {
          organizationId,
          membershipId: membership.id,
          action: 'THAWED',
          actorId: userId,
          previousState: {
            status: 'FROZEN',
            endDate: currentEndDate.toISOString().split('T')[0],
          },
          newState: {
            status: 'ACTIVE',
            endDate: newEndDate.toISOString().split('T')[0],
            daysFrozen,
          },
          reason: dto.reason || `Thawed after ${daysFrozen} days on freeze`,
        },
      });

      // Outbox Event
      await tx.membershipOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: membership.id,
          eventType: 'membership.thawed',
          idempotencyKey: `outbox_membership_thawed_${activeFreeze.id}`,
          payload: {
            membershipId: membership.id,
            freezeId: activeFreeze.id,
            memberId: membership.memberId,
            organizationId,
            daysFrozen,
            newEndDate: newEndDate.toISOString().split('T')[0],
          },
          status: 'PENDING',
        },
      });

      // Audit Log
      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'membership.thawed',
        entity: 'member_membership',
        entityId: membership.id,
        metadata: {
          freezeId: activeFreeze.id,
          daysFrozen,
          oldEndDate: currentEndDate.toISOString().split('T')[0],
          newEndDate: newEndDate.toISOString().split('T')[0],
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(`Thawed membership ${membership.id}: shifted endDate from ${currentEndDate.toISOString()} to ${newEndDate.toISOString()} (${daysFrozen} days)`);
      return this.mapSubscriptionToData(updated);
    });
  }

  async cancelMembership(
    organizationId: string,
    userId: string,
    membershipId: string,
    dto: CancelMembershipInput,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<MemberMembershipData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const membership = await tx.memberMembership.findFirst({
        where: { id: membershipId, organizationId },
        include: {
          freezes: { where: { status: 'ACTIVE' } },
        },
      });
      if (!membership) {
        throw new NotFoundException('Membership not found');
      }

      if (membership.status === ('CANCELLED' as any) || membership.status === ('TERMINATED' as any)) {
        throw new BadRequestException(`Membership is already ${membership.status}`);
      }

      // Close any active freeze
      if (membership.freezes.length > 0) {
        await tx.membershipFreeze.updateMany({
          where: { membershipId: membership.id, status: 'ACTIVE' },
          data: {
            status: 'CANCELLED',
            actualThawDate: new Date(),
          },
        });
      }

      const cancelledAt = new Date();
      const updated = await tx.memberMembership.update({
        where: { id: membership.id },
        data: {
          status: 'CANCELLED',
          cancelledAt,
          cancellationReason: dto.reason.trim(),
          cancelledBy: userId,
        },
        include: {
          member: { select: { firstName: true, lastName: true, memberNumber: true } },
          plan: { select: { name: true, code: true } },
          homeBranch: { select: { name: true } },
        },
      });

      // History
      await tx.membershipHistory.create({
        data: {
          organizationId,
          membershipId: membership.id,
          action: 'CANCELLED',
          actorId: userId,
          previousState: { status: membership.status },
          newState: { status: 'CANCELLED', cancelledAt: cancelledAt.toISOString() },
          reason: dto.reason.trim(),
        },
      });

      // Outbox Event
      await tx.membershipOutboxEvent.create({
        data: {
          organizationId,
          aggregateId: membership.id,
          eventType: 'membership.cancelled',
          idempotencyKey: `outbox_membership_cancelled_${membership.id}`,
          payload: {
            membershipId: membership.id,
            memberId: membership.memberId,
            organizationId,
            reason: dto.reason.trim(),
            cancelledAt: cancelledAt.toISOString(),
          },
          status: 'PENDING',
        },
      });

      // Audit Log
      await this.auditService.recordInTransaction(tx, {
        organizationId,
        userId,
        action: 'membership.cancelled',
        entity: 'member_membership',
        entityId: membership.id,
        metadata: {
          previousStatus: membership.status,
          reason: dto.reason.trim(),
        },
        ipAddress,
        userAgent,
      });

      this.logger.log(`Cancelled membership ${membership.id} for member ${membership.memberId}: "${dto.reason}"`);
      return this.mapSubscriptionToData(updated);
    });
  }

  // ---------------------------------------------------------------------------
  // QUERY & REPORTING
  // ---------------------------------------------------------------------------

  async listSubscriptions(
    organizationId: string,
    query: SubscriptionQueryInput,
  ): Promise<PaginatedResult<MemberMembershipData>> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const where: Prisma.MemberMembershipWhereInput = {
        organizationId,
        status: query.status ? (query.status as any) : undefined,
        memberId: query.memberId || undefined,
        planId: query.planId || undefined,
        homeBranchId: query.branchId || undefined,
        ...(query.expiringInDays
          ? {
              status: 'ACTIVE' as any,
              endDate: {
                gte: new Date(),
                lte: new Date(Date.now() + query.expiringInDays * 24 * 60 * 60 * 1000),
              },
            }
          : {}),
        ...(query.search
          ? {
              OR: [
                { member: { firstName: { contains: query.search, mode: 'insensitive' } } },
                { member: { lastName: { contains: query.search, mode: 'insensitive' } } },
                { member: { memberNumber: { contains: query.search, mode: 'insensitive' } } },
                { plan: { name: { contains: query.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        tx.memberMembership.findMany({
          where,
          include: {
            member: { select: { firstName: true, lastName: true, memberNumber: true } },
            plan: { select: { name: true, code: true } },
            homeBranch: { select: { name: true } },
          },
          orderBy: { [query.sortBy || 'createdAt']: query.sortOrder || 'desc' },
          skip,
          take: limit,
        }),
        tx.memberMembership.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);
      return {
        items: items.map((s) => this.mapSubscriptionToData(s)),
        meta: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      };
    });
  }

  async getSubscriptionById(organizationId: string, membershipId: string): Promise<MembershipDetailData> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const subscription = await tx.memberMembership.findFirst({
        where: { id: membershipId, organizationId },
        include: {
          member: { select: { firstName: true, lastName: true, memberNumber: true } },
          plan: {
            include: { branchScopes: true },
          },
          homeBranch: { select: { name: true } },
          freezes: { orderBy: { createdAt: 'desc' } },
          history: { orderBy: { timestamp: 'desc' } },
        },
      });

      if (!subscription) {
        throw new NotFoundException('Membership subscription not found');
      }

      return this.mapSubscriptionToDetail(subscription);
    });
  }

  async getMemberSubscriptions(organizationId: string, memberId: string): Promise<MemberMembershipData[]> {
    return this.prisma.withTenantContext(organizationId, async (tx) => {
      const list = await tx.memberMembership.findMany({
        where: { organizationId, memberId },
        include: {
          member: { select: { firstName: true, lastName: true, memberNumber: true } },
          plan: { select: { name: true, code: true } },
          homeBranch: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return list.map((s) => this.mapSubscriptionToData(s));
    });
  }

  // ---------------------------------------------------------------------------
  // BACKGROUND / CRON SUPPORT: EXPIRIES & OUTBOX DISPATCH
  // ---------------------------------------------------------------------------

  async processExpiries(organizationId?: string): Promise<{ expiredCount: number }> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const where: Prisma.MemberMembershipWhereInput = {
      status: 'ACTIVE' as any,
      endDate: { lt: today },
      ...(organizationId ? { organizationId } : {}),
    };

    const expiredSubscriptions = await this.prisma.memberMembership.findMany({
      where,
      select: { id: true, organizationId: true, memberId: true, endDate: true },
      take: 200,
    });

    let count = 0;
    for (const sub of expiredSubscriptions) {
      try {
        await this.prisma.withTenantContext(sub.organizationId, async (tx) => {
          await tx.memberMembership.update({
            where: { id: sub.id },
            data: { status: 'EXPIRED' as any },
          });

          await tx.membershipHistory.create({
            data: {
              organizationId: sub.organizationId,
              membershipId: sub.id,
              action: 'EXPIRED',
              newState: { status: 'EXPIRED' },
              reason: 'Automatic expiry processing passed endDate',
            },
          });

          const dateStr = sub.endDate instanceof Date ? sub.endDate.toISOString().split('T')[0] : String(sub.endDate);
          await tx.membershipOutboxEvent.create({
            data: {
              organizationId: sub.organizationId,
              aggregateId: sub.id,
              eventType: 'membership.expired',
              idempotencyKey: `outbox_membership_expired_${sub.id}_${dateStr}`,
              payload: {
                membershipId: sub.id,
                memberId: sub.memberId,
                organizationId: sub.organizationId,
                status: 'EXPIRED',
              },
              status: 'PENDING',
            },
          });
        });
        count++;
      } catch (err) {
        this.logger.error(`Failed to expire membership ${sub.id}`, (err as Error).stack);
      }
    }

    if (count > 0) {
      this.logger.log(`Processed ${count} expired memberships`);
    }
    return { expiredCount: count };
  }

  async processOutboxEvents(batchSize: number = 50): Promise<{ processed: number; failed: number }> {
    const events = await this.prisma.membershipOutboxEvent.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    let processed = 0;
    let failed = 0;

    for (const evt of events) {
      try {
        await this.prisma.membershipOutboxEvent.update({
          where: { id: evt.id },
          data: {
            status: 'PUBLISHED',
            processedAt: new Date(),
          },
        });
        processed++;
      } catch (err) {
        failed++;
        await this.prisma.membershipOutboxEvent.update({
          where: { id: evt.id },
          data: {
            retryCount: { increment: 1 },
            lastError: (err as Error).message,
            status: evt.retryCount >= 5 ? 'FAILED' : 'PENDING',
          },
        });
      }
    }

    return { processed, failed };
  }
}
