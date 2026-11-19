-- Migration: 20261120000001_fix_member_rls_permissive
-- Purpose: Convert member table RLS policies from RESTRICTIVE to PERMISSIVE
-- This migration is idempotent: safe on both existing DB (already PERMISSIVE) 
-- and fresh DB (sequential application after migration 20261120000000).

-- Drop and recreate policies on members table
DROP POLICY IF EXISTS "tenant_isolation_policy_members" ON "members";
CREATE POLICY "tenant_isolation_policy_members" ON "members"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Drop and recreate policies on member_transfers table
DROP POLICY IF EXISTS "tenant_isolation_policy_member_transfers" ON "member_transfers";
CREATE POLICY "tenant_isolation_policy_member_transfers" ON "member_transfers"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Drop and recreate policies on organization_member_sequences table
DROP POLICY IF EXISTS "tenant_isolation_policy_member_sequences" ON "organization_member_sequences";
CREATE POLICY "tenant_isolation_policy_member_sequences" ON "organization_member_sequences"
  FOR ALL
  USING (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    NULLIF(current_setting('app.is_super_admin', true), '') = 'true'
    OR organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
