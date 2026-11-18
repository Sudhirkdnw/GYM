import { z } from "zod";

/**
 * Common Environment Variables Schema
 */
export const nodeEnvSchema = z
  .enum(["development", "production", "test"])
  .default("development");

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default("api"),
  DATABASE_URL: z.string().url().describe("PostgreSQL connection string"),
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  JWT_SECRET: z
    .string()
    .min(16)
    .default("development-jwt-secret-min-16-chars-long"),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000/api/v1"),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

/**
 * Pagination Query Validation Schema
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ValidatedPaginationQuery = z.infer<typeof paginationQuerySchema>;
