# GYMOS — STAGE 2.7 IMPLEMENTATION PLAN
## Attendance Management & QR Check-In System

**Version:** 2.0.0  
**Status:** REVISED — PENDING FINAL APPROVAL  
**Baseline Commit:** `e1f9f46`  
**Prerequisites:** Stages 2.1–2.6  
**Primary Target:** Multi-tenant QR-based Member Check-In, Zero-Hardware Browser Camera Scanning, Deterministic Validation Pipeline, Partial Unique Index Concurrency, Live Occupancy Dashboard, Attendance History, and Automation-Ready Lifecycle Events.

---

## 1. Product & Architectural Objectives

GymOS Stage 2.7 establishes a **zero-hardware-cost, high-throughput, multi-tenant attendance management engine**. Using any existing smartphone, tablet, or laptop front-desk camera via standard browser APIs (`navigator.mediaDevices.getUserMedia`), gym staff can scan member QR codes to validate entry safely and deterministically.

### Core Architecture Pillars

1. **Zero Proprietary Hardware Reliance:** All scanning runs directly within standard desktop and mobile web browsers. Dedicated RFID scanners, proprietary turnstiles, and external biometric devices are explicitly deferred to future phases.
2. **Dual-Token QR Credential Architecture:**
   - **Dynamic Rolling QR (Mobile Web Pass):** Cryptographically signed HMAC-SHA256 sliding tokens with 90-second lifespan and rotating nonces to prevent replay and screenshot reuse.
   - **Persistent Physical Badge Pass (Laminated Card/Keyfob):** High-entropy 16-character alphanumeric opaque passcodes stored strictly as cryptographic hashes for members without mobile devices.
3. **PostgreSQL-Enforced Concurrency & Integrity:** Database-level concurrency protection using a **PostgreSQL partial unique index** (`WHERE status = 'CHECKED_IN'`) guaranteeing zero possibility of duplicate active sessions or double check-ins across concurrent scanner terminals.
4. **Deterministic Server-Side Validation Pipeline:** Multi-factor server-side entry rules evaluating active member status, inclusive subscription validity dates, active freeze periods, branch access scopes, and configurable overdue billing dues policies.
5. **Hierarchical Settings Engine:** Deterministic settings precedence: `Branch Override → Organization Setting → Hardcoded System Default`.
6. **Live Floor & Occupancy Analytics:** Real-time in-gym headcount, live active member roster with one-click manual check-out, visit duration analytics, and peak-hour distribution heatmaps.
7. **Transactional Outbox for Event-Driven Automation:** Emits `attendance.checked_in`, `attendance.checked_out`, `attendance.rejected`, and `attendance.milestone_reached` events within the check-in transaction for future automated WhatsApp/SMS messaging.
8. **Strict Multi-Tenant Security & PostgreSQL RLS:** PostgreSQL Row-Level Security (`ENABLE` + `FORCE`) with **zero SuperAdmin bypass** across all attendance tables.

---

## 2. Scope Boundaries & Explicit Non-Goals

To maintain strict project discipline and protect stability, Stage 2.7 explicitly defines its scope boundaries:

### In Scope
- Browser camera QR code scanning via HTML5 `MediaDevices` API on desktop, tablet, and mobile.
- Dynamic rotating QR generation and HMAC-SHA256 token verification.
- Opaque physical badge code issuance, salted cryptographic hash storage, and scan resolution.
- Multi-factor server-side membership and overdue dues validation reusing existing Stage 2.4–2.6 services.
- Database partial unique index enforcing at most one active check-in per member.
- Atomic, idempotent manual and automatic check-outs.
- Front-desk manual check-in search (by member name, phone number, or member number).
- Live gym floor dashboard and historical attendance ledger with CSV/Excel export.
- Organization-level and branch-level attendance policy configuration.
- Transactional outbox events for attendance lifecycle events.
- Background worker routine for scheduled auto-checkout.

### Explicitly Out of Scope (Non-Goals)
- **RFID / NFC Hardware Integration:** Proprietary USB/serial RFID card readers or turnstile relay boards are out of scope. The database schema retains the `RFID_CARD` enum value for future forward-compatibility, but no hardware drivers or serial port communication code will be implemented.
- **Dedicated KIOSK Hardware:** "Kiosk" in GymOS refers strictly to a responsive browser-based self-service or check-in webpage running in full-screen/kiosk mode on an iPad, tablet, or touchscreen monitor, NOT dedicated proprietary kiosk hardware.
- **Member Mobile Native App / Mandatory Member Login:** Member self-service mobile app login is out of scope. Member dynamic passes are delivered via secure, tokenized web URLs (e.g. sent via WhatsApp/SMS or displayed by front desk), allowing members to view dynamic passes without logging in.
- **Full Automation Engine:** Automated message delivery (WhatsApp/SMS gateways) remains deferred to Stage 3. Stage 2.7 strictly implements the transactional outbox event production.
- **Custom Tenant / Auth Workarounds:** No bypasses or alternative RLS mechanisms. All queries strictly use `PrismaService.withTenantContext(organizationId, ...)`.

---

## 3. Threat Model & Dual-Token Cryptographic Security

### A. Threat Model & Attack Vectors

