# ADR-002: Multi-Tenancy Strategy — Shared Database with Row-Level Security (RLS)

## Status

Accepted

## Date

2026-11-18

## Context

Multi-tenancy requires isolating data between distinct fitness businesses. We evaluated three tenancy models:

1. **Database-per-Tenant**: Each gym has its own PostgreSQL database.
2. **Schema-per-Tenant**: Single database with separate PostgreSQL schema per gym.
3. **Shared Database & Shared Schema with Tenant Discriminator + PostgreSQL RLS**: All gyms share tables partitioned logically by `organization_id` and enforced via kernel Row-Level Security.

## Decision

We adopted **Shared Database & Shared Schema with Tenant-Aware Tables and PostgreSQL Row-Level Security (RLS)**.

## Rationale

1. **Scalability to 1,000+ Gyms**: Database-per-tenant requires managing hundreds of database connections, connection pools, and migration pipelines. Schema-per-tenant causes PostgreSQL catalog bloat and complex migrations. Shared schema scales smoothly to millions of rows with proper indexing on `(organization_id, id)`.
2. **Operational Cost**: Infrastructure costs are minimized by maximizing connection pool utilization and compute efficiency.
3. **Database Kernel Security**: PostgreSQL Row-Level Security provides defense-in-depth at the storage layer. Even if an application query lacks an explicit tenant filter, the database rejects unauthorized row access.

## Consequences

- Every tenant table must contain an `organization_id` foreign key.
- Database queries must execute within a tenant context session (`SET LOCAL app.current_tenant_id = ...`).
- In Stage 1, the foundational schema models are created; full RLS policies and isolation penetration tests are scheduled for Stage 2.
