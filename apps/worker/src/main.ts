import "dotenv/config";
import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { QUEUES, APP_CONFIG } from "@gymos/config";
import { workerEnvSchema } from "@gymos/validation";

function log(level: string, message: string, meta?: Record<string, unknown>) {
  const payload = {
    timestamp: new Date().toISOString(),
    service: "gymos-worker",
    level,
    message,
    ...meta,
  };
  process.stdout.write(JSON.stringify(payload) + "\n");
}

async function bootstrap() {
  // Validate Environment Variables
  const envResult = workerEnvSchema.safeParse(process.env);
  if (!envResult.success) {
    const errorDetails = envResult.error.errors.map(
      (err) => `${err.path.join(".")}: ${err.message}`,
    );
    log(
      "FATAL",
      `Worker environment validation failed: ${errorDetails.join(", ")}`,
    );
    process.exit(1);
  }

  const env = envResult.data;
  log("INFO", "Initializing GymOS Background Worker...", {
    redisHost: env.REDIS_HOST,
    redisPort: env.REDIS_PORT,
    concurrency: env.WORKER_CONCURRENCY,
  });

  // Dedicated Redis Connection for BullMQ
  const redisConnection = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });

  redisConnection.on("connect", () => {
    log("INFO", "Redis connection established for worker queue");
  });

  redisConnection.on("error", (err) => {
    log("ERROR", "Redis connection error in worker", { error: err.message });
  });

  // BullMQ Worker Foundation
  const notificationWorker = new Worker(
    QUEUES.NOTIFICATIONS,
    async (job: Job) => {
      log("INFO", `Processing background job [${job.name}] id=${job.id}`, {
        jobId: job.id,
        name: job.name,
        attemptsMade: job.attemptsMade,
      });

      // Stage 1 Foundation: Architectural job handling placeholder
      return { processed: true, completedAt: new Date().toISOString() };
    },
    {
      connection: redisConnection,
      concurrency:
        env.WORKER_CONCURRENCY || APP_CONFIG.DEFAULT_WORKER_CONCURRENCY,
    },
  );

  notificationWorker.on("completed", (job) => {
    log("INFO", `Job completed: id=${job?.id} name=${job?.name}`);
  });

  notificationWorker.on("failed", (job, err) => {
    log("ERROR", `Job failed: id=${job?.id} name=${job?.name}`, {
      error: err.message,
    });
  });

  log("INFO", `Worker active and listening on queue: ${QUEUES.NOTIFICATIONS}`);

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    log("INFO", `Received ${signal}. Gracefully stopping worker...`);
    try {
      await notificationWorker.close();
      await redisConnection.quit();
      log("INFO", "Worker and Redis connections closed successfully");
      process.exit(0);
    } catch (err) {
      log("ERROR", "Error during worker shutdown", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  log("FATAL", "Uncaught worker exception", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
