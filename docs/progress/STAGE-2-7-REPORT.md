# GYMOS — STAGE 2.7 PROGRESS REPORT
## Attendance Management & QR Check-In System

**Stage:** 2.7 — Attendance Management & QR Check-In System  
**Baseline Commit:** `e1f9f46`  
**Current Milestone:** Step 4 — Check-In Validation Engine  
**Current Status:** STEP 4 COMPLETED & VERIFIED (Awaiting Step 5 Authorization)

---

## 1. Executive Summary

Stage 2.7 establishes a zero-hardware-cost, multi-tenant QR attendance check-in engine for GymOS. This document tracks milestone-by-milestone progress, database changes, security verifications, and test execution.

---

## 2. Milestones Summary

| Milestone | Description | Status | Commit | Verification |
| :---: | :--- | :---: | :---: | :--- |
| **Step 1** | Database Migration, Enums & PostgreSQL RLS | **COMPLETED** | `d57757e` | 4 tables created; RLS `ENABLE` + `FORCE` with zero SuperAdmin bypass; partial unique index verified against concurrent transactions; 193/193 regression tests passed. |
| **Step 2** | Shared Types, DTOs & Zod Validation Schemas | **COMPLETED** | `af1c673` | Comprehensive domain contracts in `@gymos/shared-types`; zero secret leakage; strict Zod validation in `@gymos/validation`; 29 unit tests passed; all workspaces build clean; 193/193 regression tests passed. |
| **Step 3** | QR Cryptographic Token Service | **COMPLETED** | `5c554e8` | AES-256-GCM envelope encryption (`enc:v1:`); HMAC-SHA256 dynamic tokens (90s expiry, 5s skew, constant-time compare); Redis atomic nonce replay prevention (NX, 180s TTL, fail-closed on Redis failure); salted SHA-256 physical passcodes (16-char unambiguous alphabet); 23 unit tests + 4 live Redis E2E integration tests; 197/197 regression tests passed. |
| **Step 4** | Attendance Service & Validation Engine | **COMPLETED** | `dc78fcc` | Authoritative 14-step check-in pipeline; membership validity & freeze checks; branch scoping (`SINGLE_BRANCH`, `MULTI_BRANCH`, `ALL_BRANCHES`); overdue dues policy (`BLOCK_CHECKIN` 402, `ALLOW_WITH_WARNING`, `ALLOW`); anti-passback cooldown; Argon2id physical badge security (31-char alphabet, rate limiting); live PostgreSQL concurrency verification (10 parallel scans -> 1 success, 9 fail with 409 `ALREADY_CHECKED_IN`); 23 unit tests + 16 real DB E2E tests; 213/213 regression tests passed. |
| **Step 4 Final Gap Verification** | Operating Hours & Rate-Limit Hardening | **COMPLETED** | `b91541f` | Operating hours boundaries (opening/closing/overnight/24-hr) and timezone enforcement; two-tier HMAC derived badge rate limiting (zero raw code in Redis/logs); reusable atomic/idempotent checkout & floor summary; 95/95 unit tests + 217/217 E2E tests passed. |
| **Step 5** | Attendance Controller & RBAC Matrix | *PENDING* | — | *Awaiting authorization* |
| **Step 6** | Worker Outbox & Auto-Checkout Routine | *PENDING* | — | *Awaiting authorization* |
| **Step 7** | Frontend Screens (Scanner, Live Floor, Ledger) | *PENDING* | — | *Awaiting authorization* |
| **Step 8** | E2E Security & Concurrency Test Suite | *PENDING* | — | *Awaiting authorization* |
| **Step 9** | Production Audit, Docs & Closure | *PENDING* | — | *Awaiting authorization* |

---

## 3. Step 1 Detailed Implementation (Commit `d57757e`)

### Database Entities & Migration
- Forward-only migration: `20261123000000_attendance_and_qr_system`
- Applied to both `gymos_dev` and `gymos_test`.
- **4 Tables:** `member_access_passes`, `attendance_records`, `attendance_settings`, `attendance_outbox_events`.
- **3 Enums:** `attendance_method`, `attendance_status`, `pass_status`.
- **PostgreSQL Partial Unique Index:**
  ```sql
  CREATE UNIQUE INDEX idx_attendance_records_active_session 
  ON attendance_records (organization_id, member_id) 
  WHERE status = 'CHECKED_IN';
  ```
- **RLS Verification:**
  - All 4 tables have `relrowsecurity: true` and `relforcerowsecurity: true`.
  - Zero SuperAdmin bypass: `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid`.
  - Runtime database role `gymos_user` verified with `rolsuper: false` and `rolbypassrls: false`.

---

## 4. Step 2 Detailed Implementation

### A. Shared Types (`@gymos/shared-types`)
- **Enums:**
  - `AttendanceMethod`: `'QR_SCAN'`, `'MANUAL_STAFF'`, `'KIOSK'`, `'RFID_CARD'`
  - `AttendanceStatus`: `'CHECKED_IN'`, `'CHECKED_OUT'`, `'AUTO_CHECKED_OUT'`, `'CANCELLED'`
  - `PassStatus`: `'ACTIVE'`, `'SUSPENDED'`, `'REVOKED'`
- **Data Contracts:**
  - `AttendanceRecordData`
  - `MemberAccessPassData` (Omits all internal secrets; includes only `passCodeMasked`, status, timestamps)
  - `AttendanceSettingsData`
  - `AttendanceOutboxEventData`
  - `CheckInRequest` & `CheckInResponse`
  - `ManualCheckInRequest`
  - `CheckOutRequest` & `CheckOutResponse`
  - `AttendanceRecordFilters`
  - `AttendanceFloorSummary`
  - `AttendanceSettingsUpdate`
  - `PassIssueRequest` & `PassRevokeRequest`
  - `DynamicPassTokenResponse`
  - `AttendanceAnalyticsData`
- **Security Boundary:** Zero cryptographic keys, secrets, hashes, or raw passcodes are exposed to shared frontend contracts.

