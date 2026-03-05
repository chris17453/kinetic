# Kinetic — Developer Setup

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 20+](https://nodejs.org/) (for the UI)
- [Docker & Docker Compose](https://docs.docker.com/get-docker/)

## 1. Start Infrastructure

The core services (MSSQL, Redis, RabbitMQ) are defined in `docker-compose.yml`. Start them with:

```bash
docker compose up -d mssql redis rabbitmq
```

Wait for healthy status (especially MSSQL which takes ~30s):

```bash
docker compose ps
```

### Default credentials

| Service    | Port(s)       | Credentials / Connection String                                                          |
|------------|---------------|------------------------------------------------------------------------------------------|
| **MSSQL**  | `1433`        | `Server=localhost,1433;Database=Kinetic;User Id=sa;Password=Kinetic@Dev123!;TrustServerCertificate=True` |
| **Redis**  | `6379`        | `localhost:6379`                                                                         |
| **RabbitMQ** | `5672` (AMQP), `15672` (management UI) | `amqp://guest:guest@localhost:5672`                                          |

RabbitMQ management UI: http://localhost:15672 (guest/guest)

### Optional services

```bash
# Sample databases (PostgreSQL, MySQL) for testing adapters
docker compose --profile sample-dbs up -d

# Dev tools (Redis Commander UI on :8081)
docker compose --profile dev-tools up -d

# Observability (Seq log viewer on :8082)
docker compose --profile observability up -d
```

## 2. Run the API (First-Run Setup Wizard)

No manual config files needed — the setup wizard handles everything on first boot.

```bash
cd src/Kinetic.Api
dotnet run
```

The API starts on `http://localhost:5000`. Because there's no `kinetic.config.json` yet, it boots in **setup mode** — only the `/api/setup/*` endpoints are active.

## 3. Run the UI

```bash
cd ui
npm install
npm run dev
```

The UI starts on `http://localhost:5173`. On first load it checks `GET /api/setup/status` and redirects to the **Setup Wizard** at `/setup`.

## 4. Walk Through the Setup Wizard

The wizard has 6 steps:

| Step | What to enter | Default / tip |
|------|---------------|---------------|
| **Database** | MSSQL connection string | `Server=localhost,1433;Database=Kinetic;User Id=sa;Password=Kinetic@Dev123!;TrustServerCertificate=True` |
| **Message Broker** | RabbitMQ connection string | Pre-filled: `amqp://guest:guest@localhost:5672` |
| **Cache** | Redis connection string | Pre-filled: `localhost:6379` |
| **Security** | Encryption key | Auto-generated (copy it somewhere safe) |
| **Admin Account** | Display name, email, password | Your choice — this is the first admin user |
| **Review** | Confirm everything | Click **Complete Setup** |

Each connection step has a **Test Connection** button — you must pass the test before advancing.

When you click **Complete Setup** the API:
1. Writes `kinetic.config.json` (git-ignored)
2. Applies EF Core migrations to the database
3. Creates an "Administrators" group with every permission
4. Creates your admin user as Owner of that group
5. Restarts itself

After restart the UI redirects to the login page. Sign in with the admin credentials you just created.

## 5. Run the Worker (optional)

The background worker handles scheduled reports, queue consumers, and cleanup jobs. It reads the same `kinetic.config.json`.

```bash
cd src/Kinetic.Worker
dotnet run
```

If no config exists yet, the worker logs a warning and exits gracefully — run the setup wizard first.

## Project Structure

```
src/
  Kinetic.Api/           # ASP.NET Core REST API
  Kinetic.Worker/        # Background job processor (MassTransit consumers)
  Kinetic.Core/          # Domain models, interfaces
  Kinetic.Data/          # EF Core DbContext, migrations
  Kinetic.Identity/      # Auth, JWT, user/group services
  Kinetic.Adapters/      # Database adapters (Postgres, MySQL, Oracle, etc.)
  Kinetic.Queue/         # MassTransit + RabbitMQ config
  Kinetic.Store/         # Redis cache service
  Kinetic.Ingest/        # TCP ingest server
ui/                      # React + Vite frontend
docker/                  # Init scripts for sample databases
```

## Common Tasks

### Reset everything

```bash
# Stop and destroy all containers + volumes
docker compose down -v

# Delete the generated config (forces setup wizard on next run)
rm -f src/Kinetic.Api/kinetic.config.json
```

### Rebuild the database

Delete `kinetic.config.json` and re-run the setup wizard, or manually drop and re-create:

```bash
cd src/Kinetic.Api
dotnet ef database drop --force
dotnet ef database update
```

### Add an EF Core migration

```bash
cd src/Kinetic.Api
dotnet ef migrations add MigrationName --project ../Kinetic.Data
```

## Ports Summary

| Service          | Port  |
|------------------|-------|
| Kinetic API      | 5000  |
| Kinetic UI (dev) | 5173  |
| MSSQL            | 1433  |
| Redis            | 6379  |
| RabbitMQ (AMQP)  | 5672  |
| RabbitMQ (UI)    | 15672 |
| Redis Commander  | 8081  |
| Seq              | 8082  |
| Ingest (TCP)     | 9999  |
