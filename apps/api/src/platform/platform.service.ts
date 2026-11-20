import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EntitlementService } from '../common/entitlements/entitlement.service';
import {
  PlatformOverviewData,
  SaasSubscriptionStatus,
} from '@gymos/shared-types';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
  ) {}

  /**
   * Platform Overview: KPI analytics across all gyms, subscriptions, and MRR.
   */
  async getOverview(): Promise<PlatformOverviewData> {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const [totalGyms, activeGyms, suspendedGyms, totalMembers, totalPlans, subscriptions] =
        await Promise.all([
          tx.organization.count(),
          tx.organization.count({ where: { status: 'ACTIVE' } }),
          tx.organization.count({ where: { status: 'SUSPENDED' } }),
          tx.member.count({ where: { status: 'ACTIVE' } }),
          tx.saasPlan.count({ where: { isActive: true } }),
          tx.organizationSubscription.findMany({
            where: {
              status: {
                in: [
                  SaasSubscriptionStatus.ACTIVE,
                  SaasSubscriptionStatus.TRIALING,
                ],
              },
            },
            include: { plan: true },
          }),
        ]);

      let mrr = 0;
      const planDistribution: Record<string, number> = {};

      for (const sub of subscriptions) {
        const planName = sub.plan?.name || 'Custom';
        planDistribution[planName] = (planDistribution[planName] || 0) + 1;

        const agreed = Number(sub.agreedPrice || 0);
        if (sub.billingInterval === 'ANNUAL') {
          mrr += agreed / 12;
        } else {
          mrr += agreed;
        }
      }

      return {
        totalOrganizations: totalGyms,
        activeOrganizations: activeGyms,
        suspendedOrganizations: suspendedGyms,
        totalMembers,
        totalPlans,
        estimatedMrr: Math.round(mrr),
        planDistribution,
      };
    });
  }

  /**
   * List organizations with their subscription, plan, and usage stats.
   */
  async getOrganizations(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    return this.prisma.withSuperAdminContext(async (tx) => {
      const where: any = {};

      if (params.search) {
        where.OR = [
          { name: { contains: params.search, mode: 'insensitive' } },
          { slug: { contains: params.search, mode: 'insensitive' } },
        ];
      }

      if (params.status) {
        where.status = params.status;
      }

      const [total, orgs] = await Promise.all([
        tx.organization.count({ where }),
        tx.organization.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            subscriptions: {
              where: {
                status: {
                  in: [
                    SaasSubscriptionStatus.ACTIVE,
                    SaasSubscriptionStatus.TRIALING,
                  ],
                },
              },
              include: { plan: true },
              orderBy: { currentPeriodEnd: 'desc' },
              take: 1,
            },
            _count: {
              select: {
                members: { where: { status: 'ACTIVE' } },
                branches: { where: { status: 'ACTIVE' } },
              },
            },
          },
        }),
      ]);

      const items = orgs.map((org) => {
        const activeSub = org.subscriptions[0] || null;
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
          createdAt: org.createdAt.toISOString(),
          activeMembersCount: org._count.members,
          activeBranchesCount: org._count.branches,
          subscription: activeSub
            ? {
                id: activeSub.id,
                planCode: activeSub.plan.code,
                planName: activeSub.plan.name,
                status: activeSub.status,
                agreedPrice: Number(activeSub.agreedPrice),
                billingInterval: activeSub.billingInterval,
                currentPeriodEnd: activeSub.currentPeriodEnd.toISOString().slice(0, 10),
              }
            : null,
        };
      });

      return {
        data: items,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  /**
   * Update gym organization status (ACTIVE, SUSPENDED, CANCELLED).
   */
  async updateOrganizationStatus(orgId: string, status: any) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id: orgId } });
      if (!org) {
        throw new NotFoundException(`Organization with ID ${orgId} not found`);
      }

      const updated = await tx.organization.update({
        where: { id: orgId },
        data: { status },
      });

      // Clear cached entitlements
      await this.entitlementService.invalidateCache(orgId);

      return { id: updated.id, name: updated.name, status: updated.status };
    });
  }

  /**
   * List all SaaS plans and their configured feature entitlements.
   */
  async getPlans() {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const plans = await tx.saasPlan.findMany({
        orderBy: { sortOrder: 'asc' },
        include: {
          features: {
            include: { feature: true },
          },
        },
      });

      return plans.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        monthlyPrice: Number(p.monthlyPrice),
        annualPrice: Number(p.annualPrice),
        currency: p.currency,
        isActive: p.isActive,
        isPublic: p.isPublic,
        features: p.features.map((f) => ({
          featureKey: f.featureKey,
          domain: f.feature.domain,
          name: f.feature.name,
          isEnabled: f.isEnabled,
          numericQuota: f.numericQuota,
        })),
      }));
    });
  }

  /**
   * List the complete feature catalog (all 49 modules) grouped by category.
   */
  async getFeatureCatalog() {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const features = await tx.featureCatalog.findMany({
        orderBy: [{ domain: 'asc' }, { key: 'asc' }],
      });

      const grouped: Record<string, typeof features> = {};
      for (const f of features) {
        if (!grouped[f.domain]) {
          grouped[f.domain] = [];
        }
        grouped[f.domain]!.push(f);
      }

      return {
        all: features,
        grouped,
      };
    });
  }

  /**
   * Get an organization's complete entitlement management state:
   * current subscription, base plan, active overrides, and effective resolved map.
   */
  async getOrganizationEntitlementDetails(orgId: string) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const org = await tx.organization.findUnique({
        where: { id: orgId },
        include: {
          subscriptions: {
            include: {
              plan: {
                include: { features: true },
              },
            },
            orderBy: { currentPeriodEnd: 'desc' },
            take: 1,
          },
        },
      });

      if (!org) {
        throw new NotFoundException(`Organization with ID ${orgId} not found`);
      }

      const overrides = await tx.organizationEntitlementOverride.findMany({
        where: { organizationId: orgId },
      });

      const catalog = await tx.featureCatalog.findMany({
        orderBy: [{ domain: 'asc' }, { key: 'asc' }],
      });

      const effective = await this.entitlementService.getEffectiveEntitlements(orgId);

      const activeSub = org.subscriptions[0] || null;

      return {
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          status: org.status,
        },
        subscription: activeSub
          ? {
              id: activeSub.id,
              planCode: activeSub.plan.code,
              planName: activeSub.plan.name,
              status: activeSub.status,
              agreedPrice: Number(activeSub.agreedPrice),
              billingInterval: activeSub.billingInterval,
              currentPeriodStart: activeSub.currentPeriodStart.toISOString().slice(0, 10),
              currentPeriodEnd: activeSub.currentPeriodEnd.toISOString().slice(0, 10),
            }
          : null,
        overrides: overrides.map((o) => ({
          featureKey: o.featureKey,
          isEnabled: o.isEnabled,
          numericQuota: o.numericQuota,
          reason: o.reason,
          expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
        })),
        effective,
        catalog,
      };
    });
  }

  /**
   * Apply custom 1-click feature overrides or quota updates for a specific gym.
   */
  async setOrganizationEntitlements(
    orgId: string,
    overrides: Array<{
      featureKey: string;
      isEnabled: boolean;
      numericQuota?: number | null;
      reason?: string;
    }>,
    adminUserId: string,
  ) {
    if (!overrides || overrides.length === 0) {
      throw new BadRequestException('At least one override must be provided');
    }

    await this.prisma.withSuperAdminContext(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id: orgId } });
      if (!org) {
        throw new NotFoundException(`Organization with ID ${orgId} not found`);
      }

      for (const item of overrides) {
        // Upsert the override
        await tx.organizationEntitlementOverride.upsert({
          where: {
            unique_org_feature_override: {
              organizationId: orgId,
              featureKey: item.featureKey,
            },
          },
          update: {
            isEnabled: item.isEnabled,
            numericQuota: item.numericQuota !== undefined ? item.numericQuota : null,
            reason: item.reason || 'Admin custom override',
            grantedByUserId: adminUserId,
            updatedAt: new Date(),
          },
          create: {
            organizationId: orgId,
            featureKey: item.featureKey,
            isEnabled: item.isEnabled,
            numericQuota: item.numericQuota !== undefined ? item.numericQuota : null,
            reason: item.reason || 'Admin custom override',
            grantedByUserId: adminUserId,
          },
        });

        // Audit log
        await tx.entitlementChangeLog.create({
          data: {
            organizationId: orgId,
            featureKey: item.featureKey,
            actionType: 'OVERRIDE_UPDATED',
            performedByUserId: adminUserId,
            reason: item.reason || 'Platform Admin toggle',
            newState: {
              isEnabled: item.isEnabled,
              numericQuota: item.numericQuota,
            },
          },
        });
      }
    });

    // Invalidate Redis cache so subsequent requests get fresh state instantly
    await this.entitlementService.invalidateCache(orgId);

    return this.entitlementService.getEffectiveEntitlements(orgId);
  }

  /**
   * Assign or change a SaaS subscription plan for a gym.
   */
  async assignSubscriptionPlan(
    orgId: string,
    data: {
      planCode: string;
      billingInterval?: string;
      agreedPrice?: number;
    },
    adminUserId: string,
  ) {
    await this.prisma.withSuperAdminContext(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id: orgId } });
      if (!org) {
        throw new NotFoundException(`Organization ${orgId} not found`);
      }

      const plan = await tx.saasPlan.findUnique({
        where: { code: data.planCode },
      });
      if (!plan) {
        throw new NotFoundException(`Plan with code "${data.planCode}" not found`);
      }

      const now = new Date();
      const currentPeriodStart = now;
      const currentPeriodEnd = new Date(now);
      const billingInterval = data.billingInterval || 'MONTHLY';

      if (billingInterval === 'ANNUAL') {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      } else {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      }

      const agreedPrice =
        data.agreedPrice !== undefined
          ? data.agreedPrice
          : billingInterval === 'ANNUAL'
          ? Number(plan.annualPrice)
          : Number(plan.monthlyPrice);

      // Upsert subscription
      const existing = await tx.organizationSubscription.findFirst({
        where: { organizationId: orgId },
        orderBy: { currentPeriodEnd: 'desc' },
      });

      if (existing) {
        await tx.organizationSubscription.update({
          where: { id: existing.id },
          data: {
            planId: plan.id,
            status: SaasSubscriptionStatus.ACTIVE,
            billingInterval,
            agreedPrice,
            currentPeriodStart,
            currentPeriodEnd,
          },
        });
      } else {
        await tx.organizationSubscription.create({
          data: {
            organizationId: orgId,
            planId: plan.id,
            status: SaasSubscriptionStatus.ACTIVE,
            billingInterval,
            agreedPrice,
            currentPeriodStart,
            currentPeriodEnd,
          },
        });
      }

      // Audit log
      await tx.entitlementChangeLog.create({
        data: {
          organizationId: orgId,
          featureKey: 'all',
          actionType: 'PLAN_CHANGED',
          performedByUserId: adminUserId,
          reason: `Assigned plan ${plan.name} (${billingInterval})`,
          newState: {
            planCode: plan.code,
            billingInterval,
            agreedPrice,
          },
        },
      });
    });

    await this.entitlementService.invalidateCache(orgId);

    return this.entitlementService.getEffectiveEntitlements(orgId);
  }

  /**
   * Permanently delete an organization and cleanly cascade all tenant data.
   */
  async deleteOrganization(orgId: string) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const org = await tx.organization.findUnique({ where: { id: orgId } });
      if (!org) {
        throw new NotFoundException(`Organization with ID ${orgId} not found`);
      }

      // Delete dependent records in reverse dependency order
      await tx.attendanceRecord.deleteMany({ where: { organizationId: orgId } });
      await tx.attendanceSettings.deleteMany({ where: { organizationId: orgId } });
      await tx.attendanceOutboxEvent.deleteMany({ where: { organizationId: orgId } });
      await tx.memberAccessPass.deleteMany({ where: { organizationId: orgId } });
      await tx.refund.deleteMany({ where: { organizationId: orgId } });
      await tx.paymentAllocationReversal.deleteMany({ where: { organizationId: orgId } });
      await tx.paymentAllocation.deleteMany({ where: { organizationId: orgId } });
      await tx.payment.deleteMany({ where: { organizationId: orgId } });
      await tx.invoiceItem.deleteMany({ where: { organizationId: orgId } });
      await tx.invoice.deleteMany({ where: { organizationId: orgId } });
      await tx.memberCreditEntry.deleteMany({ where: { organizationId: orgId } });
      await tx.memberCreditAccount.deleteMany({ where: { organizationId: orgId } });
      await tx.billingOutboxEvent.deleteMany({ where: { organizationId: orgId } });
      await tx.organizationBillingSequence.deleteMany({ where: { organizationId: orgId } });
      await tx.membershipFreeze.deleteMany({ where: { organizationId: orgId } });
      await tx.membershipHistory.deleteMany({ where: { organizationId: orgId } });
      await tx.memberMembership.deleteMany({ where: { organizationId: orgId } });
      await tx.membershipOutboxEvent.deleteMany({ where: { organizationId: orgId } });
      await tx.membershipPlanBranch.deleteMany({ where: { organizationId: orgId } });
      await tx.membershipPlan.deleteMany({ where: { organizationId: orgId } });
      await tx.memberTransfer.deleteMany({ where: { organizationId: orgId } });
      await tx.member.deleteMany({ where: { organizationId: orgId } });
      await tx.organizationMemberSequence.deleteMany({ where: { organizationId: orgId } });
      await tx.branchStaffAssignment.deleteMany({ where: { organizationId: orgId } });
      await tx.branch.deleteMany({ where: { organizationId: orgId } });
      await tx.organizationUser.deleteMany({ where: { organizationId: orgId } });
      await tx.auditLog.deleteMany({ where: { organizationId: orgId } });
      await tx.organizationSubscription.deleteMany({ where: { organizationId: orgId } });
      await tx.organizationEntitlementOverride.deleteMany({ where: { organizationId: orgId } });
      await tx.organizationUsageRecord.deleteMany({ where: { organizationId: orgId } });
      await tx.entitlementChangeLog.deleteMany({ where: { organizationId: orgId } });

      await tx.organization.delete({ where: { id: orgId } });

      await this.entitlementService.invalidateCache(orgId);

      return { success: true, deletedId: orgId, name: org.name };
    });
  }

  /**
   * Bulk delete multiple organizations.
   */
  async bulkDeleteOrganizations(orgIds: string[]) {
    if (!orgIds || orgIds.length === 0) {
      throw new BadRequestException('At least one organization ID must be provided');
    }

    const results = [];
    for (const id of orgIds) {
      try {
        const res = await this.deleteOrganization(id);
        results.push(res);
      } catch (err: unknown) {
        results.push({ success: false, id, error: (err as Error).message });
      }
    }

    return {
      totalRequested: orgIds.length,
      deletedCount: results.filter((r) => r.success).length,
      results,
    };
  }
}
