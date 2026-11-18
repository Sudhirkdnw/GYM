import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HealthService } from "./health.service";
import { PrismaService } from "../database/prisma.service";
import { AppLoggerService } from "../logging/app-logger.service";

describe("HealthService", () => {
  let service: HealthService;
  let prismaService: jest.Mocked<Partial<PrismaService>>;
  let loggerService: jest.Mocked<Partial<AppLoggerService>>;

  beforeEach(async () => {
    prismaService = {
      isHealthy: jest.fn().mockResolvedValue({ isHealthy: true, latencyMs: 5 }),
    };

    loggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AppLoggerService,
          useValue: loggerService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultVal: unknown) => {
              if (key === "redis.host") return "127.0.0.1";
              if (key === "redis.port") return 6379;
              if (key === "nodeEnv") return "test";
              return defaultVal;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy();
    }
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should report database as up when query succeeds", async () => {
    const status = await service.checkDatabase();
    expect(status.status).toBe("up");
    expect(status.latencyMs).toBe(5);
  });

  it("should report database as down when query fails", async () => {
    (prismaService.isHealthy as jest.Mock).mockResolvedValueOnce({
      isHealthy: false,
      latencyMs: 12,
      message: "Connection timeout",
    });

    const status = await service.checkDatabase();
    expect(status.status).toBe("down");
    expect(status.message).toBe("Connection timeout");
  });
});
