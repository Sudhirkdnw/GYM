import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";

export interface LoggerFn {
  (level: string, message: string, meta?: Record<string, unknown>): void;
}

export class AttendanceOutboxDispatcher {
  private isDispatching = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly attendanceQueue: Queue,
    private readonly log: LoggerFn,
  ) {}

  /**
   * Scans and dispatches PENDING attendance_outbox_events to BullMQ with strict per-tenant RLS context.
   * Employs bounded retries (5 max) and records errors for observability.
   */
  async dispatchPendingEvents(): Promise<{ dispatched: number; failed: number }> {
    if (this.isDispatching) return { dispatched: 0, failed: 0 };
    this.isDispatching = true;

    let dispatched = 0;
    let failed = 0;

    try {
      // 1. Fetch active organizations safely
      const orgs = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true';`);
        return tx.organization.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true },
        });
      });

      // 2. Iterate per organization to enforce tenant RLS context
      for (const org of orgs) {
        await this.prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL app.current_tenant_id = '${org.id}';`);

          const pendingEvents = await tx.attendanceOutboxEvent.findMany({
            where: {
              organizationId: org.id,
              status: "PENDING",
            },
            orderBy: { createdAt: "asc" },
            take: 50,
          });

          for (const event of pendingEvents) {
            try {
              // Enqueue in BullMQ with bounded retry policy and idempotency
              await this.attendanceQueue.add(
                event.eventType,
                event.payload as Record<string, unknown>,
                {
                  jobId: event.idempotencyKey,
                  attempts: 5,
                  backoff: {
                    type: "exponential",
                    delay: 2000,
                  },
                  removeOnComplete: 100,
                  removeOnFail: 500,
                },
              );

              // Mark as PUBLISHED transactionally
              await tx.attendanceOutboxEvent.update({
                where: { id: event.id },
                data: {
                  status: "PUBLISHED",
                  processedAt: new Date(),
                },
              });

              dispatched++;
              this.log("INFO", `Dispatched attendance outbox event`, {
                eventId: event.id,
                eventType: event.eventType,
                orgId: org.id,
              });
            } catch (dispatchErr) {
              failed++;
              const errMsg =
                dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
              const nextRetry = event.retryCount + 1;
              const nextStatus = nextRetry >= 5 ? "FAILED" : "PENDING";

              await tx.attendanceOutboxEvent.update({
                where: { id: event.id },
                data: {
                  retryCount: { increment: 1 },
                  lastError: errMsg,
                  status: nextStatus,
                },
              });

              this.log("WARN", `Failed to dispatch attendance outbox event`, {
                eventId: event.id,
                eventType: event.eventType,
                orgId: org.id,
                retryCount: nextRetry,
                status: nextStatus,
                error: errMsg,
              });
            }
          }
        });
      }
    } catch (err) {
      this.log("ERROR", "Attendance outbox dispatcher failure", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      this.isDispatching = false;
    }

    return { dispatched, failed };
  }
}
