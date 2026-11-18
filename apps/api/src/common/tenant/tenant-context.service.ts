import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AppLoggerService } from '../../logging/app-logger.service';
import { TenantStatus, UserRole } from '@gymos/shared-types';
import { TenantContextStore } from './tenant-context.storage';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ResolvedTenantMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  userId: string;
  role: UserRole;
}

@Injectable()
export class TenantContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Resolves trusted organization membership for a user from database records.
   * If requestedOrgId is specified by the client, verifies user is authorized for that specific org.
   * Never trusts client-supplied organizationId without database verification.
   */
  async resolveMembership(
    userId: string,
    requestedOrgId?: string,
  ): Promise<ResolvedTenantMembership> {
    if (!UUID_REGEX.test(userId)) {
      throw new BadRequestException(`Invalid user ID format: ${userId}`);
    }

    if (requestedOrgId && !UUID_REGEX.test(requestedOrgId)) {
      throw new BadRequestException(`Invalid requested organization ID format: ${requestedOrgId}`);
    }

    // Query trusted membership outside RLS using super admin / un-isolated lookup on organization_users
    const membership = await this.prisma.withSuperAdminContext(async (tx) => {
      if (requestedOrgId) {
        return tx.organizationUser.findUnique({
          where: {
            unique_org_user: {
              organizationId: requestedOrgId,
              userId,
            },
          },
          include: {
            organization: true,
          },
        });
      }

      // Default to first active membership if not explicitly requested
      return tx.organizationUser.findFirst({
        where: { userId },
        include: {
          organization: true,
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    if (!membership) {
      if (requestedOrgId) {
        this.logger.warn(
          `Unauthorized organization access attempt: user ${userId} attempted to access organization ${requestedOrgId}`,
          'TenantContextService',
        );
        throw new ForbiddenException('Access denied: You are not a member of this organization');
      }
      throw new NotFoundException('User does not belong to any organization');
    }

    // Verify Organization Status
    if (membership.organization.status !== TenantStatus.ACTIVE) {
      this.logger.warn(
        `Inactive organization access attempt: user ${userId} tried to access organization ${membership.organizationId} with status ${membership.organization.status}`,
        'TenantContextService',
      );
      throw new ForbiddenException(
        `Organization is currently ${membership.organization.status.toLowerCase()}`,
      );
    }

    return {
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      organizationSlug: membership.organization.slug,
      userId: membership.userId,
      role: membership.role as UserRole,
    };
  }

  /**
   * Executes a database operation within a verified tenant context.
   * Sets PostgreSQL transaction-scoped variable `SET LOCAL app.current_tenant_id`.
   */
  async runInTenantContext<T>(
    organizationId: string,
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!UUID_REGEX.test(organizationId)) {
      throw new BadRequestException(`Invalid organization ID: ${organizationId}`);
    }

    return TenantContextStore.run({ organizationId }, async () => {
      return this.prisma.withTenantContext(organizationId, callback);
    });
  }

  /**
   * Complete verified workflow:
   * 1. Resolves trusted membership for userId
   * 2. Verifies requestedOrgId authorization
   * 3. Executes queries within tenant-scoped transaction
   */
  async resolveAndRun<T>(
    userId: string,
    requestedOrgId: string | undefined,
    callback: (tx: Prisma.TransactionClient, membership: ResolvedTenantMembership) => Promise<T>,
  ): Promise<T> {
    const membership = await this.resolveMembership(userId, requestedOrgId);

    return TenantContextStore.run(
      {
        organizationId: membership.organizationId,
        userId: membership.userId,
        role: membership.role,
      },
      async () => {
        return this.prisma.withTenantContext(membership.organizationId, async (tx) => {
          return callback(tx, membership);
        });
      },
    );
  }
}
