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

/**
 * SuperAdmin Organization Provisioning Schema
 */
export const createOrganizationSchema = z.object({
  name: z.string().min(2, 'Organization name must be at least 2 characters').max(255),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase alphanumeric characters and hyphens')
    .optional(),
  legalName: z.string().max(255).optional().nullable(),
  businessEmail: z.string().email('Invalid business email').optional().nullable(),
  businessPhone: z.string().max(50).optional().nullable(),
  website: z.string().url('Invalid website URL').max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  timezone: z.string().max(50).optional().default('UTC'),
  currency: z.string().max(10).optional().default('INR'),
  adminEmail: z.string().email('Invalid admin email address'),
  adminFirstName: z.string().min(1, 'Admin first name is required').max(100),
  adminLastName: z.string().min(1, 'Admin last name is required').max(100),
  adminPassword: z.string().min(8, 'Password must be at least 8 characters').optional().default('Password@123'),
  initialBranchName: z.string().min(2).max(255).optional(),
  initialBranchCode: z.string().min(2).max(50).optional(),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/**
 * Stage 2.4: Member Management Validation Schemas
 */
export const memberStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED']);
export type MemberStatusType = z.infer<typeof memberStatusEnum>;

export const genderEnum = z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY']);
export type GenderType = z.infer<typeof genderEnum>;

export const createMemberSchema = z.object({
  branchId: z.string().uuid('Invalid branch ID format'),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  preferredName: z.string().max(100).optional().nullable(),
  gender: genderEnum.optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().min(5, 'Phone number must be at least 5 digits').max(50),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  emergencyContactName: z.string().max(100).optional().nullable(),
  emergencyContactPhone: z.string().max(50).optional().nullable(),
  emergencyContactRelationship: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  joinedAt: z.string().optional().nullable(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;

export const updateMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100).optional(),
  lastName: z.string().min(1, 'Last name is required').max(100).optional(),
  preferredName: z.string().max(100).optional().nullable(),
  gender: genderEnum.optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  phone: z.string().min(5, 'Phone number must be at least 5 digits').max(50).optional(),
  addressLine1: z.string().max(255).optional().nullable(),
  addressLine2: z.string().max(255).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  emergencyContactName: z.string().max(100).optional().nullable(),
  emergencyContactPhone: z.string().max(50).optional().nullable(),
  emergencyContactRelationship: z.string().max(50).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

export const updateMemberStatusSchema = z.object({
  status: memberStatusEnum,
  reason: z.string().max(255).optional().nullable(),
});

export type UpdateMemberStatusInput = z.infer<typeof updateMemberStatusSchema>;

export const transferMemberSchema = z.object({
  targetBranchId: z.string().uuid('Invalid target branch ID format'),
  reason: z.string().max(255).optional().nullable(),
});

export type TransferMemberInput = z.infer<typeof transferMemberSchema>;

export const archiveMemberSchema = z.object({
  reason: z.string().max(255).optional().nullable(),
});

export type ArchiveMemberInput = z.infer<typeof archiveMemberSchema>;

export const memberQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  branchId: z.string().uuid('Invalid branch ID format').optional().or(z.literal('')),
  status: memberStatusEnum.optional(),
  sortBy: z.enum(['createdAt', 'firstName', 'lastName', 'memberNumber', 'joinedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type MemberQueryInput = z.infer<typeof memberQuerySchema>;

/**
 * Stage 2.5: Membership Plans & Subscriptions Validation Schemas
 */
export const planDurationTypeEnum = z.enum(['DAYS', 'MONTHS', 'YEARS']);
export type PlanDurationTypeValue = z.infer<typeof planDurationTypeEnum>;

export const planScopeEnum = z.enum(['SINGLE_BRANCH', 'MULTI_BRANCH', 'ALL_BRANCHES']);
export type PlanScopeValue = z.infer<typeof planScopeEnum>;

export const planStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);
export type PlanStatusValue = z.infer<typeof planStatusEnum>;

export const membershipStatusEnum = z.enum(['PENDING', 'ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELLED', 'TERMINATED']);
export type MembershipStatusValue = z.infer<typeof membershipStatusEnum>;

export const freezeStatusEnum = z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']);
export type FreezeStatusValue = z.infer<typeof freezeStatusEnum>;

export const createMembershipPlanSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters').max(150),
  code: z
    .string()
    .min(2, 'Plan code must be at least 2 characters')
    .max(50)
    .regex(/^[a-zA-Z0-9-_]+$/, 'Plan code must be alphanumeric with dashes or underscores')
    .transform((val) => val.toUpperCase().trim()),
  description: z.string().max(1000).optional().nullable(),
  durationType: planDurationTypeEnum.default('MONTHS'),
  durationValue: z.coerce.number().int().positive('Duration value must be greater than 0'),
  price: z.coerce.number().nonnegative('Price cannot be negative'),
  registrationFee: z.coerce.number().nonnegative().default(0),
  currency: z.string().max(10).default('INR'),
  scope: planScopeEnum.default('SINGLE_BRANCH'),
  branchIds: z.array(z.string().uuid()).optional(),
  maxFreezeDays: z.coerce.number().int().nonnegative().default(0),
  maxFreezes: z.coerce.number().int().nonnegative().default(0),
  gracePeriodDays: z.coerce.number().int().nonnegative().default(0),
  features: z.array(z.string()).optional().default([]),
});

export type CreateMembershipPlanInput = z.infer<typeof createMembershipPlanSchema>;

export const updateMembershipPlanSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(1000).optional().nullable(),
  durationType: planDurationTypeEnum.optional(),
  durationValue: z.coerce.number().int().positive().optional(),
  price: z.coerce.number().nonnegative().optional(),
  registrationFee: z.coerce.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),
  scope: planScopeEnum.optional(),
  branchIds: z.array(z.string().uuid()).optional(),
  maxFreezeDays: z.coerce.number().int().nonnegative().optional(),
  maxFreezes: z.coerce.number().int().nonnegative().optional(),
  gracePeriodDays: z.coerce.number().int().nonnegative().optional(),
  features: z.array(z.string()).optional(),
});

