-- Migration: 20261122000000_billing_and_payments
-- Description: Adds Stage 2.6 Billing, Invoices, Payments, Allocations, Reversals, Refunds,
--              Member Credit Accounts/Entries, Billing Sequences, and Billing Outbox Events
--              with PostgreSQL Row-Level Security (RLS ENABLE + FORCE) and strict tenant isolation (No SuperAdmin bypass).

-- 1. Create Enums
CREATE TYPE "invoice_status" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID', 'REFUNDED');
CREATE TYPE "invoice_item_type" AS ENUM ('MEMBERSHIP', 'REGISTRATION_FEE', 'PERSONAL_TRAINING', 'SERVICE', 'MERCHANDISE', 'CUSTOM');
CREATE TYPE "payment_method" AS ENUM ('CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE', 'MEMBER_CREDIT', 'OTHER');
CREATE TYPE "payment_status" AS ENUM ('COMPLETED', 'PENDING', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'REVERSED');
CREATE TYPE "allocation_status" AS ENUM ('ACTIVE', 'PARTIALLY_REVERSED', 'REVERSED');
CREATE TYPE "refund_status" AS ENUM ('COMPLETED', 'PENDING', 'FAILED');
CREATE TYPE "credit_entry_type" AS ENUM ('CREDIT_FROM_OVERPAYMENT', 'CREDIT_ADJUSTMENT', 'CREDIT_APPLIED', 'CREDIT_REFUND', 'CREDIT_REVERSAL');

-- 2. Create Invoices Table
CREATE TABLE "invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "invoice_number" VARCHAR(50) NOT NULL,
  "financial_year" VARCHAR(10) NOT NULL,
  "sequence_number" INTEGER NOT NULL,
  "issue_date" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
  "subtotal" DECIMAL(10,2) NOT NULL,
  "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "discount_reason" VARCHAR(255),
  "taxable_amount" DECIMAL(10,2) NOT NULL,
  "cgst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "sgst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "igst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "cess_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "total_tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "total_amount" DECIMAL(10,2) NOT NULL,
  "allocated_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "balance_due" DECIMAL(10,2) NOT NULL,
  "status" "invoice_status" NOT NULL DEFAULT 'ISSUED',
  "supplier_snapshot" JSONB NOT NULL,
  "customer_snapshot" JSONB NOT NULL,
  "tax_snapshot" JSONB NOT NULL,
  "place_of_supply" VARCHAR(2) NOT NULL,
  "notes" TEXT,
  "terms" TEXT,
  "created_by_id" UUID NOT NULL,
  "voided_at" TIMESTAMPTZ,
  "void_reason" VARCHAR(255),
  "voided_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_invoices" PRIMARY KEY ("id"),
  CONSTRAINT "fk_invoices_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_invoices_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_invoices_member" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT,
  CONSTRAINT "unique_org_invoice_number" UNIQUE ("organization_id", "invoice_number")
);

CREATE INDEX "idx_invoices_org" ON "invoices"("organization_id");
CREATE INDEX "idx_invoices_branch" ON "invoices"("organization_id", "branch_id");
CREATE INDEX "idx_invoices_member" ON "invoices"("organization_id", "member_id");
CREATE INDEX "idx_invoices_status" ON "invoices"("organization_id", "status");
CREATE INDEX "idx_invoices_due_date" ON "invoices"("organization_id", "due_date");

-- 3. Create Invoice Items Table
CREATE TABLE "invoice_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "item_type" "invoice_item_type" NOT NULL DEFAULT 'MEMBERSHIP',
  "description" VARCHAR(255) NOT NULL,
  "sac_hsn_code" VARCHAR(20) DEFAULT '999723',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unit_price" DECIMAL(10,2) NOT NULL,
  "discount_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "taxable_amount" DECIMAL(10,2) NOT NULL,
  "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  "tax_amount" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "total_amount" DECIMAL(10,2) NOT NULL,
  "membership_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_invoice_items" PRIMARY KEY ("id"),
  CONSTRAINT "fk_invoice_items_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_invoice_items_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_invoice_items_membership" FOREIGN KEY ("membership_id") REFERENCES "member_memberships"("id") ON DELETE SET NULL
);

