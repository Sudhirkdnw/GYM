import { Injectable, LoggerService, Scope } from "@nestjs/common";

export interface LogPayload {
  message: string;
  context?: string;
  correlationId?: string;
  organizationId?: string;
  error?: unknown;
  details?: Record<string, unknown>;
}

@Injectable({ scope: Scope.DEFAULT })
export class AppLoggerService implements LoggerService {
  private formatOutput(
    level: string,
    message: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): string {
    const timestamp = new Date().toISOString();
    const logObject = {
      timestamp,
      level,
      context: context || "Application",
      message,
      ...extra,
    };
    return JSON.stringify(logObject);
  }

  log(
    message: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    process.stdout.write(
      this.formatOutput("INFO", message, context, extra) + "\n",
    );
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    process.stderr.write(
      this.formatOutput("ERROR", message, context, { ...extra, trace }) + "\n",
    );
  }

  warn(
    message: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    process.stdout.write(
      this.formatOutput("WARN", message, context, extra) + "\n",
    );
  }

  debug(
    message: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    if (process.env.LOG_LEVEL === "debug") {
      process.stdout.write(
        this.formatOutput("DEBUG", message, context, extra) + "\n",
      );
    }
  }

  verbose(
    message: string,
    context?: string,
    extra?: Record<string, unknown>,
  ): void {
    if (process.env.LOG_LEVEL === "debug") {
      process.stdout.write(
        this.formatOutput("VERBOSE", message, context, extra) + "\n",
      );
    }
  }
}
