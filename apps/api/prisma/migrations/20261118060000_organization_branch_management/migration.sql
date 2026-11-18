-- Stage 2.3: Organization and Multi-Branch Management
-- 1. Create Enums
CREATE TYPE "branch_status" AS ENUM ('ACTIVE', 'INACTIVE', 'CLOSED');
CREATE TYPE "assignment_status" AS ENUM ('ACTIVE', 'INACTIVE');

-- 2. Alter Organization Table to add domain fields
ALTER TABLE "organizations"
  ADD COLUMN "legal_name" VARCHAR(255),
  ADD COLUMN "business_email" VARCHAR(255),
  ADD COLUMN "business_phone" VARCHAR(50),
  ADD COLUMN "website" VARCHAR(255),
  ADD COLUMN "logo_url" VARCHAR(500),
  ADD COLUMN "description" TEXT,
  ADD COLUMN "address_line_1" VARCHAR(255),
  ADD COLUMN "address_line_2" VARCHAR(255),
  ADD COLUMN "city" VARCHAR(100),
  ADD COLUMN "state" VARCHAR(100),
  ADD COLUMN "country" VARCHAR(100),
  ADD COLUMN "postal_code" VARCHAR(20),
  ADD COLUMN "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
  ADD COLUMN "currency" VARCHAR(10) NOT NULL DEFAULT 'INR';

-- 3. Create Branches Table
CREATE TABLE "branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "branch_code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "website" VARCHAR(255),
    "logo_url" VARCHAR(500),
    "address_line_1" VARCHAR(255),
    "address_line_2" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "status" "branch_status" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- Unique index on (organization_id, id) for composite FK reference
CREATE UNIQUE INDEX "unique_branches_org_composite" ON "branches"("organization_id", "id");
CREATE UNIQUE INDEX "unique_org_users_org_composite" ON "organization_users"("organization_id", "id");

-- Uniqueness per organization for slug and branch_code
CREATE UNIQUE INDEX "branches_organization_id_slug_key" ON "branches"("organization_id", "slug");
CREATE UNIQUE INDEX "branches_organization_id_branch_code_key" ON "branches"("organization_id", "branch_code");

-- Performance indexes
CREATE INDEX "idx_branches_org_id" ON "branches"("organization_id");
CREATE INDEX "idx_branches_status" ON "branches"("status");
CREATE INDEX "idx_branches_org_composite" ON "branches"("organization_id", "id");

-- Foreign key to organizations
ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Create Branch Staff Assignments Table
CREATE TABLE "branch_staff_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "organization_user_id" UUID NOT NULL,
    "status" "assignment_status" NOT NULL DEFAULT 'ACTIVE',
    "assigned_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branch_staff_assignments_pkey" PRIMARY KEY ("id")
);

-- Unique assignment per branch and organization_user
CREATE UNIQUE INDEX "branch_staff_assignments_branch_id_organization_user_id_key" ON "branch_staff_assignments"("branch_id", "organization_user_id");

-- Performance indexes
CREATE INDEX "idx_branch_staff_org_id" ON "branch_staff_assignments"("organization_id");
CREATE INDEX "idx_branch_staff_branch_id" ON "branch_staff_assignments"("branch_id");
CREATE INDEX "idx_branch_staff_org_user_id" ON "branch_staff_assignments"("organization_user_id");
CREATE INDEX "idx_branch_staff_org_composite" ON "branch_staff_assignments"("organization_id", "id");

-- Foreign keys (Standard FKs)
ALTER TABLE "branch_staff_assignments" ADD CONSTRAINT "branch_staff_assignments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_staff_assignments" ADD CONSTRAINT "branch_staff_assignments_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_staff_assignments" ADD CONSTRAINT "branch_staff_assignments_organization_user_id_fkey"
  FOREIGN KEY ("organization_user_id") REFERENCES "organization_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite Foreign Keys: Enforces that branch and organization_user belong to the exact same organization_id
ALTER TABLE "branch_staff_assignments" ADD CONSTRAINT "fk_branch_staff_branch_org"
  FOREIGN KEY ("organization_id", "branch_id") REFERENCES "branches"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "branch_staff_assignments" ADD CONSTRAINT "fk_branch_staff_user_org"
  FOREIGN KEY ("organization_id", "organization_user_id") REFERENCES "organization_users"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 5. Row-Level Security (RLS) Policies on branches and branch_staff_assignments
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy_branches" ON "branches"
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

ALTER TABLE "branch_staff_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "branch_staff_assignments" FORCE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_policy_branch_staff_assignments" ON "branch_staff_assignments"
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
