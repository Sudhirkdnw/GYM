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

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PARTIALLY_PAID = 'PARTIALLY_PAID',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  VOID = 'VOID',
  REFUNDED = 'REFUNDED',
}

export enum InvoiceItemType {
  MEMBERSHIP = 'MEMBERSHIP',
  REGISTRATION_FEE = 'REGISTRATION_FEE',
  PERSONAL_TRAINING = 'PERSONAL_TRAINING',
  SERVICE = 'SERVICE',
  MERCHANDISE = 'MERCHANDISE',
  CUSTOM = 'CUSTOM',
}

export enum PaymentMethod {
  CASH = 'CASH',
  UPI = 'UPI',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  CHEQUE = 'CHEQUE',
  MEMBER_CREDIT = 'MEMBER_CREDIT',
  OTHER = 'OTHER',
}

export enum PaymentStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
  REVERSED = 'REVERSED',
}

export enum AllocationStatus {
  ACTIVE = 'ACTIVE',
  PARTIALLY_REVERSED = 'PARTIALLY_REVERSED',
  REVERSED = 'REVERSED',
}

export enum RefundStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  FAILED = 'FAILED',
}

export enum CreditEntryType {
  CREDIT_FROM_OVERPAYMENT = 'CREDIT_FROM_OVERPAYMENT',
  CREDIT_ADJUSTMENT = 'CREDIT_ADJUSTMENT',
  CREDIT_APPLIED = 'CREDIT_APPLIED',
  CREDIT_REFUND = 'CREDIT_REFUND',
  CREDIT_REVERSAL = 'CREDIT_REVERSAL',
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

  // Stage 2.6: Billing, Invoices & Payments Permissions
  INVOICE_READ = 'invoice.read',
  INVOICE_CREATE = 'invoice.create',
  INVOICE_VOID = 'invoice.void',
  PAYMENT_READ = 'payment.read',
  PAYMENT_RECORD = 'payment.record',
  PAYMENT_REFUND = 'payment.refund',
  PAYMENT_ALLOCATION_MANAGE = 'payment_allocation.manage',
  MEMBER_CREDIT_READ = 'member_credit.read',
  MEMBER_CREDIT_MANAGE = 'member_credit.manage',
  FINANCIAL_REPORT_READ = 'financial_report.read',