| Threat Vector | Attack Scenario | Mitigation in GymOS Stage 2.7 | Residual Risk & Defense-in-Depth |
| :--- | :--- | :--- | :--- |
| **Historical Screenshot Reuse** | Member takes screenshot of dynamic QR and uses it days later. | Dynamic tokens expire after 90 seconds. Expired tokens are rejected by server (`EXPIRED_TOKEN`). | None. Expired tokens cannot be redeemed. |
| **Nonce Replay Attack** | Attacker intercepts a valid dynamic token and attempts to scan it twice. | Redis atomic `SET attendance:nonce:<orgId>:<nonce> 1 EX 180 NX` ensures any presented nonce can only be processed once. | None. Second attempt immediately rejected with `TOKEN_REPLAY_DETECTED`. |
| **Forwarded Live Screenshot (Accomplice Attack)** | Member takes a screenshot of their active dynamic QR and immediately forwards it via WhatsApp to an accomplice who scans it within the 90s window. | Replay protection alone cannot detect if the physical presenter is the legitimate member. Mitigated by: (1) Anti-passback cooldown (default 10m) prevents both parties from entering; (2) UI moving animation makes static screenshots visible to staff; (3) Front-desk scanner prominently displays member photo and name for mandatory visual verification. | **Residual Risk:** If an accomplice arrives first within 90s and staff does not verify photo, entry could occur. **Remedy:** Photo verification alert on front-desk screen is the authoritative human verification gate. |
| **Physical Badge Pass Sharing** | Member hands physical badge card to a friend standing behind them in line. | Anti-passback cooldown window (e.g., 10 minutes) rejects consecutive scans of the same pass code; scanner UI displays member photo for visual check. | Physical card sharing outside the cooldown window is mitigated by mandatory staff visual photo check. |
| **Database Credential Leakage** | Database backup or read replica is compromised; attacker attempts to extract member passcodes or forge QR tokens. | 1. Raw badge passcodes are NEVER stored in DB; only salted SHA-256 hashes are stored.<br>2. Dynamic QR secrets (`hmacSecret`) are encrypted at rest using AES-256-GCM envelope encryption with an application master key. | Compromised DB rows yield zero plain-text passcodes and zero usable HMAC signing keys. |
| **Brute-Force Passcode Enumeration** | Attacker repeatedly inputs or scans sequential badge passcodes at scanner or API. | 1. 16-character CSPRNG passcodes have 80 bits of entropy ($32^{16} \approx 1.2 \times 10^{24}$ combinations).<br>2. Redis-backed rate limiter restricts failed badge lookups to max 5 attempts per 60s per branch IP/terminal, triggering a 5-minute lockout upon violation. | Brute force is computationally and rate-limit infeasible. |

---

### B. Dynamic Rolling QR Token Lifecycle (Mobile Web Pass)

Because GymOS does not require a native mobile app or member login account, dynamic passes are accessed via a lightweight, secure web pass page.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        DYNAMIC ROLLING QR TOKEN LIFECYCLE                              │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [Front Desk / SMS Link]                [Member Mobile Browser]             [GymOS API & Redis]
           │                                       │                                 │
           │ 1. Share/Open Pass Web Link           │                                 │
           │    https://.../p/:passToken           │                                 │
           ├──────────────────────────────────────►│                                 │
           │                                       │ 2. GET /passes/:passToken/view  │
           │                                       ├────────────────────────────────►│ (Validates token,
           │                                       │                                 │  returns pass HTML
           │                                       │◄────────────────────────────────┤  with client session)
           │                                       │                                 │
           │                                       │ 3. POST /passes/:id/token       │
           │                                       │    (Pass Session Ticket)        │
           │                                       ├────────────────────────────────►│ (Generates nonce,
           │                                       │                                 │  signs HMAC-SHA256,
           │                                       │◄────────────────────────────────┤  sets exp = now + 90s)
           │                                       │ 4. Renders Rolling QR + Counter │
           │                                       │    (Auto-refreshes every 45s)   │
           │                                       │                                 │
           │                                       │ 5. Front-Desk Scans QR          │
           │                                       └──────────────┬──────────────────┘
           │                                                      │
           ▼                                                      ▼
 ┌───────────────────────────────────────────────────────────────────────────────────┐
 │ Front-Desk Scanner Terminal: POST /api/v1/attendance/check-in                      │
 ├───────────────────────────────────────────────────────────────────────────────────┤
 │ Server Validation:                                                                │
 │ 1. Parse header.payload.signature                                                 │
 │ 2. Decrypt member's hmacSecret using AES-256-GCM master key                       │
 │ 3. Timing-safe verify HMAC-SHA256 signature                                       │
 │ 4. Verify exp: now <= exp + 5s (skew tolerance)                                   │
 │ 5. Atomic Redis Replay Check: SET attendance:nonce:<orgId>:<nce> 1 EX 180 NX      │
 │    -> If null, REJECT with 409 TOKEN_REPLAY_DETECTED                              │
 │ 6. Proceed to Membership, Freeze, Branch Scope & Financial Validation             │
 └───────────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Token Specifications
1. **Token Format:**
   `GYMOS:V1:<header_b64url>.<payload_b64url>.<signature_b64url>`
2. **Payload Structure:**
   ```json
   {
     "sub": "b2f0a1d4-8392-491a-96e0-32df92c90abc",  // memberId (UUID)
     "org": "c1a9e3f2-1234-4567-89ab-cdef01234567",  // organizationId (UUID)
     "typ": "DYN",                                     // Dynamic rolling pass
     "iat": 1732098000,                               // Issued at (Unix timestamp)
     "exp": 1732098090,                               // Expires at (iat + 90s)
     "nce": "4f9a1c8e3b2d10a9"                        // 12-byte CSPRNG random hex nonce
   }
   ```
3. **Cryptographic Signing & Verification:**
   - Signer uses `crypto.createHmac('sha256', decryptedHmacSecret)`.
   - Verification uses timing-safe equality comparison (`crypto.timingSafeEqual`) to prevent side-channel timing attacks.
4. **Secret Protection at Rest (Envelope Encryption):**
   - In `member_access_passes`, the secret is stored in column `hmac_secret_encrypted`.
   - Encrypted with AES-256-GCM using an organization-scoped derived key or application master key (`ATTENDANCE_SECRET_MASTER_KEY`).
   - Stored format: `enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>`.
5. **Pass Revocation & Secret Rotation:**
   - Revoking a pass immediately marks `status = 'REVOKED'`, records `revoked_at` and `revoked_by_id`, and rotates `hmac_secret_encrypted` to a new random 32-byte secret.
   - Any outstanding tokens issued under the old secret fail HMAC verification instantly.

---

### C. Persistent Physical Badge Pass Security

For members who use physical ID cards, keyfobs, or laminated tags:

1. **Passcode Generation:**
   - Generated using a Cryptographically Secure Pseudo-Random Number Generator (CSPRNG): `crypto.randomBytes(16)`.
   - Encoded using an unambiguous 32-character alphabet: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (excludes confusing characters `0`, `O`, `1`, `I`).
   - Formatted for human readability: `A7K9-W3M2-X8P1-Q4V6` (16 characters, 80 bits of cryptographic entropy).
2. **One-Way Salted Hash Storage:**
   - The database **NEVER** stores the raw passcode in plain text.
   - Schema stores:
     * `pass_code_hash`: SHA-256 hash of `(passcode + salt + organizationId)`.
     * `pass_code_salt`: 16-byte random salt generated per pass.
     * `pass_code_masked`: Masked string for staff identification (e.g. `A7K9-****-****-Q4V6`).
