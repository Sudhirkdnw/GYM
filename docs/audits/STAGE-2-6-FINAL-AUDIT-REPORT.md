# GYMOS — STAGE 2.6 FINAL SECURITY & FINANCIAL INTEGRITY AUDIT REPORT

**Date:** November 20, 2026  
**Audited Baseline:** `e917370` (Stage 2.5 Closure)  
**Implementation Commit:** `e89c4fa`  
**Remediation Commit:** Pending Final Staging  
**Executive Verdict:** **PASS**

---

## 1. Executive Summary

This independent audit conducted an exhaustive verification of Stage 2.6 (Billing, Invoices, Payments, Refunds, Member Credits, and Financial Records). The audit encompassed:
1. Physical database schema inspection and live PostgreSQL Row-Level Security (`ENABLE` + `FORCE`) verification across all financial tables.
2. Direct validation of tenant isolation policies with zero `SUPER_ADMIN` bypass.
3. Detailed statutory compliance testing for Indian GST (Intra-state CGST+SGST, Inter-state IGST, inclusive/exclusive calculations, SAC 999723 configurability, and immutable point-in-time billing snapshots).
4. Full execution of the 10 critical payment and refund scenarios (partial payments, multi-invoice allocations, overpayment credits, wallet payments, LIFO multi-invoice allocation reversals, consecutive partial refunds, and idempotency deduplication).
5. Mathematical credit ledger reconciliation ensuring append-only integrity, monotonic running balances (`balanceBefore`, `balanceAfter`), and consistency with account balances.
6. Background outbox dispatcher and worker reliability audit, verifying atomic dispatch, duplicate prevention, and establishing explicit tenant context per active organization during background processing.
7. Verification of all 5 responsive, dual-theme frontend billing screens.
8. Complete E2E regression testing: **10 test suites passed, 193 of 193 tests passed (100% pass rate, 0 failures)**.

---

## 2. Table Inventory & Row-Level Security Matrix

### A. Clarification on Outbox Table Inventory
In the Stage 2.6 completion report summary prose, the text inadvertently cited `organization_billing_profiles` instead of `billing_outbox_events`. 
The physical PostgreSQL database schema, Prisma models, and migration `20261122000000_billing_and_payments` contain **10 distinct financial models**:
1. `invoices`
2. `invoice_items`
3. `payments`
4. `payment_allocations`
5. `payment_allocation_reversals`
6. `refunds`
7. `billing_outbox_events` (Transactional Outbox table for financial events)
8. `org_billing_sequences` (Sequential numbering table per organization and FY)
9. `member_credit_accounts` (Member credit balance wallets)
10. `member_credit_entries` (Append-only member credit audit ledger)

Billing profile details (GSTIN, legal name, PAN, address) are maintained directly on `organizations` and `branches` and snapshotted immutably into `supplierSnapshot` on every issued invoice.

### B. PostgreSQL Row-Level Security Verification Matrix
Live inspection on `gymos_dev` and `gymos_test` confirmed that every single financial table has RLS `ENABLED` and `FORCED`, bound strictly to `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` with **ZERO SuperAdmin bypass**.

