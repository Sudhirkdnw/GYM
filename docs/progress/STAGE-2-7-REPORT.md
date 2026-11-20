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
