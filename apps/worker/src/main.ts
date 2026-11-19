import "dotenv/config";
import { Worker, Job, Queue } from "bullmq";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
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

  const prisma = new PrismaClient();

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

  // Membership Event Queue for publishing outbox items
  const membershipQueue = new Queue(QUEUES.MEMBERSHIPS, {
    connection: redisConnection,
  });

  // BullMQ Worker for Notifications
  const notificationWorker = new Worker(
    QUEUES.NOTIFICATIONS,
    async (job: Job) => {
      log("INFO", `Processing background job [${job.name}] id=${job.id}`, {
        jobId: job.id,
        name: job.name,
        attemptsMade: job.attemptsMade,
      });
      return { processed: true, completedAt: new Date().toISOString() };
    },
    {
      connection: redisConnection,
      concurrency:
        env.WORKER_CONCURRENCY || APP_CONFIG.DEFAULT_WORKER_CONCURRENCY,
    },
  );

  // BullMQ Worker for Memberships
  const membershipWorker = new Worker(
    QUEUES.MEMBERSHIPS,
    async (job: Job) => {
      log("INFO", `Processing membership event [${job.name}] id=${job.id}`, {
        jobId: job.id,
        name: job.name,
        data: job.data,
      });
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

  membershipWorker.on("completed", (job) => {
    log("INFO", `Membership job completed: id=${job?.id} name=${job?.name}`);
  });

  membershipWorker.on("failed", (job, err) => {
    log("ERROR", `Membership job failed: id=${job?.id} name=${job?.name}`, {
      error: err.message,
    });
  });

  log("INFO", `Worker active and listening on queues: ${QUEUES.NOTIFICATIONS}, ${QUEUES.MEMBERSHIPS}`);

  // Outbox Dispatcher loop (polls PENDING membership_outbox_events)
  let isDispatching = false;
  const dispatchOutboxEvents = async () => {
    if (isDispatching) return;
    isDispatching = true;
    try {
      const pendingEvents = await prisma.membershipOutboxEvent.findMany({
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        take: 50,
      });

      for (const event of pendingEvents) {
        try {
          await membershipQueue.add(event.eventType, event.payload, {
            jobId: event.idempotencyKey,
            removeOnComplete: 100,
            removeOnFail: 500,
          });

          await prisma.membershipOutboxEvent.update({
            where: { id: event.id },
            data: {
              status: "PUBLISHED",
              processedAt: new Date(),
            },
          });
          log("INFO", `Dispatched outbox event ${event.eventType} (${event.id})`);
        } catch (dispatchErr) {
          const errMsg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
          await prisma.membershipOutboxEvent.update({
            where: { id: event.id },
            data: {
              retryCount: { increment: 1 },
              lastError: errMsg,
              status: event.retryCount >= 5 ? "FAILED" : "PENDING",
            },
          });
        }
      }
    } catch (err) {
      log("ERROR", "Outbox dispatcher error", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      isDispatching = false;
    }
  };

  // Expiry Processor loop (daily/periodic check for expired memberships)
  let isExpiring = false;
  const processExpiredMemberships = async () => {
    if (isExpiring) return;
    isExpiring = true;
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      const expiredMemberships = await prisma.memberMembership.findMany({
        where: {
          status: "ACTIVE",
          endDate: { lt: today },
        },
        select: { id: true, organizationId: true, memberId: true, endDate: true },
        take: 100,
      });

      for (const sub of expiredMemberships) {
        try {
          await prisma.memberMembership.update({
            where: { id: sub.id },
            data: { status: "EXPIRED" },
          });

          await prisma.membershipHistory.create({
            data: {
              organizationId: sub.organizationId,
              membershipId: sub.id,
              action: "EXPIRED",
              newState: { status: "EXPIRED" },
              reason: "Automatic worker expiry processing",
            },
          });

          const dateStr = sub.endDate instanceof Date ? sub.endDate.toISOString().split("T")[0] : String(sub.endDate);
          await prisma.membershipOutboxEvent.create({
            data: {
              organizationId: sub.organizationId,
              aggregateId: sub.id,
              eventType: "membership.expired",
              idempotencyKey: `outbox_membership_expired_${sub.id}_${dateStr}`,
              payload: {
                membershipId: sub.id,
                memberId: sub.memberId,
                organizationId: sub.organizationId,
                status: "EXPIRED",
              },
              status: "PENDING",
            },
          });
          log("INFO", `Expired membership ${sub.id} for member ${sub.memberId}`);
        } catch (subErr) {
          log("ERROR", `Failed to expire membership ${sub.id}`, {
            error: subErr instanceof Error ? subErr.message : String(subErr),
          });
        }
      }
    } catch (err) {
      log("ERROR", "Expiry processor error", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      isExpiring = false;
    }
  };

  const outboxInterval = setInterval(dispatchOutboxEvents, 5000);
  const expiryInterval = setInterval(processExpiredMemberships, 60000);

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    log("INFO", `Received ${signal}. Gracefully stopping worker...`);
    clearInterval(outboxInterval);
    clearInterval(expiryInterval);
    try {
      await notificationWorker.close();
      await membershipWorker.close();
      await membershipQueue.close();
      await redisConnection.quit();
      await prisma.$disconnect();
      log("INFO", "Worker, Redis, and Prisma connections closed successfully");
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
