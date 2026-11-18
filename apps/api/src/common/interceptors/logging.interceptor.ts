import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { Request, Response } from "express";
import { AppLoggerService } from "../../logging/app-logger.service";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const start = Date.now();
    const { method, originalUrl, correlationId } = req;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          this.logger.log(
            `${method} ${originalUrl} ${res.statusCode} +${duration}ms`,
            "HTTP",
            {
              correlationId,
              method,
              url: originalUrl,
              statusCode: res.statusCode,
              durationMs: duration,
            },
          );
        },
        error: (err) => {
          const duration = Date.now() - start;
          this.logger.warn(
            `${method} ${originalUrl} failed after ${duration}ms: ${err?.message || err}`,
            "HTTP",
            {
              correlationId,
              method,
              url: originalUrl,
              durationMs: duration,
            },
          );
        },
      }),
    );
  }
}
