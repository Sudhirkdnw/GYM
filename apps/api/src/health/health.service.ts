import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { PrismaService } from "../database/prisma.service";
import { AppLoggerService } from "../logging/app-logger.service";
import { HealthCheckResult, ServiceHealthStatus } from "@gymos/shared-types";

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private redisClient: Redis | null = null;
  private readonly appStartTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly logger: AppLoggerService,
  ) {
    const host = this.configService.get<string>("redis.host", "127.0.0.1");
    const port = this.configService.get<number>("redis.port", 6379);
    const password = this.configService.get<string | undefined>(
      "redis.password",
    );

    this.redisClient = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: (times) => Math.min(times * 100, 2000),
    });

    this.redisClient.on("error", (err) => {
      // Suppress unhandled event crashes on connection retry
      this.logger.debug(
        `Redis client background error: ${err.message}`,
        "HealthService",
      );
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.redisClient && this.redisClient.status === "wait") {
      await this.redisClient.connect().catch((err) => {
        this.logger.warn(
          `Redis initial connection failed: ${err.message}`,
          "HealthService",
        );
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit().catch(() => {});
    }
  }

  async checkDatabase(): Promise<ServiceHealthStatus> {
    const result = await this.prisma.isHealthy();
    return {
      status: result.isHealthy ? "up" : "down",
      latencyMs: result.latencyMs,
      message: result.message,
    };
  }

  async checkRedis(): Promise<ServiceHealthStatus> {
    const start = Date.now();
    try {
      if (!this.redisClient) {
        throw new Error("Redis client is not configured");
      }

      if (this.redisClient.status === "wait") {
        await this.redisClient.connect();
      }

      const pingResponse = await this.redisClient.ping();
      const latencyMs = Date.now() - start;

      if (pingResponse !== "PONG") {
        return {
          status: "down",
          latencyMs,
          message: `Unexpected Redis ping response: ${pingResponse}`,
        };
      }

      return {
        status: "up",
        latencyMs,
      };
    } catch (error) {
      return {
        status: "down",
        latencyMs: Date.now() - start,
        message: error instanceof Error ? error.message : "Unknown Redis error",
      };
    }
  }

  async checkOverallHealth(): Promise<HealthCheckResult> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allUp = database.status === "up" && redis.status === "up";
    const anyUp = database.status === "up" || redis.status === "up";

    let overallStatus: "ok" | "degraded" | "error" = "ok";
    if (!allUp) {
      overallStatus = anyUp ? "degraded" : "error";
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.appStartTime) / 1000),
      environment: this.configService.get<string>("nodeEnv", "development"),
      version: "0.1.0",
      services: {
        database,
        redis,
      },
    };
  }
}