  // Stage 2.7: Attendance Management & QR Check-In Permissions
  ATTENDANCE_READ = 'attendance.read',
  ATTENDANCE_CHECKIN = 'attendance.checkin',
  ATTENDANCE_MANUAL = 'attendance.manual',
  ATTENDANCE_CHECKOUT = 'attendance.checkout',
  ATTENDANCE_FLOOR_READ = 'attendance.floor.read',
  ATTENDANCE_SETTINGS_MANAGE = 'attendance.settings.manage',
  ATTENDANCE_PASS_MANAGE = 'attendance.pass.manage',

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
    Permission.INVOICE_READ,
    Permission.INVOICE_CREATE,
    Permission.INVOICE_VOID,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_RECORD,
    Permission.PAYMENT_REFUND,
    Permission.PAYMENT_ALLOCATION_MANAGE,
    Permission.MEMBER_CREDIT_READ,
    Permission.MEMBER_CREDIT_MANAGE,
    Permission.FINANCIAL_REPORT_READ,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_CHECKIN,
    Permission.ATTENDANCE_MANUAL,
    Permission.ATTENDANCE_CHECKOUT,
    Permission.ATTENDANCE_FLOOR_READ,
    Permission.ATTENDANCE_SETTINGS_MANAGE,
    Permission.ATTENDANCE_PASS_MANAGE,
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
    Permission.INVOICE_READ,
    Permission.INVOICE_CREATE,
    Permission.INVOICE_VOID,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_RECORD,
    Permission.PAYMENT_REFUND,
    Permission.PAYMENT_ALLOCATION_MANAGE,
    Permission.MEMBER_CREDIT_READ,
    Permission.MEMBER_CREDIT_MANAGE,
    Permission.FINANCIAL_REPORT_READ,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_CHECKIN,
    Permission.ATTENDANCE_MANUAL,
    Permission.ATTENDANCE_CHECKOUT,
    Permission.ATTENDANCE_FLOOR_READ,
    Permission.ATTENDANCE_SETTINGS_MANAGE,
    Permission.ATTENDANCE_PASS_MANAGE,
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
    Permission.ORGANIZATION_PAYMENTS_READ,
    Permission.ORGANIZATION_PAYMENTS_MANAGE,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
    Permission.MEMBERSHIP_PLAN_READ,
    Permission.MEMBER_SUBSCRIPTION_READ,
    Permission.MEMBER_SUBSCRIPTION_ASSIGN,
    Permission.MEMBER_SUBSCRIPTION_RENEW,
    Permission.MEMBER_SUBSCRIPTION_FREEZE,
    Permission.INVOICE_READ,
    Permission.INVOICE_CREATE,
    Permission.PAYMENT_READ,
    Permission.PAYMENT_RECORD,
    Permission.MEMBER_CREDIT_READ,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_CHECKIN,
    Permission.ATTENDANCE_MANUAL,
    Permission.ATTENDANCE_CHECKOUT,
    Permission.ATTENDANCE_FLOOR_READ,
    Permission.ATTENDANCE_PASS_MANAGE,
  ],
  [UserRole.TRAINER]: [
    Permission.ORGANIZATION_DASHBOARD_READ,
    Permission.ORGANIZATION_BRANCHES_READ,
    Permission.ORGANIZATION_MEMBERS_READ,
    Permission.MEMBER_READ,
    Permission.ORGANIZATION_ATTENDANCE_READ,
    Permission.ATTENDANCE_READ,
    Permission.ATTENDANCE_FLOOR_READ,
    Permission.MEMBER_PROFILE_READ,
    Permission.MEMBER_PROFILE_UPDATE,
    Permission.MEMBERSHIP_PLAN_READ,
    Permission.MEMBER_SUBSCRIPTION_READ,
  ],
  [UserRole.MEMBER]: [
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

// Stage 2.6: Billing, Invoices & Payments Interfaces
export interface InvoiceSnapshotSupplier {
  legalName: string;
  tradeName?: string;
  branchName: string;
  addressLine1?: string;
  city?: string;
  state: string;
  stateCode: string;
  postalCode?: string;
  gstin?: string;
  pan?: string;
  phone?: string;
  email?: string;
}

export interface InvoiceSnapshotCustomer {
  memberId: string;
  memberNumber: string;
  name: string;
  email?: string;
  phone: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  postalCode?: string;
  recipientGstin?: string;
}

export interface InvoiceSnapshotTax {
  taxMode: 'EXCLUSIVE' | 'INCLUSIVE';
  isInterState: boolean;
  placeOfSupply: string;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
}

export interface InvoiceItemData {
  id: string;
  organizationId: string;
  invoiceId: string;
  itemType: InvoiceItemType;
  description: string;
  sacHsnCode?: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxableAmount: number;
  taxRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  taxAmount: number;
  totalAmount: number;
  membershipId?: string | null;
  createdAt: string;
}

export interface InvoiceData {
  id: string;
  organizationId: string;
  branchId: string;
  memberId: string;
  invoiceNumber: string;
  financialYear: string;
  sequenceNumber: number;
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  discountAmount: number;
  discountReason?: string | null;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  cessAmount: number;
  totalTaxAmount: number;
  totalAmount: number;
  allocatedAmount: number;
  paidAmount?: number;
  balanceDue: number;
  status: InvoiceStatus;
  supplierSnapshot: InvoiceSnapshotSupplier;
  customerSnapshot: InvoiceSnapshotCustomer;
  taxSnapshot: InvoiceSnapshotTax;
  placeOfSupply: string;
  notes?: string | null;
  terms?: string | null;
  createdById: string;
  voidedAt?: string | null;
  voidReason?: string | null;
  voidedById?: string | null;
  createdAt: string;
  updatedAt: string;
  member?: {
    id: string;
    memberNumber: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
  };
  branch?: {
    id: string;
    name: string;
    branchCode: string;
  };
}

export interface InvoiceDetailData extends InvoiceData {
  items: InvoiceItemData[];
  allocations: PaymentAllocationData[];
}

export interface PaymentAllocationData {
  id: string;
  organizationId: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  status: AllocationStatus;
  allocatedAt: string;
  createdAt: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    balanceDue: number;
    status: InvoiceStatus;
  };
  reversals?: PaymentAllocationReversalData[];
}

