import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { AppLoggerService } from "../logging/app-logger.service";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly logger: AppLoggerService) {
    super({
      log: [
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log("Initializing database connection...", "PrismaService");
      await this.$connect();
      this.logger.log(
        "Database connection established successfully",
        "PrismaService",
      );
    } catch (error) {
      this.logger.error(
        "Failed to connect to PostgreSQL database during initialization",
        error instanceof Error ? error.stack : undefined,
        "PrismaService",
      );
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log("Disconnecting database client...", "PrismaService");
    await this.$disconnect();
    this.logger.log("Database client disconnected", "PrismaService");
  }

  async isHealthy(): Promise<{
    isHealthy: boolean;
    latencyMs: number;
    message?: string;
  }> {
    const start = Date.now();
    try {
      await this.$queryRaw`SELECT 1`;
      return {
        isHealthy: true,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        isHealthy: false,
        latencyMs: Date.now() - start,
        message:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }
}