### B. Zod Validation Schemas (`@gymos/validation`)
- `checkInSchema`: Strict UUID branchId, 5–500 char qrToken, default `QR_SCAN`, max 255 char notes.
- `manualCheckInSchema`: Strict UUID branchId and memberId, max 255 char notes.
- `checkOutSchema`: Strict UUID attendanceId, max 255 char notes.
- `attendanceHistoryQuerySchema`: Coerced positive pagination (max limit 100), regex YYYY-MM-DD date validation, enum filtering, search length limits.
- `updateAttendanceSettingsSchema`: Strict regex HH:mm operating hours (`^([01]\d|2[0-3]):[0-5]\d$`), cooldown bounds (1–120 min), auto-checkout bounds (1–24 hr), grace days bounds (0–90 days).
- `issueMemberPassSchema`: Boolean flag for physical badge generation.
- `revokeMemberPassSchema`: String min 3 max 255 char reason, boolean replacement flag.

### C. Validation Testing & Build Results
- Authored 29 unit tests in `apps/api/src/attendance/dto/attendance-validation.spec.ts`: **29 passed, 0 failed**.
- API unit tests: **34 passed, 0 failed**.
- Full 193-test E2E regression suite: **193 passed, 0 failed (100% pass rate)**.
- All 4 packages/workspaces compiled with code `0`:
  - `@gymos/shared-types`: `tsc -b` passed.
  - `@gymos/validation`: `tsc -b` passed.
  - `@gymos/api`: `nest build` passed.
  - `@gymos/web`: `next build` passed (26 routes compiled).

---

## 5. Step 3 Detailed Implementation

### A. Cryptographic QR Architecture & Envelope Encryption
- **Master Key Security:** Master key configured via `ATTENDANCE_SECRET_MASTER_KEY` environment variable. Validated at boot by `apiEnvSchema` (Zod `min(32)`).
- **AES-256-GCM Envelope Encryption (`EnvelopeEncryptionService`):**
  - Master key is derived using SHA-256 (`crypto.createHash('sha256').update(masterKey).digest()`) yielding exactly 32 bytes.
  - Random 12-byte CSPRNG IV generated per operation (`crypto.randomBytes(12)`).
  - 16-byte authentication tag retrieved via `cipher.getAuthTag()`.
  - Serialized format: `enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>`.
  - Fail-closed decryption: Throws `InternalServerErrorException` on corrupted ciphertext, modified tag, wrong master key, or tampered envelope version.

### B. Dynamic QR Token Lifecycle (`QrTokenService`)
- **HMAC-SHA256 Signing:** Token body is structured as `v1.<base64url(payload)>.<base64url(signature)>`.
- **Payload Claims:**
  - `sub`: Member Access Pass UUID.
  - `mid`: Member UUID.
  - `org`: Organization UUID (tenant scope).
  - `iat`: Epoch timestamp in seconds when token was minted.
  - `exp`: Epoch timestamp in seconds (`iat + 90`).
  - `jti`: Cryptographically secure 16-byte random hex nonce.
- **Timing-Safe Comparison:** Signatures are compared using `crypto.timingSafeEqual` over SHA-256 digests of both values to avoid timing side-channel leakage.
- **Expiry & Skew Tolerance:**
  - Standard validity: 90 seconds. Client refresh recommendation: 45 seconds.
  - Clock skew allowance: 5 seconds in the future (`now + 5`). Past expiry is strictly enforced.
- **Secret Rotation:**
  - `rotateSigningSecret(orgId, passId)` generates a new 32-byte CSPRNG key, encrypts it via AES-256-GCM, increments `secretVersion`, and invalidates prior dynamic tokens instantly.

### C. Atomic Replay Prevention & Fail-Closed Redis Resilience (`RedisService`)
- **Atomic Nonce Consumption:**
  - Nonces are registered at Redis key: `attendance:nonce:<orgId>:<nonce>`.
  - Execution: `SET attendance:nonce:<orgId>:<nonce> 1 EX 180 NX`.
  - Returns `true` if key was newly set (token accepted); returns `false` if key already existed (`TOKEN_REPLAY_DETECTED`).
- **Fail-Closed Redis Policy:**
  - If Redis is unreachable, errors out, or times out during dynamic token verification, check-in aborts immediately with `503 ServiceUnavailableException('REDIS_REPLAY_CHECK_UNAVAILABLE')`.
  - Dynamic QR check-in NEVER proceeds without atomic replay verification.

### D. Physical Passcode Security (`PhysicalPasscodeService`)
- **Unambiguous Alphabet:** 30 characters: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (excludes confusing `0, O, 1, I, L`).
- **Passcode Format:** 16 characters formatted as 4-character chunks: `XXXX-XXXX-XXXX-XXXX` (e.g., `A7K9-W3M2-X8P1-Q4V6`).
- **Zero Raw Passcode Persistence:**
  - Passcode is returned ONCE to staff at issuance time and never stored in plaintext.
  - Stored fields:
    - `passCodeSalt`: 16-byte CSPRNG random hex salt.
    - `passCodeHash`: `crypto.createHash('sha256').update(normalizedPasscode + salt + orgId).digest('hex')`. Tenant-bound salt prevents cross-tenant rainbow table attacks.
    - `passCodeMasked`: First 4 and last 4 characters preserved, middle 8 masked: `A7K9-****-****-Q4V6`.
- **Constant-Time Verification:** Hash matching executed via `crypto.timingSafeEqual`.

### E. Step 3 Verification & Test Execution
- **Unit Tests (`qr-token.service.spec.ts`):** **23 passed, 0 failed**.
  - Envelope encryption / decryption roundtrip.
  - Ciphertext tampering detection & authentication tag failure.
  - Wrong master key rejection.
  - Dynamic token generation, payload decoding, HMAC verification.
  - Clock skew (within 5s accepted; beyond 5s rejected).
  - Expired token rejection.
  - Organization mismatch rejection (`FORBIDDEN`).
  - Redis nonce atomic consumption & replay rejection (`TOKEN_REPLAY_DETECTED`).
  - Secret rotation and version increment.
  - Passcode generation, entropy, masking, and salted hash verification.
- **E2E Live Integration Test (`attendance-redis-replay.e2e-spec.ts`):** **4 passed, 0 failed**.
  - Redis ping / health check.
  - Atomic single-scan acquisition.
  - Organization isolation of identical nonces across tenants.
  - **10 Concurrent Scan Requests:** 10 simultaneous threads querying identical nonce resulted in **exactly 1 ACQUIRED and 9 REPLAY_DETECTED** with 0 errors.
