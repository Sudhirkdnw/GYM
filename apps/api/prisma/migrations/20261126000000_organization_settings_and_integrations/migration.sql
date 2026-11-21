-- Migration: 20261126000000_organization_settings_and_integrations
-- Description: Tenant-level configuration (Custom SMTP, Custom WhatsApp, Notification Triggers)
--              with PostgreSQL Row-Level Security (RLS ENABLE + FORCE).

-- 1. Create organization_settings Table
CREATE TABLE IF NOT EXISTS "organization_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "category" VARCHAR(50) NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "value" JSONB,
  "encrypted_value" TEXT,
  "last_tested_at" TIMESTAMPTZ,
  "test_status" VARCHAR(50),
  "test_message" VARCHAR(500),
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_settings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "unique_org_setting_key" ON "organization_settings"("organization_id", "key");
CREATE INDEX IF NOT EXISTS "idx_org_settings_category" ON "organization_settings"("organization_id", "category");

-- 2. Enable & Force Row-Level Security
ALTER TABLE "organization_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_settings" FORCE ROW LEVEL SECURITY;

-- 3. RLS Policy: Tenant Isolation + Super Admin Override
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'organization_settings' AND policyname = 'organization_settings_tenant_isolation_policy'
  ) THEN
    CREATE POLICY organization_settings_tenant_isolation_policy ON "organization_settings"
      FOR ALL
      USING (
        current_setting('app.is_super_admin', true) = 'true'
        OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
      )
      WITH CHECK (
        current_setting('app.is_super_admin', true) = 'true'
        OR organization_id = NULLIF(current_setting('app.current_organization_id', true), '')::uuid
      );
  END IF;
END $$;
