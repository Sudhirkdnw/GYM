import crypto from "crypto";
import { PrismaClient, AttendanceStatus } from "@prisma/client";
import Redis from "ioredis";
import { isWithinOperatingHours, getLocalTimeAndDate } from "@gymos/shared-types";
import { LoggerFn } from "./attendance-outbox.dispatcher";

export interface AutoCheckoutResult {
  checkedOutCount: number;
  skippedCount: number;
}

export class AutoCheckoutProcessor {
  private isProcessing = false;
  readonly lockKey = "lock:worker:attendance:auto-checkout";
  readonly lockTtlSeconds = 300; // 5 minutes

  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly log: LoggerFn,
  ) {}

  /**
   * Acquires the distributed lock atomically using a unique ownership token.
   */
  async acquireLock(
    token: string,
    ttlSeconds: number = this.lockTtlSeconds,
  ): Promise<boolean> {
    try {
      const lockRes = await this.redis.set(
        this.lockKey,
        token,
        "EX",
        ttlSeconds,
        "NX",
      );
      return lockRes === "OK";
    } catch (err) {
      this.log("ERROR", "Failed to acquire Redis auto-checkout lock", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Releases the distributed lock atomically using a Lua script that deletes
   * the key only when its current value matches the execution's token.
   */
  async releaseLock(token: string): Promise<boolean> {
    const releaseScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    try {
      const res = await this.redis.eval(releaseScript, 1, this.lockKey, token);
      return res === 1;
    } catch (err) {
      this.log("ERROR", "Failed to release Redis auto-checkout lock", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Extends the distributed lock TTL atomically using a Lua script that verifies
   * token ownership before extending the expiration.
   */
  async renewLock(
    token: string,
    ttlSeconds: number = this.lockTtlSeconds,
  ): Promise<boolean> {
    const renewScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("expire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    try {
      const res = await this.redis.eval(
        renewScript,
        1,
        this.lockKey,
        token,
        ttlSeconds,
      );
      return res === 1;
    } catch (err) {
      this.log("WARN", "Failed to renew Redis auto-checkout lock", {
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  /**
   * Executes scheduled automatic check-out for expired or after-hours attendance sessions.
   * Atomic, concurrency-safe, timezone-aware, and isolated per tenant.
   */
  async processAutoCheckout(now: Date = new Date()): Promise<AutoCheckoutResult> {
    if (this.isProcessing) {
      return { checkedOutCount: 0, skippedCount: 0 };
    }
    this.isProcessing = true;

    let checkedOutCount = 0;
    let skippedCount = 0;
    let lockAcquired = false;
    const lockToken = crypto.randomUUID();
    let renewalTimer: NodeJS.Timeout | null = null;

    try {
      // 1. Acquire Redis distributed lock with unique CSPRNG ownership token
      const acquired = await this.acquireLock(lockToken, this.lockTtlSeconds);
      if (!acquired) {
        this.log(
          "DEBUG",
          "Auto-checkout lock held by another worker instance. Skipping run.",
        );
        return { checkedOutCount: 0, skippedCount: 0 };
      }
      lockAcquired = true;

      // Start lock renewal heartbeat (every 60s for 300s TTL)
      renewalTimer = setInterval(async () => {
        const renewed = await this.renewLock(lockToken, this.lockTtlSeconds);
        if (!renewed) {
          this.log(
            "WARN",
            "Auto-checkout lock renewal failed: ownership lost or key expired",
            { lockToken },
          );
        }
      }, 60_000);
      if (renewalTimer.unref) {
        renewalTimer.unref();
      }

      // 2. Query active organizations safely
      const orgs = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL app.is_super_admin = 'true';`);
        return tx.organization.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true, timezone: true },
        });
      });

      // 3. Process each tenant in strict isolation
      for (const org of orgs) {
        await this.prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(
            `SET LOCAL app.current_tenant_id = '${org.id}';`,
          );

          // Fetch all active sessions for this organization
          const activeSessions = await tx.attendanceRecord.findMany({
            where: {
              organizationId: org.id,
              status: AttendanceStatus.CHECKED_IN,
            },
            include: {
              branch: {
                select: {
                  id: true,
                  name: true,
                  timezone: true,
                  status: true,
                },
              },
            },
          });

          if (activeSessions.length === 0) return;

          // Fetch organization default attendance settings (where branchId IS NULL)
          const orgSettings = await tx.attendanceSettings.findFirst({
            where: {
              organizationId: org.id,
              branchId: null,
            },
          });

          // Cache branch-specific settings to avoid duplicate DB roundtrips
          const branchSettingsMap = new Map<string, any>();

          for (const session of activeSessions) {
            const branch = session.branch;

            let settings = branchSettingsMap.get(session.branchId);
            if (settings === undefined) {
              const bSettings = await tx.attendanceSettings.findFirst({
                where: {
                  organizationId: org.id,
                  branchId: session.branchId,
                },
              });
              settings = bSettings || orgSettings;
              branchSettingsMap.set(session.branchId, settings);
            }

            const autoCheckOutHours = settings?.autoCheckOutHours ?? 3;
            const operatingHoursStart = settings?.operatingHoursStart ?? "05:00";
            const operatingHoursEnd = settings?.operatingHoursEnd ?? "23:00";
            const allowOffHoursCheckIn = settings?.allowOffHoursCheckIn ?? false;

            const timezone = branch?.timezone || org.timezone || "UTC";

            // Eligibility Condition A: Duration threshold (checkInTime + autoCheckOutHours <= now)
            const durationThresholdMs = autoCheckOutHours * 3600 * 1000;
            const isDurationExceeded =
              now.getTime() >= session.checkInTime.getTime() + durationThresholdMs;

            // Eligibility Condition B: Branch operating hours closing (if off-hours check-in not allowed)
            let isBranchClosed = false;
            if (!allowOffHoursCheckIn) {
              const { localTime } = getLocalTimeAndDate(now, timezone);
              const isCurrentlyOpen = isWithinOperatingHours(
                localTime,
                operatingHoursStart,
                operatingHoursEnd,
              );
              if (!isCurrentlyOpen) {
                isBranchClosed = true;
              }
            }

            // Eligibility Condition C: Branch itself is INACTIVE
            const isBranchInactive = branch?.status !== "ACTIVE";

            if (isDurationExceeded || isBranchClosed || isBranchInactive) {
              // Compute checkout time
              let checkOutTime: Date;
              if (isDurationExceeded) {
                checkOutTime = new Date(
                  session.checkInTime.getTime() + durationThresholdMs,
                );
                if (checkOutTime.getTime() > now.getTime()) {
                  checkOutTime = now;
                }
              } else {
                checkOutTime = now;
              }

              const durationMinutes = Math.max(
                1,
                Math.round(
                  (checkOutTime.getTime() - session.checkInTime.getTime()) / 60000,
                ),
              );

              const reasonNote = isDurationExceeded
                ? "System auto-checkout due to duration limit"
                : isBranchInactive
                  ? "System auto-checkout due to branch deactivation"
                  : "System auto-checkout due to branch closing";

              // Atomic conditional UPDATE: matching status = 'CHECKED_IN' prevents race condition with manual checkout
              const updateResult = await tx.attendanceRecord.updateMany({
                where: {
                  id: session.id,
                  organizationId: org.id,
                  status: AttendanceStatus.CHECKED_IN,
                },
                data: {
                  status: AttendanceStatus.AUTO_CHECKED_OUT,
                  checkOutTime,
                  durationMinutes,
                  notes: session.notes
                    ? `${session.notes}; ${reasonNote}`
                    : reasonNote,
                },
              });

              if (updateResult.count > 0) {
                checkedOutCount++;

                // Transactional Outbox Event for auto-checkout
                await tx.attendanceOutboxEvent.create({
                  data: {
                    organizationId: org.id,
                    aggregateId: session.id,
                    eventType: "attendance.checked_out",
                    payload: {
                      attendanceId: session.id,
                      memberId: session.memberId,
                      branchId: session.branchId,
                      checkOutTime: checkOutTime.toISOString(),
                      durationMinutes,
                      source: "AUTO_CHECKOUT",
                      reason: reasonNote,
                      verifiedById: null,
                    },
                    idempotencyKey: `attendance_auto_checkout_${session.id}`,
                    status: "PENDING",
                  },
                });

                this.log("INFO", "Auto-checked out attendance session", {
                  attendanceId: session.id,
                  memberId: session.memberId,
                  branchId: session.branchId,
                  orgId: org.id,
                  durationMinutes,
                  reason: reasonNote,
                });
              } else {
                // If updateResult.count === 0, session was checked out by staff concurrently (race condition handled gracefully)
                skippedCount++;
              }
            } else {
              skippedCount++;
            }
          }
        });
      }
    } catch (err) {
      this.log("ERROR", "Auto-checkout processor error", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      if (renewalTimer) {
        clearInterval(renewalTimer);
        renewalTimer = null;
      }
      if (lockAcquired) {
        await this.releaseLock(lockToken);
      }
      this.isProcessing = false;
    }

    return { checkedOutCount, skippedCount };
  }
}
