import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CurrentTenant } from '../common/auth/current-tenant.decorator';
import { CurrentBranch } from '../common/auth/current-branch.decorator';
import { RequireBranchContext } from '../common/auth/require-branch-context.decorator';
import { BranchContextGuard } from '../common/auth/branch-context.guard';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  AuthenticatedUserContext,
  BranchData,
  BranchStatus,
  UserRole,
} from '@gymos/shared-types';
import { selectBranchSchema, SelectBranchInput } from './dto/branch.dto';
import { PrismaService } from '../database/prisma.service';
import { BranchContextService } from '../common/tenant/branch-context.service';

@Controller('auth/organizations/current/branches')
@UseGuards(JwtAuthGuard)
export class UserBranchesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchContextService: BranchContextService,
  ) {}

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

    const branch = await this.branchContextService.validateBranchAccess(
      orgId,
      dto.branchId,
      user,
    );

    return { selectedBranch: branch };
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

    if (requestedBranchId) {
      const selected = await this.branchContextService.validateBranchAccess(
        orgId,
        requestedBranchId,
        user,
      );
      return { selectedBranch: selected };
    }

    const accessible = await this.getAccessibleBranches(orgId, user);
    return { selectedBranch: accessible[0] || null };
  }

  /**
   * Verified branch operational context test endpoint
   * Guarantees branch is active, belongs to org, and user is authorized
   */
  @Get('current-context')
  @UseGuards(BranchContextGuard)
  @RequireBranchContext({ required: true, allowInactive: false })
  async getCurrentBranchContext(
    @CurrentBranch() branch: BranchData,
  ): Promise<{ branch: BranchData }> {
    return { branch };
  }
}
