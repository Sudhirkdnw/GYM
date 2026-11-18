# GymOS Coding Standards & Engineering Guidelines

## 1. Clean Code Standards

- **Strict TypeScript**: Never use `any`. Explicitly type all function signatures, return types, and interfaces. Enable all strict compiler flags.
- **Single Responsibility**: Each function, service, and controller must perform one distinct task.
- **Meaningful Names**: Use intention-revealing names (`validateTenantSubscription` instead of `check`).
- **Fail Fast & Explicit Error Handling**: Validate inputs at boundaries. Never swallow exceptions or leave empty catch blocks.

---

## 2. Monorepo Reusability Rules

- Place cross-application contracts, enums, and response models in `packages/shared-types`.
- Place common Zod validation schemas in `packages/validation`.
- Place global system configurations and queue constants in `packages/config`.
- Avoid premature abstraction. Only extract shared utilities when real reuse across multiple apps exists.

---

## 3. Asynchronous Operations & Worker Standards

- All background tasks must use BullMQ queues defined in `@gymos/config` (`QUEUES`).
- Jobs must include `organizationId` and `correlationId` in the job payload.
- Jobs must be idempotent to allow safe automatic retries on network or transient failures.

---

## 4. Documentation Continuity

- Whenever an architectural pattern, route, or schema changes, update the corresponding documentation under `docs/` immediately.
