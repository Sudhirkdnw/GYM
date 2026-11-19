import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppLoggerService } from '../../logging/app-logger.service';
import {
  AuthenticatedUserContext,
  BranchData,
  BranchStatus,
  UserRole,
} from '@gymos/shared-types';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidateBranchOptions {
  allowInactive?: boolean;
}

@Injectable()
export class BranchContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Validates that:
   * 1. branchId is a valid UUID format.
   * 2. branch exists and strictly belongs to the current organization (RLS isolation).
   * 3. branch is in ACTIVE status (unless allowInactive is explicitly requested).
   * 4. user has permission to access this branch:
   *    - SuperAdmins, Owners, and Admins have organization-wide branch access.
   *    - Staff (Receptionist, Trainer, Member) must have an active assignment to this branch.
   */
  async validateBranchAccess(
    organizationId: string,
    branchId: string,
    user: AuthenticatedUserContext,
    options: ValidateBranchOptions = {},
  ): Promise<BranchData> {
    if (!branchId || typeof branchId !== 'string') {
      throw new BadRequestException('Branch ID is required');
    }

    if (!UUID_REGEX.test(branchId)) {
      throw new BadRequestException(`Invalid branch ID format: '${branchId}'`);
    }

    return this.prisma.withTenantContext(organizationId, async (tx) => {
      // 1. Fetch branch within tenant context
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
      });

      // Cross-tenant or non-existent branch
      if (!branch || branch.organizationId !== organizationId) {
        this.logger.warn(
          `Branch access rejected: Branch '${branchId}' not found in organization '${organizationId}'`,
          'BranchContextService',
        );
        throw new NotFoundException('Branch not found in current organization');
      }

      // 2. Validate operational status
      if (!options.allowInactive && branch.status !== BranchStatus.ACTIVE) {
        this.logger.warn(
          `Operational attempt on non-active branch '${branchId}' (status: ${branch.status})`,
          'BranchContextService',
        );
        throw new BadRequestException(
          `Branch is ${branch.status.toLowerCase()} and cannot be used for operational workflows`,
        );
      }

      // 3. Validate user assignment authority
      const hasOrgWideAccess =
        user.isSuperAdmin ||
        user.role === UserRole.GYM_OWNER ||
        user.role === UserRole.GYM_ADMIN;

      if (!hasOrgWideAccess) {
        const assignment = await tx.branchStaffAssignment.findFirst({
          where: {
            branchId,
            organizationId,
            organizationUser: { userId: user.id },
            status: 'ACTIVE',
          },
        });

        if (!assignment) {
          this.logger.warn(
            `Staff branch authorization failed: User '${user.id}' (${user.role}) is not assigned to branch '${branchId}' in org '${organizationId}'`,
            'BranchContextService',
          );
          throw new ForbiddenException(
            'Forbidden: You are not assigned to this branch',
          );
        }
      }

      return {
        id: branch.id,
        organizationId: branch.organizationId,
        name: branch.name,
        slug: branch.slug,
        branchCode: branch.branchCode,
        description: branch.description,
        email: branch.email,
        phone: branch.phone,
        website: branch.website,
        logoUrl: branch.logoUrl,
        addressLine1: branch.addressLine1,
        addressLine2: branch.addressLine2,
        city: branch.city,
        state: branch.state,
        country: branch.country,
        postalCode: branch.postalCode,
        timezone: branch.timezone,
        status: branch.status as BranchStatus,
        createdAt: branch.createdAt.toISOString(),
        updatedAt: branch.updatedAt.toISOString(),
      };
    });
  }
}
