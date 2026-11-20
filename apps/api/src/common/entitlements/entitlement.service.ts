import {
  Injectable,
  ForbiddenException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import {
  EffectiveEntitlementsContext,
  SaasSubscriptionStatus,
} from '@gymos/shared-types';

@Injectable()
export class EntitlementService {
  private readonly logger = new Logger(EntitlementService.name);
  private readonly cacheTtlSeconds = 3600; // 1 hour

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  private getCacheKey(organizationId: string): string {
    return `gymos:entitlements:${organizationId}`;
  }

  /**
   * Resolves the authoritative effective entitlements for an organization.
   * Priority: Overrides > Plan Defaults > System Defaults.
   */
  async getEffectiveEntitlements(
    organizationId: string,
  ): Promise<EffectiveEntitlementsContext> {
    const cacheKey = this.getCacheKey(organizationId);

    // 1. Try Redis cache
    try {
      const client = this.redisService.getClient();
      const cached = await client.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err: unknown) {
      this.logger.warn(`Redis entitlement cache read failure: ${(err as Error).message}`);
    }

    // 2. Resolve from authoritative database
    return this.prisma.withSuperAdminContext(async (tx) => {
      // Find active organization subscription
      const sub = await tx.organizationSubscription.findFirst({
        where: {
          organizationId,
          status: { in: [SaasSubscriptionStatus.ACTIVE, SaasSubscriptionStatus.TRIALING] },
        },
        include: {
          plan: {
            include: {
              features: true,
            },
          },
        },
        orderBy: { currentPeriodEnd: 'desc' },
      });

      // Find active overrides
      const now = new Date();
      const overrides = await tx.organizationEntitlementOverride.findMany({
        where: {
          organizationId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });

      const features: Record<string, boolean> = {};
      const quotas: Record<string, { current: number; max: number | null }> = {};

      // A. Populate Plan Defaults
      if (sub && sub.plan) {
        for (const pf of sub.plan.features) {
          features[pf.featureKey] = pf.isEnabled;
          if (pf.numericQuota !== null && pf.numericQuota !== undefined) {
            quotas[pf.featureKey] = { current: 0, max: pf.numericQuota };
          }
        }
      }

      // B. Apply Custom Overrides
      for (const ov of overrides) {
        features[ov.featureKey] = ov.isEnabled;
        if (ov.numericQuota !== null && ov.numericQuota !== undefined) {
          quotas[ov.featureKey] = {
            current: quotas[ov.featureKey]?.current ?? 0,
            max: ov.numericQuota,
          };
        }
      }

      // C. Count live usage for key quotas
      const [membersCount, branchesCount, staffCount] = await Promise.all([
        tx.member.count({ where: { organizationId, status: 'ACTIVE' } }),
        tx.branch.count({ where: { organizationId, status: 'ACTIVE' } }),
        tx.organizationUser.count({
          where: { organizationId, role: { not: 'MEMBER' } },
        }),
      ]);

      if (quotas['members.max_active']) {
        quotas['members.max_active'].current = membersCount;
      }
      if (quotas['core.branches.max']) {
        quotas['core.branches.max'].current = branchesCount;
      }
      if (quotas['core.staff.max']) {
        quotas['core.staff.max'].current = staffCount;
      }

      const isSubscriptionActive = Boolean(
        sub &&
          (sub.status === SaasSubscriptionStatus.ACTIVE ||
            sub.status === SaasSubscriptionStatus.TRIALING) &&
          new Date(sub.currentPeriodEnd) >= new Date(),
      );

      const context: EffectiveEntitlementsContext = {
        organizationId,
        planCode: sub?.plan.code || 'custom',
        planName: sub?.plan.name || 'Custom Package',
        subscriptionStatus: (sub?.status as unknown as SaasSubscriptionStatus) || SaasSubscriptionStatus.CANCELLED,
        isSubscriptionActive,
        expiresAt: sub ? sub.currentPeriodEnd.toISOString().slice(0, 10) : '',
        features,
        quotas,
      };

      // 3. Write back to Redis
      try {
        const client = this.redisService.getClient();
        await client.set(
          cacheKey,
          JSON.stringify(context),
          'EX',
          this.cacheTtlSeconds,
        );
      } catch (err: unknown) {
        this.logger.warn(`Redis entitlement cache write failure: ${(err as Error).message}`);
      }

      return context;
    });
  }

  /**
   * Evaluates if an organization is entitled to a specific feature key.
   */
  async isEntitled(organizationId: string, featureKey: string): Promise<boolean> {
    const entitlements = await this.getEffectiveEntitlements(organizationId);

    if (!entitlements.isSubscriptionActive) {
      return false;
    }

    return Boolean(entitlements.features[featureKey]);
  }

  /**
   * Verifies that adding to a metric does not violate the organization's quota limit.
   */
  async assertWithinQuota(
    organizationId: string,
    metricKey: string,
    currentUsage: number,
  ): Promise<void> {
    const entitlements = await this.getEffectiveEntitlements(organizationId);
    const quota = entitlements.quotas[metricKey];

    if (quota && quota.max !== null && currentUsage >= quota.max) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message: `Plan limit reached for ${metricKey} (${currentUsage}/${quota.max}). Please upgrade your GymOS subscription.`,
        code: 'QUOTA_EXCEEDED',
        metricKey,
        currentUsage,
        maxLimit: quota.max,
      });
    }
  }

  /**
   * Invalidates cached entitlements when Super Admin updates plans or overrides.
   */
  async invalidateCache(organizationId: string): Promise<void> {
    try {
      const client = this.redisService.getClient();
      await client.del(this.getCacheKey(organizationId));
    } catch (err: unknown) {
      this.logger.warn(`Failed to clear entitlement cache: ${(err as Error).message}`);
    }
  }
}
