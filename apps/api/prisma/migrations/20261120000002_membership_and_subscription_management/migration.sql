-- Migration: 20261120000002_membership_and_subscription_management
-- Description: Adds membership plans, multi-branch scoping, member subscriptions with pricing snapshots,
--              freeze/thaw tracking, membership history, and transactional outbox events with PostgreSQL RLS.

-- 1. Create Enums
CREATE TYPE "plan_duration_type" AS ENUM ('DAYS', 'MONTHS', 'YEARS');
CREATE TYPE "plan_scope" AS ENUM ('SINGLE_BRANCH', 'MULTI_BRANCH', 'ALL_BRANCHES');
CREATE TYPE "plan_status" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "membership_status" AS ENUM ('PENDING', 'ACTIVE', 'FROZEN', 'EXPIRED', 'CANCELLED', 'TERMINATED');
CREATE TYPE "freeze_status" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "outbox_status" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- 2. Create Membership Plans Table
CREATE TABLE "membership_plans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(150) NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "description" VARCHAR(1000),
  "duration_type" "plan_duration_type" NOT NULL DEFAULT 'MONTHS',
  "duration_value" INTEGER NOT NULL,
  "price" DECIMAL(10,2) NOT NULL,
  "registration_fee" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
  "scope" "plan_scope" NOT NULL DEFAULT 'SINGLE_BRANCH',
  "max_freeze_days" INTEGER NOT NULL DEFAULT 0,
  "max_freezes" INTEGER NOT NULL DEFAULT 0,
  "grace_period_days" INTEGER NOT NULL DEFAULT 0,
  "features" JSONB DEFAULT '[]',
  "status" "plan_status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_membership_plans" PRIMARY KEY ("id"),
  CONSTRAINT "fk_membership_plans_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "unique_org_plan_code" UNIQUE ("organization_id", "code")
);

CREATE INDEX "idx_membership_plans_org" ON "membership_plans"("organization_id");
CREATE INDEX "idx_membership_plans_org_status" ON "membership_plans"("organization_id", "status");

-- 3. Create Membership Plan Branches Table (Multi-branch scoping)
CREATE TABLE "membership_plan_branches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_membership_plan_branches" PRIMARY KEY ("id"),
  CONSTRAINT "fk_plan_branches_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_plan_branches_plan" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_plan_branches_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE,
  CONSTRAINT "unique_plan_branch" UNIQUE ("plan_id", "branch_id")
);

CREATE INDEX "idx_plan_branches_org_branch" ON "membership_plan_branches"("organization_id", "branch_id");

-- 4. Create Member Memberships Table
CREATE TABLE "member_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "home_branch_id" UUID NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "original_end_date" DATE NOT NULL,
  "base_price" DECIMAL(10,2) NOT NULL,
  "registration_fee" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "discount_reason" VARCHAR(255),
  "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "final_price" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
  "pricing_snapshot" JSONB NOT NULL,
  "total_freeze_days_used" INTEGER NOT NULL DEFAULT 0,
  "freeze_count" INTEGER NOT NULL DEFAULT 0,
  "renewal_count" INTEGER NOT NULL DEFAULT 0,
  "previous_membership_id" UUID,
  "status" "membership_status" NOT NULL DEFAULT 'ACTIVE',
  "auto_renew" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "cancelled_at" TIMESTAMPTZ,
  "cancellation_reason" VARCHAR(255),
  "cancelled_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_member_memberships" PRIMARY KEY ("id"),
  CONSTRAINT "fk_member_memberships_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_member_memberships_member" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_member_memberships_plan" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_member_memberships_home_branch" FOREIGN KEY ("home_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_member_memberships_org" ON "member_memberships"("organization_id");
CREATE INDEX "idx_member_memberships_member" ON "member_memberships"("organization_id", "member_id");
CREATE INDEX "idx_member_memberships_status" ON "member_memberships"("organization_id", "status");
CREATE INDEX "idx_member_memberships_end_date" ON "member_memberships"("organization_id", "end_date");
CREATE INDEX "idx_member_memberships_branch" ON "member_memberships"("organization_id", "home_branch_id");

-- 5. Create Membership Freezes Table
CREATE TABLE "membership_freezes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "actual_thaw_date" DATE,
  "days_frozen" INTEGER NOT NULL DEFAULT 0,
  "reason" VARCHAR(255),
  "status" "freeze_status" NOT NULL DEFAULT 'ACTIVE',
  "frozen_by" UUID NOT NULL,
  "thawed_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_membership_freezes" PRIMARY KEY ("id"),
  CONSTRAINT "fk_membership_freezes_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_membership_freezes_membership" FOREIGN KEY ("membership_id") REFERENCES "member_memberships"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_membership_freezes_org" ON "membership_freezes"("organization_id");
CREATE INDEX "idx_membership_freezes_membership" ON "membership_freezes"("membership_id");

-- 6. Create Membership History Table
CREATE TABLE "membership_history" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "membership_id" UUID NOT NULL,
  "action" VARCHAR(50) NOT NULL,
  "actor_id" UUID,
  "previous_state" JSONB,
  "new_state" JSONB,
  "reason" VARCHAR(255),
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_membership_history" PRIMARY KEY ("id"),
  CONSTRAINT "fk_membership_history_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_membership_history_membership" FOREIGN KEY ("membership_id") REFERENCES "member_memberships"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_membership_history_membership" ON "membership_history"("organization_id", "membership_id");

-- 7. Create Membership Outbox Events Table
CREATE TABLE "membership_outbox_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "aggregate_id" VARCHAR(100) NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "outbox_status" NOT NULL DEFAULT 'PENDING',
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "processed_at" TIMESTAMPTZ,
  "idempotency_key" VARCHAR(200) NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_membership_outbox_events" PRIMARY KEY ("id"),
  CONSTRAINT "fk_membership_outbox_events_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE INDEX "idx_outbox_org_status" ON "membership_outbox_events"("organization_id", "status");
CREATE INDEX "idx_outbox_status_created" ON "membership_outbox_events"("status", "created_at");

-- 8. Enable and FORCE PostgreSQL Row-Level Security on all 6 tables

ALTER TABLE "membership_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_membership_plans" ON "membership_plans"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "membership_plan_branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_plan_branches" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_membership_plan_branches" ON "membership_plan_branches"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "member_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_member_memberships" ON "member_memberships"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "membership_freezes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_freezes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_membership_freezes" ON "membership_freezes"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "membership_history" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_history" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_membership_history" ON "membership_history"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "membership_outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membership_outbox_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_membership_outbox_events" ON "membership_outbox_events"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
