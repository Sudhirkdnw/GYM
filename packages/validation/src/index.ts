import { z } from 'zod';

/**
 * Common Environment Variables Schema
 */
export const nodeEnvSchema = z.enum(['development', 'production', 'test']).default('development');

export const apiEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  PORT: z.coerce.number().default(4000),
  API_PREFIX: z.string().default('api'),
  DATABASE_URL: z.string().url().describe('PostgreSQL connection string'),
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(16).default('development-jwt-secret-min-16-chars-long'),
  JWT_REFRESH_SECRET: z.string().min(16).default('development-jwt-refresh-secret-min-16-chars-long'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(16).default('development-cookie-secret-min-16-chars-long'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export const workerEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
});

export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export const webEnvSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000/api/v1'),
});

export type WebEnv = z.infer<typeof webEnvSchema>;

/**
 * Pagination Query Validation Schema
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ValidatedPaginationQuery = z.infer<typeof paginationQuerySchema>;

/**
 * Authentication DTO Validation Schemas
 */
export const registerUserSchema = z.object({
  email: z.string().email('Invalid email address').transform((val) => val.toLowerCase().trim()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  gymName: z.string().min(2, 'Gym name must be at least 2 characters').max(255).optional(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').transform((val) => val.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
  organizationId: z.string().uuid('Invalid organization ID format').optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').transform((val) => val.toLowerCase().trim()),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Invalid reset token'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(10, 'Invalid verification token'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const selectOrganizationSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID format'),
});

export type SelectOrganizationInput = z.infer<typeof selectOrganizationSchema>;

/**
 * Organization Profile & Settings Validation Schemas
 */
export const updateOrganizationProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(255).optional(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  legalName: z.string().max(255).nullable().optional(),
  businessEmail: z.string().email('Invalid email address').nullable().optional().or(z.literal('')),
  businessPhone: z.string().max(50).nullable().optional(),
  website: z.string().max(255).nullable().optional().or(z.literal('')),
  logoUrl: z.string().max(500).nullable().optional().or(z.literal('')),
  description: z.string().max(2000).nullable().optional(),
  addressLine1: z.string().max(255).nullable().optional(),
  addressLine2: z.string().max(255).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  timezone: z.string().max(50).optional(),
  currency: z.string().min(2).max(10).optional(),
});

export type UpdateOrganizationProfileInput = z.infer<typeof updateOrganizationProfileSchema>;

export const updateOrganizationSettingsSchema = z.object({
  timezone: z.string().max(50).optional(),
  currency: z.string().min(2).max(10).optional(),
});

export type UpdateOrganizationSettingsInput = z.infer<typeof updateOrganizationSettingsSchema>;

/**
 * Branch CRUD & Status Validation Schemas
 */
export const branchStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'CLOSED']);
export type BranchStatusType = z.infer<typeof branchStatusEnum>;

export const createBranchSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters').max(255),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  branchCode: z
    .string()
    .min(2, 'Branch code must be at least 2 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9-_]+$/, 'Branch code must be alphanumeric with underscores or hyphens')
    .transform((val) => val.toUpperCase().trim()),
  description: z.string().max(2000).optional().nullable(),
  email: z.string().email('Invalid branch email').optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  website: z.string().max(255).optional().nullable().or(z.literal('')),
  logoUrl: z.string().max(500).optional().nullable().or(z.literal('')),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  timezone: z.string().max(50).default('UTC'),
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export const updateBranchSchema = z.object({
  name: z.string().min(2, 'Branch name must be at least 2 characters').max(255).optional(),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .optional(),
  branchCode: z
    .string()
    .min(2, 'Branch code must be at least 2 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9-_]+$/, 'Branch code must be alphanumeric with underscores or hyphens')
    .transform((val) => val.toUpperCase().trim())
    .optional(),
  description: z.string().max(2000).optional().nullable(),
  email: z.string().email('Invalid branch email').optional().nullable().or(z.literal('')),
  phone: z.string().max(50).optional().nullable(),
  website: z.string().max(255).optional().nullable().or(z.literal('')),
  logoUrl: z.string().max(500).optional().nullable().or(z.literal('')),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  timezone: z.string().max(50).optional(),
});

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export const updateBranchStatusSchema = z.object({
  status: branchStatusEnum,
});

export type UpdateBranchStatusInput = z.infer<typeof updateBranchStatusSchema>;

export const branchQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  status: branchStatusEnum.optional(),
  city: z.string().optional(),
  state: z.string().optional(),
});

export type BranchQueryInput = z.infer<typeof branchQuerySchema>;

/**
 * Branch Staff Assignment Schemas
 */
export const assignBranchStaffSchema = z.object({
  organizationUserId: z.string().uuid('Invalid organization user ID format'),
});

export type AssignBranchStaffInput = z.infer<typeof assignBranchStaffSchema>;

export const selectBranchSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID format'),
});

export type SelectBranchInput = z.infer<typeof selectBranchSchema>;