| Physical Table Name | RLS Enabled | RLS Forced | Policy Command | Policy Expression (RLS Enforcement) | SuperAdmin Bypass? |
| :--- | :---: | :---: | :---: | :--- | :---: |
| `invoices` | **TRUE** | **TRUE** | `ALL` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` | **NONE** |
| `invoice_items` | **TRUE** | **TRUE** | `ALL` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` | **NONE** |
| `payments` | **TRUE** | **TRUE** | `ALL` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` | **NONE** |
| `payment_allocations` | **TRUE** | **TRUE** | `ALL` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` | **NONE** |
| `payment_allocation_reversals`| **TRUE** | **TRUE** | `ALL` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` | **NONE** |
| `refunds` | **TRUE** | **TRUE** | `ALL` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` | **NONE** |
| `billing_outbox_events` | **TRUE** | **TRUE** | `ALL` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` | **NONE** |
| `org_billing_sequences` | **TRUE** | **TRUE** | `ALL` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` | **NONE** |
| `member_credit_accounts` | **TRUE** | **TRUE** | `ALL` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` | **NONE** |
| `member_credit_entries` | **TRUE** | **TRUE** | `ALL` | `organization_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` | **NONE** |

### C. Runtime Database Role Privileges
Querying `pg_roles` for the active runtime user `gymos_user`:
```
┌─────────┬──────────────┬──────────┬──────────────┬────────────┐
│ (index) │ rolname      │ rolsuper │ rolbypassrls │ rolinherit │
├─────────┼──────────────┼──────────┼──────────────┼────────────┤
│ 0       │ 'gymos_user' │ false    │ false        │ true       │
└─────────┴──────────────┴──────────┴──────────────┴────────────┘
```
The database connection operates as an unprivileged application role with `rolsuper: false` and `rolbypassrls: false`. RLS is unconditionally enforced on all statements.

---

## 3. GST Calculation & Invoice Accuracy

1. **Intra-State vs. Inter-State Supply:**
   - Supply within the same state (e.g., Delhi $\rightarrow$ Delhi, State Code 07) automatically splits tax into CGST (9%) and SGST (9%).
   - Supply across different states (e.g., Delhi $\rightarrow$ Haryana, State Code 06) automatically applies IGST (18%).
2. **Rounding Consistency:**
   - In intra-state tax splitting, odd-paise rounding discrepancies are prevented by calculating `itemCgstAmount = itemTax.div(2).toDecimalPlaces(2, ROUND_HALF_UP)` and `itemSgstAmount = itemTax.sub(itemCgstAmount)`.
3. **Tax-Inclusive Backout Calculation:**
   - Tax-inclusive line items correctly back out the taxable value:
     $$\text{Taxable} = \text{round}\left(\frac{\text{Gross}}{1 + \frac{\text{Rate}}{100}}, 2\right)$$
     $$\text{Tax} = \text{Gross} - \text{Taxable}$$
4. **SAC/HSN & Tax Rate Configurability:**
   - SAC defaults to `999723` (Gymnasium Services) if unspecified, but accepts arbitrary SAC/HSN codes per line item (e.g. personal training, merchandise, dietary supplements).
   - Tax rates are configurable per item (0%, 5%, 12%, 18%, 28%).
5. **Immutability of Invoices:**
   - There are no `UPDATE`, `PATCH`, or `DELETE` endpoints for invoices.
   - Point-in-time snapshots (`supplierSnapshot`, `customerSnapshot`, `taxSnapshot`) are frozen permanently upon invoice issuance.
   - Invoices can only be voided via `POST /api/v1/billing/invoices/:id/void` with mandatory audit reason (`voidReason`, `voidedAt`, `voidedById`). Voiding zeroes `balanceDue` so it ceases to appear in outstanding receivables while preserving immutable financial history.

---

## 4. Payment Allocation & Refund Integrity (10 Scenarios Audit)

All 10 scenarios were tested against the live API and database in `test/billing-integrity-audit.e2e-spec.ts`:

1. **Scenario 1 (1-to-1 Payment):**
   - Single payment matching invoice amount transitions invoice to `PAID` with `balanceDue: 0`.
2. **Scenario 2 (1-to-Many Payment):**
   - Single ₹5,000 payment allocated across two invoices (₹2,000 and ₹3,000) successfully settled both invoices to `PAID`.
3. **Scenario 3 (Partial Payment Followed by Final Payment):**
   - ₹2,000 paid on ₹5,000 invoice transitioned it to `PARTIALLY_PAID` with `balanceDue: 3000`. Second payment of ₹3,000 settled it to `PAID` with `balanceDue: 0`.
4. **Scenario 4 (Overpayment to Credit Wallet):**
   - ₹3,000 payment on ₹2,000 invoice with `retainExcessAsCredit: true` allocated ₹2,000 to the invoice and credited ₹1,000 to the member's wallet account.
5. **Scenario 5 (Credit Wallet Redemption):**
   - Member credit applied via `applyCreditToInvoice` successfully settled an invoice using store credit.
6. **Scenario 6 (Partial Refund on Multi-Invoice Payment via LIFO Reversal):**
   - A ₹1,500 refund against a ₹5,000 payment (split ₹2,000 on InvA and ₹3,000 on InvB) reversed ₹1,500 from InvB's allocation. InvB's `balanceDue` was restored to ₹1,500 (`PARTIALLY_PAID`), while InvA remained fully paid (`PAID`, `balanceDue: 0`).
7. **Scenario 7 (Multiple Partial Refunds):**
   - Consecutive partial refunds of ₹1,500, ₹1,500, and ₹1,000 against a ₹4,000 payment transitioned payment status from `COMPLETED` $\rightarrow$ `PARTIALLY_REFUNDED` $\rightarrow$ `PARTIALLY_REFUNDED` $\rightarrow$ `REFUNDED`.
8. **Scenario 8 (Excessive Refund Rejection):**
   - Refund attempt of ₹2,500 on a ₹2,000 payment was rejected with HTTP 400 (`Refund amount exceeds available unrefunded payment balance`).
9. **Scenario 9 (Sequential Rapid Refunds Safety):**
   - Two sequential refund requests that collectively exceeded the unrefunded balance rejected the second slice with HTTP 400.
10. **Scenario 10 (Idempotent Payment Submissions):**
    - Duplicate submission with the same `idempotencyKey` returned the original payment record without creating duplicate transactions or double allocations.

---

## 5. Member Credit Ledger Audit

1. **Append-Only Ledger:**
   - `member_credit_entries` records mutations with immutable timestamps, user attribution (`createdById`), and unique idempotency keys.
2. **Monotonic Running Balances:**
   - In `getMemberCreditLedger`, running balances are computed chronologically:
     $$\text{balanceBefore}_{i} = \sum_{k=0}^{i-1} \text{amount}_k$$
     $$\text{balanceAfter}_{i} = \text{balanceBefore}_{i} + \text{amount}_i$$
   - Verified that the latest `balanceAfter` exactly matches `account.currentBalance`.
3. **No Phantom Credits:**
   - Deposits increment `currentBalance` and log `CREDIT_ADJUSTMENT`.
   - Overpayments increment `currentBalance` and log `OVERPAYMENT_CREDIT`.
   - Redemptions decrement `currentBalance` and log negative `amount` with `CREDIT_APPLIED`.

---

## 6. Sequential Numbering Audit

1. **Indian Financial Year Boundaries:**
   - Calculated via `getFinancialYear(date)`: April 1 through March 31.
   - Formatted sequences:
     - Invoices: `INV/2026-27/00001`
     - Receipts: `REC/2026-27/00001`
     - Refunds: `REF/2026-27/00001`
2. **Concurrency & Atomicity:**
   - Sequence generation utilizes `org_billing_sequences` with atomic upsert and row increment inside the transaction.
3. **No Gapless Claim:**
   - Documented and verified that aborted transactions or voided invoices preserve audit trail rather than rewinding sequence numbers.

---

## 7. Outbox & Background Worker Reliability

1. **Atomic Outbox Enqueue:**
   - Financial operations (`invoice.created`, `invoice.paid`, `payment.recorded`, `billing.refund.issued`, `billing.dues.reminder_triggered`) are written to `billing_outbox_events` within the same database transaction as the financial entities.
2. **Tenant Context in Background Processing:**
   - **Audit Remediation:** In `apps/worker/src/main.ts`, the background loops (`dispatchBillingOutboxEvents`, `processOverdueInvoices`, `dispatchOutboxEvents`, `processExpiredMemberships`) previously polled tables globally without establishing a tenant context. Under strict PostgreSQL RLS without SuperAdmin bypass, this returned 0 rows.
   - **Fix Implemented:** The worker now fetches active organizations with super admin context on `organizations`, then establishes `SET LOCAL app.current_tenant_id = '${org.id}'` in an isolated transaction for each organization.
3. **Idempotency in Daily Overdue Reminders:**
   - `processOverdueInvoices` generates reminder outbox records with `idempotencyKey: outbox_overdue_${inv.id}_${dateStr}`. Repeated runs on the same calendar day cannot produce duplicate reminder events due to the unique constraint on `idempotency_key`.

---

## 8. RBAC & Branch Authorization

1. **Role Enforcement:**
   - `GYM_OWNER` & `GYM_ADMIN`: Full access to invoices, payments, refunds, credits, and financial reports.
   - `RECEPTIONIST`: Can read and create invoices and record payments, but **CANNOT** void invoices (HTTP 403), **CANNOT** issue refunds (HTTP 403), **CANNOT** manually deposit credits (HTTP 403), and **CANNOT** access financial reports (HTTP 403).
   - `TRAINER`: Blocked from all billing endpoints (HTTP 403).
   - `MEMBER`: No staff billing access.
2. **Branch Isolation:**
   - Branch-scoped billing validates the target `branchId` against the user's active `BranchStaffAssignment`. Staff assigned to Branch 1 cannot invoice or collect payments for Branch 2 (HTTP 403).
3. **Cross-Tenant Isolation:**
   - Attempts by Org Beta owner to read Org Alpha invoices or payments return HTTP 404 / 403, blocked directly by PostgreSQL RLS.

---

## 9. Frontend & UI/UX Audit

All 5 screens in `apps/web/src/app/dashboard/billing/` were inspected and verified:
1. **Billing Overview (`/dashboard/billing`):**
   - Real-time KPI summary cards (Today's Collections, MTD Collections, Total Invoiced, Outstanding Dues, Active Credits).
   - Payment method breakdown distribution bar.
   - Branch financial performance table.
2. **Invoices Ledger (`/dashboard/billing/invoices`):**
   - Status tabs, search, branch filter, and pagination.
   - Create invoice modal with dynamic items, auto-calculated subtotal, GST rates, and grand total.
   - Printable GST Tax Invoice Preview Modal with supplier/customer details.
   - Void invoice modal with mandatory reason input and double-submission protection.
3. **Payments Ledger (`/dashboard/billing/payments`):**
   - Multi-method support (Cash, UPI with UTR, Card with POS Auth, Bank Transfer with Ref, Cheque, Member Credit).
   - Record payment modal with active invoice allocation inputs.
   - Printable receipt modal.
   - Refund modal with reason and reference capture.
4. **Aging Dues (`/dashboard/billing/dues`):**
   - Aging brackets summary cards (Current, 1–30, 31–60, 61–90, 90+ days).
   - Member receivables table with quick-collect actions.
5. **Member Credit Wallets (`/dashboard/billing/credits`):**
   - Credit accounts table, advance deposit modal, and chronological transaction ledger.
6. **Themes & Responsiveness:**
   - Complete Light Mode and Dark Mode support with consistent `dark:` classes.
   - Currency formatted using Indian Rupee standards (`₹` with `en-IN` numbering).

---

## 10. Audit Test Execution Log

```
PASS test/billing-integrity-audit.e2e-spec.ts (7.723 s)
  Stage 2.6: Financial Integrity & Deep Allocation Audit (10 Scenarios)
    Scenario 1: One payment allocated to one invoice
      √ should allocate single payment to single invoice and transition to PAID (258 ms)
    Scenario 2: One payment allocated across multiple invoices
      √ should allocate a ₹5000 payment across two invoices (₹2000 and ₹3000) settling both (136 ms)
    Scenario 3: Partial payment followed by another payment
      √ should accept partial payment of ₹2000 on ₹5000 invoice, then second payment of ₹3000 settles it (124 ms)
    Scenario 4: Overpayment deposited into member credit wallet
      √ should allocate ₹2000 to invoice and deposit excess ₹1000 into member credit wallet (85 ms)
    Scenario 5: Member credit applied to an invoice
      √ should use member credit wallet to pay an invoice in full (127 ms)
    Scenario 6: Partial refund against multi-invoice payment (LIFO reversal)
      √ should reverse only the most recent allocation and restore that specific invoice balanceDue (177 ms)
    Scenario 7: Multiple partial refunds against one payment
      √ should allow consecutive partial refunds transitioning payment to REFUNDED upon reaching total (207 ms)
    Scenario 8: Refund exceeding the refundable amount
      √ should reject refund request that exceeds payment unrefunded balance (70 ms)
    Scenario 9: Sequential rapid refund requests safety
      √ should prevent double refund when two rapid requests collectively exceed unrefunded balance (100 ms)
    Scenario 10: Duplicate payment submissions using same idempotency key
      √ should return existing payment without duplicating transactions or allocations (111 ms)
    Audit 4: Member Credit Ledger Verification
      √ should maintain chronological running balances with balanceBefore and balanceAfter matching account balance (33 ms)
    Audit 7: RBAC & Tenant Isolation Verification
      √ should block Receptionist from issuing refunds (403 Forbidden) (63 ms)
      √ should block Trainer from creating invoices (403 Forbidden) (7 ms)
      √ should block Org Beta owner from reading Org Alpha invoice via PostgreSQL RLS (404) (42 ms)