3. **Lookup & Verification:**
   - Front-desk scanner receives `GYMOS:PASS:<rawPasscode>`.
   - System hashes the incoming code against stored salts in the organization or queries via tenant-salted hash lookup.
4. **Rate Limiting & Brute-Force Prevention:**
   - Redis rate limiter tracks failed badge attempts: `attendance:failed_badge:<branchId>:<clientIp>`.
   - Max 5 failed lookups per 60 seconds.
   - Exceeding the threshold triggers an automatic 5-minute IP/terminal block and logs a `SECURITY_BADGE_BRUTE_FORCE_ATTEMPT` audit entry.
5. **Badge Replacement & Audit:**
   - If a card is lost, staff clicks "Revoke & Replace".
   - Old pass is marked `status = 'REVOKED'`; new pass is issued with a new random code and new salt.
   - Full audit trail recorded in `audit_logs`.

---

## 4. Database Concurrency Guarantees & Schema Design

### A. Database-Level Protection Against Concurrency Violations

To eliminate race conditions between dual scanners, simultaneous manual/QR entries, or worker overlaps, GymOS enforces concurrency at the **PostgreSQL engine level**:

```
                               CONCURRENCY RACE PROTECTION
  
   Scanner Terminal 1 (Door A)                    Scanner Terminal 2 (Door B)
              │                                              │
              │ Check-In Request: Member M1                  │ Check-In Request: Member M1
              │ (T = 0ms)                                    │ (T = 5ms)
              ▼                                              ▼
   ┌────────────────────────────────┐             ┌────────────────────────────────┐
   │ BEGIN TRANSACTION              │             │ BEGIN TRANSACTION              │
   │ INSERT INTO attendance_records │             │ INSERT INTO attendance_records │
   │ (member_id = M1,               │             │ (member_id = M1,               │
   │  status = 'CHECKED_IN')        │             │  status = 'CHECKED_IN')        │
   └──────────────┬─────────────────┘             └──────────────┬─────────────────┘
                  │                                              │
                  ▼                                              ▼
        ┌───────────────────┐                         ┌───────────────────┐
        │ PostgreSQL Engine │                         │ PostgreSQL Engine │
        │ Evaluates Partial │                         │ Evaluates Partial │
        │ Unique Index      │                         │ Unique Index      │
        └─────────┬─────────┘                         └─────────┬─────────┘
                  │                                              │
                  ▼                                              ▼
            [SUCCESS: 201]                                 [FAIL: 23505]
            Transaction Committed                         Unique Constraint Violated!
                                                          Rollback -> HTTP 409
                                                          "ALREADY_CHECKED_IN"
```

1. **PostgreSQL Partial Unique Index:**
   ```sql
   CREATE UNIQUE INDEX idx_attendance_records_active_session 
   ON attendance_records (organization_id, member_id) 
   WHERE status = 'CHECKED_IN';
   ```
   - **Guaranteed by Database:** A member can have at most **ONE** record in `status = 'CHECKED_IN'` within an organization at any instant in time.
   - If two concurrent scans or a scan and a manual check-in occur simultaneously, exactly one transaction will succeed; the second transaction will fail with PostgreSQL error code `23505` (`unique_violation`), which the API catches and maps to `409 Conflict: ALREADY_CHECKED_IN`.
   - When a member checks out, `status` changes to `CHECKED_OUT`, releasing the partial unique index condition and allowing subsequent check-ins.

2. **Atomic & Idempotent Check-Out:**
   Check-out operations must be completely atomic and idempotent:
   ```sql
   UPDATE attendance_records
   SET status = 'CHECKED_OUT',
       check_out_time = $now,
       duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM ($now - check_in_time)) / 60))
   WHERE id = $attendanceId 
     AND organization_id = $organizationId 
     AND status = 'CHECKED_IN'
   RETURNING *;
   ```
   - If `rows_affected == 0`, the record is either already checked out or does not exist. The service returns HTTP 200 with the existing record rather than failing, ensuring idempotency across network retries.

3. **Manual Check-out vs Auto-Checkout Worker Race:**
   - Both staff manual checkout and background worker auto-checkout execute conditional updates matching `WHERE status = 'CHECKED_IN'`.
   - If staff manually checks out a member while the worker auto-checkout job is executing, the worker's atomic UPDATE touches 0 rows and gracefully skips the record.

4. **Duplicate Worker Execution Protection:**
   - Auto-checkout worker runs every 30 minutes.
   - Before scanning records, the worker acquires a Redis distributed lock:
     `SET lock:worker:attendance:auto-checkout 1 EX 300 NX`
   - If another worker instance holds the lock, execution aborts immediately, preventing duplicate processing.

---

### B. Prisma Schema & Table Definitions

Stage 2.7 introduces 4 new database tables and 3 new enums:

