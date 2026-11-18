-- Phase 2.1: Multi-Tenant Row-Level Security Foundation
-- Enable and Force RLS on tenant-owned tables

-- 1. Organizations table
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy_organizations" ON "organizations"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR
    id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR
    id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- 2. Organization Users table
ALTER TABLE "organization_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_users" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy_organization_users" ON "organization_users"
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

-- 3. Audit Logs table
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy_audit_logs" ON "audit_logs"
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

-- Composite indices for tenant-scoped lookups
CREATE INDEX IF NOT EXISTS "idx_audit_logs_org_composite" ON "audit_logs"("organization_id", "id");
CREATE INDEX IF NOT EXISTS "idx_org_users_org_composite" ON "organization_users"("organization_id", "id");
