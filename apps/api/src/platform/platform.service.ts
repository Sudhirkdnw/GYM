import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { EntitlementService } from '../common/entitlements/entitlement.service';
import { PasswordHasherService } from '../auth/password-hasher.service';
import {
  PlatformOverviewData,
  SaasSubscriptionStatus,
} from '@gymos/shared-types';

@Injectable()
export class PlatformService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
    private readonly passwordHasher: PasswordHasherService,
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
   * Register a new Gym Organization directly from the Super Admin platform.
   */
  async createOrganization(dto: {
    name: string;
    slug?: string;
    branchName?: string;
    branchCode?: string;
    ownerFirstName: string;
    ownerLastName: string;
    ownerEmail: string;
    ownerPhone?: string;
    password?: string;
    planId?: string;
    planCode?: string;
    billingInterval?: 'MONTHLY' | 'ANNUAL';
    agreedPrice?: number;
    status?: 'ACTIVE' | 'SUSPENDED';
  }) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Gym Organization name is required');
    }
    if (!dto.ownerEmail?.trim()) {
      throw new BadRequestException('Owner email is required');
    }
    if (!dto.ownerFirstName?.trim()) {
      throw new BadRequestException('Owner first name is required');
    }

    const name = dto.name.trim();
    const ownerEmail = dto.ownerEmail.toLowerCase().trim();
    const ownerFirstName = dto.ownerFirstName.trim();
    const ownerLastName = (dto.ownerLastName || '').trim();
    const branchName = (dto.branchName || 'Main Branch').trim();
    const branchCode = (dto.branchCode || 'MAIN').trim().toUpperCase();
    const password = dto.password?.trim() || 'GymOwner@123';
    const orgStatus = dto.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
    const billingInterval = dto.billingInterval === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY';

    return this.prisma.withSuperAdminContext(async (tx) => {
      // 1. Generate unique organization slug
      const baseSlug =
        dto.slug?.trim() ||
        name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') ||
        'gym';

      let finalSlug = baseSlug;
      const existingSlug = await tx.organization.findUnique({
        where: { slug: finalSlug },
      });
      if (existingSlug) {
        finalSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
      }

      // 2. Create Organization record
      const org = await tx.organization.create({
        data: {
          name,
          slug: finalSlug,
          status: orgStatus as any,
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          businessEmail: ownerEmail,
          businessPhone: dto.ownerPhone?.trim() || null,
        },
      });

      // 3. Create primary Branch
      const branchSlug =
        branchName
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'main';

      const branch = await tx.branch.create({
        data: {
          organizationId: org.id,
          name: branchName,
          slug: `${finalSlug}-${branchSlug}`,
          branchCode,
          status: 'ACTIVE',
          timezone: 'Asia/Kolkata',
          email: ownerEmail,
          phone: dto.ownerPhone?.trim() || null,
        },
      });

      // 4. Create or link Owner User (Ensure credentials match what Super Admin provided)
      const passwordHash = await this.passwordHasher.hashPassword(password);
      let user = await tx.user.findUnique({ where: { email: ownerEmail } });
      let isNewUser = false;

      if (!user) {
        user = await tx.user.create({
          data: {
            email: ownerEmail,
            passwordHash,
            firstName: ownerFirstName,
            lastName: ownerLastName,
            status: 'ACTIVE',
            emailVerified: true,
          },
        });
        isNewUser = true;
      } else {
        // When Super Admin provisions a gym for an existing email, update their password so
        // the provided initial credentials work immediately, activate the account, and verify email.
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            status: 'ACTIVE',
            emailVerified: true,
            ...(ownerFirstName ? { firstName: ownerFirstName } : {}),
            ...(ownerLastName ? { lastName: ownerLastName } : {}),
          },
        });
      }

      // 5. Link user to organization as GYM_OWNER
      const orgUser = await tx.organizationUser.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: 'GYM_OWNER',
        },
      });

      // 6. Assign to primary branch
      await tx.branchStaffAssignment.create({
        data: {
          organizationId: org.id,
          branchId: branch.id,
          organizationUserId: orgUser.id,
          status: 'ACTIVE',
        },
      });

      // 7. Attach SaaS Subscription Plan
      let plan = null;
      if (dto.planId) {
        plan = await tx.saasPlan.findUnique({ where: { id: dto.planId } });
      } else if (dto.planCode) {
        plan = await tx.saasPlan.findUnique({ where: { code: dto.planCode.toLowerCase() } });
      }
      if (!plan) {
        plan = await tx.saasPlan.findFirst({
          where: { isActive: true },
          orderBy: { monthlyPrice: 'desc' },
        });
      }
      if (!plan) {
        throw new BadRequestException('No active SaaS plan available to assign to this gym');
      }

      const now = new Date();
      const currentPeriodEnd = new Date(now);
      if (billingInterval === 'ANNUAL') {
        currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
      } else {
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
      }

      const agreedPrice =
        dto.agreedPrice !== undefined
          ? dto.agreedPrice
          : billingInterval === 'ANNUAL'
          ? Number(plan.annualPrice)
          : Number(plan.monthlyPrice);

      await tx.organizationSubscription.create({
        data: {
          organizationId: org.id,
          planId: plan.id,
          status: SaasSubscriptionStatus.ACTIVE,
          billingInterval,
          agreedPrice,
          currentPeriodStart: now,
          currentPeriodEnd,
          notes: `Created by Super Admin via Platform Console on ${now.toISOString()}`,
        },
      });

      // Invalidate cache
      await this.entitlementService.invalidateCache(org.id);

      return {
        success: true,
        organization: org,
        branch,
        owner: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isNewUser,
          defaultPassword: password,
        },
        subscription: {
          planId: plan.id,
          planName: plan.name,
          planCode: plan.code,
          billingInterval,
          agreedPrice,
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
          _count: {
            select: { subscriptions: true },
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
        assignedGymsCount: p._count.subscriptions,
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
   * Get plan by ID including its features.
   */
  async getPlanById(planId: string) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const p = await tx.saasPlan.findUnique({
        where: { id: planId },
        include: {
          features: {
            include: { feature: true },
          },
          _count: {
            select: { subscriptions: true },
          },
        },
      });
      if (!p) {
        throw new NotFoundException(`Plan with ID ${planId} not found`);
      }
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        monthlyPrice: Number(p.monthlyPrice),
        annualPrice: Number(p.annualPrice),
        currency: p.currency,
        isActive: p.isActive,
        isPublic: p.isPublic,
        assignedGymsCount: p._count.subscriptions,
        features: p.features.map((f) => ({
          featureKey: f.featureKey,
          domain: f.feature.domain,
          name: f.feature.name,
          isEnabled: f.isEnabled,
          numericQuota: f.numericQuota,
        })),
      };
    });
  }

  /**
   * Create a new custom SaaS pricing plan with feature allocations.
   */
  async createPlan(data: any) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const code = String(data.code || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-');

      if (!code) {
        throw new BadRequestException('Plan code is required');
      }

      const existing = await tx.saasPlan.findUnique({ where: { code } });
      if (existing) {
        throw new BadRequestException(`A plan with code "${code}" already exists`);
      }

      const plan = await tx.saasPlan.create({
        data: {
          code,
          name: data.name,
          description: data.description || null,
          monthlyPrice: data.monthlyPrice !== undefined ? Number(data.monthlyPrice) : 0,
          annualPrice: data.annualPrice !== undefined ? Number(data.annualPrice) : 0,
          currency: data.currency || 'INR',
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
          isPublic: data.isPublic !== undefined ? Boolean(data.isPublic) : true,
          sortOrder: data.sortOrder || 0,
        },
      });

      // Populate features
      const catalog = await tx.featureCatalog.findMany();
      const featuresMap: Record<string, { isEnabled: boolean; numericQuota?: number | null }> = {};

      if (Array.isArray(data.features)) {
        for (const f of data.features) {
          featuresMap[f.featureKey] = {
            isEnabled: Boolean(f.isEnabled),
            numericQuota: f.numericQuota !== undefined ? f.numericQuota : null,
          };
        }
      }

      for (const cat of catalog) {
        const item = featuresMap[cat.key];
        await tx.saasPlanFeature.create({
          data: {
            planId: plan.id,
            featureKey: cat.key,
            isEnabled: item ? item.isEnabled : false,
            numericQuota: item?.numericQuota !== undefined ? item.numericQuota : null,
          },
        });
      }

      return this.getPlanById(plan.id);
    });
  }

  /**
   * Update an existing SaaS plan and its feature allocations.
   */
  async updatePlan(planId: string, data: any) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const plan = await tx.saasPlan.findUnique({ where: { id: planId } });
      if (!plan) {
        throw new NotFoundException(`Plan with ID ${planId} not found`);
      }

      await tx.saasPlan.update({
        where: { id: planId },
        data: {
          name: data.name !== undefined ? data.name : plan.name,
          description: data.description !== undefined ? data.description : plan.description,
          monthlyPrice: data.monthlyPrice !== undefined ? Number(data.monthlyPrice) : plan.monthlyPrice,
          annualPrice: data.annualPrice !== undefined ? Number(data.annualPrice) : plan.annualPrice,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : plan.isActive,
          isPublic: data.isPublic !== undefined ? Boolean(data.isPublic) : plan.isPublic,
        },
      });

      // Update features if provided
      if (Array.isArray(data.features)) {
        for (const f of data.features) {
          await tx.saasPlanFeature.upsert({
            where: {
              unique_plan_feature: {
                planId,
                featureKey: f.featureKey,
              },
            },
            update: {
              isEnabled: Boolean(f.isEnabled),
              numericQuota: f.numericQuota !== undefined ? f.numericQuota : null,
            },
            create: {
              planId,
              featureKey: f.featureKey,
              isEnabled: Boolean(f.isEnabled),
              numericQuota: f.numericQuota !== undefined ? f.numericQuota : null,
            },
          });
        }
      }

      // Invalidate cache for all gyms enrolled on this plan
      const subs = await tx.organizationSubscription.findMany({
        where: { planId },
        select: { organizationId: true },
      });
      for (const s of subs) {
        await this.entitlementService.invalidateCache(s.organizationId);
      }

      return this.getPlanById(planId);
    });
  }

  /**
   * Delete or archive a SaaS plan.
   */
  async deletePlan(planId: string) {
    return this.prisma.withSuperAdminContext(async (tx) => {
      const plan = await tx.saasPlan.findUnique({ where: { id: planId } });
      if (!plan) {
        throw new NotFoundException(`Plan with ID ${planId} not found`);
      }

      const activeGymsCount = await tx.organizationSubscription.count({
        where: { planId },
      });

      if (activeGymsCount > 0) {
        throw new BadRequestException(
          `Cannot delete plan "${plan.name}" because ${activeGymsCount} gym(s) are currently subscribed to it. Please reassign them to another plan first, or set this plan to Inactive.`,
        );
      }

      await tx.saasPlanFeature.deleteMany({ where: { planId } });
      await tx.saasPlan.delete({ where: { id: planId } });

      return { success: true, deletedId: planId, name: plan.name };
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

      // Authorize tenant context for this specific org in RLS
      await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${orgId}';`);

      // Delete dependent records in reverse dependency order
      await tx.paymentAllocationReversal.deleteMany({ where: { organizationId: orgId } });
      await tx.paymentAllocation.deleteMany({ where: { organizationId: orgId } });
      await tx.refund.deleteMany({ where: { organizationId: orgId } });
      await tx.payment.deleteMany({ where: { organizationId: orgId } });
      await tx.invoiceItem.deleteMany({ where: { organizationId: orgId } });
      await tx.invoice.deleteMany({ where: { organizationId: orgId } });
      await tx.memberCreditEntry.deleteMany({ where: { organizationId: orgId } });
      await tx.memberCreditAccount.deleteMany({ where: { organizationId: orgId } });
      await tx.billingOutboxEvent.deleteMany({ where: { organizationId: orgId } });
      await tx.organizationBillingSequence.deleteMany({ where: { organizationId: orgId } });
      await tx.attendanceRecord.deleteMany({ where: { organizationId: orgId } });
      await tx.attendanceSettings.deleteMany({ where: { organizationId: orgId } });
      await tx.attendanceOutboxEvent.deleteMany({ where: { organizationId: orgId } });
      await tx.memberAccessPass.deleteMany({ where: { organizationId: orgId } });
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

    const results: Array<{ success: boolean; id: string; name?: string; error?: string }> = [];

    await this.prisma.withSuperAdminContext(async (tx) => {
      for (const id of orgIds) {
        try {
          const org = await tx.organization.findUnique({ where: { id } });
          if (!org) {
            results.push({ success: false, id, error: 'Not found' });
            continue;
          }

          // Authorize tenant context for this specific org in RLS
          await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${id}';`);

          await tx.paymentAllocationReversal.deleteMany({ where: { organizationId: id } });
          await tx.paymentAllocation.deleteMany({ where: { organizationId: id } });
          await tx.refund.deleteMany({ where: { organizationId: id } });
          await tx.payment.deleteMany({ where: { organizationId: id } });
          await tx.invoiceItem.deleteMany({ where: { organizationId: id } });
          await tx.invoice.deleteMany({ where: { organizationId: id } });
          await tx.memberCreditEntry.deleteMany({ where: { organizationId: id } });
          await tx.memberCreditAccount.deleteMany({ where: { organizationId: id } });
          await tx.billingOutboxEvent.deleteMany({ where: { organizationId: id } });
          await tx.organizationBillingSequence.deleteMany({ where: { organizationId: id } });
          await tx.attendanceRecord.deleteMany({ where: { organizationId: id } });
          await tx.attendanceSettings.deleteMany({ where: { organizationId: id } });
          await tx.attendanceOutboxEvent.deleteMany({ where: { organizationId: id } });
          await tx.memberAccessPass.deleteMany({ where: { organizationId: id } });
          await tx.membershipFreeze.deleteMany({ where: { organizationId: id } });
          await tx.membershipHistory.deleteMany({ where: { organizationId: id } });
          await tx.memberMembership.deleteMany({ where: { organizationId: id } });
          await tx.membershipOutboxEvent.deleteMany({ where: { organizationId: id } });
          await tx.membershipPlanBranch.deleteMany({ where: { organizationId: id } });
          await tx.membershipPlan.deleteMany({ where: { organizationId: id } });
          await tx.memberTransfer.deleteMany({ where: { organizationId: id } });
          await tx.member.deleteMany({ where: { organizationId: id } });
          await tx.organizationMemberSequence.deleteMany({ where: { organizationId: id } });
          await tx.branchStaffAssignment.deleteMany({ where: { organizationId: id } });
          await tx.branch.deleteMany({ where: { organizationId: id } });
          await tx.organizationUser.deleteMany({ where: { organizationId: id } });
          await tx.auditLog.deleteMany({ where: { organizationId: id } });
          await tx.organizationSubscription.deleteMany({ where: { organizationId: id } });
          await tx.organizationEntitlementOverride.deleteMany({ where: { organizationId: id } });
          await tx.organizationUsageRecord.deleteMany({ where: { organizationId: id } });
          await tx.entitlementChangeLog.deleteMany({ where: { organizationId: id } });

          await tx.organization.delete({ where: { id } });

          results.push({ success: true, id, name: org.name });
        } catch (err: unknown) {
          results.push({ success: false, id, error: (err as Error).message });
        }
      }
    });

    // Invalidate Redis caches
    for (const res of results) {
      if (res.success) {
        await this.entitlementService.invalidateCache(res.id);
      }
    }

    const deletedCount = results.filter((r) => r.success).length;
    return {
      totalRequested: orgIds.length,
      deletedCount,
      results,
    };
  }
}
