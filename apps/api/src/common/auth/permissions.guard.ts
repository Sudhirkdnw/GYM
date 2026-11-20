import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './require-permissions.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { Permission, AuthenticatedUserContext } from '@gymos/shared-types';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no specific permissions are declared, allow authenticated access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUserContext | undefined;

    if (!user) {
      throw new UnauthorizedException('Authentication required to verify permissions');
    }

    // Deny by default: Validate user possesses every required permission
    const userPermissions = new Set<string>(user.permissions || []);

    const hasAllRequired = requiredPermissions.every((permission) =>
      userPermissions.has(permission),
    );

    if (!hasAllRequired) {
      throw new ForbiddenException(
        `Forbidden: Insufficient permissions for this action (required: ${requiredPermissions.join(
          ', ',
        )})`,
      );
    }

    return true;
  }
}
