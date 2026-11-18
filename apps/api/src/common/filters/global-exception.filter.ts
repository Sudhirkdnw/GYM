import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ApiErrorResponse } from "@gymos/shared-types";
import { AppLoggerService } from "../../logging/app-logger.service";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const correlationId = request?.correlationId ?? "unknown";
    const timestamp = new Date().toISOString();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = "Internal Server Error";
    let message: string | string[] = "An unexpected error occurred";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
        error = exception.name;
      } else if (typeof res === "object" && res !== null) {
        const obj = res as Record<string, unknown>;
        message = (obj["message"] as string | string[]) || exception.message;
        error = (obj["error"] as string) || exception.name;
      }
    } else if (exception instanceof Error) {
      error = exception.name;
      message =
        process.env.NODE_ENV === "production"
          ? "Internal server error"
          : exception.message;
    }

    this.logger.error(
      `HTTP Exception [${statusCode}] ${request?.method} ${request?.url}: ${JSON.stringify(message)}`,
      exception instanceof Error ? exception.stack : undefined,
      "GlobalExceptionFilter",
      {
        correlationId,
        statusCode,
        path: request?.url,
        method: request?.method,
      },
    );

    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode,
      error,
      message,
      timestamp,
      correlationId,
      path: request?.url ?? "",
    };

    response.status(statusCode).json(errorResponse);
  }
}