```prisma
enum AttendanceMethod {
  QR_SCAN
  MANUAL_STAFF
  KIOSK
  RFID_CARD // Reserved for future hardware integration; out of scope in 2.7

  @@map("attendance_method")
}

enum AttendanceStatus {
  CHECKED_IN
  CHECKED_OUT
  AUTO_CHECKED_OUT
  CANCELLED

  @@map("attendance_status")
}

enum PassStatus {
  ACTIVE
  SUSPENDED
  REVOKED

  @@map("pass_status")
}

/// MemberAccessPass stores cryptographic credentials and hashed badge codes
model MemberAccessPass {
  id                    String        @id @default(uuid()) @map("id") @db.Uuid
  organizationId        String        @map("organization_id") @db.Uuid
  memberId              String        @map("member_id") @db.Uuid
  
  passCodeHash          String?       @map("pass_code_hash") @db.VarChar(128)
  passCodeSalt          String?       @map("pass_code_salt") @db.VarChar(64)
  passCodeMasked        String?       @map("pass_code_masked") @db.VarChar(32)
  
  hmacSecretEncrypted   String        @map("hmac_secret_encrypted") @db.VarChar(255)
  status                PassStatus    @default(ACTIVE) @map("status")
  
  issuedAt              DateTime      @default(now()) @map("issued_at") @db.Timestamptz
  revokedAt             DateTime?     @map("revoked_at") @db.Timestamptz
  revokedById           String?       @map("revoked_by_id") @db.Uuid
  revocationReason      String?       @map("revocation_reason") @db.VarChar(255)
  lastScannedAt         DateTime?     @map("last_scanned_at") @db.Timestamptz
  lastScannedBranchId   String?       @map("last_scanned_branch_id") @db.Uuid
  
  createdAt             DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  organization          Organization  @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  member                Member        @relation(fields: [memberId], references: [id], onDelete: Restrict)

  @@unique([organizationId, memberId], name: "unique_org_member_pass")
  @@unique([organizationId, passCodeHash], name: "unique_org_pass_hash")
  @@index([organizationId, status], map: "idx_passes_org_status")
  @@map("member_access_passes")
}

/// AttendanceRecord stores individual member visit sessions
model AttendanceRecord {
  id                    String            @id @default(uuid()) @map("id") @db.Uuid
  organizationId        String            @map("organization_id") @db.Uuid
  branchId              String            @map("branch_id") @db.Uuid
  memberId              String            @map("member_id") @db.Uuid
  membershipId          String?           @map("membership_id") @db.Uuid
  
  checkInTime           DateTime          @default(now()) @map("check_in_time") @db.Timestamptz
  checkOutTime          DateTime?         @map("check_out_time") @db.Timestamptz
  durationMinutes       Int?              @map("duration_minutes")
  
  method                AttendanceMethod  @default(QR_SCAN) @map("method")
  status                AttendanceStatus  @default(CHECKED_IN) @map("status")
  
  verifiedById          String?           @map("verified_by_id") @db.Uuid
  notes                 String?           @map("notes") @db.VarChar(255)
  rejectionReason       String?           @map("rejection_reason") @db.VarChar(255)
  
  createdAt             DateTime          @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime          @updatedAt @map("updated_at") @db.Timestamptz

  organization          Organization      @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  branch                Branch            @relation(fields: [branchId], references: [id], onDelete: Restrict)
  member                Member            @relation(fields: [memberId], references: [id], onDelete: Restrict)
  membership            MemberMembership? @relation(fields: [membershipId], references: [id], onDelete: SetNull)

  @@index([organizationId, branchId, checkInTime], map: "idx_attendance_org_branch_time")
  @@index([organizationId, memberId, checkInTime], map: "idx_attendance_org_member_time")
  @@index([organizationId, status, checkInTime], map: "idx_attendance_org_status_time")
  @@map("attendance_records")
}

/// AttendanceSettings stores branch-level and organization-wide check-in policies
model AttendanceSettings {
  id                    String        @id @default(uuid()) @map("id") @db.Uuid
  organizationId        String        @map("organization_id") @db.Uuid
  branchId              String?       @map("branch_id") @db.Uuid
  
  allowCheckInWithDues  Boolean       @default(false) @map("allow_check_in_with_dues")
  maxOverdueGraceDays   Int           @default(0) @map("max_overdue_grace_days")
  cooldownMinutes       Int           @default(10) @map("cooldown_minutes")
  requireCheckOut       Boolean       @default(false) @map("require_check_out")
  autoCheckOutHours     Int           @default(3) @map("auto_check_out_hours")
  operatingHoursStart   String        @default("05:00") @map("operating_hours_start") @db.VarChar(10)
  operatingHoursEnd     String        @default("23:00") @map("operating_hours_end") @db.VarChar(10)
  allowOffHoursCheckIn  Boolean       @default(false) @map("allow_off_hours_check_in")
  
  createdAt             DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  organization          Organization  @relation(fields: [organizationId], references: [id], onDelete: Restrict)
  branch                Branch?       @relation(fields: [branchId], references: [id], onDelete: Restrict)

  @@unique([organizationId, branchId], name: "unique_org_branch_attendance_settings")
  @@map("attendance_settings")
}

/// AttendanceOutboxEvent implements the Transactional Outbox Pattern for check-in events
model AttendanceOutboxEvent {
  id                    String        @id @default(uuid()) @map("id") @db.Uuid
  organizationId        String        @map("organization_id") @db.Uuid
  aggregateId           String        @map("aggregate_id") @db.VarChar(100)
  eventType             String        @map("event_type") @db.VarChar(100)
  payload               Json          @map("payload")
  status                OutboxStatus  @default(PENDING) @map("status")
  retryCount            Int           @default(0) @map("retry_count")
  lastError             String?       @map("last_error") @db.Text
  processedAt           DateTime?     @map("processed_at") @db.Timestamptz
  idempotencyKey        String        @unique @map("idempotency_key") @db.VarChar(200)
  createdAt             DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt             DateTime      @updatedAt @map("updated_at") @db.Timestamptz

  organization          Organization  @relation(fields: [organizationId], references: [id], onDelete: Restrict)

  @@index([organizationId, status], map: "idx_attendance_outbox_org_status")
  @@index([status, createdAt], map: "idx_attendance_outbox_status_created")
  @@map("attendance_outbox_events")
}
```

---

### C. Migration DDL & Row-Level Security Policies

All four tables have PostgreSQL RLS enabled and forced with **ZERO SuperAdmin bypass**:

```sql
-- Forward Migration: 20261123000000_attendance_and_qr_system.sql

-- 1. Create partial unique index on active check-in
CREATE UNIQUE INDEX "idx_attendance_records_active_session" 
ON "attendance_records" ("organization_id", "member_id") 
WHERE "status" = 'CHECKED_IN';

-- 2. member_access_passes RLS
ALTER TABLE "member_access_passes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_access_passes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_member_access_passes" ON "member_access_passes"
  FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 3. attendance_records RLS
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_attendance_records" ON "attendance_records"
  FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 4. attendance_settings RLS
ALTER TABLE "attendance_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_attendance_settings" ON "attendance_settings"
  FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- 5. attendance_outbox_events RLS
ALTER TABLE "attendance_outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_outbox_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_attendance_outbox_events" ON "attendance_outbox_events"
  FOR ALL
  USING (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
```

---

## 5. Authoritative Server-Side Validation Pipeline

When an entry scan request is received (`POST /api/v1/attendance/check-in`), the server executes an authoritative, multi-tier validation sequence:

