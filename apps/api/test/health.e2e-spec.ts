import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication, VersioningType } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { TransformInterceptor } from "../src/common/interceptors/transform.interceptor";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { AppLoggerService } from "../src/logging/app-logger.service";

describe("HealthController (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    const logger = app.get(AppLoggerService);
    app.setGlobalPrefix("api");
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: "1",
    });
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter(logger));

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/api/v1/health (GET)", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.services.database.status).toBe("up");
    expect(res.body.data.services.redis.status).toBe("up");
  });

  it("/api/v1/health/database (GET)", async () => {
    const res = await request(app.getHttpServer()).get(
      "/api/v1/health/database",
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("up");
  });

  it("/api/v1/health/redis (GET)", async () => {
    const res = await request(app.getHttpServer()).get("/api/v1/health/redis");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("up");
  });
});
