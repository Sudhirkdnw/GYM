import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
} from "@nestjs/swagger";
import { Response } from "express";
import { HealthService } from "./health.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: "Overall system health check" })
  @SwaggerApiResponse({
    status: 200,
    description: "All systems operational or degraded",
  })
  @SwaggerApiResponse({
    status: 503,
    description: "Core infrastructure unavailable",
  })
  async getOverallHealth(@Res({ passthrough: true }) res: Response) {
    const health = await this.healthService.checkOverallHealth();
    if (health.status === "error") {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }

  @Get("database")
  @ApiOperation({ summary: "PostgreSQL database connectivity check" })
  @SwaggerApiResponse({
    status: 200,
    description: "Database connected and responsive",
  })
  @SwaggerApiResponse({ status: 503, description: "Database unreachable" })
  async getDatabaseHealth(@Res({ passthrough: true }) res: Response) {
    const dbHealth = await this.healthService.checkDatabase();
    if (dbHealth.status === "down") {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return dbHealth;
  }

  @Get("redis")
  @ApiOperation({ summary: "Redis cache & queue connectivity check" })
  @SwaggerApiResponse({
    status: 200,
    description: "Redis connected and responsive",
  })
  @SwaggerApiResponse({ status: 503, description: "Redis unreachable" })
  async getRedisHealth(@Res({ passthrough: true }) res: Response) {
    const redisHealth = await this.healthService.checkRedis();
    if (redisHealth.status === "down") {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return redisHealth;
  }
}