```
                            CHECK-IN VERIFICATION PIPELINE
  
  [Input: branchId, qrToken / passCode, Idempotency-Key]
     │
     ▼
  Step 1: Authenticate Scanner Staff & Verify Staff Branch Context
     │    • Staff must belong to tenant & be assigned to branchId
     ▼
  Step 2: Resolve & Validate Token Credential
     ├─► [Dynamic QR Token]
     │     • Decrypt secret, timing-safe verify HMAC-SHA256 signature
     │     • Check expiry: now <= exp + 5s
     │     • Atomic Redis Nonce check: SET attendance:nonce:<orgId>:<nonce> 1 EX 180 NX
     │       └─► If null: REJECT "TOKEN_REPLAY_DETECTED" (409)
     ├─► [Physical Badge Pass]
     │     • Check Redis failed-attempt rate limiter (max 5/min)
     │     • Compute salted SHA-256 hash & match DB pass_code_hash
     │     • Verify pass.status == 'ACTIVE'
     ▼
  Step 3: Resolve Organization Timezone & Operating Hours
     │    • Fetch organization.timezone (e.g., 'Asia/Kolkata')
     │    • Resolve effective settings (Branch Override -> Org Default -> Fallback)
     │    • Evaluate local time vs operatingHoursStart & operatingHoursEnd
     │    └─► Outside hours & allowOffHoursCheckIn == false: REJECT "OUTSIDE_OPERATING_HOURS" (403)
     ▼
  Step 4: Anti-Passback Cooldown Check
     │    • Check Redis key: attendance:cooldown:<orgId>:<memberId>
     │    └─► Exists: REJECT "ALREADY_CHECKED_IN" with remaining cooldown minutes (409)
     ▼
  Step 5: Authoritative Member Status Check (Stage 2.4 Service)
     │    • Member.status must be 'ACTIVE' (not 'SUSPENDED' or 'INACTIVE')
     │    └─► Inactive: REJECT "MEMBER_INACTIVE" / "MEMBER_SUSPENDED" (403)
     ▼
  Step 6: Authoritative Membership Subscription Validation (Stage 2.5 Service)
     │    • Query active subscriptions for member where:
     │      - MemberMembership.status == 'ACTIVE'
     │      - localDate >= startDate AND localDate <= endDate (inclusive boundaries)
     │    ├─► No active plan found: REJECT "NO_ACTIVE_MEMBERSHIP" (422)
     │    ├─► End date in past: REJECT "MEMBERSHIP_EXPIRED" (422)
     │    ├─► Start date in future: REJECT "MEMBERSHIP_PENDING" (422)
     │    ▼
     │    • Active Freeze Check:
     │      - Query MembershipFreeze where status == 'ACTIVE' and localDate between startDate & endDate
     │      └─► Frozen: REJECT "MEMBERSHIP_FROZEN" (422)
     │    ▼
     │    • Branch Eligibility Check:
     │      - MembershipPlan.allBranchesAccess == true OR exists MembershipPlanBranch for branchId
     │      └─► Not eligible: REJECT "BRANCH_ACCESS_DENIED" (403)
     ▼
  Step 7: Configurable Overdue Dues Policy Evaluation (Stage 2.6 Service)
     │    • Query open invoices where status == 'OVERDUE' and balanceDue > 0
     │    ├─► Has overdue dues & allowCheckInWithDues == false:
     │    │     - Calculate overdue days = (localDate - oldestInvoiceDueDate)
     │    │     - If overdue days > maxOverdueGraceDays:
     │    │         REJECT "OVERDUE_PAYMENT_BLOCKED" with total amount & invoice ref (402)
     │    │     - Else: Allow entry with dueWarning = true (grace period active)
     │    └─► allowCheckInWithDues == true: Allow entry with dueWarning = true
     ▼
  Step 8: Execute Atomic Check-In Database Transaction
     │    • BEGIN TRANSACTION (with tenant context set)
     │    • INSERT INTO attendance_records (status: 'CHECKED_IN', ...)
     │      (Enforced by PostgreSQL partial unique index: duplicate active check-in fails with 23505)
     │    • UPDATE member_access_passes SET last_scanned_at = now(), last_scanned_branch_id = branchId
     │    • INSERT INTO attendance_outbox_events (eventType: 'attendance.checked_in', ...)
     │    • COMMIT TRANSACTION
     ▼
  Step 9: Post-Commit State & Response
     │    • Set Redis cooldown key: attendance:cooldown:<orgId>:<memberId> EX cooldownMinutes*60
     │    • Return HTTP 201 with Member Photo, Name, Plan, and Dues Notice
```

> [!IMPORTANT]
> **No Duplicate Business Logic:** Validation strictly reuses the existing Stage 2.4 `Member`, Stage 2.5 `MemberMembership`, and Stage 2.6 `Invoice` repositories and services. Date boundary rules, leap year handling, and invoice balance computations remain centralized in their authoritative modules.

---

## 6. Attendance Settings Hierarchy & Inheritance Model

To provide gym chains flexibility while maintaining ease of management for single-facility gyms, attendance settings follow a strict **deterministic 3-tier hierarchy**:

```
 ┌────────────────────────────────────────────────────────────┐
 │                  DETERMINISTIC PRECEDENCE                  │
 │                                                            │
 │   1. Branch-Specific Override                              │
 │      (attendance_settings WHERE branch_id = :branchId)     │
 │                           │                                │
 │                           ▼ [If null or unset]             │
 │   2. Organization-Wide Setting                             │
 │      (attendance_settings WHERE branch_id IS NULL)         │
 │                           │                                │
 │                           ▼ [If null or unconfigured]      │
 │   3. Documented Hardcoded System Default                   │
 └────────────────────────────────────────────────────────────┘
```

### Settings Schema & Default Values

| Setting Attribute | Type | Default Value | Validation Rules | Description |
| :--- | :---: | :---: | :--- | :--- |
| `allowCheckInWithDues` | boolean | `false` | Boolean | Whether members with overdue invoices are permitted entry. |
| `maxOverdueGraceDays` | integer | `0` | Min: 0, Max: 90 | Days after invoice due date before check-in is strictly blocked. |
| `cooldownMinutes` | integer | `10` | Min: 1, Max: 120 | Anti-passback window blocking consecutive scans of the same pass. |
| `requireCheckOut` | boolean | `false` | Boolean | If true, staff is reminded to log checkout when member leaves. |
| `autoCheckOutHours` | integer | `3` | Min: 1, Max: 24 | Elapsed hours after which background worker auto-closes visit. |
| `operatingHoursStart` | string | `"05:00"` | Regex `^\d{2}:\d{2}$` | Opening time in organization local timezone. |
| `operatingHoursEnd` | string | `"23:00"` | Regex `^\d{2}:\d{2}$` | Closing time in organization local timezone. |
| `allowOffHoursCheckIn` | boolean | `false` | Boolean | Allows staff to check in members outside regular operating hours. |

