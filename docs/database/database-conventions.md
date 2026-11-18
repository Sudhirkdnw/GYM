# GymOS Database Conventions & Standards

## 1. Relational Database Engine
- Engine: PostgreSQL 18
- Access Layer: Prisma ORM
- Isolation: Logical multi-tenant schema with PostgreSQL Row-Level Security (RLS)

---

## 2. Table Classification Architecture

In the GymOS multi-tenant architecture, all tables fall into five distinct classifications:

| Classification | Tables | Description | RLS Applied? |
| :--- | :--- | :--- | :---: |
| **Global Identity Tables** | `users` | Platform-wide identity records. A user can belong to multiple gyms. Queried during global login before tenant is resolved. | **No** (Direct query) |
| **Tenant Root Table** | `organizations` | Represents individual gym organizations. Contains tenant settings, slug, and status. | **Yes** (`id = app.current_tenant_id`) |
| **Association Tables** | `organization_users`, `branch_staff_assignments` | Maps global users to organizations/branches with roles and assignments. | **Yes** (`organization_id = app.current_tenant_id`) |
| **Tenant-Owned Tables** | `branches`, `audit_logs` (future: `members`, `plans`, `invoices`, etc.) | Fully partitioned tenant records. Must contain an `organization_id` foreign key. | **Yes** (`organization_id = app.current_tenant_id`) |
| **System Tables** | `_prisma_migrations` | Schema migration history and engine tooling. Global to the database. | **No** |

---

## 3. Row-Level Security (RLS) Standards

For every Tenant-Owned or Association table:
1. Must contain an `organization_id UUID NOT NULL` column.
2. Must execute:
   ```sql
   ALTER TABLE "<table_name>" ENABLE ROW LEVEL SECURITY;
   ALTER TABLE "<table_name>" FORCE ROW LEVEL SECURITY;
   ```
3. Must define a comprehensive policy covering SELECT, INSERT, UPDATE, DELETE:
   ```sql
   CREATE POLICY "tenant_isolation_policy_<table_name>" ON "<table_name>"
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
   ```

---

## 4. Naming Conventions

### 4.1 Tables
- Must use lowercase `snake_case` in plural form (e.g. `organizations`, `users`, `organization_users`, `audit_logs`).
- Model definitions in Prisma use `PascalCase` and explicitly map to table names:
  ```prisma
  model OrganizationUser {
    ...
    @@map("organization_users")
  }
  ```

### 4.2 Columns
- Must use lowercase `snake_case` (e.g. `organization_id`, `created_at`, `password_hash`).
- Model fields in Prisma use `camelCase` and explicitly map to column names:
  ```prisma
  organizationId String @map("organization_id") @db.Uuid
  ```

### 4.3 Composite Indices for Multi-Tenancy
- In addition to standard primary and foreign keys, all tenant-owned tables must define composite indexes:
  - `(organization_id, id)`: For single-record lookups and joins.
  - `(organization_id, created_at)`: For paginated list queries.

---

## 5. Financial and Decimal Data Handling

> [!CAUTION]
> **Zero Floating-Point Tolerance for Currency**:
> Never use `FLOAT`, `DOUBLE`, `REAL`, or JavaScript floating numbers for financial amounts (membership prices, invoice totals, payment charges, discounts).

### Rules:
1. In PostgreSQL schema, all financial columns must use `@db.Decimal(12, 2)` or integer cents.
2. In TypeScript/Node.js application layer:
   - Use `Prisma.Decimal` or high-precision math libraries.
   - Store prices in calculations using integer minor units (cents) or precise Decimal math.
   - Never perform `price * tax` using raw JavaScript floating point math.

---

## 6. Safe Migration Workflow

1. Always inspect generated SQL before applying:
   ```bash
   npx prisma migrate dev --create-only --name <migration_name>
   ```
2. When creating new tenant tables, include RLS activation and policies in the migration script.
3. In production environments, migrations are applied using:
   ```bash
   npx prisma migrate deploy
   ```
4. Never delete existing production migration folders.
