# GYMOS — STAGE 2.7 FINAL SECURITY, INTEGRATION & PRODUCTION READINESS AUDIT REPORT

**Audit Scope:** Complete Stage 2.7 — Attendance Management & QR Check-In System  
**Audit Baseline Commit:** `c1302e659314afecfbecb21d396c06eca2403e7a`  
**Previous Milestones:** Step 1 through Step 7  
**Audit Date:** 2026-11-20  
**Audit Mode:** READ-ONLY COMPREHENSIVE SECURITY & INTEGRATION AUDIT  
**Audit Decision:** **CONDITIONAL PASS** (No critical vulnerabilities; specific non-critical architectural findings and test improvements identified for remediation prior to Stage 3).

---

## 1. Audit Scope & Methodology

This audit evaluates the complete end-to-end attendance flow across the GymOS monorepo:
```
Browser QR Scanner / Public Mobile Pass
  → Next.js 14 App Router Frontend (`@gymos/web`)
  → NestJS 10 Attendance Controller (`@gymos/api`)
  → Authentication, RBAC & AsyncLocalStorage Context (`JwtAuthGuard`, `PermissionsGuard`, `TenantContextStore`)
  → Organization & Branch Validation (`BranchContextService`)
  → Authoritative 14-Step Check-In Validation Engine (`AttendanceService`)
  → PostgreSQL 16 & Row-Level Security (`RLS ENABLE + FORCE`)
  → Transactional Outbox Events (`attendance_outbox_events`)
  → BullMQ Background Worker (`@gymos/worker`)
  → Scheduled Automatic Checkout Processor (`AutoCheckoutProcessor`)
```

### Verification Methods:
1. **Source Code & AST Inspection:** Direct inspection of NestJS controllers, services, guards, Prisma migrations, SQL policies, BullMQ processors, and Next.js frontend components.
2. **Database & Schema Auditing:** Verification of PostgreSQL DDL, foreign key relationships, partial unique indices, RLS policies, and session variables.
3. **Automated Test Execution:** Execution of unit test suites, integration test suites, and end-to-end regression suites.
4. **Contract Cross-Check:** Deep comparison of frontend form state, API payloads, Swagger documentation, and database columns.

---

## 2. Files & Modules Inspected

- **Database & Migrations:**
  - `apps/api/prisma/schema.prisma`
  - `apps/api/prisma/migrations/20261123000000_attendance_and_qr_system/migration.sql`
- **Backend Core & Cryptography:**
  - `apps/api/src/attendance/attendance.controller.ts`
  - `apps/api/src/attendance/attendance.service.ts`
  - `apps/api/src/attendance/qr-token.service.ts`
  - `apps/api/src/attendance/physical-passcode.service.ts`
  - `apps/api/src/attendance/encryption/envelope-encryption.service.ts`
  - `apps/api/src/common/tenant/branch-context.service.ts`
  - `apps/api/src/common/auth/jwt-auth.guard.ts`
  - `apps/api/src/common/auth/permissions.guard.ts`
  - `apps/api/src/common/auth/current-tenant.decorator.ts`
- **Worker & Outbox Infrastructure:**
  - `apps/worker/src/attendance/auto-checkout.processor.ts`
  - `apps/worker/src/attendance/attendance-outbox.dispatcher.ts`
  - `apps/worker/src/attendance/attendance.worker.ts`
  - `apps/worker/src/main.ts`
- **Frontend Screens & Components:**
  - `apps/web/src/app/dashboard/attendance/page.tsx` (Live Floor)
  - `apps/web/src/app/dashboard/attendance/scanner/page.tsx` (Front-Desk Scanner)
  - `apps/web/src/app/dashboard/attendance/history/page.tsx` (Ledger & CSV)
  - `apps/web/src/app/dashboard/attendance/settings/page.tsx` (Settings)
  - `apps/web/src/app/pass/[passToken]/page.tsx` (Public Mobile Web Pass)
  - `apps/web/src/components/attendance/MemberPassCard.tsx` (Member Profile Pass Card)
  - `apps/web/src/components/attendance/ManualCheckInModal.tsx`
  - `apps/web/src/components/attendance/sound.ts`
  - `apps/web/src/components/attendance/AttendanceNav.tsx`
