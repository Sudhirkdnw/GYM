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
import { MembersService } from './members.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import { BranchContextGuard } from '../common/auth/branch-context.guard';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { RequireBranchContext } from '../common/auth/require-branch-context.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CurrentTenant } from '../common/auth/current-tenant.decorator';
import { CurrentBranch } from '../common/auth/current-branch.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  Permission,
  AuthenticatedUserContext,
  MemberData,
  MemberDetailData,
  PaginatedResult,
  BranchData,
} from '@gymos/shared-types';
import {
  createMemberSchema,
  CreateMemberInput,
  updateMemberSchema,
  UpdateMemberInput,
  updateMemberStatusSchema,
  UpdateMemberStatusInput,
  transferMemberSchema,
  TransferMemberInput,
  archiveMemberSchema,
  ArchiveMemberInput,
  memberQuerySchema,
  MemberQueryInput,
} from '@gymos/validation';

@Controller('members')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post()
  @RequirePermissions(Permission.MEMBER_CREATE)
  @RequireBranchContext({ required: false })
  @UseGuards(BranchContextGuard)
  async createMember(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @CurrentBranch() branch: BranchData | null,
    @Body(new ZodValidationPipe(createMemberSchema)) dto: CreateMemberInput,
    @Req() req: Request,
  ): Promise<MemberData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const branchId = dto.branchId || branch?.id;
    if (!branchId) {
      throw new BadRequestException('Branch ID is required');
    }

    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.membersService.createMember(
      orgId,
      branchId,
      user.id,
      dto,
      ipAddress,
      userAgent,
    );
  }

  @Get()
  @RequirePermissions(Permission.MEMBER_READ)
  async listMembers(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query(new ZodValidationPipe(memberQuerySchema)) query: MemberQueryInput,
  ): Promise<PaginatedResult<MemberData>> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.membersService.findMembers(orgId, query, user);
  }

  @Get(':id')
  @RequirePermissions(Permission.MEMBER_READ)
  async getMember(
    @CurrentTenant() orgId: string | null,
    @Param('id') id: string,
  ): Promise<MemberDetailData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    return this.membersService.findMemberById(orgId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MEMBER_UPDATE)
  async updateMember(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) dto: UpdateMemberInput,
    @Req() req: Request,
  ): Promise<MemberData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.membersService.updateMember(
      orgId,
      id,
      user.id,
      dto,
      ipAddress,
      userAgent,
    );
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.MEMBER_STATUS_MANAGE)
  async updateMemberStatus(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMemberStatusSchema)) dto: UpdateMemberStatusInput,
    @Req() req: Request,
  ): Promise<MemberData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.membersService.updateMemberStatus(
      orgId,
      id,
      user.id,
      dto,
      ipAddress,
      userAgent,
    );
  }

  @Post(':id/transfer')
  @RequirePermissions(Permission.MEMBER_TRANSFER)
  async transferMember(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(transferMemberSchema)) dto: TransferMemberInput,
    @Req() req: Request,
  ): Promise<MemberData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.membersService.transferMember(
      orgId,
      id,
      user.id,
      dto,
      ipAddress,
      userAgent,
    );
  }

  @Post(':id/archive')
  @RequirePermissions(Permission.MEMBER_ARCHIVE)
  async archiveMember(
    @CurrentTenant() orgId: string | null,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(archiveMemberSchema)) dto: ArchiveMemberInput,
    @Req() req: Request,
  ): Promise<MemberData> {
    if (!orgId) {
      throw new BadRequestException('Active organization context required');
    }
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    return this.membersService.archiveMember(
      orgId,
      id,
      user.id,
      dto,
      ipAddress,
      userAgent,
    );
  }
}