---

## 7. Performance Objectives & Reliability Architecture

### A. Measurable Performance Targets

Rather than unrealistic absolute guarantees, GymOS specifies measurable performance targets under realistic production conditions:

| Metric | Target Objective | Conditions / Test Environment |
| :--- | :---: | :--- |
| **Check-In API Latency (p50)** | **< 120 ms** | Standard local Wi-Fi / 4G broadband; Redis cache active; single DB transaction. |
| **Check-In API Latency (p95)** | **< 250 ms** | Peak morning rush: 50 concurrent scans/minute across 5 active branch doors. |
| **QR Frame Decoding (Browser)** | **< 100 ms** | HTML5 `BarcodeDetector` API (or `@zxing/browser` fallback) on modern mobile browser. |
| **Live Headcount Query (p95)** | **< 80 ms** | Aggregated query on `attendance_records` using indexed partial state. |

---

### B. Fault Tolerance & Failure Handling

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FAILURE RECOVERY MATRIX                         │
├────────────────────┬───────────────────────────────────────────────────┤
│ Failure Scenario   │ System Behavior & Degradation Strategy            │
├────────────────────┼───────────────────────────────────────────────────┤
│ **Redis Outage**   │ • System degrades gracefully to PostgreSQL.       │
│                    │ • Partial unique index continues to guarantee zero│
│                    │   duplicate active check-ins.                     │
│                    │ • Cooldown check falls back to indexed SQL query  │
│                    │   on `attendance_records.check_in_time`.          │
│                    │ • Replay protection logs warning; relies on 90s   │
│                    │   token TTL. System continues operating safely.   │
├────────────────────┼───────────────────────────────────────────────────┤
│ **Database Failure│ • Any uncommitted database error immediately      │
│ / Transaction Roll-│   aborts check-in; transaction rolls back.        │
│ back**             │ • HTTP 500/503 returned to client.                │
│                    │ • **CRITICAL INVARIANT:** A check-in is NEVER    │
│                    │   accepted as successful without a committed      │
│                    │   PostgreSQL database transaction.                │
├────────────────────┼───────────────────────────────────────────────────┤
│ **Camera Access    │ • Scanner UI captures `NotAllowedError` /         │
│ Denied or Missing**│   `NotFoundError`.                                │
│                    │ • Displays non-blocking permission guide.         │
│                    │ • Instantly auto-focuses the "Manual Check-In"    │
│                    │   search input so front desk operations do not    │
│                    │   halt.                                           │
├────────────────────┼───────────────────────────────────────────────────┤
│ **Network Timeout  │ • Front-desk scanner HTTP client sets a 5000ms    │
│ & Retries**        │   request timeout.                                │
│                    │ • Every scan transmits an `X-Idempotency-Key`     │
│                    │   header containing a client-generated UUID.      │
│                    │ • If a retry occurs, backend returns the committed│
│                    │   record without duplicate database inserts.      │
└────────────────────┴───────────────────────────────────────────────────┘
```

---

## 8. Shared Types, DTOs & Validation Schemas

### A. `@gymos/shared-types` Updates

```typescript
export enum AttendanceMethod {
  QR_SCAN = 'QR_SCAN',
  MANUAL_STAFF = 'MANUAL_STAFF',
  KIOSK = 'KIOSK',
  RFID_CARD = 'RFID_CARD', // Forward-compatibility placeholder
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
  createdAt: string;
}