export type UpdateMembershipPlanInput = z.infer<typeof updateMembershipPlanSchema>;

export const updatePlanStatusSchema = z.object({
  status: planStatusEnum,
});

export type UpdatePlanStatusInput = z.infer<typeof updatePlanStatusSchema>;

export const assignMembershipSchema = z.object({
  memberId: z.string().uuid('Invalid member ID format'),
  planId: z.string().uuid('Invalid plan ID format'),
  homeBranchId: z.string().uuid('Invalid branch ID format'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
  discountAmount: z.coerce.number().nonnegative().default(0),
  discountReason: z.string().max(255).optional().nullable(),
  taxRate: z.coerce.number().nonnegative().max(100).default(0),
  notes: z.string().max(1000).optional().nullable(),
  autoRenew: z.boolean().default(false),
});

export type AssignMembershipInput = z.infer<typeof assignMembershipSchema>;

export const renewMembershipSchema = z.object({
  planId: z.string().uuid('Invalid plan ID format').optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format').optional(),
  discountAmount: z.coerce.number().nonnegative().default(0),
  discountReason: z.string().max(255).optional().nullable(),
  taxRate: z.coerce.number().nonnegative().max(100).default(0),
  notes: z.string().max(1000).optional().nullable(),
  autoRenew: z.boolean().optional(),
});

export type RenewMembershipInput = z.infer<typeof renewMembershipSchema>;

export const freezeMembershipSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be in YYYY-MM-DD format').optional().nullable(),
  reason: z.string().max(255).optional().nullable(),
});

export type FreezeMembershipInput = z.infer<typeof freezeMembershipSchema>;

export const thawMembershipSchema = z.object({
  thawDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Thaw date must be in YYYY-MM-DD format').optional(),
  reason: z.string().max(255).optional().nullable(),
});

export type ThawMembershipInput = z.infer<typeof thawMembershipSchema>;

export const cancelMembershipSchema = z.object({
  reason: z.string().min(2, 'Cancellation reason is required').max(255),
});

export type CancelMembershipInput = z.infer<typeof cancelMembershipSchema>;

export const planQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  status: planStatusEnum.optional(),
  scope: planScopeEnum.optional(),
  branchId: z.string().uuid('Invalid branch ID').optional().or(z.literal('')),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'name', 'price', 'durationValue']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type PlanQueryInput = z.infer<typeof planQuerySchema>;

export const subscriptionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: membershipStatusEnum.optional(),
  memberId: z.string().uuid().optional().or(z.literal('')),
  planId: z.string().uuid().optional().or(z.literal('')),
  branchId: z.string().uuid().optional().or(z.literal('')),
  search: z.string().optional(),
  expiringInDays: z.coerce.number().int().positive().optional(),
  sortBy: z.enum(['createdAt', 'startDate', 'endDate', 'finalPrice', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type SubscriptionQueryInput = z.infer<typeof subscriptionQuerySchema>;



