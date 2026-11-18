# Contributing to GymOS

Thank you for contributing to GymOS. To maintain production-grade quality, security, and scalability, all contributions must adhere to the following standards.

---

## 1. Monorepo Principles & Boundaries

1. **Modular Monolith Discipline**:
   - Keep business domains separated.
   - Do not create circular dependencies between modules.
   - Cross-domain models and contracts must reside in `@gymos/shared-types`.

2. **No Speculative Code**:
   - Only implement features mapped to the current project stage.
   - Do not leave empty placeholder classes, dummy mocks, or unused imports.

3. **Strict TypeScript**:
   - Never use `any`. All function signatures, inputs, and outputs must be strongly typed.
   - Passing `npm run typecheck` is mandatory before creating a PR.

---

## 2. Multi-Tenancy Rules

- Every tenant-scoped entity MUST include `organization_id`.
- Never execute raw SQL without verifying tenant context scoping.
- Background worker jobs must include `organizationId` and `correlationId` in the payload.
- Redis cache keys must always be prefixed with `gymos:{organizationId}:`.

---

## 3. Financial and Monetary Data Rules

- Never use floating-point types (`FLOAT`, `DOUBLE`, `REAL`, or JavaScript `number`) for financial amounts.
- All monetary fields in Prisma schema must be `@db.Decimal(12, 2)` or integer cents.
- Perform currency calculations using Decimal representations or integer cents.

---

## 4. Pull Request Checklist

Before submitting a PR, verify:

- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm test` passes.
- [ ] `npm run --workspace=@gymos/api test:e2e` passes.
- [ ] `npm run build` succeeds for all packages and applications.
- [ ] Architecture documentation in `docs/` is updated if any patterns or models changed.
- [ ] No secrets or `.env` files are tracked.
