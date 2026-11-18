# GymOS Security Baseline

## 1. Perimeter Security & HTTP Headers

The NestJS backend application applies production HTTP security headers using `helmet`:

- `Content-Security-Policy` (CSP)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security` (HSTS)
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 2. CORS (Cross-Origin Resource Sharing)

- In development: Configured to accept requests from `http://localhost:3000`.
- In production: Strict origin whitelist parsed from the `CORS_ORIGIN` environment variable.
- Wildcards (`*`) with credentials (`credentials: true`) are explicitly disallowed.
- Allowed methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- Allowed headers: `Content-Type`, `Authorization`, `x-correlation-id`, `x-request-id`, `x-organization-id`.

---

## 3. Secret Management & Environment Security

- Secrets are strictly prohibited from being committed to Git (`.gitignore` enforces exclusions).
- All runtime environment variables are strictly validated at bootstrap using Zod (`apiEnvSchema`, `workerEnvSchema`). If any required secret or URL is missing or malformed, the process halts immediately with actionable errors.
- Secrets and passwords are sanitized before logging. Loggers never output database connection strings, passwords, or JWT secrets.

---

## 4. Input Validation & Injection Defense

- All incoming external data is validated through Zod validation pipes before reaching controllers or domain logic.
- Parameterized queries are enforced via Prisma ORM, preventing SQL injection vulnerabilities.
- Raw queries are forbidden except for verified database session variables (`SET LOCAL app.current_tenant_id`).
