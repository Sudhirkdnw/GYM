# GymOS Local Development Setup & Environment Recovery Guide

This guide walks through configuring, recovering, and verifying the GymOS development environment on Windows 11/10 with native PostgreSQL and Redis in WSL.

---

## 1. System Requirements

- **Operating System**: Windows 11 (build 26100+ recommended) or Linux / macOS
- **Node.js**: v20+ LTS (Node.js v24.16.0 LTS verified)
- **Package Manager**: npm v11+
- **PostgreSQL**: PostgreSQL 16+ (PostgreSQL 18.7 on port 5432 verified)
- **Redis**: Redis 7+ (Redis 8.0.5 in WSL Ubuntu on port 6379 verified)
- **WSL 2**: With mirrored networking (`networkingMode=mirrored`)

---

## 2. Infrastructure Setup & Environment Recovery

### 2.1 PostgreSQL Setup
PostgreSQL runs as a Windows service on `127.0.0.1:5432`.

To initialize the application user and databases:
```powershell
# Connect as superuser (default password 'admin')
$env:PGPASSWORD="admin"
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE ROLE gymos_user WITH LOGIN PASSWORD 'gymos_dev_password' CREATEDB;"
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE gymos_dev OWNER gymos_user;"
psql -U postgres -h 127.0.0.1 -p 5432 -c "CREATE DATABASE gymos_test OWNER gymos_user;"
```

Verify connection using `pg_isready`:
```powershell
& "S:\PostgreSQL\18\bin\pg_isready.exe" -h 127.0.0.1 -p 5432 -U postgres
# Output: 127.0.0.1:5432 - accepting connections
```

---

### 2.2 Redis Setup via WSL with Mirrored Networking

To allow Windows host applications (NestJS and BullMQ Worker) to connect directly to Redis on `127.0.0.1:6379`:

1. Configure WSL mirrored networking in `C:\Users\<username>\.wslconfig`:
   ```ini
   [wsl2]
   networkingMode=mirrored
   ```
2. Restart WSL:
   ```powershell
   wsl --shutdown
   ```
3. Ensure `redis-server` is installed and running in WSL:
   ```bash
   sudo apt-get install -y redis-server
   sudo service redis-server start
   ```
4. Test connectivity from Windows:
   ```powershell
   node -e "const net = require('net'); const s = net.createConnection({port: 6379, host: '127.0.0.1'}, () => { console.log('Redis connected'); s.end(); });"
   ```

---

### 2.3 Docker Compose Alternative
If Docker Desktop is running and enabled on your workstation, you can spin up PostgreSQL and Redis with a single command:
```bash
docker compose up -d
```
*(Note: Docker is optional for local development when native PostgreSQL and WSL Redis are running).*

---

## 3. Monorepo Installation & Database Migration

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Environment Files
```bash
cp .env.example .env
cp .env apps/api/.env
cp .env apps/worker/.env
cp .env apps/web/.env.local
```

### Step 3: Build Monorepo Packages
```bash
npm run build:packages
```

### Step 4: Generate Prisma Client & Run Migrations
```bash
npm run db:generate
npm run db:migrate
```

---

## 4. Launching Development Servers

In separate terminal sessions:

```powershell
# 1. Start NestJS Backend API Gateway (Port 4000)
npm run dev:api

# 2. Start Next.js App Router Web Frontend (Port 3000)
npm run dev:web

# 3. Start BullMQ Background Worker
npm run dev:worker
```

---

## 5. Verification Checklist

Execute the complete verification suite:
```powershell
# 1. Typecheck all apps and packages
npm run typecheck

# 2. Run unit tests
npm test

# 3. Run API e2e integration tests (verifies real DB & Redis)
npm run --workspace=@gymos/api test:e2e

# 4. Run linter
npm run lint

# 5. Production build of web and api
npm run build
```
