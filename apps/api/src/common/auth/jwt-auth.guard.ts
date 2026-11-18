import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AUTH_CONFIG } from '@gymos/config';
import { AuthenticatedUserContext } from '@gymos/shared-types';
import { TenantContextStore } from '../tenant/tenant-context.storage';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('jwt.secret') ||
      'development-jwt-secret-min-16-chars-long';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromRequest(request);

    if (!token) {
      throw new UnauthorizedException(
        'Authentication required: No bearer token or session cookie provided',
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.jwtSecret,
      });

      const userContext: AuthenticatedUserContext = {
        id: payload.sub,
        email: payload.email,
        firstName: payload.firstName || '',
        lastName: payload.lastName || '',
        isSuperAdmin: Boolean(payload.isSuperAdmin),
        organizationId: payload.organizationId,
        role: payload.role,
        permissions: payload.permissions || [],
      };

      request.user = userContext;

      // Populate AsyncLocalStorage Tenant Context if organizationId is present
      if (userContext.organizationId) {
        TenantContextStore.run(
          {
            organizationId: userContext.organizationId,
            userId: userContext.id,
            role: userContext.role,
            isSuperAdmin: userContext.isSuperAdmin,
          },
          () => {
            // Context will be active
          },
        );
      }

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private extractTokenFromRequest(request: Request): string | null {
    // 1. Check Authorization Bearer header
    const authHeader = request.headers?.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const [type, token] = authHeader.split(' ');
      if (type?.toLowerCase() === 'bearer' && token) {
        return token.trim();
      }
    }

    // 2. Check HttpOnly cookie
    if (request.cookies && request.cookies[AUTH_CONFIG.COOKIE_ACCESS_TOKEN]) {
      return request.cookies[AUTH_CONFIG.COOKIE_ACCESS_TOKEN];
    }

    return null;
  }
}