PASS test/billing-management.e2e-spec.ts (7.495 s)
  Stage 2.6: Billing, Invoices, Payments & Financial Records (E2E Integration & Security)
    1. Invoice Creation & GST Snapshots (4 tests)
    2. Invoice Voiding (2 tests)
    3. Manual Payment Recording & Allocations (3 tests)
    4. Overpayments & Member Credit Wallet (3 tests)
    5. Refunds & Allocation Reversals (2 tests)
    6. Dues & Financial Reports (4 tests)
    7. Security, RBAC & Multi-Tenant RLS Isolation (8 tests)

Test Suites: 10 passed, 10 total
Tests:       193 passed, 193 total
Snapshots:   0 total
Time:        27.852 s
```

---

## 11. Findings & Remediations Log

| ID | Severity | Component | Finding Description | Resolution / Remediation |
| :--- | :---: | :--- | :--- | :--- |
| **F-01** | **HIGH** | `apps/worker/src/main.ts` | Background worker queried `billingOutboxEvents` and `invoices` without establishing tenant context. With strict PostgreSQL RLS having no SuperAdmin bypass, queries returned 0 rows. | Updated worker to iterate active organizations and execute dispatch/due checks inside `SET LOCAL app.current_tenant_id = '${org.id}'`. |
| **F-02** | **MEDIUM** | `apps/api/src/billing/billing.service.ts` | `getMemberCreditLedger` returned entries without calculating running balances `balanceBefore` and `balanceAfter`. | Added `balanceBefore` and `balanceAfter` to `MemberCreditEntryData` and computed them monotonically in `getMemberCreditLedger`. |
| **F-03** | **LOW** | `apps/api/src/billing/billing.controller.ts` | Void invoice endpoint returned HTTP 201 instead of standard 200 OK for state mutation. | Added `@HttpCode(HttpStatus.OK)` on `@Post('invoices/:id/void')`. |
| **F-04** | **LOW** | `apps/api/src/billing/billing.controller.ts` | `/reports/kpis` endpoint was plural-only, while API clients/tests accessed `/reports/kpi`. | Updated route to `@Get(['reports/kpi', 'reports/kpis'])` supporting both singular and plural paths. |

---

## 12. Final Audit Verdict

`STAGE 2.6 — FINAL AUDIT PASSED`

All 8 audit dimensions are verified with mathematical precision, strict RLS enforcement, and comprehensive automated test coverage. Stage 2.6 is approved for closure.
