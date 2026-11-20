import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_ENTITLEMENT_KEY } from './require-entitlement.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { EntitlementService } from '../entitlements/entitlement.service';
import { AuthenticatedUserContext } from '@gymos/shared-types';

@Injectable()
export class EntitlementGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlementService: EntitlementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const featureKey = this.reflector.getAllAndOverride<string>(
      REQUIRE_ENTITLEMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!featureKey) {
      return true; // No specific entitlement required for this route
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUserContext | undefined;

    // Platform Super Admin bypasses tenant entitlement checks
    if (user?.isSuperAdmin) {
      return true;
    }

    const organizationId = user?.organizationId;
    if (!organizationId) {
      throw new ForbiddenException('Missing organization context for feature evaluation');
    }

    const isEntitled = await this.entitlementService.isEntitled(
      organizationId,
      featureKey,
    );

    if (!isEntitled) {
      throw new ForbiddenException({
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        message: `This feature (${featureKey}) is not included in your GymOS plan. Please contact support or upgrade.`,
        code: 'FEATURE_NOT_ENTITLED',
        featureKey,
      });
    }

    return true;
  }
}
