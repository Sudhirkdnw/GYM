-- Stage 2.4: Production-Grade Gym Member Management Module
-- 1. Create Enums
CREATE TYPE "member_status" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- 2. Create Organization Member Sequences Table (Atomic, Concurrency-Safe Member Numbers)
CREATE TABLE "organization_member_sequences" (
    "organization_id" UUID NOT NULL,
    "current_value" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_member_sequences_pkey" PRIMARY KEY ("organization_id"),
    CONSTRAINT "organization_member_sequences_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Create Members Table
CREATE TABLE "members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID,
    "member_number" VARCHAR(50) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "preferred_name" VARCHAR(100),
    "gender" "gender",
    "date_of_birth" DATE,
    "email" VARCHAR(255),
    "phone" VARCHAR(50) NOT NULL,
    "address_line_1" VARCHAR(255),
    "address_line_2" VARCHAR(255),
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "country" VARCHAR(100),
    "postal_code" VARCHAR(20),
    "emergency_contact_name" VARCHAR(100),
    "emergency_contact_phone" VARCHAR(50),
    "emergency_contact_relationship" VARCHAR(50),
    "profile_photo_key" VARCHAR(500),
    "notes" TEXT,
    "status" "member_status" NOT NULL DEFAULT 'ACTIVE',
    "joined_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID,
    "archived_at" TIMESTAMPTZ,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- Unique index on (organization_id, id) for composite FK reference
CREATE UNIQUE INDEX "unique_members_org_composite" ON "members"("organization_id", "id");

-- Unique member_number within organization
CREATE UNIQUE INDEX "unique_org_member_number" ON "members"("organization_id", "member_number");

-- Performance & search indexes
CREATE INDEX "idx_members_org_id" ON "members"("organization_id");
CREATE INDEX "idx_members_branch_id" ON "members"("branch_id");
CREATE INDEX "idx_members_status" ON "members"("status");
CREATE INDEX "idx_members_phone" ON "members"("phone");
CREATE INDEX "idx_members_email" ON "members"("email");
CREATE INDEX "idx_members_joined_at" ON "members"("joined_at");
CREATE INDEX "idx_members_org_composite" ON "members"("organization_id", "id");

-- Standard Foreign keys
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "members" ADD CONSTRAINT "members_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Composite Foreign Key: Enforces branch belongs to the exact same organization_id
ALTER TABLE "members" ADD CONSTRAINT "fk_members_branch_org"
  FOREIGN KEY ("organization_id", "branch_id")
  REFERENCES "branches"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Create Member Transfers Table
CREATE TABLE "member_transfers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "source_branch_id" UUID NOT NULL,
    "destination_branch_id" UUID NOT NULL,
    "transferred_by" UUID NOT NULL,
    "transferred_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" VARCHAR(255),

    CONSTRAINT "member_transfers_pkey" PRIMARY KEY ("id")
);

-- Indexes for transfer audit lookups
CREATE INDEX "idx_member_transfers_org_id" ON "member_transfers"("organization_id");
CREATE INDEX "idx_member_transfers_member_id" ON "member_transfers"("member_id");
CREATE INDEX "idx_member_transfers_org_composite" ON "member_transfers"("organization_id", "id");

-- Standard Foreign keys
ALTER TABLE "member_transfers" ADD CONSTRAINT "member_transfers_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_transfers" ADD CONSTRAINT "member_transfers_member_id_fkey"
  FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_transfers" ADD CONSTRAINT "member_transfers_source_branch_id_fkey"
  FOREIGN KEY ("source_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "member_transfers" ADD CONSTRAINT "member_transfers_destination_branch_id_fkey"
  FOREIGN KEY ("destination_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Composite Foreign Keys: Enforces that member, source branch, and destination branch belong to the exact same organization_id
ALTER TABLE "member_transfers" ADD CONSTRAINT "fk_transfers_member_org"
  FOREIGN KEY ("organization_id", "member_id")
  REFERENCES "members"("organization_id", "id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_transfers" ADD CONSTRAINT "fk_transfers_from_branch_org"
  FOREIGN KEY ("organization_id", "source_branch_id")
  REFERENCES "branches"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "member_transfers" ADD CONSTRAINT "fk_transfers_to_branch_org"
  FOREIGN KEY ("organization_id", "destination_branch_id")
  REFERENCES "branches"("organization_id", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Row-Level Security (RLS) Enablement & Enforcement
ALTER TABLE "organization_member_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_member_sequences" FORCE ROW LEVEL SECURITY;

ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "members" FORCE ROW LEVEL SECURITY;

ALTER TABLE "member_transfers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_transfers" FORCE ROW LEVEL SECURITY;

-- 6. Row-Level Security Isolation Policies
CREATE POLICY "tenant_isolation_policy_member_sequences" ON "organization_member_sequences"
  AS RESTRICTIVE
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

CREATE POLICY "tenant_isolation_policy_members" ON "members"
  AS RESTRICTIVE
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

CREATE POLICY "tenant_isolation_policy_member_transfers" ON "member_transfers"
  AS RESTRICTIVE
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

-- 7. Grant DML Privileges to Non-Superuser Application Role
GRANT SELECT, INSERT, UPDATE, DELETE ON "organization_member_sequences" TO gymos_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "members" TO gymos_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON "member_transfers" TO gymos_user;
