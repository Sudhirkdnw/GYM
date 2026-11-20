import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedUserContext } from '@gymos/shared-types';

/**
 * SuperAdminGuard restricts platform-level endpoints exclusively to users
 * with isSuperAdmin === true.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUserContext | undefined;

    if (!user || !user.id) {
      throw new UnauthorizedException('Authentication required');
    }

    if (!user.isSuperAdmin) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'This action is restricted exclusively to platform administrators.',
        code: 'SUPER_ADMIN_REQUIRED',
      });
    }

    return true;
  }
}