export interface CheckInResultData {
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

export interface MemberPassData {
  id: string;
  memberId: string;
  passCodeMasked?: string | null;
  qrPayload: string; // Dynamic signed token or formatted passCode
  status: PassStatus;
  issuedAt: string;
  lastScannedAt?: string | null;
}

export interface LiveOccupancyData {
  currentCount: number;
  capacity?: number;
  activeSessions: AttendanceRecordData[];
  peakTodayCount: number;
  totalCheckInsToday: number;
}

export interface AttendanceAnalyticsData {
  hourlyDistribution: { hour: number; count: number }[];
  dayOfWeekDistribution: { day: string; count: number }[];
  topAttendees: { memberId: string; name: string; memberNumber: string; visitCount: number }[];
  averageVisitDurationMinutes: number;
}
```

---

### B. `@gymos/validation` Schemas

```typescript
export const checkInSchema = z.object({
  branchId: z.string().uuid('Valid Branch ID is required'),
  qrToken: z.string().min(5, 'QR token is required').max(500),
  method: z.nativeEnum(AttendanceMethod).default(AttendanceMethod.QR_SCAN),
  notes: z.string().max(255).optional(),
});

export const manualCheckInSchema = z.object({
  branchId: z.string().uuid('Valid Branch ID is required'),
  memberId: z.string().uuid('Valid Member ID is required'),
  notes: z.string().max(255).optional(),
});

export const checkOutSchema = z.object({
  attendanceId: z.string().uuid('Valid Attendance ID is required'),
  notes: z.string().max(255).optional(),
});

export const attendanceQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
  memberId: z.string().uuid().optional(),
  status: z.nativeEnum(AttendanceStatus).optional(),
  method: z.nativeEnum(AttendanceMethod).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const attendanceSettingsSchema = z.object({
  branchId: z.string().uuid().optional(),
  allowCheckInWithDues: z.boolean().default(false),
  maxOverdueGraceDays: z.coerce.number().int().min(0).max(90).default(0),
  cooldownMinutes: z.coerce.number().int().min(1).max(120).default(10),
  requireCheckOut: z.boolean().default(false),
  autoCheckOutHours: z.coerce.number().int().min(1).max(24).default(3),
  operatingHoursStart: z.string().regex(/^\d{2}:\d{2}$/).default('05:00'),
  operatingHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).default('23:00'),
  allowOffHoursCheckIn: z.boolean().default(false),
});
```

---

## 9. Backend API Specification & RBAC Matrix

All endpoints reside under `/api/v1/attendance`:

```
POST   /api/v1/attendance/check-in             (Scan QR token or pass code to check in)
POST   /api/v1/attendance/manual-check-in      (Staff manual check-in by memberId)
POST   /api/v1/attendance/check-out            (Atomic, idempotent check-out)
GET    /api/v1/attendance/live                 (Live floor headcount & active roster)
GET    /api/v1/attendance/history              (Paginated, filterable attendance ledger)
GET    /api/v1/attendance/analytics            (Peak hour distribution & visit streaks)
GET    /api/v1/attendance/members/:id/pass     (Retrieve member pass metadata)
POST   /api/v1/attendance/members/:id/pass/revoke (Revoke lost pass & issue replacement)
GET    /api/v1/attendance/settings             (Get effective branch or org settings)
PUT    /api/v1/attendance/settings             (Create or update branch/org settings)
```

### RBAC Permission Matrix

| Endpoint | Required Permission | Authorized Roles |
| :--- | :--- | :--- |
| `POST /check-in` | `ORGANIZATION_ATTENDANCE_MANAGE` | `OWNER`, `ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `POST /manual-check-in` | `ORGANIZATION_ATTENDANCE_MANAGE` | `OWNER`, `ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `POST /check-out` | `ORGANIZATION_ATTENDANCE_MANAGE` | `OWNER`, `ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `GET /live` | `ORGANIZATION_ATTENDANCE_READ` | `OWNER`, `ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `GET /history` | `ORGANIZATION_ATTENDANCE_READ` | `OWNER`, `ADMIN`, `RECEPTIONIST`, `TRAINER` |
| `GET /analytics` | `ORGANIZATION_ATTENDANCE_READ` | `OWNER`, `ADMIN`, `RECEPTIONIST` |
| `GET /members/:id/pass` | `ORGANIZATION_ATTENDANCE_READ` | `OWNER`, `ADMIN`, `RECEPTIONIST` |
| `POST /members/:id/pass/revoke` | `ORGANIZATION_ATTENDANCE_MANAGE`| `OWNER`, `ADMIN`, `RECEPTIONIST` |
| `GET /settings` | `ORGANIZATION_ATTENDANCE_READ` | `OWNER`, `ADMIN`, `RECEPTIONIST` |
| `PUT /settings` | `ORGANIZATION_SETTINGS_UPDATE` | `OWNER`, `ADMIN` |

---

## 10. Frontend UI/UX Architecture (5 Dedicated Screens)

All screens adhere strictly to GymOS's Simple, Modern, Premium Light/Dark design standard with zero layout shifts:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DASHBOARD ATTENDANCE NAV                        │
├───────────────┬────────────────┬───────────────┬───────────────────────┤
│ [Live Floor]  │ [Scanner Mode] │ [Ledger Logs] │ [Peak Hours Analytics]│
└───────────────┴────────────────┴───────────────┴───────────────────────┘
```

### 1. High-Speed Front-Desk Scanner (`/dashboard/attendance/scanner`)
- **Responsive Viewfinder:** Clean bordered viewport with animated green scan beam using `navigator.mediaDevices.getUserMedia`.
- **Instant Visual Card Feedback:**
  - **Success (Green):** Large member photo, full name, membership package name, days remaining badge, and success chime audio alert.
  - **Dues Warning (Amber):** Displays yellow alert banner: "₹1,500 Payment Overdue (Invoice #INV-2026-0012) — Grace Period Active" with one-click "Collect Payment" shortcut.
  - **Denial (Red):** Bold red denial banner with specific reason ("Membership Expired 3 Days Ago", "Subscription Frozen Until Nov 25", "Anti-Passback Cooldown: 7 min remaining"), low buzz audio tone, and action button (e.g. "Renew Plan", "Unfreeze").
- **Auto-Reset Timer:** Card resets to camera scanning mode after 4 seconds (or instantly on next scan).
- **Graceful Camera Fallback:** Prominent "Manual Search Check-In" input box always accessible at top right with phone number / member number autocomplete.

### 2. Live Gym Floor View (`/dashboard/attendance/floor`)
- **Key Metrics:** Live In-Gym Count, Today's Total Check-Ins, Peak Today, Current Capacity %.
- **Live Active Roster Table:** Shows all members currently inside with arrival time, duration elapsed, home branch, and one-click "Check Out" button.
- **Auto-Refresh:** Configurable polling (every 15s) or reactive SSE to keep front desk headcount accurate.

### 3. Attendance Ledger & History (`/dashboard/attendance/history`)
- **Comprehensive Ledger:** Filterable by branch, date range, check-in method (`QR_SCAN`, `MANUAL_STAFF`), and status (`CHECKED_IN`, `CHECKED_OUT`, `AUTO_CHECKED_OUT`).
- **Export:** One-click CSV/Excel export for attendance audits and payroll verification.

### 4. Peak Hours & Occupancy Analytics (`/dashboard/attendance/analytics`)
- **Hourly Heatmap & Bar Chart:** Shows busiest workout hours (e.g., 6:00 AM–8:00 AM, 6:00 PM–8:00 PM) to optimize staff scheduling and equipment maintenance.
- **Top Attendees & Streaks:** Leaderboard of most consistent gym members to drive member retention and recognition.

### 5. Member Digital Access Pass Modal / Card
- **Accessible from:** Member Profile (`/dashboard/members/[id]`).
- **Live Dynamic Pass View:** Displays digital gym pass with moving circular progress timer (90s countdown) for mobile browser display.
- **Printable Badge Card:** Print-ready credit-card format with member photo, gym branding, and masked physical passcode for physical card printing.

---

## 11. Background Worker & Automation Outbox Integration

`apps/worker/src/main.ts` will be updated to include an Attendance Outbox Dispatcher and Auto-Checkout Processor:

1. **Transactional Outbox Events:**
   - `attendance.checked_in`: Emitted immediately upon valid entry.
   - `attendance.checked_out`: Emitted upon member departure.
   - `attendance.rejected`: Emitted on denied scans (capturing reason code for staff audit).
   - `attendance.milestone_reached`: Emitted when total visit count reaches 10, 50, 100, 250, 500, or when streak reaches 7 consecutive days.
