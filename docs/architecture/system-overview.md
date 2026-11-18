# GymOS — High-Level System Architecture Overview

## 1. Executive Summary

GymOS is a multi-tenant SaaS application built for modern gym and fitness enterprises. The platform is designed from day one to scale from an initial target of 20 pilot gyms to 1,000+ gyms seamlessly without requiring architectural redesign.

GymOS operates as a **Modular Monolith**:

- Single unified deployable codebase preserving transactional integrity and development speed.
- Strictly decoupled domain modules with clear public interfaces.
- Prepared for seamless microservices extraction in future phases if specific modules (e.g. WhatsApp Automation or Attendance Webhooks) require independent autoscaling.

---

## 2. High-Level Architecture Diagram

```
                                      [ Users ]
                  (Super Admins, Gym Owners, Staff, Members)
                                          │
                                          ▼
                             [ Next.js Web Application ]
                                (App Router, React 18)
                                          │
                                          ▼
                               [ Reverse Proxy / TLS ]
                                          │
                                          ▼
                            [ NestJS API Gateway Engine ]
                       (Express, TypeScript Strict, Helmet)
                                          │
    ┌───────────────────────┬─────────────┴─────────────┬────────────────────────┐
    ▼                       ▼                           ▼                        ▼
[ Authentication & RBAC ] [ Tenant Context ]     [ Health & Metrics ]   [ BullMQ Job Producers ]
    │                       │                                                    │
    ▼                       ▼                                                    ▼
[ PostgreSQL 18 Engine ] [ Row-Level Security ]                           [ Redis 7+ Engine ]
(Prisma ORM, Decimal Money, UUID)                                         (In-Memory Cache & Queues)
                                                                                 │
                                                                                 ▼
                                                                     [ GymOS Worker Process ]
                                                                     (BullMQ Consumers, Async Tasks)
```

---

## 3. Core Architectural Principles

### 3.1 Strict Tenant Isolation

All tenant data is partitioned logically by `organization_id`. Tenant context is resolved at the API perimeter and propagated through asynchronous execution context down to database transactions and background queues.

### 3.2 Modular Monolith Boundaries

No cross-module direct table access. All modules communicate via explicit service contracts, shared types, or background domain events.

### 3.3 Strict Financial Precision

No floating-point numbers (`FLOAT`, `DOUBLE`, `REAL`) are permitted for currency or subscription billing amounts. All financial values use PostgreSQL `DECIMAL(12, 2)` or `NUMERIC` types with integer cents calculations in memory.

### 3.4 Decoupled Asynchronous Processing

Time-consuming operations (PDF invoice rendering, WhatsApp message delivery, notification fanout, audit trail ingestion) are offloaded to Redis-backed BullMQ queues and consumed by dedicated worker processes.

### 3.5 Observable & Resilient

Every request generates and carries an immutable `x-correlation-id`. Structured JSON logging, real health probes (`/health`, `/health/database`, `/health/redis`), and graceful shutdown hooks are baked into the foundation.