export interface PaymentAllocationReversalData {
  id: string;
  organizationId: string;
  allocationId: string;
  refundId?: string | null;
  amount: number;
  reason: string;
  reversedById: string;
  idempotencyKey?: string | null;
  createdAt: string;
}

export interface PaymentData {
  id: string;
  organizationId: string;
  branchId: string;
  memberId: string;
  paymentNumber: string;
  receiptNumber?: string;
  financialYear: string;
  sequenceNumber: number;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string | null;
  bankName?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  paidAt: string;
  collectedById: string;
  idempotencyKey?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  member?: {
    id: string;
    memberNumber: string;
    firstName: string;
    lastName: string;
    phone: string;
  };
  branch?: {
    id: string;
    name: string;
    branchCode: string;
  };
}

export interface PaymentDetailData extends PaymentData {
  allocatedAmount?: number;
  unallocatedAmount?: number;
  refundedAmount?: number;
  allocations: PaymentAllocationData[];
  refunds: RefundData[];
}

export interface RefundData {
  id: string;
  organizationId: string;
  paymentId: string;
  refundNumber: string;
  financialYear: string;
  sequenceNumber: number;
  amount: number;
  method: PaymentMethod;
  reason: string;
  reference?: string | null;
  status: RefundStatus;
  initiatedById: string;
  approvedById?: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
  updatedAt: string;
  reversals?: PaymentAllocationReversalData[];
}

export interface MemberCreditAccountData {
  id: string;
  organizationId: string;
  memberId: string;
  currency: string;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
  member?: MemberData;
}

export interface MemberCreditEntryData {
  id: string;
  organizationId: string;
  creditAccountId: string;
  entryType: CreditEntryType;
  amount: number;
  balanceBefore?: number;
  balanceAfter?: number;
  referenceType?: string | null;
  referenceId?: string | null;
  description: string;
  idempotencyKey?: string | null;
  createdById: string;
  createdAt: string;
}

export interface FinancialKpiData {
  todayCollections: number;
  mtdCollections: number;
  totalOutstandingDues: number;
  activeInvoicesCount: number;
  paidInvoicesCount: number;
  overdueInvoicesCount: number;
}

export interface DuesAgingBucketData {
  bucket: '0-30' | '31-60' | '60+';
  amount: number;
  invoiceCount: number;
}

export interface OutstandingDuesSummaryData {
  totalDues: number;
  agingBuckets: DuesAgingBucketData[];
  memberDues: Array<{
    memberId: string;
    memberName: string;
    memberNumber: string;
    phone: string;
    branchName: string;
    totalDue: number;
    oldestDueDate: string;
    invoiceCount: number;
  }>;
}

export interface PaymentMethodDistributionData {
  method: PaymentMethod;
  totalAmount: number;
  count: number;
  percentage: number;
}

export interface BranchPerformanceData {
  branchId: string;
  branchName: string;
  branchCode: string;
  collections: number;
  dues: number;
  invoicesCount: number;
}

/**
 * Stage 2.7: Attendance Management & QR Check-In Contracts
 */

export enum AttendanceMethod {
  QR_SCAN = 'QR_SCAN',
  MANUAL_STAFF = 'MANUAL_STAFF',
  KIOSK = 'KIOSK',
  RFID_CARD = 'RFID_CARD',
}

export enum AttendanceStatus {
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  AUTO_CHECKED_OUT = 'AUTO_CHECKED_OUT',
  CANCELLED = 'CANCELLED',
}

export enum PassStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  REVOKED = 'REVOKED',
}