- **Shared Types & Validation:**
  - `packages/shared-types/src/index.ts`
  - `packages/validation/src/index.ts`

---

## 3. Database, Tenant Isolation & Row-Level Security (RLS)

### A. Attendance Tables & RLS Status

| Table Name | RLS Enabled | RLS Forced | Policy Name | Isolation Predicate |
| :--- | :---: | :---: | :--- | :--- |
| `member_access_passes` | **YES** | **YES** | `tenant_isolation_policy_member_access_passes` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` |
| `attendance_records` | **YES** | **YES** | `tenant_isolation_policy_attendance_records` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` |
| `attendance_settings` | **YES** | **YES** | `tenant_isolation_policy_attendance_settings` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` |
| `attendance_outbox_events` | **YES** | **YES** | `tenant_isolation_policy_attendance_outbox_events` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` |

### B. Security & Isolation Invariants
1. **FORCE ROW LEVEL SECURITY:** All four tables explicitly have `FORCE ROW LEVEL SECURITY` applied in migration `20261123000000_attendance_and_qr_system`. Table owners are strictly subject to tenant isolation rules.
2. **Zero SuperAdmin Bypass:** The attendance RLS policies contain zero bypass clauses (no `OR current_user = 'super_admin'`, no `BYPASSRLS`). SuperAdmin accounts attempting to access tenant attendance data receive HTTP 403 Forbidden.
3. **Transaction-Scoped Tenant Context:** Database transactions strictly invoke `SET LOCAL app.current_tenant_id = '${orgId}'`. Because `SET LOCAL` is bounded to the active PostgreSQL transaction block, connection reuse in pooled environments (e.g. PgBouncer / Prisma connection pool) cannot leak tenant context across requests.
4. **Composite Foreign Keys & Unique Constraints:**
   - `CONSTRAINT "unique_org_member_pass" UNIQUE ("organization_id", "member_id")`
   - `CREATE UNIQUE INDEX "idx_attendance_records_active_session" ON "attendance_records" ("organization_id", "member_id") WHERE "status" = 'CHECKED_IN'`
   - `CREATE UNIQUE INDEX "unique_org_default_attendance_settings" ON "attendance_settings" ("organization_id") WHERE "branch_id" IS NULL`
   - `CREATE UNIQUE INDEX "unique_org_branch_attendance_settings" ON "attendance_settings" ("organization_id", "branch_id") WHERE "branch_id" IS NOT NULL`
5. **Branch Authorization:** `BranchContextService.validateBranchAccess()` strictly checks `branch.organizationId === organizationId` inside tenant context. Non-owners / non-admins require an `ACTIVE` record in `branch_staff_assignments`. Inactive or closed branches are rejected with HTTP 400.
6. **Staff vs. Member Identity:** `AttendanceService.validateAndCheckIn()` enforces:
   ```ts
   if (user.role === UserRole.MEMBER && !user.isSuperAdmin) {
     throw new ForbiddenException('Members are not authorized to operate check-in scanners');
   }
   ```
   MEMBER identity is never permitted to execute check-in or administrative operations.

---

## 4. Authentication, RBAC & API Endpoint Matrix

All staff attendance endpoints are protected globally by `JwtAuthGuard` and `PermissionsGuard`. Public endpoints are strictly marked with the `@Public()` decorator.

