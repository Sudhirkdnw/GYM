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

export enum MemberStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  ARCHIVED = 'ARCHIVED',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export enum PlanDurationType {
  DAYS = 'DAYS',
  MONTHS = 'MONTHS',
  YEARS = 'YEARS',
}

export enum PlanScope {
  SINGLE_BRANCH = 'SINGLE_BRANCH',
  MULTI_BRANCH = 'MULTI_BRANCH',
  ALL_BRANCHES = 'ALL_BRANCHES',
}

export enum PlanStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  ARCHIVED = 'ARCHIVED',
}

export enum MembershipStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
  TERMINATED = 'TERMINATED',
}

export enum FreezeStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum OutboxStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PUBLISHED = 'PUBLISHED',
  FAILED = 'FAILED',
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

  // Stage 2.4: Granular Member Management Permissions
  MEMBER_READ = 'member.read',
  MEMBER_CREATE = 'member.create',
  MEMBER_UPDATE = 'member.update',
  MEMBER_STATUS_MANAGE = 'member.status.manage',
  MEMBER_TRANSFER = 'member.transfer',
  MEMBER_ARCHIVE = 'member.archive',

  // Stage 2.5: Membership & Subscription Management Permissions
  MEMBERSHIP_PLAN_READ = 'membership_plan.read',
  MEMBERSHIP_PLAN_MANAGE = 'membership_plan.manage',
  MEMBER_SUBSCRIPTION_READ = 'member_subscription.read',
  MEMBER_SUBSCRIPTION_ASSIGN = 'member_subscription.assign',
  MEMBER_SUBSCRIPTION_RENEW = 'member_subscription.renew',
  MEMBER_SUBSCRIPTION_FREEZE = 'member_subscription.freeze',
  MEMBER_SUBSCRIPTION_CANCEL = 'member_subscription.cancel',

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
    Permission.MEMBER_READ,
    Permission.MEMBER_CREATE,
    Permission.MEMBER_UPDATE,
    Permission.MEMBER_STATUS_MANAGE,
    Permission.MEMBER_TRANSFER,
    Permission.MEMBER_ARCHIVE,
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
    Permission.MEMBERSHIP_PLAN_READ,
    Permission.MEMBERSHIP_PLAN_MANAGE,
    Permission.MEMBER_SUBSCRIPTION_READ,
    Permission.MEMBER_SUBSCRIPTION_ASSIGN,
    Permission.MEMBER_SUBSCRIPTION_RENEW,
    Permission.MEMBER_SUBSCRIPTION_FREEZE,
    Permission.MEMBER_SUBSCRIPTION_CANCEL,
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
    Permission.MEMBER_READ,
    Permission.MEMBER_CREATE,
    Permission.MEMBER_UPDATE,
    Permission.MEMBER_STATUS_MANAGE,
    Permission.MEMBER_TRANSFER,
    Permission.MEMBER_ARCHIVE,
    Permission.ORGANIZATION_MEMBERSHIPS_READ,
    Permission.ORGANIZATION_MEMBERSHIPS_MANAGE,
    Permission.ORGANIZATION_ATTENDANCE_READ,
    Permission.ORGANIZATION_ATTENDANCE_MANAGE,
    Permission.ORGANIZATION_PAYMENTS_READ,
    Permission.ORGANIZATION_PAYMENTS_MANAGE,
    Permission.ORGANIZATION_STAFF_READ,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
    Permission.MEMBERSHIP_PLAN_READ,
    Permission.MEMBERSHIP_PLAN_MANAGE,
    Permission.MEMBER_SUBSCRIPTION_READ,
    Permission.MEMBER_SUBSCRIPTION_ASSIGN,
    Permission.MEMBER_SUBSCRIPTION_RENEW,
    Permission.MEMBER_SUBSCRIPTION_FREEZE,
    Permission.MEMBER_SUBSCRIPTION_CANCEL,
  ],
  [UserRole.RECEPTIONIST]: [
    Permission.ORGANIZATION_DASHBOARD_READ,
    Permission.ORGANIZATION_BRANCHES_READ,
    Permission.ORGANIZATION_BRANCH_STAFF_READ,
    Permission.ORGANIZATION_MEMBERS_READ,
    Permission.ORGANIZATION_MEMBERS_MANAGE,
    Permission.MEMBER_READ,
    Permission.MEMBER_CREATE,
    Permission.MEMBER_UPDATE,
    Permission.MEMBER_STATUS_MANAGE,
    Permission.ORGANIZATION_MEMBERSHIPS_READ,
    Permission.ORGANIZATION_ATTENDANCE_READ,
    Permission.ORGANIZATION_ATTENDANCE_MANAGE,
    Permission.ORGANIZATION_PAYMENTS_READ,
    Permission.ORGANIZATION_PAYMENTS_MANAGE,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
    Permission.MEMBERSHIP_PLAN_READ,
    Permission.MEMBER_SUBSCRIPTION_READ,
    Permission.MEMBER_SUBSCRIPTION_ASSIGN,
    Permission.MEMBER_SUBSCRIPTION_RENEW,
    Permission.MEMBER_SUBSCRIPTION_FREEZE,
  ],
  [UserRole.TRAINER]: [
    Permission.ORGANIZATION_DASHBOARD_READ,
    Permission.ORGANIZATION_BRANCHES_READ,
    Permission.ORGANIZATION_MEMBERS_READ,
    Permission.MEMBER_READ,
    Permission.ORGANIZATION_ATTENDANCE_READ,
    Permission.ORGANIZATION_ATTENDANCE_MANAGE,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
    Permission.MEMBERSHIP_PLAN_READ,
    Permission.MEMBER_SUBSCRIPTION_READ,
  ],
  [UserRole.MEMBER]: [
    Permission.ORGANIZATION_ATTENDANCE_READ,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
    Permission.MEMBER_SUBSCRIPTION_READ,
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

export interface MemberData {
  id: string;
  organizationId: string;
  branchId: string;
  branchName?: string;
  userId?: string | null;
  memberNumber: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  gender?: Gender | null;
  dateOfBirth?: string | null;
  email?: string | null;
  phone: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  profilePhotoKey?: string | null;
  notes?: string | null;
  status: MemberStatus;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface MemberTransferData {
  id: string;
  organizationId: string;
  memberId: string;
  fromBranchId: string;
  fromBranchName?: string;
  toBranchId: string;
  toBranchName?: string;
  reason?: string | null;
  transferredBy: string;
  transferredByName?: string;
  transferredAt: string;
}

export interface MemberDetailData extends MemberData {
  transfers?: MemberTransferData[];
}

export interface MembershipPlanData {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  description?: string | null;
  durationType: PlanDurationType;
  durationValue: number;
  price: number;
  registrationFee: number;
  currency: string;
  scope: PlanScope;
  maxFreezeDays: number;
  maxFreezes: number;
  gracePeriodDays: number;
  features?: string[];
  status: PlanStatus;
  branchIds?: string[];
  createdAt: string;
  updatedAt: string;
  subscriberCount?: number;
}

export interface PricingSnapshotData {
  planId: string;
  planName: string;
  planCode: string;
  durationType: PlanDurationType;
  durationValue: number;
  basePrice: number;
  registrationFee: number;
  discountAmount: number;
  discountReason?: string | null;
  taxAmount: number;
  taxRate: number;
  finalPrice: number;
  currency: string;
  capturedAt: string;
}

export interface MemberMembershipData {
  id: string;
  organizationId: string;
  memberId: string;
  memberName?: string;
  memberNumber?: string;
  planId: string;
  planName?: string;
  planCode?: string;
  homeBranchId: string;
  homeBranchName?: string;
  startDate: string;
  endDate: string;
  originalEndDate: string;
  basePrice: number;
  registrationFee: number;
  discountAmount: number;
  discountReason?: string | null;
  taxAmount: number;
  taxRate: number;
  finalPrice: number;
  currency: string;
  pricingSnapshot: PricingSnapshotData;
  totalFreezeDaysUsed: number;
  freezeCount: number;
  renewalCount: number;
  previousMembershipId?: string | null;
  status: MembershipStatus;
  autoRenew: boolean;
  notes?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  cancelledBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipFreezeData {
  id: string;
  organizationId: string;
  membershipId: string;
  startDate: string;
  endDate?: string | null;
  actualThawDate?: string | null;
  daysFrozen: number;
  reason?: string | null;
  status: FreezeStatus;
  frozenBy: string;
  thawedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipHistoryData {
  id: string;
  organizationId: string;
  membershipId: string;
  action: string;
  actorId?: string | null;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  reason?: string | null;
  timestamp: string;
}

export interface MembershipDetailData extends MemberMembershipData {
  freezes?: MembershipFreezeData[];
  history?: MembershipHistoryData[];
  plan?: MembershipPlanData;
}

