import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_CONFIG } from '@gymos/config';
import { AppLoggerService } from '../../logging/app-logger.service';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class CsrfProtectionGuard implements CanActivate {
  private readonly allowedOrigins: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    const rawOrigin =
      this.configService.get<string>('cors.origin') || 'http://localhost:3000';
    this.allowedOrigins = rawOrigin.includes(',')
      ? rawOrigin.split(',').map((o) => o.trim().toLowerCase())
      : [rawOrigin.trim().toLowerCase()];
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    // Only inspect state-changing requests
    if (!STATE_CHANGING_METHODS.has(method)) {
      return true;
    }

    // Check if request is authenticated via cookies
    const hasAuthCookie = Boolean(
      request.cookies &&
        (request.cookies[AUTH_CONFIG.COOKIE_ACCESS_TOKEN] ||
          request.cookies[AUTH_CONFIG.COOKIE_REFRESH_TOKEN]),
    );

    // If request uses Authorization Bearer header, browser CSRF does not apply
    const authHeader = request.headers?.authorization;
    const hasBearerHeader =
      typeof authHeader === 'string' &&
      authHeader.toLowerCase().startsWith('bearer ') &&
      authHeader.slice(7).trim().length > 0;

    // If not cookie-authenticated, CSRF validation does not apply
    if (!hasAuthCookie && hasBearerHeader) {
      return true;
    }

    // Inspect Origin and Referer headers
    const originHeader = request.headers?.origin as string | undefined;
    const refererHeader = request.headers?.referer as string | undefined;

    if (originHeader) {
      const normalizedOrigin = originHeader.trim().toLowerCase();
      const isAllowed = this.allowedOrigins.some(
        (allowed) =>
          allowed === normalizedOrigin ||
          (allowed.startsWith('http://localhost') &&
            normalizedOrigin.startsWith('http://localhost')),
      );

      if (!isAllowed) {
        this.logger.warn(
          `CSRF blocked: Unauthorized Origin '${originHeader}' attempted state-changing ${method} ${request.url}`,
          'CsrfProtectionGuard',
        );
        throw new ForbiddenException(
          'CSRF validation failed: Unauthorized cross-origin request',
        );
      }
      return true;
    }

    if (refererHeader) {
      try {
        const parsedRefererOrigin = new URL(refererHeader).origin.toLowerCase();
        const isAllowed = this.allowedOrigins.some(
          (allowed) =>
            allowed === parsedRefererOrigin ||
            (allowed.startsWith('http://localhost') &&
              parsedRefererOrigin.startsWith('http://localhost')),
        );

        if (!isAllowed) {
          this.logger.warn(
            `CSRF blocked: Unauthorized Referer '${refererHeader}' attempted state-changing ${method} ${request.url}`,
            'CsrfProtectionGuard',
          );
          throw new ForbiddenException(
            'CSRF validation failed: Unauthorized Referer header',
          );
        }
        return true;
      } catch {
        throw new ForbiddenException(
          'CSRF validation failed: Malformed Referer header',
        );
      }
    }

    // If request has cookie authentication and Origin header was explicitly spoofed or cross-origin
    return true;
  }
}
