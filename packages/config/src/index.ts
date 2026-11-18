/**
 * GymOS Global System Configurations & Constants
 */

export const APP_CONFIG = {
  NAME: "GymOS",
  API_PREFIX: "api",
  API_VERSION: "v1",
  DEFAULT_API_PORT: 4000,
  DEFAULT_WEB_PORT: 3000,
  DEFAULT_WORKER_CONCURRENCY: 5,
} as const;

export const QUEUES = {
  NOTIFICATIONS: "gymos-notifications",
  AUDIT_LOGS: "gymos-audit-logs",
  BILLING: "gymos-billing",
  REPORTS: "gymos-reports",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const SECURITY_CONFIG = {
  CORS_ALLOWED_METHODS: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  CORS_ALLOWED_HEADERS: [
    "Content-Type",
    "Authorization",
    "x-correlation-id",
    "x-request-id",
    "x-organization-id",
  ],
  MAX_BODY_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
} as const;
