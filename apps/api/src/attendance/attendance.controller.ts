import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { Public } from '../common/auth/public.decorator';
import { CurrentTenant } from '../common/auth/current-tenant.decorator';
import { CurrentUser } from '../common/auth/current-user.decorator';
import { CurrentBranch } from '../common/auth/current-branch.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  checkInSchema,
  CheckInInput,
  manualCheckInSchema,
  ManualCheckInInput,
  checkOutSchema,
  CheckOutInput,
  attendanceHistoryQuerySchema,
  AttendanceHistoryQueryInput,
  updateAttendanceSettingsSchema,
  UpdateAttendanceSettingsInput,
  issueMemberPassSchema,
  IssueMemberPassInput,
  revokeMemberPassSchema,
  RevokeMemberPassInput,
} from '@gymos/validation';
import {
  Permission,
  AuthenticatedUserContext,
  BranchData,
  CheckInResponse,
  CheckOutResponse,
  AttendanceFloorSummary,
  AttendanceRecordData,
  AttendanceSettingsData,
  MemberAccessPassData,
  DynamicPassTokenResponse,
  PublicPassResponse,
  PaginatedResult,
} from '@gymos/shared-types';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ===========================================================================
  // 1. CHECK-IN ENDPOINTS
  // ===========================================================================

  @Post('scan')
  @RequirePermissions(Permission.ATTENDANCE_CHECKIN)
  @ApiOperation({ summary: 'Process member check-in via QR or credentials' })
  @ApiResponse({ status: 200, description: 'Check-in processed successfully' })
  async scanCheckIn(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(checkInSchema)) dto: CheckInInput,
  ): Promise<CheckInResponse> {
    return this.attendanceService.checkIn(
      organizationId,
      dto.branchId,
      { ...dto, method: dto.method as any },
      user,
    );
  }

  @Post('check-in')
  @RequirePermissions(Permission.ATTENDANCE_CHECKIN)
  @ApiOperation({ summary: 'Process member check-in (alias for /scan)' })
  @ApiResponse({ status: 200, description: 'Check-in processed successfully' })
  async checkInAlias(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(checkInSchema)) dto: CheckInInput,
  ): Promise<CheckInResponse> {
    return this.attendanceService.checkIn(
      organizationId,
      dto.branchId,
      { ...dto, method: dto.method as any },
      user,
    );
  }

  @Post('manual')
  @RequirePermissions(Permission.ATTENDANCE_MANUAL)
  @ApiOperation({ summary: 'Process manual staff member check-in' })
  @ApiResponse({ status: 200, description: 'Manual check-in processed successfully' })
  async manualCheckIn(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(manualCheckInSchema)) dto: ManualCheckInInput,
  ): Promise<CheckInResponse> {
    return this.attendanceService.checkIn(
      organizationId,
      dto.branchId,
      {
        branchId: dto.branchId,
        memberId: dto.memberId,
        notes: dto.notes,
      },
      user,
    );
  }

  @Post('manual-check-in')
  @RequirePermissions(Permission.ATTENDANCE_MANUAL)
  @ApiOperation({ summary: 'Process manual staff member check-in (alias)' })
  @ApiResponse({ status: 200, description: 'Manual check-in processed successfully' })
  async manualCheckInAlias(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(manualCheckInSchema)) dto: ManualCheckInInput,
  ): Promise<CheckInResponse> {
    return this.attendanceService.checkIn(
      organizationId,
      dto.branchId,
      {
        branchId: dto.branchId,
        memberId: dto.memberId,
        notes: dto.notes,
      },
      user,
    );
  }

  // ===========================================================================
  // 2. CHECK-OUT ENDPOINTS
  // ===========================================================================

  @Post(':id/checkout')
  @RequirePermissions(Permission.ATTENDANCE_CHECKOUT)
  @ApiOperation({ summary: 'Check out active member attendance session by ID' })
  @ApiParam({ name: 'id', description: 'Attendance Record UUID' })
  @ApiResponse({ status: 200, description: 'Member checked out successfully' })
  async checkOutById(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') attendanceId: string,
    @Body('notes') notes?: string,
  ): Promise<CheckOutResponse> {
    return this.attendanceService.checkOut(organizationId, attendanceId, user, notes);
  }

  @Post('check-out')
  @RequirePermissions(Permission.ATTENDANCE_CHECKOUT)
  @ApiOperation({ summary: 'Check out active member attendance session via body' })
  @ApiResponse({ status: 200, description: 'Member checked out successfully' })
  async checkOutBody(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Body(new ZodValidationPipe(checkOutSchema)) dto: CheckOutInput,
  ): Promise<CheckOutResponse> {
    return this.attendanceService.checkOut(
      organizationId,
      dto.attendanceId,
      user,
      dto.notes,
    );
  }

  // ===========================================================================
  // 3. LIVE FLOOR OCCUPANCY
  // ===========================================================================

  @Get('floor')
  @RequirePermissions(Permission.ATTENDANCE_FLOOR_READ)
  @ApiOperation({ summary: 'Retrieve live floor occupancy and headcount for branch' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Live floor summary returned' })
  async getLiveFloor(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @CurrentBranch() branch: BranchData | null,
    @Query('branchId') queryBranchId?: string,
  ): Promise<AttendanceFloorSummary> {
    const branchId = queryBranchId || branch?.id;
    if (!branchId) {
      throw new BadRequestException('Branch ID is required to query live floor occupancy');
    }
    return this.attendanceService.getLiveFloorSummary(organizationId, branchId, user);
  }

  @Get('live')
  @RequirePermissions(Permission.ATTENDANCE_FLOOR_READ)
  @ApiOperation({ summary: 'Retrieve live floor occupancy (alias for /floor)' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Branch UUID' })
  @ApiResponse({ status: 200, description: 'Live floor summary returned' })
  async getLiveFloorAlias(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @CurrentBranch() branch: BranchData | null,
    @Query('branchId') queryBranchId?: string,
  ): Promise<AttendanceFloorSummary> {
    const branchId = queryBranchId || branch?.id;
    if (!branchId) {
      throw new BadRequestException('Branch ID is required to query live floor occupancy');
    }
    return this.attendanceService.getLiveFloorSummary(organizationId, branchId, user);
  }

  // ===========================================================================
  // 4. ATTENDANCE HISTORY & RECORDS
  // ===========================================================================

  @Get('records')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Query paginated attendance records and history' })
  @ApiResponse({ status: 200, description: 'Paginated attendance records returned' })
  async getRecords(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query(new ZodValidationPipe(attendanceHistoryQuerySchema))
    query: AttendanceHistoryQueryInput,
  ): Promise<PaginatedResult<AttendanceRecordData>> {
    return this.attendanceService.getAttendanceRecords(organizationId, query, user);
  }

  @Get('history')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Query paginated attendance history (alias for /records)' })
  @ApiResponse({ status: 200, description: 'Paginated attendance records returned' })
  async getHistoryAlias(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Query(new ZodValidationPipe(attendanceHistoryQuerySchema))
    query: AttendanceHistoryQueryInput,
  ): Promise<PaginatedResult<AttendanceRecordData>> {
    return this.attendanceService.getAttendanceRecords(organizationId, query, user);
  }

  // ===========================================================================
  // 5. ATTENDANCE SETTINGS
  // ===========================================================================

  @Get('settings')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Retrieve attendance policy settings for branch or organization' })
  @ApiQuery({ name: 'branchId', required: false, description: 'Optional Branch UUID' })
  @ApiResponse({ status: 200, description: 'Attendance settings returned' })
  async getSettings(
    @CurrentTenant() organizationId: string,
    @Query('branchId') branchId?: string,
  ): Promise<AttendanceSettingsData> {
    return this.attendanceService.getAttendanceSettings(organizationId, branchId);
  }

  @Patch('settings')
  @RequirePermissions(Permission.ATTENDANCE_SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update attendance policy settings' })
  @ApiResponse({ status: 200, description: 'Attendance settings updated' })
  async updateSettings(
    @CurrentTenant() organizationId: string,
    @Body(new ZodValidationPipe(updateAttendanceSettingsSchema))
    dto: UpdateAttendanceSettingsInput,
  ): Promise<AttendanceSettingsData> {
    return this.attendanceService.updateAttendanceSettings(organizationId, dto.branchId, dto);
  }

  @Put('settings')
  @RequirePermissions(Permission.ATTENDANCE_SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update attendance policy settings (alias for PATCH /settings)' })
  @ApiResponse({ status: 200, description: 'Attendance settings updated' })
  async updateSettingsPut(
    @CurrentTenant() organizationId: string,
    @Body(new ZodValidationPipe(updateAttendanceSettingsSchema))
    dto: UpdateAttendanceSettingsInput,
  ): Promise<AttendanceSettingsData> {
    return this.attendanceService.updateAttendanceSettings(organizationId, dto.branchId, dto);
  }

  // ===========================================================================
  // 6. MEMBER ACCESS PASS MANAGEMENT
  // ===========================================================================

  @Post('members/:memberId/pass/issue')
  @RequirePermissions(Permission.ATTENDANCE_PASS_MANAGE)
  @ApiOperation({ summary: 'Issue or rotate access pass for a member' })
  @ApiParam({ name: 'memberId', description: 'Member UUID' })
  @ApiResponse({ status: 200, description: 'Access pass issued' })
  async issuePassForMember(
    @CurrentTenant() organizationId: string,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(issueMemberPassSchema))
    dto?: IssueMemberPassInput,
  ): Promise<{ pass: MemberAccessPassData; rawPhysicalPasscode?: string }> {
    return this.attendanceService.issuePass(
      organizationId,
      memberId,
      dto?.generatePhysicalBadge ?? false,
    );
  }

  @Post('passes/issue')
  @RequirePermissions(Permission.ATTENDANCE_PASS_MANAGE)
  @ApiOperation({ summary: 'Issue access pass via body payload' })
  @ApiResponse({ status: 200, description: 'Access pass issued' })
  async issuePassBody(
    @CurrentTenant() organizationId: string,
    @Body('memberId') memberId: string,
    @Body(new ZodValidationPipe(issueMemberPassSchema))
    dto?: IssueMemberPassInput,
  ): Promise<{ pass: MemberAccessPassData; rawPhysicalPasscode?: string }> {
    if (!memberId) {
      throw new BadRequestException('memberId is required in body');
    }
    return this.attendanceService.issuePass(
      organizationId,
      memberId,
      dto?.generatePhysicalBadge ?? false,
    );
  }

  @Post('members/:memberId/pass/revoke')
  @RequirePermissions(Permission.ATTENDANCE_PASS_MANAGE)
  @ApiOperation({ summary: 'Revoke an access pass for a member' })
  @ApiParam({ name: 'memberId', description: 'Member UUID' })
  @ApiResponse({ status: 200, description: 'Access pass revoked' })
  async revokePassForMember(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(revokeMemberPassSchema))
    dto: RevokeMemberPassInput,
  ): Promise<MemberAccessPassData> {
    return this.attendanceService.revokePassByMemberId(
      organizationId,
      memberId,
      dto.reason,
      user,
      dto.issueReplacement ?? false,
    );
  }

  @Post('passes/:id/revoke')
  @RequirePermissions(Permission.ATTENDANCE_PASS_MANAGE)
  @ApiOperation({ summary: 'Revoke an access pass by pass ID' })
  @ApiParam({ name: 'id', description: 'Pass UUID' })
  @ApiResponse({ status: 200, description: 'Access pass revoked' })
  async revokePassById(
    @CurrentTenant() organizationId: string,
    @CurrentUser() user: AuthenticatedUserContext,
    @Param('id') passId: string,
    @Body(new ZodValidationPipe(revokeMemberPassSchema))
    dto: RevokeMemberPassInput,
  ): Promise<MemberAccessPassData> {
    return this.attendanceService.revokePass(
      organizationId,
      passId,
      dto.reason,
      user,
    );
  }

  @Get('members/:memberId/pass')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Retrieve member access pass metadata' })
  @ApiParam({ name: 'memberId', description: 'Member UUID' })
  @ApiResponse({ status: 200, description: 'Access pass metadata returned' })
  async getMemberPass(
    @CurrentTenant() organizationId: string,
    @Param('memberId') memberId: string,
  ): Promise<MemberAccessPassData> {
    const pass = await this.attendanceService.getMemberPass(organizationId, memberId);
    if (!pass) {
      throw new NotFoundException('Member access pass not found');
    }
    return pass;
  }

  @Get('members/:memberId/pass/token')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Generate fresh dynamic QR token for member pass' })
  @ApiParam({ name: 'memberId', description: 'Member UUID' })
  @ApiResponse({ status: 200, description: 'Fresh dynamic QR token generated' })
  async getDynamicToken(
    @CurrentTenant() organizationId: string,
    @Param('memberId') memberId: string,
  ): Promise<DynamicPassTokenResponse> {
    return this.attendanceService.generateDynamicPassToken(organizationId, memberId);
  }

  @Get('members/:memberId/pass/web-link')
  @RequirePermissions(Permission.ATTENDANCE_READ)
  @ApiOperation({ summary: 'Generate signed public web pass URL for member' })
  @ApiParam({ name: 'memberId', description: 'Member UUID' })
  @ApiResponse({ status: 200, description: 'Signed web pass link generated' })
  async getWebPassLink(
    @CurrentTenant() organizationId: string,
    @Param('memberId') memberId: string,
  ): Promise<{ passToken: string; webPassUrl: string }> {
    return this.attendanceService.generateSignedWebPassToken(organizationId, memberId);
  }

  // ===========================================================================
  // 7. PUBLIC SIGNED WEB PASS FLOW
  // ===========================================================================

  @Public()
  @Get('public/pass/:passToken')
  @ApiOperation({ summary: 'Public view endpoint for mobile web pass' })
  @ApiParam({ name: 'passToken', description: 'Signed bearer pass token' })
  @ApiResponse({ status: 200, description: 'Member pass and dynamic rolling token returned' })
  async getPublicPass(
    @Param('passToken') passToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicPassResponse> {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return this.attendanceService.resolvePublicWebPass(passToken);
  }

  @Public()
  @Post('public/pass/:passToken/refresh')
  @ApiOperation({ summary: 'Public refresh endpoint for dynamic pass token' })
  @ApiParam({ name: 'passToken', description: 'Signed bearer pass token' })
  @ApiResponse({ status: 200, description: 'Fresh dynamic rolling QR token generated' })
  async refreshPublicPass(
    @Param('passToken') passToken: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ dynamicToken: DynamicPassTokenResponse }> {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const clientIp = req.ip || (req.headers['x-forwarded-for'] as string) || '';
    return this.attendanceService.refreshPublicWebPass(passToken, clientIp);
  }
}
