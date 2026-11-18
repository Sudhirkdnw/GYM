# GymOS Development Commands Quick Reference

## Monorepo Lifecycle Commands

### Dependencies & Setup

```bash
# Install dependencies across all packages and apps
npm install

# Copy environment variables
cp .env.example .env
```

### Development Servers

```bash
# Start NestJS API Gateway in watch mode (Port 4000)
npm run dev:api

# Start Next.js Web App in development mode (Port 3000)
npm run dev:web

# Start Background Worker in development mode
npm run dev:worker
```

### Build & Compilation

```bash
# Build all packages and applications
npm run build

# Build individual targets
npm run build:packages
npm run build:api
npm run build:web
npm run build:worker
```

### Testing & Quality Assurance

```bash
# Run unit and integration tests across monorepo
npm test

# Run e2e integration tests for API
npm run --workspace=@gymos/api test:e2e

# Run TypeScript type checking
npm run typecheck

# Run ESLint across workspace
npm run lint

# Format code with Prettier
npm run format
```

### Database & Prisma

```bash
# Generate Prisma Client
npm run db:generate

# Create and apply migrations in development
npm run db:migrate

# Apply migrations in production/CI
npm run --workspace=@gymos/api prisma:deploy
```