2. **Auto-Checkout Routine:**
   - Runs every 30 minutes in the background worker.
   - Acquires distributed lock: `SET lock:worker:attendance:auto-checkout 1 EX 300 NX`.
   - Iterates through active organizations, establishing tenant context:
     `SET LOCAL app.current_tenant_id = '${org.id}'`
   - Executes atomic SQL update for sessions where `check_in_time < now - autoCheckOutHours`:
     ```sql
     UPDATE attendance_records
     SET status = 'AUTO_CHECKED_OUT',
         check_out_time = check_in_time + (INTERVAL '1 hour' * $autoCheckoutHours),
         duration_minutes = $autoCheckoutHours * 60,
         notes = COALESCE(notes || '; ', '') || 'System auto-checkout due to duration limit'
     WHERE organization_id = $orgId 
       AND status = 'CHECKED_IN'
       AND check_in_time < ($now - (INTERVAL '1 hour' * $autoCheckoutHours));
     ```

---

## 12. Test Strategy & Verification Plan

### Test Suites to Implement

1. **Cryptographic & Token Unit Tests:**
   - HMAC signing, timing-safe verification, sliding 90s expiration, clock-skew tolerance (+5s).
   - Atomic Redis nonce replay check: duplicate nonce rejected.
   - 16-character CSPRNG passcode generation from unambiguous alphabet and salted SHA-256 hash matching.
2. **Concurrency & Race Condition Suite:**
   - **PostgreSQL Partial Unique Index Verification:** 10 simultaneous check-in requests for the same member across parallel workers; exactly 1 transaction succeeds (201), 9 fail with 409 `ALREADY_CHECKED_IN` (PostgreSQL `23505` error caught and mapped cleanly).
   - **Simultaneous Manual & Auto-Checkout Race:** Staff manual checkout and worker auto-checkout executed concurrently; exactly one applies, duration calculated accurately, zero duplicate records or corrupt status.
3. **E2E Integration & Security Suite (`apps/api/test/attendance-management.e2e-spec.ts`):**
   - **Active Membership:** Active plan checks in successfully.
   - **Expired Plan:** Plan expired yesterday rejected with 422 `MEMBERSHIP_EXPIRED`.
   - **Pending Plan:** Plan starting tomorrow rejected with 422 `MEMBERSHIP_PENDING`.
   - **Frozen Plan:** Active freeze rejected with 422 `MEMBERSHIP_FROZEN`.
   - **Branch Restriction:** Single-branch plan checked in at unauthorized Branch 2 rejected with 403 `BRANCH_ACCESS_DENIED`.
   - **Multi-Branch Plan:** Multi-branch plan checks in successfully at Branch 2.
   - **Financial Overdue Policy:**
     * `allowCheckInWithDues = false`, invoice overdue beyond grace: rejected with 402 `OVERDUE_PAYMENT_BLOCKED`.
     * `allowCheckInWithDues = false`, invoice overdue within grace: permitted with warning banner.
     * `allowCheckInWithDues = true`: permitted with warning banner and balanceDue.
   - **Anti-Passback Cooldown:** Immediate second scan rejected with 409 `ALREADY_CHECKED_IN`.
   - **Multi-Tenant RLS Isolation:** Org Beta staff cannot view, scan, or check out Org Alpha member passes. Queries without tenant context yield 0 rows. Zero SuperAdmin bypass verified via raw PostgreSQL inspection.
4. **Full Regression Verification:**
   - Run complete test suite across all modules (Stages 2.1–2.6: 193 existing tests) ensuring 100% pass rate with 0 regressions.

---

## 13. Implementation Roadmap (9 Milestones)

```
┌────────────────────────────────────────────────────────────────────────┐
│                      STAGE 2.7 EXECUTION ROADMAP                       │
├─────────┬──────────────────────────────────────────────────────────────┤
│ Step 1  │ Prisma Schema, 4 Tables, 3 Enums & Migration                 │
│         │ • Add models & enums to schema.prisma                        │
│         │ • Create migration 20261123000000_attendance_and_qr_system   │
│         │ • Add partial unique index for active check-in session       │
│         │ • Apply RLS ENABLE + FORCE with zero SuperAdmin bypass       │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Step 2  │ Shared Types, DTOs & Zod Validation Schemas                  │
│         │ • Update @gymos/shared-types & @gymos/validation             │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Step 3  │ QR Cryptographic Token Service                               │
│         │ • AES-256-GCM secret encryption at rest                      │
│         │ • HMAC-SHA256 signer, validator & sliding expiration         │
│         │ • Redis atomic nonce replay check                            │
│         │ • Salted SHA-256 physical badge passcode generator & hasher  │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Step 4  │ Attendance Service & Deterministic Validation Pipeline       │
│         │ • Authoritative check-in sequence integrating 2.4, 2.5, 2.6  │
│         │ • Anti-passback cooldown & timezone conversion               │
│         │ • Atomic idempotent check-out routine                        │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Step 5  │ Attendance Controller, RBAC & Branch Context Integration     │
│         │ • Register /api/v1/attendance/* endpoints                    │
│         │ • Apply BranchContextGuard, permissions & rate limiters      │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Step 6  │ Worker Outbox Events & Auto-Checkout Background Job          │
│         │ • Attendance event outbox dispatcher                         │
│         │ • Scheduled auto-checkout job with per-tenant context        │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Step 7  │ Frontend: Scanner Viewport, Live Floor, Ledger & Analytics   │
│         │ • Browser MediaDevices camera scanner viewport               │
│         │ • Live floor active roster & one-click check-out             │
│         │ • Filterable history ledger & CSV export                     │
│         │ • Peak-hour occupancy charts & streak leaderboards           │
│         │ • Light & Dark theme compliance                              │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Step 8  │ Automated E2E Security, Concurrency & Regression Testing     │
│         │ • Author attendance-management.e2e-spec.ts                   │
│         │ • Verify partial unique index concurrency & anti-passback    │
│         │ • Execute full regression suite (193 + new tests)            │
├─────────┼──────────────────────────────────────────────────────────────┤
│ Step 9  │ Full Audit, Documentation, and Git Checkpoint Commit         │
│         │ • Production build verification (API, Worker, Web)           │
│         │ • Clean git checkpoint commit                                │
└─────────┴──────────────────────────────────────────────────────────────┘
```

---

## 14. Approval Gate

Execution of Stage 2.7 requires formal review and authorization of this revised plan. Upon receipt of authorization, implementation will proceed systematically through Steps 1 through 9.
