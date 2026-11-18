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

export const AUTH_CONFIG = {
  ACCESS_TOKEN_EXPIRY: "15m",
  ACCESS_TOKEN_EXPIRY_SECONDS: 15 * 60, // 900 seconds
  REFRESH_TOKEN_EXPIRY_DAYS: 7,
  REFRESH_TOKEN_EXPIRY_SECONDS: 7 * 24 * 60 * 60, // 604,800 seconds
  PASSWORD_RESET_EXPIRY_HOURS: 1,
  EMAIL_VERIFICATION_EXPIRY_HOURS: 24,
  COOKIE_ACCESS_TOKEN: "gymos_access_token",
  COOKIE_REFRESH_TOKEN: "gymos_refresh_token",
  ARGON2_OPTIONS: {
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
  },
} as const;
