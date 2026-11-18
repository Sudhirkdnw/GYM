# ADR-001: Architecture Pattern Selection — Modular Monolith

## Status

Accepted

## Date

2026-11-18

## Context

GymOS is designed to manage gym operations, member subscriptions, attendance tracking, lead pipelines, and automation workflows. The initial target is 20 gyms, with a future growth path to 1,000+ gyms.
We evaluated three architectural candidates:

1. Pure Microservices
2. Traditional Unstructured Monolith
3. Modular Monolith

## Decision

We chose the **Modular Monolith** architecture pattern deployed as a single backend application alongside a dedicated asynchronous worker process and Next.js frontend within an npm monorepo.

## Rationale

1. **Development Velocity**: A single deployable backend eliminates distributed system overhead, distributed transactions (Sagas), network latency between services, and complex service mesh configurations.
2. **Transactional Integrity**: Multi-table operations (e.g. member registration + invoice generation + payment recording) can execute inside atomic PostgreSQL ACID transactions.
3. **Clean Domain Boundaries**: Modules communicate via clear interfaces and shared types in `@gymos/shared-types`.
4. **Future Microservices Readiness**: If a specific module (e.g. WhatsApp Automation or Attendance Webhooks) later exhibits asymmetric compute or bandwidth demands at 1,000+ gyms, that module can be extracted into an independent microservice with minimal refactoring.

## Consequences

- Developers must respect module boundaries and avoid direct circular dependencies between modules.
- Shared database migrations require careful planning and backwards compatibility.
