import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import { QUEUES, APP_CONFIG } from "@gymos/config";
import { LoggerFn } from "./attendance-outbox.dispatcher";

export function createAttendanceWorker(
  redisConnection: Redis,
  concurrency: number,
  log: LoggerFn,
  queueName: string = QUEUES.ATTENDANCE,
): Worker {
  const worker = new Worker(
    queueName,
    async (job: Job) => {
      const { name, data, id } = job;
      log("INFO", `Processing attendance queue event [${name}] id=${id}`, {
        jobId: id,
        eventType: name,
        aggregateId: data?.attendanceId || data?.memberId,
        branchId: data?.branchId,
      });

      // Dispatch specific domain event actions
      switch (name) {
        case "attendance.checked_in": {
          log("INFO", `Processed attendance.checked_in for member ${data?.memberId}`);
          break;
        }
        case "attendance.checked_out": {
          log("INFO", `Processed attendance.checked_out for member ${data?.memberId}`, {
            durationMinutes: data?.durationMinutes,
            source: data?.source,
          });
          break;
        }
        case "attendance.rejected": {
          log("WARN", `Attendance scan rejected audit log`, {
            rejectionCode: data?.rejectionCode,
            branchId: data?.branchId,
          });
          break;
        }
        case "attendance.milestone_reached": {
          log("INFO", `Member attendance milestone reached!`, {
            memberId: data?.memberId,
            milestoneType: data?.milestoneType,
            milestoneValue: data?.milestoneValue,
          });
          break;
        }
        default: {
          log("WARN", `Unrecognized attendance event type: ${name}`, { jobId: id });
        }
      }

      return {
        processed: true,
        eventType: name,
        completedAt: new Date().toISOString(),
      };
    },
    {
      connection: redisConnection,
      concurrency: concurrency || APP_CONFIG.DEFAULT_WORKER_CONCURRENCY,
    },
  );

  worker.on("completed", (job) => {
    log("INFO", `Attendance job completed: id=${job?.id} name=${job?.name}`);
  });

  worker.on("failed", (job, err) => {
    log("ERROR", `Attendance job failed: id=${job?.id} name=${job?.name}`, {
      error: err.message,
    });
  });

  return worker;
}
