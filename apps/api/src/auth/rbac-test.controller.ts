import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequirePermissions, CurrentUser } from '../common/auth';
import { Permission, AuthenticatedUserContext } from '@gymos/shared-types';

@ApiTags('RBAC Testing')
@ApiBearerAuth()
@Controller('test-rbac')
export class RbacTestController {
  @Get('owner-only')
  @ApiOperation({ summary: 'Protected endpoint requiring Gym Owner settings manage permission' })
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_MANAGE)
  getOwnerSettings(@CurrentUser() user: AuthenticatedUserContext) {
    return {
      message: 'Access granted: Organization settings manage',
      userId: user.id,
      role: user.role,
    };
  }

  @Get('admin-action')
  @ApiOperation({ summary: 'Protected endpoint requiring Gym Admin settings read permission' })
  @RequirePermissions(Permission.ORGANIZATION_SETTINGS_READ)
  getAdminSettings(@CurrentUser() user: AuthenticatedUserContext) {
    return {
      message: 'Access granted: Organization settings read',
      userId: user.id,
      role: user.role,
    };
  }

  @Get('receptionist-action')
  @ApiOperation({ summary: 'Protected endpoint requiring Receptionist payment manage permission' })
  @RequirePermissions(Permission.ORGANIZATION_PAYMENTS_MANAGE)
  getReceptionistPayments(@CurrentUser() user: AuthenticatedUserContext) {
    return {
      message: 'Access granted: Organization payments manage',
      userId: user.id,
      role: user.role,
    };
  }

  @Get('trainer-action')
  @ApiOperation({ summary: 'Protected endpoint requiring Trainer members read permission' })
  @RequirePermissions(Permission.ORGANIZATION_MEMBERS_READ)
  getTrainerMembers(@CurrentUser() user: AuthenticatedUserContext) {
    return {
      message: 'Access granted: Organization members read',
      userId: user.id,
      role: user.role,
    };
  }

  @Get('member-action')
  @ApiOperation({ summary: 'Protected endpoint accessible by all valid members' })
  @RequirePermissions(Permission.MEMBER_PROFILE_READ)
  getMemberProfile(@CurrentUser() user: AuthenticatedUserContext) {
    return {
      message: 'Access granted: Member profile read',
      userId: user.id,
      role: user.role,
    };
  }

  @Get('superadmin-only')
  @ApiOperation({ summary: 'Protected endpoint requiring Platform Super Admin permission' })
  @RequirePermissions(Permission.PLATFORM_ACCESS)
  getSuperAdminAccess(@CurrentUser() user: AuthenticatedUserContext) {
    return {
      message: 'Access granted: Platform access',
      userId: user.id,
      isSuperAdmin: user.isSuperAdmin,
    };
  }
}
