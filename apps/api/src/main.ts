import { NestFactory } from "@nestjs/core";
import { VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { AppModule } from "./app.module";
import { AppLoggerService } from "./logging/app-logger.service";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { SECURITY_CONFIG } from "@gymos/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  const configService = app.get(ConfigService);
  const port = configService.get<number>("port", 4000);
  const corsOrigin = configService.get<string>(
    "cors.origin",
    "http://localhost:3000",
  );
  const apiPrefix = configService.get<string>("apiPrefix", "api");

  // Security Headers
  app.use(helmet());
  app.use(cookieParser());

  // CORS Configuration
  app.enableCors({
    origin: corsOrigin.includes(",")
      ? corsOrigin.split(",").map((o) => o.trim())
      : corsOrigin,
    methods: [...SECURITY_CONFIG.CORS_ALLOWED_METHODS],
    allowedHeaders: [...SECURITY_CONFIG.CORS_ALLOWED_HEADERS],
    credentials: true,
  });

  // API Versioning and Prefix
  app.setGlobalPrefix(apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1",
  });

  // Global Interceptors & Filters
  app.useGlobalInterceptors(
    new LoggingInterceptor(logger),
    new TransformInterceptor(),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(logger));

  // Graceful Shutdown
  app.enableShutdownHooks();

  // Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle("GymOS Core API")
    .setDescription(
      "GymOS - Multi-Tenant Gym Management & Automation SaaS Foundation API",
    )
    .setVersion("1.0")
    .addTag("Health", "Infrastructure and health diagnostics")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document);

  await app.listen(port);
  logger.log(
    `GymOS API Gateway initialized on port ${port} (prefix: /${apiPrefix}/v1)`,
    "Bootstrap",
  );
  logger.log(
    `OpenAPI documentation available at http://localhost:${port}/${apiPrefix}/docs`,
    "Bootstrap",
  );
}

bootstrap().catch((err) => {
  console.error("Fatal error during GymOS API bootstrapping:", err);
  process.exit(1);
});
