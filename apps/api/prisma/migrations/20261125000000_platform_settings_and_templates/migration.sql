-- Migration: 20261125000000_platform_settings_and_templates
-- Description: Platform-level settings and email templates with PostgreSQL Row-Level Security (RLS ENABLE + FORCE)

-- 1. Create platform_settings Table
CREATE TABLE IF NOT EXISTS "platform_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
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
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_settings_key_key" ON "platform_settings"("key");
CREATE INDEX IF NOT EXISTS "idx_platform_settings_category" ON "platform_settings"("category");

-- 2. Create platform_email_templates Table
CREATE TABLE IF NOT EXISTS "platform_email_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(100) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "category" VARCHAR(100) NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "html_body" TEXT NOT NULL,
  "text_body" TEXT,
  "available_variables" JSONB NOT NULL DEFAULT '[]',
  "sample_variables" JSONB,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "history" JSONB,
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_email_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_email_templates_code_key" ON "platform_email_templates"("code");
CREATE INDEX IF NOT EXISTS "idx_platform_templates_category" ON "platform_email_templates"("category");

-- 3. Enable & Force Row-Level Security
ALTER TABLE "platform_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_settings" FORCE ROW LEVEL SECURITY;

ALTER TABLE "platform_email_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_email_templates" FORCE ROW LEVEL SECURITY;

-- 4. RLS Policies: Strictly Super Admin Context Only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'platform_settings' AND policyname = 'platform_settings_super_admin_policy'
  ) THEN
    CREATE POLICY platform_settings_super_admin_policy ON "platform_settings"
      FOR ALL
      USING (current_setting('app.is_super_admin', true) = 'true')
      WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'platform_email_templates' AND policyname = 'platform_email_templates_super_admin_policy'
  ) THEN
    CREATE POLICY platform_email_templates_super_admin_policy ON "platform_email_templates"
      FOR ALL
      USING (current_setting('app.is_super_admin', true) = 'true')
      WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
  END IF;
END $$;
