-- Migration: 20261123000000_attendance_and_qr_system
-- Description: Adds Stage 2.7 Attendance Management & QR Check-In System:
--              member_access_passes, attendance_records, attendance_settings, attendance_outbox_events
--              with PostgreSQL Row-Level Security (RLS ENABLE + FORCE), zero SuperAdmin bypass,
--              and PostgreSQL partial unique index preventing multiple active check-ins.

-- 1. Create Enums
CREATE TYPE "attendance_method" AS ENUM ('QR_SCAN', 'MANUAL_STAFF', 'KIOSK', 'RFID_CARD');
CREATE TYPE "attendance_status" AS ENUM ('CHECKED_IN', 'CHECKED_OUT', 'AUTO_CHECKED_OUT', 'CANCELLED');
CREATE TYPE "pass_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'REVOKED');

-- 2. Create member_access_passes Table
CREATE TABLE "member_access_passes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "pass_code_hash" VARCHAR(128),
  "pass_code_salt" VARCHAR(64),
  "pass_code_masked" VARCHAR(32),
  "hmac_secret_encrypted" VARCHAR(255) NOT NULL,
  "status" "pass_status" NOT NULL DEFAULT 'ACTIVE',
  "issued_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "revoked_at" TIMESTAMPTZ,
  "revoked_by_id" UUID,
  "revocation_reason" VARCHAR(255),
  "last_scanned_at" TIMESTAMPTZ,
  "last_scanned_branch_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_member_access_passes" PRIMARY KEY ("id"),
  CONSTRAINT "fk_member_access_passes_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_member_access_passes_member" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT,
  CONSTRAINT "unique_member_access_pass_member" UNIQUE ("member_id"),
  CONSTRAINT "unique_org_member_pass" UNIQUE ("organization_id", "member_id")
);

CREATE UNIQUE INDEX "unique_org_pass_hash" ON "member_access_passes" ("organization_id", "pass_code_hash") WHERE "pass_code_hash" IS NOT NULL;
CREATE INDEX "idx_passes_org_code_hash" ON "member_access_passes" ("organization_id", "pass_code_hash");
CREATE INDEX "idx_passes_org_status" ON "member_access_passes" ("organization_id", "status");

-- 3. Create attendance_records Table
CREATE TABLE "attendance_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "membership_id" UUID,
  "check_in_time" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "check_out_time" TIMESTAMPTZ,
  "duration_minutes" INTEGER,
  "method" "attendance_method" NOT NULL DEFAULT 'QR_SCAN',
  "status" "attendance_status" NOT NULL DEFAULT 'CHECKED_IN',
  "verified_by_id" UUID,
  "notes" VARCHAR(255),
  "rejection_reason" VARCHAR(255),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_attendance_records" PRIMARY KEY ("id"),
  CONSTRAINT "fk_attendance_records_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_attendance_records_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_attendance_records_member" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_attendance_records_membership" FOREIGN KEY ("membership_id") REFERENCES "member_memberships"("id") ON DELETE SET NULL
);

-- Partial Unique Index: Exactly one active check-in session per member per organization
CREATE UNIQUE INDEX "idx_attendance_records_active_session" 
ON "attendance_records" ("organization_id", "member_id") 
WHERE "status" = 'CHECKED_IN';

CREATE INDEX "idx_attendance_org_branch_time" ON "attendance_records" ("organization_id", "branch_id", "check_in_time");
CREATE INDEX "idx_attendance_org_member_time" ON "attendance_records" ("organization_id", "member_id", "check_in_time");
CREATE INDEX "idx_attendance_org_status_time" ON "attendance_records" ("organization_id", "status", "check_in_time");

-- 4. Create attendance_settings Table
CREATE TABLE "attendance_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "branch_id" UUID,
  "allow_check_in_with_dues" BOOLEAN NOT NULL DEFAULT FALSE,
  "max_overdue_grace_days" INTEGER NOT NULL DEFAULT 0,
  "cooldown_minutes" INTEGER NOT NULL DEFAULT 10,
  "require_check_out" BOOLEAN NOT NULL DEFAULT FALSE,
  "auto_check_out_hours" INTEGER NOT NULL DEFAULT 3,
  "operating_hours_start" VARCHAR(10) NOT NULL DEFAULT '05:00',
  "operating_hours_end" VARCHAR(10) NOT NULL DEFAULT '23:00',
  "allow_off_hours_check_in" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_attendance_settings" PRIMARY KEY ("id"),
  CONSTRAINT "fk_attendance_settings_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_attendance_settings_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "unique_org_default_attendance_settings" ON "attendance_settings" ("organization_id") WHERE "branch_id" IS NULL;
CREATE UNIQUE INDEX "unique_org_branch_attendance_settings" ON "attendance_settings" ("organization_id", "branch_id") WHERE "branch_id" IS NOT NULL;

-- 5. Create attendance_outbox_events Table
CREATE TABLE "attendance_outbox_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "aggregate_id" VARCHAR(100) NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "processed_at" TIMESTAMPTZ,
  "idempotency_key" VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_attendance_outbox_events" PRIMARY KEY ("id"),
  CONSTRAINT "fk_attendance_outbox_org" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "unique_attendance_outbox_idempotency" UNIQUE ("idempotency_key")
);

CREATE INDEX "idx_attendance_outbox_org_status" ON "attendance_outbox_events" ("organization_id", "status");
CREATE INDEX "idx_attendance_outbox_status_created" ON "attendance_outbox_events" ("status", "created_at");

-- 6. Enable and Force Row-Level Security (RLS) with Zero SuperAdmin Bypass

-- member_access_passes RLS
ALTER TABLE "member_access_passes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_access_passes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_member_access_passes" ON "member_access_passes"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- attendance_records RLS
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_attendance_records" ON "attendance_records"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- attendance_settings RLS
ALTER TABLE "attendance_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_attendance_settings" ON "attendance_settings"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- attendance_outbox_events RLS
ALTER TABLE "attendance_outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_outbox_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_attendance_outbox_events" ON "attendance_outbox_events"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
