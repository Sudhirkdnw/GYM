import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Headers,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CurrentTenant } from '../common/auth/current-tenant.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  AuthenticatedUserContext,
  BranchData,
  BranchStatus,
  UserRole,
} from '@gymos/shared-types';
import { selectBranchSchema, SelectBranchInput } from './dto/branch.dto';
import { PrismaService } from '../database/prisma.service';

@Controller('auth/organizations/current/branches')
@UseGuards(JwtAuthGuard)
export class UserBranchesController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all branches accessible by the current authenticated user
   */
  @Get()
  async getAccessibleBranches(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
  ): Promise<BranchData[]> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }

    return this.prisma.withTenantContext(orgId, async (tx) => {
      // Owners and Admins have access to all active branches in the organization
      if (
        user.role === UserRole.GYM_OWNER ||
        user.role === UserRole.GYM_ADMIN ||
        user.isSuperAdmin
      ) {
        const branches = await tx.branch.findMany({
          where: {
            organizationId: orgId,
            status: BranchStatus.ACTIVE,
          },
          orderBy: { name: 'asc' },
        });

        return branches.map((b) => ({
          id: b.id,
          organizationId: b.organizationId,
          name: b.name,
          slug: b.slug,
          branchCode: b.branchCode,
          description: b.description,
          email: b.email,
          phone: b.phone,
          website: b.website,
          logoUrl: b.logoUrl,
          addressLine1: b.addressLine1,
          addressLine2: b.addressLine2,
          city: b.city,
          state: b.state,
          country: b.country,
          postalCode: b.postalCode,
          timezone: b.timezone,
          status: b.status as BranchStatus,
          createdAt: b.createdAt.toISOString(),
          updatedAt: b.updatedAt.toISOString(),
        }));
      }

      // Staff (Receptionist, Trainer, Member): Only assigned active branches
      const assignments = await tx.branchStaffAssignment.findMany({
        where: {
          organizationId: orgId,
          organizationUser: { userId: user.id },
          status: 'ACTIVE',
          branch: { status: BranchStatus.ACTIVE },
        },
        include: { branch: true },
        orderBy: { branch: { name: 'asc' } },
      });

      return assignments.map((a) => ({
        id: a.branch.id,
        organizationId: a.branch.organizationId,
        name: a.branch.name,
        slug: a.branch.slug,
        branchCode: a.branch.branchCode,
        description: a.branch.description,
        email: a.branch.email,
        phone: a.branch.phone,
        website: a.branch.website,
        logoUrl: a.branch.logoUrl,
        addressLine1: a.branch.addressLine1,
        addressLine2: a.branch.addressLine2,
        city: a.branch.city,
        state: a.branch.state,
        country: a.branch.country,
        postalCode: a.branch.postalCode,
        timezone: a.branch.timezone,
        status: a.branch.status as BranchStatus,
        createdAt: a.branch.createdAt.toISOString(),
        updatedAt: a.branch.updatedAt.toISOString(),
      }));
    });
  }

  /**
   * Validate and select branch context
   */
  @Post('select')
  async selectBranch(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(selectBranchSchema)) dto: SelectBranchInput,
  ): Promise<{ selectedBranch: BranchData }> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }

    return this.prisma.withTenantContext(orgId, async (tx) => {
      const branch = await tx.branch.findUnique({
        where: { id: dto.branchId },
      });

      if (!branch || branch.organizationId !== orgId) {
        throw new NotFoundException('Branch not found in current organization');
      }

      if (branch.status !== BranchStatus.ACTIVE) {
        throw new BadRequestException(
          `Branch is ${branch.status.toLowerCase()} and cannot be selected for operational workflows`,
        );
      }

      // Check user authority to select this branch
      if (
        user.role !== UserRole.GYM_OWNER &&
        user.role !== UserRole.GYM_ADMIN &&
        !user.isSuperAdmin
      ) {
        const assignment = await tx.branchStaffAssignment.findFirst({
          where: {
            branchId: dto.branchId,
            organizationId: orgId,
            organizationUser: { userId: user.id },
            status: 'ACTIVE',
          },
        });

        if (!assignment) {
          throw new ForbiddenException(
            'Forbidden: You are not assigned to this branch',
          );
        }
      }

      return {
        selectedBranch: {
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
        },
      };
    });
  }

  /**
   * Returns current selected branch (by x-branch-id header or first active branch)
   */
  @Get('selected')
  async getSelectedBranch(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Headers('x-branch-id') requestedBranchId?: string,
  ): Promise<{ selectedBranch: BranchData | null }> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }

    const accessible = await this.getAccessibleBranches(orgId, user);
    if (accessible.length === 0) {
      return { selectedBranch: null };
    }

    if (requestedBranchId) {
      const match = accessible.find((b) => b.id === requestedBranchId);
      if (match) {
        return { selectedBranch: match };
      }
    }

    return { selectedBranch: accessible[0] || null };
  }
}
