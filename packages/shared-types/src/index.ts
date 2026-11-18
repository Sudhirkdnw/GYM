/**
 * GymOS Shared Types, Domain Contracts & RBAC Permissions
 */

export enum UserRole {
  GYM_OWNER = 'GYM_OWNER',
  GYM_ADMIN = 'GYM_ADMIN',
  RECEPTIONIST = 'RECEPTIONIST',
  TRAINER = 'TRAINER',
  MEMBER = 'MEMBER',
}

export enum PlatformRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
}

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  TRIAL = 'TRIAL',
  CANCELLED = 'CANCELLED',
}

export enum BranchStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CLOSED = 'CLOSED',
}

export enum AssignmentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUSPENDED = 'SUSPENDED',
}

export const HTTP_HEADERS = {
  CORRELATION_ID: 'x-correlation-id',
  REQUEST_ID: 'x-request-id',
  ORGANIZATION_ID: 'x-organization-id',
} as const;

export enum Permission {
  PLATFORM_ACCESS = 'platform.access',
  PLATFORM_ORGANIZATIONS_READ = 'platform.organizations.read',
  PLATFORM_ORGANIZATIONS_MANAGE = 'platform.organizations.manage',
  PLATFORM_AUDIT_READ = 'platform.audit.read',

  ORGANIZATION_DASHBOARD_READ = 'organization.dashboard.read',
  ORGANIZATION_PROFILE_READ = 'organization.profile.read',
  ORGANIZATION_PROFILE_UPDATE = 'organization.profile.update',
  ORGANIZATION_SETTINGS_READ = 'organization.settings.read',
  ORGANIZATION_SETTINGS_MANAGE = 'organization.settings.manage',
  ORGANIZATION_SETTINGS_UPDATE = 'organization.settings.update',
  ORGANIZATION_BRANCHES_READ = 'organization.branches.read',
  ORGANIZATION_BRANCHES_CREATE = 'organization.branches.create',
  ORGANIZATION_BRANCHES_UPDATE = 'organization.branches.update',
  ORGANIZATION_BRANCHES_STATUS_MANAGE = 'organization.branches.status.manage',
  ORGANIZATION_BRANCH_STAFF_READ = 'organization.branch_staff.read',
  ORGANIZATION_BRANCH_STAFF_MANAGE = 'organization.branch_staff.manage',
  ORGANIZATION_MEMBERS_READ = 'organization.members.read',
  ORGANIZATION_MEMBERS_MANAGE = 'organization.members.manage',
  ORGANIZATION_MEMBERSHIPS_READ = 'organization.memberships.read',
  ORGANIZATION_MEMBERSHIPS_MANAGE = 'organization.memberships.manage',
  ORGANIZATION_ATTENDANCE_READ = 'organization.attendance.read',
  ORGANIZATION_ATTENDANCE_MANAGE = 'organization.attendance.manage',
  ORGANIZATION_PAYMENTS_READ = 'organization.payments.read',
  ORGANIZATION_PAYMENTS_MANAGE = 'organization.payments.manage',
  ORGANIZATION_STAFF_READ = 'organization.staff.read',
  ORGANIZATION_STAFF_MANAGE = 'organization.staff.manage',