CREATE INDEX "idx_invoice_items_invoice" ON "invoice_items"("organization_id", "invoice_id");

-- 4. Create Payments Table
CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "payment_number" VARCHAR(50) NOT NULL,
  "financial_year" VARCHAR(10) NOT NULL,
  "sequence_number" INTEGER NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
  "method" "payment_method" NOT NULL,
  "status" "payment_status" NOT NULL DEFAULT 'COMPLETED',
  "transaction_reference" VARCHAR(100),
  "bank_name" VARCHAR(100),
  "cheque_number" VARCHAR(50),
  "cheque_date" DATE,
  "paid_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "collected_by_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(200),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_payments" PRIMARY KEY ("id"),
  CONSTRAINT "fk_payments_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_payments_branch" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_payments_member" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT,
  CONSTRAINT "unique_org_payment_number" UNIQUE ("organization_id", "payment_number"),
  CONSTRAINT "unique_payments_idempotency" UNIQUE ("idempotency_key")
);

CREATE INDEX "idx_payments_org" ON "payments"("organization_id");
CREATE INDEX "idx_payments_branch" ON "payments"("organization_id", "branch_id");
CREATE INDEX "idx_payments_member" ON "payments"("organization_id", "member_id");
CREATE INDEX "idx_payments_method" ON "payments"("organization_id", "method");

-- 5. Create Payment Allocations Table
CREATE TABLE "payment_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "invoice_id" UUID NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" "allocation_status" NOT NULL DEFAULT 'ACTIVE',
  "allocated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_payment_allocations" PRIMARY KEY ("id"),
  CONSTRAINT "fk_allocations_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_allocations_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_allocations_invoice" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT
);

CREATE INDEX "idx_allocations_payment" ON "payment_allocations"("organization_id", "payment_id");
CREATE INDEX "idx_allocations_invoice" ON "payment_allocations"("organization_id", "invoice_id");

-- 6. Create Refunds Table
CREATE TABLE "refunds" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "refund_number" VARCHAR(50) NOT NULL,
  "financial_year" VARCHAR(10) NOT NULL,
  "sequence_number" INTEGER NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "method" "payment_method" NOT NULL,
  "reason" VARCHAR(255) NOT NULL,
  "reference" VARCHAR(100),
  "status" "refund_status" NOT NULL DEFAULT 'COMPLETED',
  "initiated_by_id" UUID NOT NULL,
  "approved_by_id" UUID,
  "idempotency_key" VARCHAR(200),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_refunds" PRIMARY KEY ("id"),
  CONSTRAINT "fk_refunds_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_refunds_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT,
  CONSTRAINT "unique_org_refund_number" UNIQUE ("organization_id", "refund_number"),
  CONSTRAINT "unique_refunds_idempotency" UNIQUE ("idempotency_key")
);

CREATE INDEX "idx_refunds_payment" ON "refunds"("organization_id", "payment_id");

-- 7. Create Payment Allocation Reversals Table
CREATE TABLE "payment_allocation_reversals" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "allocation_id" UUID NOT NULL,
  "refund_id" UUID,
  "amount" DECIMAL(10,2) NOT NULL,
  "reason" VARCHAR(255) NOT NULL,
  "reversed_by_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(200),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_payment_allocation_reversals" PRIMARY KEY ("id"),
  CONSTRAINT "fk_reversals_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_reversals_allocation" FOREIGN KEY ("allocation_id") REFERENCES "payment_allocations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_reversals_refund" FOREIGN KEY ("refund_id") REFERENCES "refunds"("id") ON DELETE RESTRICT,
  CONSTRAINT "unique_reversals_idempotency" UNIQUE ("idempotency_key")
);

