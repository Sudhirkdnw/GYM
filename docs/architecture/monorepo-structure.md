# Monorepo Structure & Package Boundaries

GymOS uses an npm workspaces monorepo structure. This architecture allows strict type sharing, centralized configuration, and independent deployment of applications and workers.

## 1. Directory Tree

```
gymos/
├── apps/
│   ├── web/                     # Next.js 14 App Router frontend
│   │   ├── src/
│   │   │   ├── app/             # App Router pages and layouts
│   │   │   ├── components/      # UI components (Button, Card, Layout)
│   │   │   ├── hooks/           # Custom React hooks
│   │   │   ├── lib/             # API client, cn utils
│   │   │   ├── services/        # Frontend API services
│   │   │   └── types/           # Client-specific types
│   │   ├── public/              # Static assets
│   │   └── package.json
│   │
│   ├── api/                     # NestJS backend API gateway
│   │   ├── src/
│   │   │   ├── common/          # Filters, Interceptors, Middleware, Pipes
│   │   │   ├── config/          # Environment validation & configs
│   │   │   ├── database/        # Prisma service & DatabaseModule
│   │   │   ├── health/          # Health check probes (DB, Redis, Overall)
│   │   │   ├── logging/         # Structured logger & LoggingModule
│   │   │   ├── app.module.ts    # Root application module
│   │   │   └── main.ts          # NestJS bootstrap entrypoint
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Multi-tenant PostgreSQL Prisma schema
│   │   │   └── migrations/      # Versioned SQL migrations
│   │   ├── test/                # Supertest e2e integration tests
│   │   └── package.json
│   │
│   └── worker/                  # BullMQ background worker service
│       ├── src/
│       │   └── main.ts          # BullMQ worker initialization & handlers
│       └── package.json
│
├── packages/
│   ├── shared-types/            # Shared TypeScript enums, contracts & types
│   │   ├── src/index.ts
│   │   └── package.json
│   │
│   ├── validation/              # Zod schemas for runtime environment & data
│   │   ├── src/index.ts
│   │   └── package.json
│   │
│   └── config/                  # Global system constants, queues & defaults
│       ├── src/index.ts
│       └── package.json
│
├── infrastructure/
│   ├── docker/                  # Dockerfiles & container assets
│   └── monitoring/              # Observability configs
│
├── docs/                        # Complete technical and operational documentation
│   ├── architecture/
│   ├── decisions/
│   ├── development/
│   ├── api/
│   ├── database/
│   ├── security/
│   └── progress/
│
├── docker-compose.yml           # PostgreSQL & Redis container definitions
├── package.json                 # Monorepo workspaces coordinator
├── tsconfig.base.json           # Shared strict TypeScript configuration
├── .env.example                 # Documented environment template
├── .gitignore                   # Git exclusion rules
├── README.md                    # Project overview and quickstart
└── CONTRIBUTING.md              # Engineering guidelines and Git flow
```

---

## 2. Package Responsibilities and Dependency Graph

```
                   [ apps/web ]       [ apps/api ]       [ apps/worker ]
                        │                  │                   │
                        ├──────────────────┼───────────────────┤
                        ▼                  ▼                   ▼
              [ @gymos/config ]    [ @gymos/validation ]    [ @gymos/shared-types ]
```

1. **`@gymos/shared-types`**:
   Zero runtime dependencies. Contains domain enums (`UserRole`, `TenantStatus`), API envelope interfaces (`ApiResponse<T>`, `ApiErrorResponse`), and health status contracts.

2. **`@gymos/validation`**:
   Contains Zod validation schemas for environment variables, pagination, and data structures. Depends on `zod`.

3. **`@gymos/config`**:
   Contains application constants, BullMQ queue names, default ports, and security parameters.
