import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Request } from 'express';
import { BranchesService } from './branches.service';
import { BranchStaffService } from './branch-staff.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CurrentTenant } from '../common/auth/current-tenant.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  Permission,
  AuthenticatedUserContext,
  BranchData,
  BranchStaffAssignmentData,
  PaginatedResult,
} from '@gymos/shared-types';
import {
  createBranchSchema,
  CreateBranchInput,
  updateBranchSchema,
  UpdateBranchInput,
  updateBranchStatusSchema,
  UpdateBranchStatusInput,
  branchQuerySchema,
  BranchQueryInput,
  assignBranchStaffSchema,
  AssignBranchStaffInput,
} from './dto/branch.dto';

@Controller('branches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BranchesController {
  constructor(
    private readonly branchesService: BranchesService,
    private readonly branchStaffService: BranchStaffService,
  ) {}

  @Post()
  @RequirePermissions(Permission.ORGANIZATION_BRANCHES_CREATE)
  async createBranch(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(createBranchSchema)) dto: CreateBranchInput,
    @Req() req: Request,
  ): Promise<BranchData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.branchesService.createBranch(
      orgId,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Get()
  @RequirePermissions(Permission.ORGANIZATION_BRANCHES_READ)
  async listBranches(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query(new ZodValidationPipe(branchQuerySchema)) query: BranchQueryInput,
  ): Promise<PaginatedResult<BranchData>> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.branchesService.listBranches(orgId, query, user);
  }

  @Get(':branchId')
  @RequirePermissions(Permission.ORGANIZATION_BRANCHES_READ)
  async getBranchById(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('branchId') branchId: string,
  ): Promise<BranchData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.branchesService.getBranchById(orgId, branchId, user);
  }

  @Patch(':branchId')
  @RequirePermissions(Permission.ORGANIZATION_BRANCHES_UPDATE)
  async updateBranch(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('branchId') branchId: string,
    @Body(new ZodValidationPipe(updateBranchSchema)) dto: UpdateBranchInput,
    @Req() req: Request,
  ): Promise<BranchData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.branchesService.updateBranch(
      orgId,
      branchId,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Patch(':branchId/status')
  @RequirePermissions(Permission.ORGANIZATION_BRANCHES_STATUS_MANAGE)
  async updateBranchStatus(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('branchId') branchId: string,
    @Body(new ZodValidationPipe(updateBranchStatusSchema))
    dto: UpdateBranchStatusInput,
    @Req() req: Request,
  ): Promise<BranchData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.branchesService.updateBranchStatus(
      orgId,
      branchId,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  // Branch Staff Management Endpoints
  @Post(':branchId/staff')
  @RequirePermissions(Permission.ORGANIZATION_BRANCH_STAFF_MANAGE)
  async assignStaff(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('branchId') branchId: string,
    @Body(new ZodValidationPipe(assignBranchStaffSchema))
    dto: AssignBranchStaffInput,
    @Req() req: Request,
  ): Promise<BranchStaffAssignmentData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.branchStaffService.assignStaff(
      orgId,
      branchId,
      dto,
      user.id,
      ipAddress,
      userAgent,
    );
  }

  @Get(':branchId/staff')
  @RequirePermissions(Permission.ORGANIZATION_BRANCH_STAFF_READ)
  async listBranchStaff(
    @CurrentTenant() orgId: string | null,
    @Param('branchId') branchId: string,
  ): Promise<BranchStaffAssignmentData[]> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.branchStaffService.listBranchStaff(orgId, branchId);
  }

  @Delete(':branchId/staff/:organizationUserId')
  @RequirePermissions(Permission.ORGANIZATION_BRANCH_STAFF_MANAGE)
  async removeStaff(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('branchId') branchId: string,
    @Param('organizationUserId') organizationUserId: string,
    @Req() req: Request,
  ): Promise<{ success: boolean; message: string }> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    return this.branchStaffService.removeStaff(
      orgId,
      branchId,
      organizationUserId,
      user.id,
      ipAddress,
      userAgent,
    );
  }
}
