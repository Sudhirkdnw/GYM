# GymOS — Production-Grade SaaS Foundation (Stage 1)

**GymOS** is a multi-tenant Gym Management & Automation SaaS engineered for gym owners, fitness trainers, staff, and enterprise fitness chains.
The platform is built as a **Modular Monolith** designed to scale from an initial target of 20 pilot gyms to 1,000+ gyms seamlessly.

---

## 🚀 Key Highlights & Architecture

- **Monorepo Architecture**: Clean npm workspaces structure organizing `apps/` and `packages/`.
- **Frontend Layer**: Next.js 14 App Router, TypeScript (strict mode), Tailwind CSS, Lucide icons, React Hook Form, Zod validation, TanStack Query.
- **Backend API Gateway**: NestJS 10, Express, helmet security headers, correlation ID tracing (`x-correlation-id`), global exception filters, and OpenAPI/Swagger documentation (`/api/docs`).
- **Data Layer**: PostgreSQL 18 with Prisma ORM, strict tenant foreign keys, UUID primary keys, and decimal-precision money types.
- **Async Queue Foundation**: Redis 7+ and BullMQ background worker engine with graceful shutdown, retry, and structured logging.
- **Observability**: Real health endpoints reporting live database and Redis latency (`/api/v1/health`, `/api/v1/health/database`, `/api/v1/health/redis`).

---

## 📁 Repository Structure

```
gymos/
├── apps/
│   ├── web/                     # Next.js 14 App Router frontend (Port 3000)
│   ├── api/                     # NestJS Core API Gateway (Port 4000)
│   └── worker/                  # BullMQ Background Worker
├── packages/
│   ├── shared-types/            # Shared domain contracts, enums & response types
│   ├── validation/              # Zod schemas for env, pagination & queries
│   └── config/                  # Global system configuration constants & queues
├── infrastructure/
│   ├── docker/                  # Dockerfiles and infrastructure assets
│   └── monitoring/              # Telemetry & health configurations
├── docs/
│   ├── architecture/            # Architecture overview & multi-tenancy spec
│   ├── decisions/               # Architecture Decision Records (ADRs)
│   ├── development/             # Setup guide, commands & coding standards
│   ├── database/                # Database conventions & decimal money rules
│   ├── security/                # Security baseline & CORS policies
│   └── progress/                # Stage 1 verification report
├── docker-compose.yml           # Containerized PostgreSQL & Redis
├── package.json                 # Monorepo workspaces manifest
├── tsconfig.base.json           # Shared strict TypeScript configuration
└── .env.example                 # Environment variables specification
```

---

## ⚡ Quickstart

### 1. Prerequisites

- Node.js `v20+` (v24 LTS verified)
- PostgreSQL `16+` (v18 verified)
- Redis `7+` (v8 verified)

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

```bash
cp .env.example .env
```

Ensure PostgreSQL credentials and Redis host/port match your local environment in `.env`.

### 4. Database Migration

```bash
npm run db:generate
npm run db:migrate
```

### 5. Running the Application

```bash
# Start API Gateway (http://localhost:4000/api/v1)
npm run dev:api

# Start Web Frontend (http://localhost:3000)
npm run dev:web

# Start Background Worker
npm run dev:worker
```

### 6. Interactive API Documentation

Open Swagger UI at:

```
http://localhost:4000/api/docs
```

---

## 🧪 Testing & Verification

```bash
# Run unit tests
npm test

# Run API e2e integration tests (verifies real DB & Redis connectivity)
npm run --workspace=@gymos/api test:e2e

# Run strict TypeScript type check across all workspaces
npm run typecheck

# Build all applications for production
npm run build
```

---

## 📚 Architectural Documentation

- [System Architecture Overview](docs/architecture/system-overview.md)
- [Monorepo Structure](docs/architecture/monorepo-structure.md)
- [Multi-Tenancy Specification](docs/architecture/multi-tenancy.md)
- [Setup & Recovery Guide](docs/development/setup-guide.md)
- [Development Commands](docs/development/commands.md)
- [Database Conventions & Money Handling](docs/database/database-conventions.md)
- [Security Baseline](docs/security/security-baseline.md)
- [ADR-001: Modular Monolith](docs/decisions/ADR-001-modular-monolith.md)
- [ADR-002: Shared Database with RLS](docs/decisions/ADR-002-shared-database-tenancy.md)
- [Stage 1 Final Report](docs/progress/STAGE-1-REPORT.md)
