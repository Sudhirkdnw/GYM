-- Migration: 20261127000000_platform_email_logs
-- Description: Platform-level email delivery logs with PostgreSQL Row-Level Security (RLS ENABLE + FORCE)

CREATE TABLE IF NOT EXISTS "platform_email_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "recipient" VARCHAR(255) NOT NULL,
  "sender" VARCHAR(255) NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "template_code" VARCHAR(100),
  "status" VARCHAR(50) NOT NULL,
  "error_message" TEXT,
  "message_id" VARCHAR(255),
  "response" TEXT,
  "metadata" JSONB,
  "sent_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "platform_email_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_platform_email_logs_recipient" ON "platform_email_logs"("recipient");
CREATE INDEX IF NOT EXISTS "idx_platform_email_logs_status" ON "platform_email_logs"("status");
CREATE INDEX IF NOT EXISTS "idx_platform_email_logs_created_at" ON "platform_email_logs"("created_at");

-- Enable and Force Row Level Security
ALTER TABLE "platform_email_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "platform_email_logs" FORCE ROW LEVEL SECURITY;

-- Super Admin RLS Policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'platform_email_logs' AND policyname = 'platform_email_logs_super_admin_policy'
  ) THEN
    CREATE POLICY platform_email_logs_super_admin_policy ON "platform_email_logs"
      FOR ALL
      USING (current_setting('app.is_super_admin', true) = 'true')
      WITH CHECK (current_setting('app.is_super_admin', true) = 'true');
  END IF;
END $$;