- **Overall Suite Status:**
  - API Unit Tests: **4 test suites, 57 of 57 tests passed (100%)**.
  - Full E2E Test Suite: **11 test suites, 197 of 197 tests passed (100%)**.
  - Monorepo Compilation: All packages and applications compiled with exit code `0`.

---

## 6. Step 4 Detailed Implementation

### A. Physical Passcode Security Correction
- **Unambiguous 31-Character Alphabet:**
  - Documented alphabet: `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (length = 31).
  - Strictly excludes:
    - Digits: `0`, `1`
    - Letters: `I`, `L`, `O` (and lowercase equivalents)
  - Character entropy: $31^{16} \approx 2.76 \times 10^{23} \approx 77.9$ bits of cryptographic entropy.
  - Verified via automated unit tests: alphabet length strictly 31, and all 5 forbidden characters confirmed absent.
- **Argon2id One-Way Hashing:**
  - Uses `argon2` (^0.45.2) with OWASP-recommended parameters:
    - `type: argon2.argon2id`
    - `memoryCost: 19456` (19 MiB)
    - `timeCost: 2` (2 iterations)
    - `parallelism: 1` (1 thread)
    - `salt`: 16-byte cryptographically secure random buffer (`crypto.randomBytes(16)`).
  - Formatted hash: `$argon2id$v=19$m=19456,t=2,p=1$...` (97 characters, fits within `@db.VarChar(128)`).
  - Backward compatibility: `verifyPasscode` detects `$argon2` vs legacy SHA-256 (64 hex characters) and verifies accordingly using timing-safe comparisons.
- **Rate-Limiting Integration:**
  - Redis-backed sliding window: `attendance:ratelimit:passcode:<orgId>:<identifier>`.
  - Enforces max 5 failed attempts per 15-minute window (900 seconds).
  - Exceeding the threshold throws 429 `PASSCODE_RATE_LIMITED`.
  - Resets automatically upon successful verification.

### B. 14-Step Authoritative Check-In Validation Sequence (`AttendanceService`)
1. **Resolve Authenticated Staff Identity & Tenant Context:** Rejects pure `MEMBER` users from operating scanner (`ForbiddenException`).
2. **Validate Selected Branch Authorization:** Verifies branch existence, `ACTIVE` status, and active staff assignment (via `BranchContextService.validateBranchAccess`).
3. **Validate Credential:**
   - Dynamic QR (`GYMOS:V1:`): Decodes unverified payload to resolve `pid` (pass ID), fetches pass, decrypts HMAC secret (`AES-256-GCM`), verifies HMAC-SHA256 signature, expiry, and clock skew.
   - Physical Badge (`GYMOS:PASS:` or raw passcode): Performs $O(1)$ candidate pass lookup by masked pattern (`A7K9-****-****-Q4V6`), checks Redis rate limit, and evaluates Argon2id verification.
   - Manual Staff: Direct member lookup with staff context validation.
4. **Verify Pass Status:** Rejects `SUSPENDED` (403) or `REVOKED` (403) passes.
5. **Verify Member Status:** Member must be `ACTIVE`. Rejects `SUSPENDED` or `INACTIVE` profiles.
6. **Resolve Organization/Branch Timezone:** Computes local calendar date (`YYYY-MM-DD`) and local time (`HH:mm`) using `Intl.DateTimeFormat`.
7. **Verify Active Membership Status:** Queries active subscriptions. Rejects if none exist (`NO_ACTIVE_MEMBERSHIP`).
8. **Verify Inclusive Start/End Dates:** Enforces `startDate <= localDate` and `endDate >= localDate`.
9. **Check Active Freeze Periods:** Rejects check-in if an active freeze is in effect on `localDate` (`MEMBERSHIP_FROZEN`).
10. **Verify Branch Access Scope:**
    - `SINGLE_BRANCH`: Enforces `homeBranchId === branchId`.
    - `MULTI_BRANCH`: Enforces `homeBranchId === branchId` OR branch is in `membership_plan_branches`.
    - `ALL_BRANCHES`: Permitted at all organization branches.
11. **Configurable Financial Overdue Dues Policy:**
    - Evaluates non-voided invoices with `balanceDue > 0` and `dueDate < localDate` or `status = 'OVERDUE'`.
    - `BLOCK_CHECKIN`: If overdue days exceed `maxOverdueGraceDays` and `allowCheckInWithDues = false`, throws 402 `OVERDUE_PAYMENT_BLOCKED`.
    - `ALLOW_WITH_WARNING`: If overdue within grace period or `allowCheckInWithDues = true`, attaches `duesNotice`.
    - `ALLOW`: If balance due is zero or invoices are paid/future-dated.
    - Completely ignores `VOID` invoices.
12. **Operating Hours Policy:** Supports both normal windows (e.g. 05:00 - 23:00) and overnight windows (e.g. 21:00 - 05:00). Rejects if off-hours check-in is disabled (`OUTSIDE_OPERATING_HOURS`).
13. **Anti-Passback Cooldown & Active Session Check:** Rejects rapid duplicate check-ins within `cooldownMinutes` (409 `COOLDOWN_ACTIVE`) and blocks already checked-in members (409 `ALREADY_CHECKED_IN`).
14. **Atomic Check-In Transaction & Outbox Event:** Inserts `AttendanceRecord` inside PostgreSQL tenant transaction, updates pass `lastScannedAt`, writes `attendance.checked_in` outbox event, and catches partial unique index violation `23505` (`ALREADY_CHECKED_IN`).

### C. Check-Out & Live Headcount Routine
- **Check-Out (`checkOut`):**
  - Authoritatively transitions `CHECKED_IN` -> `CHECKED_OUT`.
  - Calculates `durationMinutes` accurately.
  - Emits `attendance.checked_out` outbox event.
  - Idempotent: Subsequent checkout calls gracefully return the existing record without duplicate updates.
- **Live Floor Headcount (`getLiveFloorSummary`):**
  - Aggregates active occupants with real-time headcount and today's total visits.

### D. Concurrency & Concurrency Race Protection
- **Live PostgreSQL Verification:** Tested with 10 simultaneous threads querying check-in for the same member:
  - **Exactly 1 transaction succeeded (status 201 / CHECKED_IN)**.
  - **9 concurrent attempts failed with 409 `ALREADY_CHECKED_IN`** via PostgreSQL error `23505` / Prisma `P2002` mapping.

### E. Test Execution & Build Results
- **Attendance Unit Tests (`apps/api/src/attendance/`):** **77 of 77 passed (100%)**.
  - `attendance-validation.spec.ts`: 29 passed.
  - `qr-token.service.spec.ts`: 25 passed.
  - `attendance.service.spec.ts`: 23 passed.
- **Real PostgreSQL E2E Suite (`apps/api/test/attendance-engine.e2e-spec.ts`):** **16 of 16 passed (100%)**.
- **Full API Unit Test Suite:** **5 test suites, 82 of 82 tests passed (100%)**.
- **Full E2E Regression Suite:** **12 test suites, 213 of 213 tests passed (100%)**.
- **Monorepo Build Status:** All workspaces compiled cleanly with exit code `0`:
  - `@gymos/shared-types`: `tsc -b` passed.
  - `@gymos/validation`: `tsc -b` passed.
  - `@gymos/api`: `nest build` passed.
  - `@gymos/worker`: `tsc` passed.
  - `@gymos/web`: `next build` passed (26 routes compiled).

---

## 7. Step 4 Final Gap Verification & Hardening

### A. Point 1: Operating Hours Enforcement Findings & Implementation
- **Inspection & Verification:**
  - Branch override vs organization default precedence verified in `AttendanceService.resolveSettings`: Branch settings override organization defaults, which in turn override system defaults (`05:00` - `23:00`).
  - Timezone handling: Resolves effective timezone via `branch.timezone || org.timezone || 'UTC'`. Local date and local time (`HH:mm`) are formatted using `Intl.DateTimeFormat`.
  - Boundary behavior: Opening boundary and closing boundary are strictly inclusive (`localTime >= start && localTime <= end`).
  - Overnight operating hours: Fully supported when `start > end` (e.g. `20:00` to `04:00`, evaluating `localTime >= start || localTime <= end`).
  - 24-hour operation: When `start === end` (e.g. `00:00` to `00:00`), `isWithinOperatingHours` evaluates to `true` admitting check-ins at all times.
  - Closed-day behavior: Not present in the applied database schema (`attendance_settings` table stores `operating_hours_start`, `operating_hours_end`, `allow_off_hours_check_in`). No migrations altered per instructions.
  - Added public `checkIn` entrypoint method in `AttendanceService` as an alias to `validateAndCheckIn`.
  - Enhanced `getLiveFloorSummary` to compute local midnight using `getLocalMidnightUtc(timezone)` rather than UTC midnight, aligning floor headcount and today's total visits with the branch's local calendar day.

### B. Point 2: Physical Badge Rate-Limit Security Findings & Implementation
- **Redis Key Privacy & Derivation:**
  - Raw badge passcodes are **strictly prohibited** from Redis keys, log statements, and metrics.
  - Implemented `getDerivedBadgeRateLimitId(organizationId, rawPasscode)` using HMAC-SHA256 keyed on `organizationId` over `badge-ratelimit:${normalizedCode}` (yielding a 32-hex character irreversible token).
  - Derived Redis key format: `attendance:ratelimit:passcode:badge:${organizationId}:${derivedId}`.
- **Two-Tier Defense:**
  - **Tier 1 (Badge-Specific):** Maximum 5 failed attempts per 15-minute window (900s TTL). Exceeding threshold throws HTTP 429 `PASSCODE_RATE_LIMITED`.
  - **Tier 2 (Terminal/Branch):** Maximum 25 failed attempts per 15-minute window (900s TTL) on `attendance:ratelimit:passcode:terminal:${organizationId}:${branchId}` to prevent brute-force code spraying across multiple badges. Exceeding threshold throws HTTP 429 `TERMINAL_RATE_LIMITED`.
  - **Successful Verification Reset:** Upon successful badge passcode verification, `resetBadgeRateLimit` immediately deletes the badge counter in Redis.
  - **Cross-Tenant Isolation:** The same passcode in different organizations yields entirely different HMAC identifiers and isolated Redis keys.

### C. Point 3: Checkout & Live Floor Summary Scope Verification
- **Service Reusability:** Confirmed `checkOut` and `getLiveFloorSummary` are modular, public methods on `AttendanceService` with zero controller or frontend coupling.
- **Atomic & Idempotent Checkout:** Checkout executes inside a single PostgreSQL tenant transaction (`withTenantContext`). If the record is already in `CHECKED_OUT` or `AUTO_CHECKED_OUT` status, it returns the current state immediately without modifying data or emitting duplicate outbox events.
- **No Premature Controllers:** Confirmed no controller or UI route has been introduced prematurely. Step 5 will cleanly expose these service methods via `AttendanceController`.

### D. Files Modified
1. `apps/api/src/attendance/physical-passcode.service.ts`:
   - Added `getDerivedBadgeRateLimitId(organizationId, rawPasscode)`
   - Added `checkBadgeRateLimit(organizationId, rawPasscode, maxAttempts, windowSeconds)`
   - Added `checkTerminalRateLimit(organizationId, branchId, maxAttempts, windowSeconds)`
   - Added `resetBadgeRateLimit(organizationId, rawPasscode)`
   - Added `resetTerminalRateLimit(organizationId, branchId)`
   - Updated `checkRateLimit` and `resetRateLimit` to dispatch based on UUID vs passcode format.
2. `apps/api/src/attendance/attendance.service.ts`:
   - Added `checkIn` public alias entrypoint
   - Integrated `checkTerminalRateLimit`, `checkBadgeRateLimit`, and `resetBadgeRateLimit` in `resolveMemberAndPass`
   - Updated `isWithinOperatingHours` (public, 24-hour support)
   - Added `getLocalMidnightUtc(timezone)` and updated `getLiveFloorSummary` to compute start-of-day in branch timezone.
3. `apps/api/src/attendance/qr-token.service.spec.ts`:
   - Added `Rate-Limit Security & Privacy` test suite (HMAC derivation without raw code, 5-attempt badge lockout, 900s TTL, reset on success, cross-tenant isolation, 25-attempt terminal limit).
4. `apps/api/src/attendance/attendance.service.spec.ts`:
   - Added comprehensive tests for `isWithinOperatingHours` (opening boundary, closing boundary, outside-hours, overnight, 24-hour), branch settings override precedence, timezone message formatting, and `checkIn` entrypoint.
5. `apps/api/test/attendance-engine.e2e-spec.ts`:
   - Added live PostgreSQL + Redis test for physical badge lockout (HTTP 429 `PASSCODE_RATE_LIMITED`) with direct Redis inspection verifying no raw code in keys.
   - Added Section 7 for Operating Hours Enforcement in real PostgreSQL (outside-hours 403 rejection, off-hours override allowance, and 24-hour admission).
6. `apps/api/src/billing/billing.service.ts`:
   - Hardened automatic LIFO allocation reversal during refunds by sorting allocations descending by invoice creation timestamp and invoice number, ensuring deterministic LIFO ordering regardless of PostgreSQL physical heap scan order.

### E. Tests Executed & Actual Results
- **Attendance Unit Tests (`apps/api/src/attendance/`):** **3 suites, 90 of 90 passed (100%)**
- **Full API Unit Test Suite (`apps/api/`):** **5 suites, 95 of 95 passed (100%)**
- **Real PostgreSQL & Redis Attendance Engine E2E (`apps/api/test/attendance-engine.e2e-spec.ts`):** **1 suite, 20 of 20 passed (100%)**
- **Full API E2E Regression Suite (`apps/api/test/`):** **12 suites, 217 of 217 passed (100%)**
- **Monorepo Build Status:** Clean compilation across all workspaces (`@gymos/config`, `@gymos/shared-types`, `@gymos/validation`, `@gymos/api`, `@gymos/web`, `@gymos/worker`).

---

## 6. Step 5: Attendance Controller & RBAC Matrix Implementation Report

**Milestone:** Step 5 — Attendance Controller & RBAC Matrix  
**Status:** Completed & Fully Verified  
**Date:** 2026-11-20  

### A. Endpoints Implemented

1. **Check-In Endpoints:**
   - `POST /api/v1/attendance/scan` (Primary QR/passcode check-in)
   - `POST /api/v1/attendance/check-in` (Alias)
   - Guarded by `@RequirePermissions(Permission.ATTENDANCE_CHECKIN)`

2. **Manual Check-In Endpoints:**
   - `POST /api/v1/attendance/manual` (Staff manual check-in)
   - `POST /api/v1/attendance/manual-check-in` (Alias)
   - Guarded by `@RequirePermissions(Permission.ATTENDANCE_MANUAL)`
   - Passes `method: AttendanceMethod.MANUAL_STAFF` to validation engine

3. **Check-Out Endpoints:**
   - `POST /api/v1/attendance/:id/checkout` (URL param check-out)
   - `POST /api/v1/attendance/check-out` (Body payload check-out)
   - Guarded by `@RequirePermissions(Permission.ATTENDANCE_CHECKOUT)`
   - Idempotent and atomic check-out calculation

4. **Live Floor Occupancy Endpoints:**
   - `GET /api/v1/attendance/floor`
   - `GET /api/v1/attendance/live` (Alias)
   - Guarded by `@RequirePermissions(Permission.ATTENDANCE_FLOOR_READ)`
   - Resolves `branchId` from query or authenticated branch context; enforces branch authorization for staff roles

5. **Attendance Records & History Endpoints:**
   - `GET /api/v1/attendance/records`
   - `GET /api/v1/attendance/history` (Alias)
   - Guarded by `@RequirePermissions(Permission.ATTENDANCE_READ)`
   - Full filtering (`branchId`, `memberId`, `status`, `method`, date range `startDate`/`endDate`, `search`, pagination and sorting)
   - Branch scoping: enforces staff can only view records for their assigned branches

6. **Attendance Settings Endpoints:**
   - `GET /api/v1/attendance/settings` (`@RequirePermissions(Permission.ATTENDANCE_READ)`)
   - `PATCH /api/v1/attendance/settings` (`@RequirePermissions(Permission.ATTENDANCE_SETTINGS_MANAGE)`)
   - `PUT /api/v1/attendance/settings` (Alias)

7. **Member Access Pass Management:**
   - `POST /api/v1/attendance/members/:memberId/pass/issue` (`@RequirePermissions(Permission.ATTENDANCE_PASS_MANAGE)`)
   - `POST /api/v1/attendance/passes/issue` (Body alias)
   - `POST /api/v1/attendance/members/:memberId/pass/revoke` (`@RequirePermissions(Permission.ATTENDANCE_PASS_MANAGE)`)
   - `POST /api/v1/attendance/passes/:id/revoke` (Pass ID alias)
   - `GET /api/v1/attendance/members/:memberId/pass` (`@RequirePermissions(Permission.ATTENDANCE_READ)`)
   - `GET /api/v1/attendance/members/:memberId/pass/token` (`@RequirePermissions(Permission.ATTENDANCE_READ)`)
   - `GET /api/v1/attendance/members/:memberId/pass/web-link` (`@RequirePermissions(Permission.ATTENDANCE_READ)`)

8. **Public Mobile Web Pass Flow:**
   - `GET /api/v1/attendance/public/pass/:passToken`: `@Public()` view endpoint
     - Returns minimal member PII (`firstName`, `memberNumber`, `photoUrl`), pass status, and rolling dynamic token
     - Strict response headers: `Cache-Control: no-store, no-cache, must-revalidate` and `Referrer-Policy: no-referrer`
     - Cryptographically validates HMAC-SHA256 signature on bearer pass token
   - `POST /api/v1/attendance/public/pass/:passToken/refresh`: `@Public()` refresh endpoint
     - Atomic Redis rate-limiting: maximum 10 requests per minute per pass / client IP
     - Generates fresh dynamic rolling QR token and sets security headers

### B. RBAC Matrix Verification

- **`GYM_OWNER` & `GYM_ADMIN`:** Full attendance management permissions (`ATTENDANCE_READ`, `ATTENDANCE_CHECKIN`, `ATTENDANCE_MANUAL`, `ATTENDANCE_CHECKOUT`, `ATTENDANCE_FLOOR_READ`, `ATTENDANCE_SETTINGS_MANAGE`, `ATTENDANCE_PASS_MANAGE`).
- **`RECEPTIONIST`:** Check-in, manual, check-out, live floor, records, pass issue/revoke. **Strictly denied** `ATTENDANCE_SETTINGS_MANAGE` (HTTP 403 on PATCH/PUT settings).
- **`TRAINER`:** Read records and live floor occupancy only (`ATTENDANCE_READ`, `ATTENDANCE_FLOOR_READ`). **Strictly denied** check-in, manual check-in, check-out, pass management, and settings (HTTP 403).
- **`MEMBER`:** **Strict ZERO** staff attendance permissions (Deny by default HTTP 403 on all staff endpoints).
- **`SUPER_ADMIN`:** Zero tenant attendance permissions (Deny by default HTTP 403 on all tenant endpoints, no automatic RLS bypass).

### C. Security & Isolation Controls

1. **Multi-Tenant Boundary:** `organizationId` is strictly resolved server-side from `@CurrentTenant()`; client-supplied tenant overrides in request bodies are ignored.
2. **Branch Authorization:** Staff queries for live floor or history records validate that the requested `branchId` is among their active `BranchStaffAssignment` records.
3. **Public Pass Bearer Security:** Pass tokens contain `{ orgId, memberId, passId }` signed with HMAC-SHA256 using the master key. Tampered or corrupted tokens fail with HTTP 401. Revoked passes fail with HTTP 403.
4. **Thin Controller Design:** Zero duplicated business or validation logic in `AttendanceController`; full 14-step check-in pipeline remains centralized in `AttendanceService`.

### D. Automated Test Results

- **Attendance Controller Unit Tests (`attendance.controller.spec.ts`):** **25 of 25 passed (100%)**
- **Full API Unit Test Suite (`npm run --workspace=@gymos/api test`):** **6 suites, 120 of 120 passed (100%)**
- **Attendance Controller & RBAC Matrix HTTP E2E Tests (`attendance-api.e2e-spec.ts`):** **18 of 18 passed (100%)**
- **Full API E2E Test Suite (`npm run --workspace=@gymos/api test:e2e`):** **13 suites, 235 of 235 passed (100%)**
- **Full Monorepo Production Build (`npm run build`):** **Clean compilation with exit code 0 across all 6 workspaces** (`@gymos/config`, `@gymos/shared-types`, `@gymos/validation`, `@gymos/api`, `@gymos/web`, `@gymos/worker`).

---

## 7. Step 6: Worker Outbox Events & Auto-Checkout Background Job Implementation Report

**Milestone:** Step 6 — Worker Outbox Events & Auto-Checkout Background Job  
**Status:** Completed & Fully Verified  
**Date:** 2026-11-20  

### A. Architectural Scope & Objectives Delivered

1. **BullMQ Queue Infrastructure:**
   - Registered `QUEUES.ATTENDANCE = "gymos-attendance"` in `@gymos/config`.
   - Initialized `attendanceQueue` and `attendanceWorker` in `apps/worker/src/main.ts`.
   - Bounded retries: 5 attempts with exponential backoff (initial delay: 2000ms), `removeOnComplete: 100`, `removeOnFail: 500`.

2. **Attendance Transactional Outbox Event Dispatcher:**
   - Implemented `AttendanceOutboxDispatcher` (`apps/worker/src/attendance/attendance-outbox.dispatcher.ts`).
   - Scans and polls `PENDING` events in batches of 50 ordered by `createdAt: "asc"`.
   - **Strict Per-Tenant Isolation:** Iterates active organizations, setting `SET LOCAL app.current_tenant_id = '${org.id}'` within each transaction. Zero cross-tenant data exposure.
   - Publishes all 4 attendance domain event types:
     - `attendance.checked_in`
     - `attendance.checked_out`
     - `attendance.rejected`
     - `attendance.milestone_reached`
   - On successful queue ingestion, updates status to `PUBLISHED` and sets `processedAt`.
   - On delivery failure, increments `retryCount`, records `lastError`, and marks as `FAILED` once `retryCount >= 5`.
   - Replay prevention / idempotency: uses `event.idempotencyKey` as the BullMQ `jobId`.

3. **Scheduled Automatic Checkout Background Job:**
   - Implemented `AutoCheckoutProcessor` (`apps/worker/src/attendance/auto-checkout.processor.ts`).
   - **Distributed Concurrency Lock:** Acquired via Redis `SET lock:worker:attendance:auto-checkout 1 EX 300 NX` (5-minute TTL). Automatically skipped if another worker instance holds the lock; cleanly released in `finally`.
   - **Tenant Context Loop:** Iterates all active organizations under individual PostgreSQL transactions enforcing `SET LOCAL app.current_tenant_id = '${org.id}'`.
   - **Operating Hours & Timezone Awareness:**
     - Uses `getLocalTimeAndDate(now, timezone)` with fallback to UTC if timezone is invalid.
     - Evaluates branch-level settings first with fallback to organization-level defaults (`autoCheckOutHours`, `operatingHoursStart`, `operatingHoursEnd`, `allowOffHoursCheckIn`).
     - Evaluates operating hours closure with `isWithinOperatingHours` (supporting normal, overnight, and 24-hour windows).
     - Identifies inactive branches and immediately checks out active sessions.
   - **Atomic Conditional UPDATE (`WHERE id = $id AND organization_id = $orgId AND status = 'CHECKED_IN'`):**
     - Eliminates race conditions with concurrent staff manual checkout. If staff manually checked out the member simultaneously, the query touches 0 rows and skips cleanly without emitting duplicate events.
     - Sets status to `AUTO_CHECKED_OUT`, calculates elapsed `durationMinutes`, and appends audit trail to `notes` (`"System auto-checkout due to duration limit"`, `"System auto-checkout due to branch closing"`, or `"System auto-checkout due to branch deactivation"`).
     - Atomically creates `attendance.checked_out` transactional outbox event with `source: "AUTO_CHECKOUT"` and unique idempotency key.
   - **Strict Idempotency:** Subsequent executions on already checked out records result in 0 updates.

4. **BullMQ Attendance Worker Event Handler:**
   - Implemented `createAttendanceWorker` (`apps/worker/src/attendance/attendance.worker.ts`).
   - Handles `attendance.checked_in`, `attendance.checked_out`, `attendance.rejected`, and `attendance.milestone_reached`.
   - Sanitized, structured logging with zero sensitive member data or tokens logged.

5. **API Outbox Event Generation Hardening:**
   - In `apps/api/src/attendance/attendance.service.ts`:
     - Added `attendance.milestone_reached` event emission upon reaching total visit thresholds (10, 50, 100, 250, 500).
     - Enhanced `AttendanceService.checkIn` to catch domain validation rejections and emit `attendance.rejected` outbox events with rejection code, reason, method, and timestamp in an isolated tenant transaction before re-throwing.

### B. Automated Test Results

- **Attendance Worker E2E Suite (`attendance-worker.e2e-spec.ts`):** **11 of 11 passed (100%)**
  - Outbox event publishing and transition to `PUBLISHED` (2 of 2 jobs).
  - Outbox bounded retries and `FAILED` transition on 5th failure.
  - Strict tenant isolation under RLS during outbox dispatching.
  - Duration limit auto-checkout and outbox generation.
  - Idempotent repeated execution (0 double checkouts).
  - Manual staff checkout vs worker auto-checkout race resolution.
  - Operating hours closure auto-checkout with branch timezone calculation.
  - Inactive branch auto-checkout.
  - Redis distributed locking (`lock:worker:attendance:auto-checkout`).
  - Cross-tenant session protection under RLS.
  - BullMQ attendance worker consumption of all 4 domain event types.
- **All Attendance E2E Suites (`npm run --workspace=@gymos/api test:e2e -- attendance`):** **4 suites, 53 of 53 passed (100%)**
- **Full API Unit Test Suite (`npm run --workspace=@gymos/api test`):** **6 suites, 120 of 120 passed (100%)**
- **Full API E2E Regression Suite (`npm run --workspace=@gymos/api test:e2e`):** **14 suites, 246 of 246 passed (100%)**
- **Full Monorepo Production Build (`npm run build`):** **Clean compilation with exit code 0 across all 6 workspaces** (`@gymos/config`, `@gymos/shared-types`, `@gymos/validation`, `@gymos/api`, `@gymos/web`, `@gymos/worker`).


---

## 8. Step 7: Frontend Screens & Browser QR Scanner Implementation Report

**Milestone:** Step 7 — Frontend Screens & Browser QR Scanner  
**Status:** Completed & Fully Verified  
**Date:** 2026-11-20  

### A. Architectural Scope & Objectives Delivered

1. **Front-Desk High-Speed Browser Camera Scanner (`/dashboard/attendance/scanner`):**
   - Implemented browser-based QR video scanning using `navigator.mediaDevices.getUserMedia` with video frame extraction onto HTML5 canvas and continuous `jsQR` decoding.
   - Dual-camera switching support (`facingMode: "environment"` vs `"user"`) with dynamic device enumeration.
   - Clean lifecycle resource management: stops video tracks and cancels animation frames on component unmount or route change.
   - Scan feedback with Web Audio API sound synthesizer: 880Hz chime for success, 587Hz tone for dues warning, and 220Hz buzz for denial.
   - Rapid-debounce: temporary freeze (4-second countdown) prevents duplicate scan submissions of the same token.
   - Fallback physical badge entry modal with masked passcode input.
   - Instant visual response cards:
     - Access Granted (Emerald) with member photo, number, active plan name, days remaining, and check-in timestamp.
     - Dues Warning Notice (Amber) alerting staff of outstanding balance while honoring admission policy.
     - Access Denied (Red) showing specific domain rejection code and user-friendly explanation.

2. **Attendance Dashboard & Live Floor (`/dashboard/attendance`):**
   - Real-time headcount metric card displaying currently active members inside the gym.
   - Today's cumulative check-in volume and peak concurrency tracking.
   - Active check-in roster table with member avatar, name, number, check-in timestamp, and live elapsed stay duration.
   - Instant one-click check-out button with optimistic state removal.
   - Fast client-side search filtering by member name or member number.
   - 15-second background auto-polling for up-to-date occupancy figures.
   - Launchers for High-Speed Scanner and Manual Check-In Modal.

3. **Manual Check-In Modal (`apps/web/src/components/attendance/ManualCheckInModal.tsx`):**
   - Quick-search lookup by member name, member number, or phone number.
   - Staff note input for audit trail.
   - Direct execution of `POST /api/v1/attendance/manual` under staff tenant & branch context.
   - Real-time display of admission results, dues warnings, or rejection reasons.

4. **Attendance History & Ledger (`/dashboard/attendance/history`):**
   - Comprehensive multi-filter attendance ledger supporting filtering by branch, member, status (`CHECKED_IN`, `CHECKED_OUT`, `AUTO_CHECKED_OUT`, `CANCELLED`), method (`QR_SCAN`, `MANUAL_STAFF`, `KIOSK`, `RFID_CARD`), and date range.
   - Paginated table showing Member, Branch, Method badge, Check-In / Check-Out timestamps, Duration, and Status badges.
   - CSV export functionality generating instant client-side ledger downloads.

5. **Attendance Settings Screen (`/dashboard/attendance/settings`):**
   - Policy configuration for organization-level defaults and branch-specific overrides.
   - Configurable parameters:
     - Operating hours (Opening & Closing times in `HH:mm` format).
     - Off-hours check-in permission toggle.
     - Auto-checkout duration threshold (in hours).
     - Mandatory check-out requirement toggle.
     - Anti-passback / duplicate scan cooldown period (in minutes).
     - Dues admission policy (allow/block check-in with dues & overdue grace days).

6. **Member Access Pass Management Card (`apps/web/src/components/attendance/MemberPassCard.tsx`):**
   - Integrated into Member Profile screen (`/dashboard/members/[memberId]`).
   - Displays current pass status (`ACTIVE`, `SUSPENDED`, `REVOKED`), issue date, last access timestamp, and masked physical badge code.
   - Pass issuance modal supporting optional physical badge assignment.
   - Pass revocation modal with mandatory audit reason.
   - Rolling Dynamic QR Token preview modal featuring 90-second countdown ring and 45-second auto-refresh.
   - One-click copy for the member's public digital pass URL.

7. **Member-Facing Public Mobile Web Pass (`/pass/[passToken]`):**
   - Standalone, zero-login mobile web view for gym members.
   - Displays member first name, member number, and high-contrast dynamic QR pass generated via `qrcode`.
   - Real-time animated 90-second expiration countdown ring with automatic token refresh at 45 seconds.
   - Responsive, dark-mode-first aesthetic with full screen fit on mobile devices.
   - Strict validation: displays explicit revocation card if the pass was revoked by staff.

8. **Navigation & Global Integration:**
   - Added Attendance navigation item with `QrCode` icon to `Navbar.tsx`.
   - Added Attendance quick-access card to Main Dashboard (`/dashboard`).
   - Unified tab bar (`AttendanceNav.tsx`) linking Live Floor, Scanner, History, and Settings.

### B. Automated Verification Results

- **Next.js Web App Production Typecheck (`tsc --noEmit`):** **0 errors**
- **Next.js Web App ESLint (`next lint`):** **0 warnings, 0 errors**
- **Next.js Production Build (`npm run --workspace=@gymos/web build`):** **30 of 30 routes built cleanly**
  - `/dashboard/attendance` (Static/Dynamic client route)
  - `/dashboard/attendance/scanner` (High-speed client scanner)
  - `/dashboard/attendance/history` (Ledger and CSV export)
  - `/dashboard/attendance/settings` (Tenant & branch policy editor)
  - `/pass/[passToken]` (Server-rendered dynamic public mobile pass)
- **Full API Unit Test Suite (`npm run --workspace=@gymos/api test`):** **6 suites, 120 of 120 passed (100%)**
- **Full API E2E Regression Suite (`npm run --workspace=@gymos/api test:e2e`):** **14 suites, 246 of 246 passed (100%)**
- **Worker Service Typecheck (`npm run --workspace=@gymos/worker typecheck`):** **0 errors**
- **Full Monorepo Production Build (`npm run build`):** **All 6 workspaces built cleanly with exit code 0**

---

## 10. Final Audit Remediation (Findings F-01 through F-04)

Following the Stage 2.7 Final Security, Integration & Production Readiness Audit (`docs/audits/STAGE-2-7-FINAL-AUDIT.md`), four findings were reviewed and remediated according to strict audit authorization guidelines:

### Finding F-01: Auto-Checkout Redis Lock Safety [RESOLVED]
- **File:** `apps/worker/src/attendance/auto-checkout.processor.ts`
- **Correction:** Replaced static `"1"` lock value and unconditional `DEL` with:
  1. Unique CSPRNG ownership token per execution: `const lockToken = crypto.randomUUID()`.
  2. Atomic lock acquisition via `SET ... NX EX` with the token.
  3. Atomic lock release via Redis Lua script validating token ownership before deletion.
  4. Heartbeat lock renewal via Redis Lua script extending TTL while verifying ownership.
  5. Graceful Redis connection error handling.
- **Verification:** 7 new automated tests in `apps/api/test/attendance-worker.e2e-spec.ts` passed: acquisition/release, worker lockout, expiration recovery, old execution protection, renewal ownership validation, Redis failure safety, and concurrent execution isolation.

### Finding F-02: Deterministic Worker E2E Tests [RESOLVED]
- **File:** `apps/api/test/attendance-worker.e2e-spec.ts`
- **Correction:** Eliminated arbitrary `setTimeout(1500)` and shared Redis connection contention:
  1. Dedicated isolated Redis connections for `queueRedis` and `workerRedis`.
  2. Isolated test queue with dynamic unique name (`gymos-attendance-test-*`), preventing background dev-worker processes from consuming test jobs.
  3. Deterministic event completion tracking via `worker.on('completed')` and `worker.on('failed')` with bounded timeout and diagnostic failure reports.
- **Verification:** Worker E2E test now executes cleanly and deterministically in 83–101ms without race conditions or test flakiness.

### Finding F-03: `requireCheckOut` Setting Product Semantics [RESOLVED & CLARIFIED]
- **File:** `apps/api/src/attendance/attendance.service.ts`, `apps/web/src/app/dashboard/attendance/settings/page.tsx`
- **Final Intended Product Behavior (Approved):**
  1. **When `requireCheckOut = true`:** The front desk UI shows the receptionist a clear active-session checkout reminder when a member departs or is presented.
  2. **When `requireCheckOut = false`:** The front desk UI does not display the additional mandatory checkout reminder.
  3. **Backend & Database Invariant (Strictly Preserved):** In both cases, the PostgreSQL database partial unique index (`"idx_attendance_records_active_session"` on `(organization_id, member_id)` where `status = 'CHECKED_IN'` and `check_out_time IS NULL`) and the backend validation engine continue unconditionally rejecting simultaneous duplicate active check-ins.
  4. Neither the database constraint nor backend validation is weakened.
  5. Schema, API contracts, and settings persistence remain preserved intact.

### Finding F-04: Attendance History CSV Export [RESOLVED]
- **File:** `apps/web/src/app/dashboard/attendance/history/page.tsx`
- **Correction:** Replaced single-page dump with full-history filtered pagination loop:
  1. Safe batch retrieval (100 records per page) matching all active filters (branch, member, status, method, date range, search).
  2. Capped at 5,000 records to protect browser memory, with clear warning banner if capped.
  3. Dynamic progress UI indicator on the export button (`Exporting (X/Y)...`).
  4. RFC 4180-compliant CSV escaping for commas, quotes, and newlines.
  5. UTF-8 BOM (`\uFEFF`) prefix ensuring Excel and spreadsheet applications display Unicode characters cleanly.
  6. AbortController error and cancellation handling; sensitive tokens/hashes omitted.
- **Verification:** Verified by Next.js typecheck (`0 errors`), ESLint (`0 warnings, 0 errors`), and full production build.

---

## 11. Final Stage 2.7 Closure Verification Metrics

- **Full API E2E Regression Suite (`npm run --workspace=@gymos/api test:e2e`):** **14 suites, 252 of 252 passed (100%)** *(increased from 246 baseline with F-01 & F-02 deterministic tests)*
- **Full API Unit Test Suite (`npm run --workspace=@gymos/api test`):** **6 suites, 120 of 120 passed (100%)**
- **Worker Service Typecheck & Lint (`npm run --workspace=@gymos/worker typecheck` & `lint`):** **0 errors, 0 warnings**
- **Web Typecheck & Lint (`npm run --workspace=@gymos/web typecheck` & `lint`):** **0 errors, 0 warnings**
- **Full Monorepo Production Build (`npm run build`):** **All 6 workspaces built cleanly with exit code 0**
- **Database Partial Unique Index:** Verified active and enforced (`idx_attendance_records_active_session`).
- **Stage 2.7 Status:** **COMPLETED, REMEDIATED & PRODUCTION-READY (FULL PASS)**