| HTTP Method | Route | Permission Required | Guards / Decorators | Authorized Roles |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/attendance/scan` | `attendance.checkin` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST` |
| `POST` | `/attendance/check-in` | `attendance.checkin` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST` |
| `POST` | `/attendance/manual` | `attendance.manual` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST` |
| `POST` | `/attendance/manual-check-in` | `attendance.manual` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST` |
| `POST` | `/attendance/:id/checkout` | `attendance.checkout` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST` |
| `POST` | `/attendance/check-out` | `attendance.checkout` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST` |
| `GET` | `/attendance/floor` | `attendance.floor_read` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `GET` | `/attendance/live` | `attendance.floor_read` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `GET` | `/attendance/records` | `attendance.read` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `GET` | `/attendance/history` | `attendance.read` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `GET` | `/attendance/settings` | `attendance.read` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `PATCH` | `/attendance/settings` | `attendance.settings_manage` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN` |
| `PUT` | `/attendance/settings` | `attendance.settings_manage` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN` |
| `POST` | `/attendance/members/:memberId/pass/issue` | `attendance.pass_manage` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST` |
| `POST` | `/attendance/passes/issue` | `attendance.pass_manage` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST` |
| `POST` | `/attendance/members/:memberId/pass/revoke`| `attendance.pass_manage` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST` |
| `POST` | `/attendance/passes/:id/revoke` | `attendance.pass_manage` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST` |
| `GET` | `/attendance/members/:memberId/pass` | `attendance.read` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `GET` | `/attendance/members/:memberId/pass/token` | `attendance.read` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `GET` | `/attendance/members/:memberId/pass/web-link` | `attendance.read` | `JwtAuthGuard`, `PermissionsGuard` | `GYM_OWNER`, `GYM_ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `GET` | `/attendance/public/pass/:passToken` | *None* | `@Public()`, Cache headers | Public (Signed bearer pass token) |
| `POST`| `/attendance/public/pass/:passToken/refresh` | *None* | `@Public()`, Rate-limited | Public (Signed bearer pass token) |

### C. Tenant Override Immunity
Client requests cannot override tenant context. All endpoints extract `organizationId` strictly from `@CurrentTenant()`, which reads from verified JWT claims (`request.user.organizationId`). Any `organizationId` parameter in client JSON request bodies is disregarded.

---

## 5. Cryptographic QR & Physical Badge Passcode Security

### A. Dynamic Rolling QR Tokens
- **Signing Algorithm:** HMAC-SHA256 (`alg: "HS256"`, `typ: "GYMOS-DYN-V1"`).
- **Format:** Compact base64url encoded string `GYMOS:V1:<header>.<payload>.<signature>`.
- **Token Claims:** `sub` (memberId), `org` (organizationId), `pid` (passId), `iat` (issued at), `exp` (expires at), `nce` (12-byte CSPRNG hex nonce).
- **Token Lifetime:** 90-second TTL with 5-second clock skew tolerance.
- **Envelope Secret Encryption:** Each pass has a dedicated 32-byte CSPRNG HMAC secret stored encrypted at rest using AES-256-GCM envelope encryption (`EnvelopeEncryptionService`).
- **Atomic Nonce Replay Prevention:**
  - Atomic Redis command: `SET lock:nonce:<orgId>:<nonce> 1 EX 180 NX`.
  - If already set, throws 409 Conflict (`TOKEN_REPLAY_DETECTED`).
  - **Fail-Closed:** If Redis is down or unreachable, throws 503 Service Unavailable (`REDIS_REPLAY_CHECK_UNAVAILABLE`), preventing unverified token consumption.
- **Timing-Safe Comparison:** Signatures are compared using `crypto.timingSafeEqual(bufSignature, bufExpected)`.