export interface AttendanceRecordData {
  id: string;
  organizationId: string;
  branchId: string;
  branchName?: string;
  memberId: string;
  memberNumber: string;
  memberName: string;
  memberPhotoUrl?: string | null;
  membershipId?: string | null;
  planName?: string | null;
  checkInTime: string;
  checkOutTime?: string | null;
  durationMinutes?: number | null;
  method: AttendanceMethod;
  status: AttendanceStatus;
  verifiedById?: string | null;
  verifiedByName?: string | null;
  notes?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberAccessPassData {
  id: string;
  organizationId: string;
  memberId: string;
  passCodeMasked?: string | null;
  status: PassStatus;
  issuedAt: string;
  revokedAt?: string | null;
  revocationReason?: string | null;
  lastScannedAt?: string | null;
  lastScannedBranchId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceSettingsData {
  id: string;
  organizationId: string;
  branchId?: string | null;
  allowCheckInWithDues: boolean;
  maxOverdueGraceDays: number;
  cooldownMinutes: number;
  requireCheckOut: boolean;
  autoCheckOutHours: number;
  operatingHoursStart: string;
  operatingHoursEnd: string;
  allowOffHoursCheckIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceOutboxEventData {
  id: string;
  organizationId: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  retryCount: number;
  lastError?: string | null;
  processedAt?: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInRequest {
  branchId: string;
  qrToken: string;
  method?: AttendanceMethod;
  notes?: string;
}

export interface ManualCheckInRequest {
  branchId: string;
  memberId: string;
  notes?: string;
}

export interface CheckInResponse {
  success: boolean;
  record?: AttendanceRecordData;
  member: {
    id: string;
    memberNumber: string;
    firstName: string;
    lastName: string;
    photoUrl?: string | null;
    phone: string;
  };
  membership?: {
    id: string;
    planName: string;
    endDate: string;
    daysRemaining: number;
  } | null;
  duesNotice?: {
    hasDues: boolean;
    overdueAmount: number;
    invoiceNumber?: string;
  } | null;
  rejectionCode?: string;
  rejectionReason?: string;
}

export interface CheckOutRequest {
  attendanceId: string;
  notes?: string;
}

export interface CheckOutResponse {
  success: boolean;
  record: AttendanceRecordData;
  durationMinutes: number;
}

export interface AttendanceRecordFilters {
  branchId?: string;
  memberId?: string;
  status?: AttendanceStatus;
  method?: AttendanceMethod;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AttendanceFloorSummary {
  currentCount: number;
  capacity?: number;
  activeSessions: AttendanceRecordData[];
  peakTodayCount: number;
  totalCheckInsToday: number;
}

export interface AttendanceSettingsUpdate {
  branchId?: string | null;
  allowCheckInWithDues?: boolean;
  maxOverdueGraceDays?: number;
  cooldownMinutes?: number;
  requireCheckOut?: boolean;
  autoCheckOutHours?: number;
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  allowOffHoursCheckIn?: boolean;
}

export interface PassIssueRequest {
  generatePhysicalBadge?: boolean;
}

export interface PassRevokeRequest {
  reason: string;
  issueReplacement?: boolean;
}

export interface DynamicPassTokenResponse {
  token: string;
  expiresAt: string;
  refreshIntervalSeconds: number;
}

export interface AttendanceAnalyticsData {
  hourlyDistribution: { hour: number; count: number }[];
  dayOfWeekDistribution: { day: string; count: number }[];
  topAttendees: { memberId: string; name: string; memberNumber: string; visitCount: number }[];
  averageVisitDurationMinutes: number;
}

export interface PublicPassResponse {
  member: {
    firstName: string;
    memberNumber: string;
    photoUrl?: string | null;
  };
  pass: {
    status: PassStatus;
    passCodeMasked?: string | null;
  };
  dynamicToken: DynamicPassTokenResponse;
}

/**
 * Evaluates whether a local time string ('HH:mm') falls within operating hours.
 * Handles normal daytime windows, overnight windows (e.g. 20:00 - 06:00), and 24-hour operation (start === end).
 */
export function isWithinOperatingHours(
  localTime: string,
  start: string,
  end: string,
): boolean {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const current = toMinutes(localTime);
  const s = toMinutes(start);
  const e = toMinutes(end);

  if (s === e) {
    return true; // 24-hour operation
  }

  if (s < e) {
    // Normal window within same day (e.g. 05:00 - 23:00)
    return current >= s && current <= e;
  } else {
    // Overnight window (e.g. 20:00 - 06:00)
    return current >= s || current <= e;
  }
}

/**
 * Returns formatted local time ('HH:mm') and local date ('YYYY-MM-DD') for a given UTC Date and IANA timezone.
 * Gracefully falls back to UTC if timezone is invalid or unrecognized.
 */
export function getLocalTimeAndDate(
  utcDate: Date,
  timeZone: string,
): { localDate: string; localTime: string } {
  try {
    const timeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const localTime = timeFormatter.format(utcDate);

    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const localDate = dateFormatter.format(utcDate);

    return { localDate, localTime };
  } catch {
    // Fallback to UTC
    const localTime = utcDate.toISOString().slice(11, 16);
    const localDate = utcDate.toISOString().slice(0, 10);
    return { localDate, localTime };
  }
}




