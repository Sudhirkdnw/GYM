-- Migration: 20261124000000_saas_entitlements_and_plans
-- Description: Modular Enterprise SaaS Architecture & Service Entitlement System
--              Creates SaasPlan, FeatureCatalog, SaasPlanFeature, OrganizationSubscription,
--              OrganizationEntitlementOverride, OrganizationUsageRecord, EntitlementChangeLog
--              with PostgreSQL Row-Level Security (RLS ENABLE + FORCE).

-- 1. Create Enums
CREATE TYPE "saas_subscription_status" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "feature_value_type" AS ENUM ('BOOLEAN', 'NUMERIC', 'TIERED');

-- 2. Create saas_plans Table
CREATE TABLE "saas_plans" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "monthly_price" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  "annual_price" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_public" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "saas_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saas_plans_code_key" ON "saas_plans"("code");

-- 3. Create feature_catalog Table
CREATE TABLE "feature_catalog" (
  "key" VARCHAR(100) NOT NULL,
  "domain" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "value_type" "feature_value_type" NOT NULL DEFAULT 'BOOLEAN',
  "default_metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "feature_catalog_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "idx_feature_catalog_domain" ON "feature_catalog"("domain");

-- 4. Create saas_plan_features Table
CREATE TABLE "saas_plan_features" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "plan_id" UUID NOT NULL,
  "feature_key" VARCHAR(100) NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "numeric_quota" INTEGER,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "saas_plan_features_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saas_plan_features_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "saas_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "saas_plan_features_feature_key_fkey" FOREIGN KEY ("feature_key") REFERENCES "feature_catalog"("key") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "unique_plan_feature" ON "saas_plan_features"("plan_id", "feature_key");

-- 5. Create organization_subscriptions Table
CREATE TABLE "organization_subscriptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "status" "saas_subscription_status" NOT NULL DEFAULT 'ACTIVE',
  "current_period_start" DATE NOT NULL,
  "current_period_end" DATE NOT NULL,
  "trial_ends_at" DATE,
  "agreed_price" DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  "billing_interval" VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organization_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "idx_org_subscription_status" ON "organization_subscriptions"("organization_id", "status");

-- 6. Create organization_entitlement_overrides Table
CREATE TABLE "organization_entitlement_overrides" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "feature_key" VARCHAR(100) NOT NULL,
  "is_enabled" BOOLEAN NOT NULL,
  "numeric_quota" INTEGER,
  "reason" VARCHAR(255),
  "granted_by_user_id" UUID,
  "expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "organization_entitlement_overrides_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_entitlement_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organization_entitlement_overrides_feature_key_fkey" FOREIGN KEY ("feature_key") REFERENCES "feature_catalog"("key") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "unique_org_feature_override" ON "organization_entitlement_overrides"("organization_id", "feature_key");
CREATE INDEX "idx_entitlement_overrides_org" ON "organization_entitlement_overrides"("organization_id");

-- 7. Create organization_usage_records Table
CREATE TABLE "organization_usage_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "metric_key" VARCHAR(100) NOT NULL,
  "period" VARCHAR(20) NOT NULL,
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "organization_usage_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_usage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "unique_org_metric_period" ON "organization_usage_records"("organization_id", "metric_key", "period");

-- 8. Create entitlement_change_logs Table
CREATE TABLE "entitlement_change_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "feature_key" VARCHAR(100) NOT NULL,
  "action_type" VARCHAR(50) NOT NULL,
  "previous_state" JSONB,
  "new_state" JSONB NOT NULL,
  "reason" VARCHAR(255),
  "performed_by_user_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "entitlement_change_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "entitlement_change_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "idx_entitlement_log_org_time" ON "entitlement_change_logs"("organization_id", "created_at");

-- =========================================================================
-- 9. ROW-LEVEL SECURITY POLICIES (RLS ENABLE + FORCE)
-- =========================================================================

-- organization_subscriptions RLS
ALTER TABLE "organization_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_organization_subscriptions" ON "organization_subscriptions"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- organization_entitlement_overrides RLS
ALTER TABLE "organization_entitlement_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_entitlement_overrides" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_organization_entitlement_overrides" ON "organization_entitlement_overrides"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- organization_usage_records RLS
ALTER TABLE "organization_usage_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_usage_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_organization_usage_records" ON "organization_usage_records"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- entitlement_change_logs RLS
ALTER TABLE "entitlement_change_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "entitlement_change_logs" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_entitlement_change_logs" ON "entitlement_change_logs"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
