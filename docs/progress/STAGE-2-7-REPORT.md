# GYMOS — STAGE 2.7 PROGRESS REPORT
## Attendance Management & QR Check-In System

**Stage:** 2.7 — Attendance Management & QR Check-In System  
**Baseline Commit:** `e1f9f46`  
**Current Milestone:** Step 3 — Cryptographic QR Token Service  
**Current Status:** STEP 3 COMPLETED & VERIFIED (Awaiting Step 4 Authorization)

---

## 1. Executive Summary

Stage 2.7 establishes a zero-hardware-cost, multi-tenant QR attendance check-in engine for GymOS. This document tracks milestone-by-milestone progress, database changes, security verifications, and test execution.

---

## 2. Milestones Summary

| Milestone | Description | Status | Commit | Verification |
| :---: | :--- | :---: | :---: | :--- |
| **Step 1** | Database Migration, Enums & PostgreSQL RLS | **COMPLETED** | `d57757e` | 4 tables created; RLS `ENABLE` + `FORCE` with zero SuperAdmin bypass; partial unique index verified against concurrent transactions; 193/193 regression tests passed. |
| **Step 2** | Shared Types, DTOs & Zod Validation Schemas | **COMPLETED** | `af1c673` | Comprehensive domain contracts in `@gymos/shared-types`; zero secret leakage; strict Zod validation in `@gymos/validation`; 29 unit tests passed; all workspaces build clean; 193/193 regression tests passed. |
| **Step 3** | QR Cryptographic Token Service | **COMPLETED** | *(pending)* | AES-256-GCM envelope encryption (`enc:v1:`); HMAC-SHA256 dynamic tokens (90s expiry, 5s skew, constant-time compare); Redis atomic nonce replay prevention (NX, 180s TTL, fail-closed on Redis failure); salted SHA-256 physical passcodes (16-char unambiguous alphabet); 23 unit tests + 4 live Redis E2E integration tests; 197/197 regression tests passed. |
| **Step 4** | Attendance Service & Validation Engine | *PENDING* | — | *Awaiting authorization* |
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