  MEMBER_PROFILE_READ = 'member.profile.read',
  MEMBER_PROFILE_UPDATE = 'member.profile.update',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.GYM_OWNER]: [
    Permission.ORGANIZATION_DASHBOARD_READ,
    Permission.ORGANIZATION_PROFILE_READ,
    Permission.ORGANIZATION_PROFILE_UPDATE,
    Permission.ORGANIZATION_SETTINGS_READ,
    Permission.ORGANIZATION_SETTINGS_MANAGE,
    Permission.ORGANIZATION_SETTINGS_UPDATE,
    Permission.ORGANIZATION_BRANCHES_READ,
    Permission.ORGANIZATION_BRANCHES_CREATE,
    Permission.ORGANIZATION_BRANCHES_UPDATE,
    Permission.ORGANIZATION_BRANCHES_STATUS_MANAGE,
    Permission.ORGANIZATION_BRANCH_STAFF_READ,
    Permission.ORGANIZATION_BRANCH_STAFF_MANAGE,
    Permission.ORGANIZATION_MEMBERS_READ,
    Permission.ORGANIZATION_MEMBERS_MANAGE,
    Permission.ORGANIZATION_MEMBERSHIPS_READ,
    Permission.ORGANIZATION_MEMBERSHIPS_MANAGE,
    Permission.ORGANIZATION_ATTENDANCE_READ,
    Permission.ORGANIZATION_ATTENDANCE_MANAGE,
    Permission.ORGANIZATION_PAYMENTS_READ,
    Permission.ORGANIZATION_PAYMENTS_MANAGE,
    Permission.ORGANIZATION_STAFF_READ,
    Permission.ORGANIZATION_STAFF_MANAGE,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
  ],
  [UserRole.GYM_ADMIN]: [
    Permission.ORGANIZATION_DASHBOARD_READ,
    Permission.ORGANIZATION_PROFILE_READ,
    Permission.ORGANIZATION_SETTINGS_READ,
    Permission.ORGANIZATION_BRANCHES_READ,
    Permission.ORGANIZATION_BRANCHES_CREATE,
    Permission.ORGANIZATION_BRANCHES_UPDATE,
    Permission.ORGANIZATION_BRANCHES_STATUS_MANAGE,
    Permission.ORGANIZATION_BRANCH_STAFF_READ,
    Permission.ORGANIZATION_BRANCH_STAFF_MANAGE,
    Permission.ORGANIZATION_MEMBERS_READ,
    Permission.ORGANIZATION_MEMBERS_MANAGE,
    Permission.ORGANIZATION_MEMBERSHIPS_READ,
    Permission.ORGANIZATION_MEMBERSHIPS_MANAGE,
    Permission.ORGANIZATION_ATTENDANCE_READ,
    Permission.ORGANIZATION_ATTENDANCE_MANAGE,
    Permission.ORGANIZATION_PAYMENTS_READ,
    Permission.ORGANIZATION_PAYMENTS_MANAGE,
    Permission.ORGANIZATION_STAFF_READ,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
  ],
  [UserRole.RECEPTIONIST]: [
    Permission.ORGANIZATION_DASHBOARD_READ,
    Permission.ORGANIZATION_BRANCHES_READ,
    Permission.ORGANIZATION_BRANCH_STAFF_READ,
    Permission.ORGANIZATION_MEMBERS_READ,
    Permission.ORGANIZATION_MEMBERS_MANAGE,
    Permission.ORGANIZATION_MEMBERSHIPS_READ,
    Permission.ORGANIZATION_ATTENDANCE_READ,
    Permission.ORGANIZATION_ATTENDANCE_MANAGE,
    Permission.ORGANIZATION_PAYMENTS_READ,
    Permission.ORGANIZATION_PAYMENTS_MANAGE,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
  ],
  [UserRole.TRAINER]: [
    Permission.ORGANIZATION_DASHBOARD_READ,
    Permission.ORGANIZATION_BRANCHES_READ,
    Permission.ORGANIZATION_MEMBERS_READ,
    Permission.ORGANIZATION_ATTENDANCE_READ,
    Permission.ORGANIZATION_ATTENDANCE_MANAGE,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
  ],
  [UserRole.MEMBER]: [
    Permission.ORGANIZATION_ATTENDANCE_READ,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
  ],
};

export const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  Permission.PLATFORM_ACCESS,
  Permission.PLATFORM_ORGANIZATIONS_READ,
  Permission.PLATFORM_ORGANIZATIONS_MANAGE,
  Permission.PLATFORM_AUDIT_READ,
];

export interface ServiceHealthStatus {
  status: 'up' | 'down';
  latencyMs: number;
  message?: string;
  details?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'error';
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
  sortOrder?: 'asc' | 'desc';
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
  firstName: string;
  lastName: string;
  isSuperAdmin: boolean;
  organizationId?: string;
  role?: UserRole;
  permissions?: Permission[];
}

export interface OrganizationProfile {
  id: string;
  name: string;
  slug: string;
  legalName?: string | null;
  businessEmail?: string | null;
  businessPhone?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  description?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  timezone: string;
  currency: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  stats?: {
    totalBranches: number;
    activeBranches: number;
    inactiveBranches: number;
    totalStaff: number;
  };
}

export interface BranchData {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  branchCode: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  logoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  timezone: string;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
  staffCount?: number;
}

export interface BranchStaffAssignmentData {
  id: string;
  organizationId: string;
  branchId: string;
  organizationUserId: string;
  status: AssignmentStatus;
  assignedAt: string;
  assignedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  branch?: {
    id: string;
    name: string;
    branchCode: string;
    status: BranchStatus;
  };
}