CREATE INDEX "idx_reversals_allocation" ON "payment_allocation_reversals"("organization_id", "allocation_id");
CREATE INDEX "idx_reversals_refund" ON "payment_allocation_reversals"("organization_id", "refund_id");

-- 8. Create Billing Outbox Events Table
CREATE TABLE "billing_outbox_events" (
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

  CONSTRAINT "pk_billing_outbox_events" PRIMARY KEY ("id"),
  CONSTRAINT "fk_billing_outbox_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "unique_billing_outbox_idempotency" UNIQUE ("idempotency_key")
);

CREATE INDEX "idx_billing_outbox_org_status" ON "billing_outbox_events"("organization_id", "status");
CREATE INDEX "idx_billing_outbox_status_created" ON "billing_outbox_events"("status", "created_at");

-- 9. Create Organization Billing Sequences Table
CREATE TABLE "org_billing_sequences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "sequence_type" VARCHAR(30) NOT NULL,
  "financial_year" VARCHAR(10) NOT NULL,
  "last_number" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_org_billing_sequences" PRIMARY KEY ("id"),
  CONSTRAINT "fk_billing_seq_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "unique_org_seq_type_fy" UNIQUE ("organization_id", "sequence_type", "financial_year")
);

-- 10. Create Member Credit Accounts Table
CREATE TABLE "member_credit_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "member_id" UUID NOT NULL,
  "currency" VARCHAR(10) NOT NULL DEFAULT 'INR',
  "current_balance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_member_credit_accounts" PRIMARY KEY ("id"),
  CONSTRAINT "fk_credit_accounts_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_credit_accounts_member" FOREIGN KEY ("member_id") REFERENCES "members"("id") ON DELETE RESTRICT,
  CONSTRAINT "unique_org_member_currency_credit" UNIQUE ("organization_id", "member_id", "currency")
);

CREATE INDEX "idx_credit_accounts_org" ON "member_credit_accounts"("organization_id");

-- 11. Create Member Credit Entries Table
CREATE TABLE "member_credit_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "credit_account_id" UUID NOT NULL,
  "entry_type" "credit_entry_type" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "reference_type" VARCHAR(50),
  "reference_id" UUID,
  "description" VARCHAR(255) NOT NULL,
  "idempotency_key" VARCHAR(200),
  "created_by_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "pk_member_credit_entries" PRIMARY KEY ("id"),
  CONSTRAINT "fk_credit_entries_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_credit_entries_account" FOREIGN KEY ("credit_account_id") REFERENCES "member_credit_accounts"("id") ON DELETE RESTRICT,
  CONSTRAINT "unique_credit_entries_idempotency" UNIQUE ("idempotency_key")
);

CREATE INDEX "idx_credit_entries_account" ON "member_credit_entries"("organization_id", "credit_account_id");

-- 12. Enable and Force Row-Level Security on All 10 Billing Tables
-- NOTE: Strict Tenant Isolation: No SuperAdmin automatic bypass on financial records.
-- SuperAdmins must explicitly provide tenant context via withTenantContext.

ALTER TABLE "invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_invoices" ON "invoices"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "invoice_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "invoice_items" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_invoice_items" ON "invoice_items"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_payments" ON "payments"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "payment_allocations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_allocations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_payment_allocations" ON "payment_allocations"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "refunds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "refunds" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_refunds" ON "refunds"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "payment_allocation_reversals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payment_allocation_reversals" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_payment_allocation_reversals" ON "payment_allocation_reversals"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "billing_outbox_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_outbox_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_billing_outbox_events" ON "billing_outbox_events"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "org_billing_sequences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "org_billing_sequences" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_org_billing_sequences" ON "org_billing_sequences"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "member_credit_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_credit_accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_member_credit_accounts" ON "member_credit_accounts"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );

ALTER TABLE "member_credit_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_credit_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy_member_credit_entries" ON "member_credit_entries"
  FOR ALL
  USING (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
  );
