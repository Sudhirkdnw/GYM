# GymOS Security Baseline

## 1. Perimeter Security & HTTP Headers

The NestJS backend application applies production HTTP security headers using `helmet`:
- `Content-Security-Policy` (CSP)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security` (HSTS: max-age=31536000; includeSubDomains)
- `Referrer-Policy: no-referrer`
- `Origin-Agent-Cluster: ?1`

---

## 2. CORS (Cross-Origin Resource Sharing)

- In development: Configured to accept requests from `http://localhost:3000`.
- In production: Strict origin whitelist parsed from the `CORS_ORIGIN` environment variable.
- Wildcards (`*`) with credentials (`credentials: true`) are explicitly disallowed.
- Allowed methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- Allowed headers: `Content-Type`, `Authorization`, `x-correlation-id`, `x-request-id`, `x-organization-id`.

---

## 3. Multi-Tenant Database Security & Row-Level Security (RLS)

### 3.1 Kernel-Enforced Row-Level Security
- All tenant-owned tables (`organizations`, `organization_users`, `audit_logs`) enforce PostgreSQL Row-Level Security.
- `FORCE ROW LEVEL SECURITY` is applied to every tenant table, ensuring the application database role (`gymos_user`) is strictly bound to RLS policies even as the table owner.
- The application database user (`gymos_user`) does not possess `BYPASSRLS` or `SUPERUSER` privileges:
  ```sql
  SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'gymos_user';
  -- Result: gymos_user | rolsuper: false | rolbypassrls: false
  ```

### 3.2 Transaction-Local Tenant Context (`SET LOCAL`)
- Tenant context is set locally per database transaction:
  ```sql
  SET LOCAL app.current_tenant_id = '<verified-uuid>';
  ```
- **Connection Pool Safety**: `SET LOCAL` is automatically discarded when the transaction commits or aborts. No tenant variables leak into pooled connections.
- **Default Deny**: Outside of an active tenant context, RLS policies deny access by default (0 rows returned).

### 3.3 Security Limitations & Defense-in-Depth
> [!IMPORTANT]
> **Architectural Security Boundary**:
> Setting a custom PostgreSQL configuration parameter (`app.current_tenant_id`) is a critical layer of defense, but does NOT by itself eliminate SQL injection risks or replace application-layer authorization.
> GymOS enforces defense-in-depth:
> 1. Strict input validation via Zod schemas and UUID regex enforcement.
> 2. Parameterized queries via Prisma ORM preventing SQL injection.
> 3. Server-side membership authorization via `TenantContextService` preventing unauthorized tenant switching.
> 4. Database-level RLS policies enforcing storage isolation.

---

## 4. Secret Management & Environment Security

- Secrets are strictly prohibited from being committed to Git (`.gitignore` enforces exclusions).
- All runtime environment variables are strictly validated at bootstrap using Zod (`apiEnvSchema`, `workerEnvSchema`). If any required secret or URL is missing or malformed, the process halts immediately with actionable errors.
- Secrets and passwords are sanitized before logging. Loggers never output database connection strings, passwords, or JWT secrets.

---

## 5. Input Validation & Injection Defense

- All incoming external data is validated through Zod validation pipes before reaching controllers or domain logic.
- Parameterized queries are enforced via Prisma ORM, preventing SQL injection vulnerabilities.
- Raw queries are forbidden except for verified database session variables (`SET LOCAL app.current_tenant_id`).
