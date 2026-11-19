# GymOS — Stage 2.4 Implementation Plan: Gym Member Management

## 1. Executive Summary & Objective

**Stage 2.4 Goal**: Implement a production-grade, multi-tenant **Gym Member Management** module for GymOS.
This module establishes customer records (gym members) under tenant organizations and physical branches, providing member registration, directory listing, search, status lifecycles, and verified branch transfers.

### Strict Scope Boundaries:
- **Tenant Entity**: `organizations` table (`organization_id`).
- **Physical Location**: `branches` table (`branch_id`).
- **Decoupled Identity**: Gym members are **NOT** staff users and do **NOT** require a GymOS staff login or password.
- **Strictly Out of Scope**:
  - No membership plans or renewals (Stage 2.5).
  - No billing, invoices, or payment gateways (Stage 2.5/2.7).
  - No QR code or biometric attendance (Stage 2.6).
  - No workout plans, diet charts, trainer scheduling, WhatsApp CRM, or AI analytics.

---

## 2. Implementation Phasing & Sequence

### Phase 1: Shared Packages Definition
1. **`@gymos/shared-types`**:
   - Enums: `MemberStatus` (`ACTIVE`, `INACTIVE`, `SUSPENDED`, `ARCHIVED`), `Gender` (`MALE`, `FEMALE`, `OTHER`, `PREFER_NOT_TO_SAY`).
   - Permissions: `member.read`, `member.create`, `member.update`, `member.status.manage`, `member.transfer`, `member.archive`.
   - Update `ROLE_PERMISSIONS` matrix for `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST`, `TRAINER`, `MEMBER`.
   - Interfaces: `MemberData`, `MemberDetailData`, `MemberTransferData`.
2. **`@gymos/validation`**:
   - Zod schemas: `createMemberSchema`, `updateMemberSchema`, `updateMemberStatusSchema`, `transferMemberSchema`, `archiveMemberSchema`, `memberQuerySchema`.
   - Rebuild shared packages (`npm run build:packages`).

### Phase 2: Database Schema & Migration
1. Add `Member`, `MemberTransfer`, and `OrganizationMemberSequence` models to `apps/api/prisma/schema.prisma`.
2. Generate migration: `prisma migrate dev --name member_management_foundation`.
3. Add PostgreSQL engine-level protections:
   - `ENABLE ROW LEVEL SECURITY` & `FORCE ROW LEVEL SECURITY`.
   - Policies: `tenant_isolation_policy_members`, `tenant_isolation_policy_member_transfers`, `tenant_isolation_policy_member_sequences`.
   - Composite Foreign Keys:
     - `fk_members_branch_org`: `(organization_id, branch_id) REFERENCES branches(organization_id, id)`
     - `fk_transfers_from_branch_org`: `(organization_id, from_branch_id) REFERENCES branches(organization_id, id)`
     - `fk_transfers_to_branch_org`: `(organization_id, to_branch_id) REFERENCES branches(organization_id, id)`
   - Grant DML privileges to application role `gymos_user`.
4. Regenerate Prisma Client (`npm run db:generate`).

### Phase 3: Backend API Module (`apps/api/src/members`)
1. **`MembersService`**:
   - Atomic concurrency-safe member number generation (`MEM-XXXXX`).
   - Member creation bound to validated tenant & branch.
   - Server-side paginated directory with full-text search (name, phone, email, member number).
   - Single member profile retrieval with branch transfer history.
   - Member profile update.
   - Status transition state machine.
   - Branch transfer with audit trail.
   - Soft-archival workflow.
2. **`MembersController`**:
   - `POST /api/v1/members` (`@RequirePermissions(Permission.MEMBER_CREATE)`)
   - `GET /api/v1/members` (`@RequirePermissions(Permission.MEMBER_READ)`)
   - `GET /api/v1/members/:id` (`@RequirePermissions(Permission.MEMBER_READ)`)
   - `PATCH /api/v1/members/:id` (`@RequirePermissions(Permission.MEMBER_UPDATE)`)
   - `PATCH /api/v1/members/:id/status` (`@RequirePermissions(Permission.MEMBER_STATUS_MANAGE)`)
   - `POST /api/v1/members/:id/transfer` (`@RequirePermissions(Permission.MEMBER_TRANSFER)`)
   - `POST /api/v1/members/:id/archive` (`@RequirePermissions(Permission.MEMBER_ARCHIVE)`)
   - Guarded by `JwtAuthGuard`, `PermissionsGuard`, and `BranchContextGuard`.
3. **`MembersModule`**:
   - Registered in `AppModule`.

### Phase 4: Frontend Web Application (`apps/web/src`)
1. `apps/web/src/app/dashboard/members/page.tsx`: Member Directory with search, status filters, branch filter, and responsive grid.
2. `apps/web/src/app/dashboard/members/new/page.tsx`: Step-by-step Member Registration Form.
3. `apps/web/src/app/dashboard/members/[memberId]/page.tsx`: Member Details, Status Switcher, and Transfer Modal.
4. `apps/web/src/app/dashboard/members/[memberId]/edit/page.tsx`: Profile Editor.

### Phase 5: Automated E2E Testing Suite
- Create `apps/api/test/member-management.e2e-spec.ts`.
- Execute test cases covering registration, concurrency, pagination, search, transfer, status transitions, archive, cross-tenant isolation, and RLS integrity against live PostgreSQL database.

---

## 3. Risks & Mitigation

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| Race condition on member numbers | High (Duplicate key crash) | Implemented PostgreSQL row-locked sequence table (`ON CONFLICT DO UPDATE ... RETURNING`). |
| Staff accessing unassigned branch members | Critical (Security breach) | Reused `BranchContextService` & `BranchContextGuard` with DB-backed staff assignment validation. |
| Cross-tenant branch transfer | Critical (Data corruption) | Enforced composite foreign key `(organization_id, to_branch_id) REFERENCES branches(organization_id, id)`. |
| PII / Sensitive data leakage | Medium (Privacy) | Minimized required fields; no medical or biometric records collected at this stage. |

---

## 4. Acceptance Criteria & STOP Condition

### Acceptance Criteria:
1. 100% of new Stage 2.4 E2E tests pass against live PostgreSQL database.
2. Zero regressions across existing 110 tests (total expected: 135+ tests passing).
3. Monorepo builds cleanly with zero TypeScript errors and zero ESLint warnings.
4. All member records are strictly isolated by `organization_id` at PostgreSQL RLS layer.

> [!IMPORTANT]
> **STOP CONDITION ACTIVATED**:
> As directed in the specification, implementation of Stage 2.4 will NOT begin until the user reviews this architectural design and provides explicit approval.