### B. Physical Badge Passcodes
- **Entropy & Character Set:** 16-character alphanumeric code using an unambiguous 31-character alphabet (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`), strictly excluding confusing glyphs (`0`, `1`, `I`, `L`, `O`). Provides **77.9 bits of cryptographic entropy** ($31^{16}$).
- **One-Way Password Hashing:** Argon2id with OWASP-recommended parameters:
  - `memoryCost: 19456` (19 MiB)
  - `timeCost: 2` (2 iterations)
  - `parallelism: 1`
  - Bound to tenant organization ID: `argon2.hash("${organizationId}:${normalized}")`.
  - Raw passcodes are never persisted in PostgreSQL or logged.
- **Two-Tier Redis Rate Limiting:**
  1. *Scanner Terminal Limit:* Max 25 attempts per 15 minutes per branch terminal (`passcode:terminal:<orgId>:<branchId>`).
  2. *Badge-Specific Limit:* Max 5 failed attempts per 15 minutes (`passcode:badge:<orgId>:<derivedId>`).
  - **Zero Passcode Leakage:** `derivedId` is calculated via HMAC-SHA256:
    ```ts
    crypto.createHmac('sha256', organizationId).update(`badge-ratelimit:${normalized}`).digest('hex').slice(0, 32);
    ```
    Raw passcodes are never present in Redis keys or error logs.

### C. Client-Side Non-Authoritative Guard
The frontend QR scanner does not validate or sign credentials. The 4-second client debounce (`lastScannedTimeRef`) is solely a UX comfort mechanism to prevent the browser camera loop from spamming the network while a user holds their screen up.

---

## 6. Public Mobile Web Pass Security (`/pass/[passToken]`)

- **Bearer Token Architecture:** `passToken` is an encrypted token containing `{ orgId, memberId, passId }` signed via the backend's master envelope encryption key.
- **Minimal PII Exposure:**
  The public view endpoint (`GET /attendance/public/pass/:passToken`) returns:
  ```json
  {
    "member": {
      "firstName": "John",
      "memberNumber": "MEM-0001",
      "photoUrl": "https://..."
    },
    "pass": {
      "status": "ACTIVE",
      "passCodeMasked": "A7K9-****-****-Q4V6"
    },
    "dynamicToken": { ... }
  }
  ```
  No last name, phone number, email address, financial status, or invoice history is returned.
- **Security Headers Enforced:**
  - `Cache-Control: no-store, no-cache, must-revalidate`
  - `Referrer-Policy: no-referrer`
- **Revocation Invalidation:** If a pass is revoked or suspended in the database, subsequent calls to `/attendance/public/pass/:passToken` immediately throw HTTP 403 Forbidden (`PASS_REVOKED` / `PASS_SUSPENDED`), and the public screen displays the revocation state.
- **Token Refresh Rate Limiting:** `POST /attendance/public/pass/:passToken/refresh` is rate-limited in Redis to 10 requests per 60 seconds per pass/IP.
- **Client Storage:** Pass tokens are kept in React component memory and never written to `localStorage` or `sessionStorage`.

---

## 7. Attendance Engine & Concurrency Verification

### A. Authoritative 14-Step Check-In Pipeline
1. Verify staff authentication & reject `MEMBER` role.
2. Validate branch status (`ACTIVE`) and staff assignment under tenant context.
3. Resolve QR token payload unverified to identify the pass.
4. Verify pass status (`ACTIVE`), reject `REVOKED` or `SUSPENDED`.
5. Verify member profile status (`ACTIVE`), reject `INACTIVE` or `SUSPENDED`.
6. Resolve branch/organization timezone and compute local date & time.
7. Fetch active subscription (`MemberMembership`).
8. Deterministically resolve attendance settings (Branch override $\rightarrow$ Org default $\rightarrow$ Hardcoded system default).
9. Verify subscription date validity (`startDate <= localDate <= endDate`).
10. Verify branch access rights for membership plan (multi-branch vs single home branch).
11. Evaluate overdue financial dues policy (`allowCheckInWithDues` and `maxOverdueGraceDays`).
12. Enforce operating hours policy (`operatingHoursStart` to `operatingHoursEnd`, supporting standard, overnight, and 24h schedules).
13. Enforce anti-passback cooldown window (`cooldownMinutes`) and reject if active session exists.
14. Atomically create `AttendanceRecord` inside tenant transaction.

### B. Concurrency Race Condition Protection
Concurrent scans for the same member are protected by a PostgreSQL partial unique index:
```sql
CREATE UNIQUE INDEX "idx_attendance_records_active_session" 
ON "attendance_records" ("organization_id", "member_id") 
WHERE "status" = 'CHECKED_IN';
```
When subjected to 10 simultaneous check-in requests for the same member in automated integration tests:
- Exactly 1 transaction commits successfully.
- Exactly 9 transactions fail with code `P2002`, caught and mapped to HTTP 409 Conflict (`ALREADY_CHECKED_IN`).
- Zero double check-ins are possible.

---

## 8. Outbox & Worker Reliability

### A. Delivery Guarantee Model: At-Least-Once Delivery
The GymOS attendance outbox dispatcher employs an **at-least-once delivery model**:
1. Outbox events are written transactionally in PostgreSQL with the attendance record (`status = 'PENDING'`).
2. The dispatcher polls pending events and adds them to BullMQ (`await attendanceQueue.add(...)`).
3. Upon queue acknowledgement, the database record is updated to `status = 'PUBLISHED'`.
4. **Failure Scenario Analysis:** If the worker crashes or the database connection drops after `attendanceQueue.add()` succeeds but before `tx.attendanceOutboxEvent.update(...)` commits, the outbox record remains `PENDING`. Upon restart, the dispatcher will re-add the job to BullMQ.
5. **Idempotency Mitigation:** The dispatcher passes `jobId: event.idempotencyKey` to BullMQ. BullMQ deduplicates jobs while the completed job is retained. Downstream consumers MUST remain idempotent. The system does NOT guarantee exactly-once delivery without downstream idempotency.

### B. Auto-Checkout Processor & Redis Distributed Lock
- **Concurreny Control:**
  `AutoCheckoutProcessor` uses an atomic Redis lock:
  ```ts
  await this.redis.set(this.lockKey, "1", "EX", this.lockTtlSeconds, "NX");
  ```
- **Conditional Update Protection:**
  The processor uses conditional SQL updates:
  ```ts
  const updateResult = await tx.attendanceRecord.updateMany({
    where: {
      id: session.id,
      organizationId: org.id,
      status: AttendanceStatus.CHECKED_IN,
    },
    data: { status: AttendanceStatus.AUTO_CHECKED_OUT, ... }
  });
  ```
  If a staff member checks out the member concurrently, `updateResult.count === 0` and the auto-checkout skips cleanly without emitting duplicate events.

---

## 9. Frontend & Backend Contract Audit

### A. Settings Fields Cross-Verification

| Field | Database Column | Zod Schema | Shared Interface | Frontend Form State | Backend Enforcement |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `cooldownMinutes` | `cooldown_minutes` | `cooldownMinutes` | `cooldownMinutes` | `cooldownMinutes` | **Enforced** (Anti-passback) |
| `autoCheckOutHours` | `auto_check_out_hours` | `autoCheckOutHours` | `autoCheckOutHours` | `autoCheckOutHours` | **Enforced** (Auto-checkout) |
| `operatingHoursStart`| `operating_hours_start` | `operatingHoursStart` | `operatingHoursStart` | `operatingHoursStart` | **Enforced** (Opening boundary) |
| `operatingHoursEnd` | `operating_hours_end` | `operatingHoursEnd` | `operatingHoursEnd` | `operatingHoursEnd` | **Enforced** (Closing boundary) |
| `allowOffHoursCheckIn`| `allow_off_hours_check_in`| `allowOffHoursCheckIn`| `allowOffHoursCheckIn`| `allowOffHoursCheckIn`| **Enforced** (Off-hours toggle) |
| `allowCheckInWithDues`| `allow_check_in_with_dues`| `allowCheckInWithDues`| `allowCheckInWithDues`| `allowCheckInWithDues`| **Enforced** (402 rejection/warn) |
| `maxOverdueGraceDays`| `max_overdue_grace_days` | `maxOverdueGraceDays`| `maxOverdueGraceDays`| `maxOverdueGraceDays`| **Enforced** (Invoice grace days) |
| `requireCheckOut` | `require_check_out` | `requireCheckOut` | `requireCheckOut` | `requireCheckOut` | ⚠️ **Unenforced in Check-in** |

*Note on `requireCheckOut`:* Stored and retrieved in settings, but `AttendanceService.validateAndCheckIn()` relies on `idx_attendance_records_active_session` and `cooldownMinutes` rather than evaluating `requireCheckOut`. See Finding F-03.

### B. Attendance Method Filters
The frontend filter dropdown in `AttendanceHistoryPage` includes:
- `QR_SCAN` $\rightarrow$ Dynamic QR
- `MANUAL_STAFF` $\rightarrow$ Manual Staff
- `RFID_CARD` $\rightarrow$ RFID / Physical Badge
- `KIOSK` $\rightarrow$ Kiosk
All four filter values strictly match the database PostgreSQL enum `attendance_method`.

### C. CSV Export Evaluation
In `apps/web/src/app/dashboard/attendance/history/page.tsx`:
```ts
const handleExportCsv = () => {
  if (!data?.items || data.items.length === 0) return;
  const rows = data.items.map((r) => [ ... ]);
```
The export converts `data.items` (the current page slice of up to 15 items) to CSV rather than querying an unpaginated server-side ledger. See Finding F-04.

---

## 10. Responsive, UX & Accessibility Audit

- **Color Contrast & Dark Mode:** Frontend screens utilize Tailwind dark-mode tokens (`dark:bg-zinc-900`, `dark:text-zinc-100`, `dark:border-zinc-800`). Emerald, Amber, and Red result banners maintain accessible contrast ratios.
- **Audio Feedback Synthesizer:** Front-desk scanner uses Web Audio API oscillators (chimes and buzzes) with fallback when audio autoplay is restricted.
- **Responsive Layout:**
  - Scanner renders dual video viewports fitting mobile portrait, tablet, and desktop aspect ratios.
  - History table wraps horizontally with standard responsive overflow controls.
- **Visual Testing Note:** Visual browser snapshot regression was not executed in a headless browser environment during this audit; UI audit was performed through direct source code, DOM structure, and CSS class inspection.

---

## 11. Automated Test & Build Results

| Test Suite / Build Target | Command | Result | Metrics |
| :--- | :--- | :---: | :--- |
| **API Unit Tests** | `npm run --workspace=@gymos/api test` | **PASS** | 6 test suites, 120/120 tests passing |
| **API Attendance Engine E2E** | `npm run --workspace=@gymos/api test:e2e -- attendance-engine` | **PASS** | 1 test suite, 20/20 tests passing |
| **API Attendance Controller & RBAC E2E** | `npm run --workspace=@gymos/api test:e2e -- attendance-api` | **PASS** | 1 test suite, 18/18 tests passing |
| **API Redis Nonce Replay E2E** | `npm run --workspace=@gymos/api test:e2e -- attendance-redis-replay` | **PASS** | 1 test suite, 4/4 tests passing |
| **API Attendance Worker E2E** | `npm run --workspace=@gymos/api test:e2e -- attendance-worker` | **FLAKY** | 10 of 11 passing (Worker timing race in test 3; see F-02) |
| **Web Typecheck** | `npm run --workspace=@gymos/web typecheck` | **PASS** | 0 TypeScript errors |
| **Web Lint** | `npm run --workspace=@gymos/web lint` | **PASS** | 0 ESLint warnings, 0 errors |
| **Worker Typecheck** | `npm run --workspace=@gymos/worker typecheck` | **PASS** | 0 TypeScript errors |
| **Monorepo Production Build** | `npm run build` | **PASS** | All 6 workspaces compiled cleanly (exit code 0) |

---

## 12. Audit Findings

### Critical Findings
*None. No critical tenant isolation leaks, unauthorized bypasses, or financial/attendance data corruption vulnerabilities were identified.*

---

### High-Risk Findings
*None.*

---

### Medium-Risk Findings

#### F-01: Redis Distributed Lock in Auto-Checkout is Non-Token-Safe
- **Severity:** Medium
- **File:** `apps/worker/src/attendance/auto-checkout.processor.ts` (lines 38–44, 236–238)
- **Evidence:**
  ```ts
  const lockRes = await this.redis.set(this.lockKey, "1", "EX", this.lockTtlSeconds, "NX");
  ...
  finally {
    if (lockAcquired) {
      await this.redis.del(this.lockKey).catch(() => {});
    }
  }
  ```
- **Impact:** The lock value is set to a static `"1"`, and the release performs an unconditional `redis.del()`. If an auto-checkout job takes longer than 300 seconds (e.g. processing thousands of tenants under database load), the lock expires in Redis. A second worker instance can then acquire the lock. When the first worker completes, its `finally` block deletes the second worker's lock prematurely.
- **Defense in Depth Note:** Database-level concurrency is safe: `attendanceRecord.updateMany({ where: { status: 'CHECKED_IN' } })` and unique `idempotencyKey` prevent duplicate checkouts. However, the Redis lock itself is non-token-safe.
- **Recommended Remediation:**
  1. Generate a CSPRNG lock token: `const lockToken = crypto.randomUUID()`.
  2. Acquire with token: `await this.redis.set(this.lockKey, lockToken, "EX", this.lockTtlSeconds, "NX")`.
  3. Release via atomic Lua script verifying ownership:
     ```lua
     if redis.call("get", KEYS[1]) == ARGV[1] then
       return redis.call("del", KEYS[1])
     else
       return 0
     end
     ```

#### F-02: Asynchronous BullMQ Test Uses Fixed `setTimeout` and Shared Redis Client
- **Severity:** Medium
- **File:** `apps/api/test/attendance-worker.e2e-spec.ts` (lines 45–54, 667)
- **Evidence:**
  ```ts
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await worker.close();
  expect(logs.some((l) => l.includes('attendance.checked_in'))).toBe(true);
  ```
- **Impact:** The BullMQ worker test relies on a fixed 1500ms sleep. Under Windows I/O or test runner load, BullMQ polling latency may exceed 1500ms before log messages are captured. Furthermore, the test shares a single `ioredis` instance across `Queue` and `Worker`, which can cause command contention during blocking BullMQ polling commands.
- **Recommended Remediation:**
  1. Use dedicated Redis client instances for `Queue` and `Worker`.
  2. Await job completion deterministically via `QueueEvents.waitUntilFinished()` or polling `job.isCompleted()` rather than an arbitrary 1500ms `setTimeout`.

---

### Low-Risk Findings

#### F-03: `requireCheckOut` Setting is Stored and Configurable but Unenforced in Validation Pipeline
- **Severity:** Low
- **File:** `apps/api/src/attendance/attendance.service.ts`
- **Evidence:** `requireCheckOut` is stored in `attendance_settings` and rendered in the frontend settings screen, but `validateAndCheckIn()` does not evaluate `settings.requireCheckOut`.
- **Impact:** Admins toggling "Require Check-Out" have no functional differentiation, because multiple check-ins are already prevented by active session uniqueness.
- **Recommended Remediation:** Either document that `requireCheckOut` is reserved for future turnstile / gate integration or implement specific policy enforcement (e.g. blocking check-in if a member's previous session was auto-checked out without manual staff checkout).

#### F-04: Attendance History CSV Export is Limited to the Currently Displayed Page
- **Severity:** Low
- **File:** `apps/web/src/app/dashboard/attendance/history/page.tsx` (lines 90–120)
- **Evidence:**
  ```ts
  const handleExportCsv = () => {
    if (!data?.items || data.items.length === 0) return;
    const rows = data.items.map((r) => [ ... ]);
  ```
- **Impact:** Clicking "Export CSV" generates a file containing only the currently visible 15 rows, not the complete historical ledger across all pages matching the filters.
- **Recommended Remediation:** Implement a backend export endpoint (`GET /attendance/records/export`) streaming the full filtered dataset, or clarify the UI button label as "Export Current Page (CSV)".

---

## 13. Missing Evidence & Unverified Assumptions

1. **Physical RFID Card Hardware Integration:**
   `AttendanceMethod.RFID_CARD` is fully implemented as a 16-character alphanumeric physical badge code scanned via camera or typed into front-desk modal. Integration with physical USB/Wiegand RFID reader hardware was simulated via standard keyboard emulation; dedicated hardware drivers were not verified.
2. **Visual Snapshot Testing:**
   No headless browser snapshot regression was conducted. UI verification was completed via Next.js typecheck, ESLint, and manual source review.

---

## 14. Overall Production-Readiness Assessment

### Final Decision: **CONDITIONAL PASS**

**Justification:**
1. **Core Invariants Verified:** PostgreSQL Row-Level Security (`RLS FORCE`), multi-tenant data isolation, Argon2id passcode hashing, timing-safe HMAC-SHA256 QR token verification, and database-level concurrency protection are verified by automated tests and code audit.
2. **No Critical Security Flaws:** Zero unauthorized data leaks, zero SuperAdmin RLS bypasses, and zero plaintext secret exposures.
3. **Condition for Final Acceptance:** Remediate non-critical findings F-01 (token-safe Redis lock) and F-02 (BullMQ test determinism) prior to authorizing Stage 3.
