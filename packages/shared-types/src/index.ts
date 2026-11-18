/**
 * GymOS Shared Types & Domain Contracts
 */

export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ORG_OWNER = "ORG_OWNER",
  ORG_STAFF = "ORG_STAFF",
  TRAINER = "TRAINER",
  MEMBER = "MEMBER",
}

export enum TenantStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  TRIAL = "TRIAL",
  CANCELLED = "CANCELLED",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  PENDING_VERIFICATION = "PENDING_VERIFICATION",
}

export const HTTP_HEADERS = {
  CORRELATION_ID: "x-correlation-id",
  REQUEST_ID: "x-request-id",
  ORGANIZATION_ID: "x-organization-id",
} as const;

export interface ServiceHealthStatus {
  status: "up" | "down";
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: ServiceHealthStatus;
    redis: ServiceHealthStatus;
  };
}

export interface ApiResponse<T = unknown> {
  success: true;
  statusCode: number;
  data: T;
  timestamp: string;
  correlationId: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  correlationId: string;
  path: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AuthenticatedUserContext {
  id: string;
  email: string;
  organizationId?: string;
  role: UserRole;
}
