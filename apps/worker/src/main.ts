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

  // Billing Event Queue for publishing financial outbox items
  const billingQueue = new Queue(QUEUES.BILLING, {
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

  // BullMQ Worker for Billing & Payments
  const billingWorker = new Worker(
    QUEUES.BILLING,
    async (job: Job) => {
      log("INFO", `Processing financial billing event [${job.name}] id=${job.id}`, {
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

  billingWorker.on("completed", (job) => {
    log("INFO", `Billing job completed: id=${job?.id} name=${job?.name}`);
  });

  billingWorker.on("failed", (job, err) => {
    log("ERROR", `Billing job failed: id=${job?.id} name=${job?.name}`, {
      error: err.message,
    });
  });

  log("INFO", `Worker active and listening on queues: ${QUEUES.NOTIFICATIONS}, ${QUEUES.MEMBERSHIPS}, ${QUEUES.BILLING}`);

  // Helper to fetch active organizations
  const getActiveOrganizations = async (): Promise<{ id: string; name: string }[]> => {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true';`);
      return tx.organization.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true },
      });
    });
  };

  // Outbox Dispatcher loop (polls PENDING membership_outbox_events with tenant context)
  let isDispatching = false;
  const dispatchOutboxEvents = async () => {
    if (isDispatching) return;
    isDispatching = true;
    try {
      const orgs = await getActiveOrganizations();
      for (const org of orgs) {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${org.id}';`);
          const pendingEvents = await tx.membershipOutboxEvent.findMany({
            where: { organizationId: org.id, status: "PENDING" },
            orderBy: { createdAt: "asc" },
            take: 50,
          });

          for (const event of pendingEvents) {
            try {
              await membershipQueue.add(event.eventType, event.payload as object, {
                jobId: event.idempotencyKey,
                removeOnComplete: 100,
                removeOnFail: 500,
              });

              await tx.membershipOutboxEvent.update({
                where: { id: event.id },
                data: {
                  status: "PUBLISHED",
                  processedAt: new Date(),
                },
              });
              log("INFO", `Dispatched outbox event ${event.eventType} (${event.id}) for org ${org.id}`);
            } catch (dispatchErr) {
              const errMsg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
              await tx.membershipOutboxEvent.update({
                where: { id: event.id },
                data: {
                  retryCount: { increment: 1 },
                  lastError: errMsg,
                  status: event.retryCount >= 5 ? "FAILED" : "PENDING",
                },
              });
            }
          }
        });
      }
    } catch (err) {
      log("ERROR", "Outbox dispatcher error", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      isDispatching = false;
    }
  };

  // Expiry Processor loop (daily/periodic check for expired memberships with tenant context)
  let isExpiring = false;
  const processExpiredMemberships = async () => {
    if (isExpiring) return;
    isExpiring = true;
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const orgs = await getActiveOrganizations();

      for (const org of orgs) {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${org.id}';`);
          const expiredMemberships = await tx.memberMembership.findMany({
            where: {
              organizationId: org.id,
              status: "ACTIVE",
              endDate: { lt: today },
            },
            select: { id: true, organizationId: true, memberId: true, endDate: true },
            take: 100,
          });

          for (const sub of expiredMemberships) {
            try {
              await tx.memberMembership.update({
                where: { id: sub.id },
                data: { status: "EXPIRED" },
              });

              await tx.membershipHistory.create({
                data: {
                  organizationId: sub.organizationId,
                  membershipId: sub.id,
                  action: "EXPIRED",
                  newState: { status: "EXPIRED" },
                  reason: "Automatic worker expiry processing",
                },
              });

              const dateStr = sub.endDate instanceof Date ? sub.endDate.toISOString().split("T")[0] : String(sub.endDate);
              await tx.membershipOutboxEvent.create({
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
              log("INFO", `Expired membership ${sub.id} for member ${sub.memberId} in org ${org.id}`);
            } catch (subErr) {
              log("ERROR", `Failed to expire membership ${sub.id}`, {
                error: subErr instanceof Error ? subErr.message : String(subErr),
              });
            }
          }
        });
      }
    } catch (err) {
      log("ERROR", "Expiry processor error", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      isExpiring = false;
    }
  };

  // Billing Outbox Dispatcher loop (polls PENDING billing_outbox_events with tenant context)
  let isDispatchingBilling = false;
  const dispatchBillingOutboxEvents = async () => {
    if (isDispatchingBilling) return;
    isDispatchingBilling = true;
    try {
      const orgs = await getActiveOrganizations();
      for (const org of orgs) {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${org.id}';`);
          const pendingEvents = await tx.billingOutboxEvent.findMany({
            where: { organizationId: org.id, status: "PENDING" },
            orderBy: { createdAt: "asc" },
            take: 50,
          });

          for (const event of pendingEvents) {
            try {
              await billingQueue.add(event.eventType, event.payload as object, {
                jobId: event.idempotencyKey,
                removeOnComplete: 100,
                removeOnFail: 500,
              });

              await tx.billingOutboxEvent.update({
                where: { id: event.id },
                data: {
                  status: "PUBLISHED",
                  processedAt: new Date(),
                },
              });
              log("INFO", `Dispatched billing outbox event ${event.eventType} (${event.id}) for org ${org.id}`);
            } catch (dispatchErr) {
              const errMsg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
              await tx.billingOutboxEvent.update({
                where: { id: event.id },
                data: {
                  retryCount: { increment: 1 },
                  lastError: errMsg,
                  status: event.retryCount >= 5 ? "FAILED" : "PENDING",
                },
              });
            }
          }
        });
      }
    } catch (err) {
      log("ERROR", "Billing outbox dispatcher error", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      isDispatchingBilling = false;
    }
  };

  // Overdue Invoice Processor (periodic check for past-due invoices with tenant context)
  let isCheckingDues = false;
  const processOverdueInvoices = async () => {
    if (isCheckingDues) return;
    isCheckingDues = true;
    try {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const orgs = await getActiveOrganizations();

      for (const org of orgs) {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${org.id}';`);
          const overdueInvoices = await tx.invoice.findMany({
            where: {
              organizationId: org.id,
              status: { in: ["ISSUED", "PARTIALLY_PAID"] },
              dueDate: { lt: today },
              balanceDue: { gt: 0 },
            },
            select: { id: true, organizationId: true, memberId: true, invoiceNumber: true, balanceDue: true, dueDate: true },
            take: 100,
          });

          for (const inv of overdueInvoices) {
            try {
              await tx.invoice.update({
                where: { id: inv.id },
                data: { status: "OVERDUE" },
              });

              const dateStr = inv.dueDate.toISOString().slice(0, 10);
              await tx.billingOutboxEvent.create({
                data: {
                  organizationId: inv.organizationId,
                  aggregateId: inv.id,
                  eventType: "billing.dues.reminder_triggered",
                  idempotencyKey: `outbox_overdue_${inv.id}_${dateStr}`,
                  payload: {
                    invoiceId: inv.id,
                    invoiceNumber: inv.invoiceNumber,
                    memberId: inv.memberId,
                    balanceDue: Number(inv.balanceDue),
                    status: "OVERDUE",
                  },
                  status: "PENDING",
                },
              });
              log("INFO", `Marked invoice ${inv.invoiceNumber} as OVERDUE for member ${inv.memberId} in org ${org.id}`);
            } catch (invErr) {
              log("ERROR", `Failed to mark invoice ${inv.id} as overdue`, {
                error: invErr instanceof Error ? invErr.message : String(invErr),
              });
            }
          }
        });
      }
    } catch (err) {
      log("ERROR", "Overdue invoice processor error", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      isCheckingDues = false;
    }
  };

  const outboxInterval = setInterval(dispatchOutboxEvents, 5000);
  const billingOutboxInterval = setInterval(dispatchBillingOutboxEvents, 5000);
  const expiryInterval = setInterval(processExpiredMemberships, 60000);
  const overdueInterval = setInterval(processOverdueInvoices, 60000);

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    log("INFO", `Received ${signal}. Gracefully stopping worker...`);
    clearInterval(outboxInterval);
    clearInterval(billingOutboxInterval);
    clearInterval(expiryInterval);
    clearInterval(overdueInterval);
    try {
      await notificationWorker.close();
      await membershipWorker.close();
      await billingWorker.close();
      await membershipQueue.close();
      await billingQueue.close();
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
