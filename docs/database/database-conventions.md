# GymOS Database Conventions & Standards

## 1. Relational Database Engine

- Engine: PostgreSQL 18
- Access Layer: Prisma ORM
- Isolation: Logical multi-tenant schema with future Row-Level Security (RLS)

---

## 2. Naming Conventions

### 2.1 Tables

- Must use lowercase `snake_case` in plural form (e.g. `organizations`, `users`, `organization_users`, `audit_logs`).
- Model definitions in Prisma use `PascalCase` and explicitly map to table names:
  ```prisma
  model OrganizationUser {
    ...
    @@map("organization_users")
  }
  ```

### 2.2 Columns

- Must use lowercase `snake_case` (e.g. `organization_id`, `created_at`, `password_hash`).
- Model fields in Prisma use `camelCase` and explicitly map to column names:
  ```prisma
  organizationId String @map("organization_id") @db.Uuid
  ```

### 2.3 Foreign Keys and Constraints

- Foreign keys must be indexed explicitly with `idx_{table}_{column}` format.
- Primary keys use UUID v4: `@id @default(uuid()) @db.Uuid`.
- Timestamps must use `@db.Timestamptz` (`timestamp with time zone`) to avoid timezone ambiguity.

---

## 3. Financial and Decimal Data Handling

> [!CAUTION]
> **Zero Floating-Point Tolerance for Currency**:
> Never use `FLOAT`, `DOUBLE`, `REAL`, or JavaScript floating numbers for financial amounts (membership prices, invoice totals, payment charges, discounts).

### Rules:

1. In PostgreSQL schema, all financial columns must use `@db.Decimal(12, 2)` or integer cents.
2. In TypeScript/Node.js application layer:
   - Use `Prisma.Decimal` or a high-precision decimal library (e.g. `decimal.js`).
   - Store prices in calculations using integer minor units (cents) or precise Decimal math.
   - Never perform `price * tax` using raw JavaScript floating point math.

---

## 4. Safe Migration Workflow

1. Always inspect generated SQL before applying in production:
   ```bash
   npx prisma migrate dev --create-only --name <migration_name>
   ```
2. Review the resulting SQL migration in `apps/api/prisma/migrations/`.
3. In production environments, migrations are applied using:
   ```bash
   npx prisma migrate deploy
   ```
4. Never delete existing production migration folders.
5. All schema modifications must be backwards-compatible (expand and contract pattern).

---

## 5. Connection Pooling and Concurrency

- API Gateway uses Prisma connection pooling configured via connection string parameters:
  `?connection_limit=20&pool_timeout=10`
- BullMQ worker processes use dedicated connection pools with minimal pool sizes (`connection_limit=5`) to prevent database connection exhaustion.
