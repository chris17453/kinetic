# Getting Started

This guide will help you set up and run Kinetic for development or production.

## Prerequisites

- [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 20+](https://nodejs.org/)
- [Docker](https://www.docker.com/) (for infrastructure)
- SQL Server 2019+ (or use Docker)

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/kinetic.git
cd kinetic
```

### 2. Start Infrastructure

```bash
docker-compose up -d
```

This starts:
- SQL Server (port 1433)
- Redis (port 6379)

### 3. Configure Environment

Create `src/Kinetic.Api/appsettings.Development.json`:

```json
{
  "ConnectionStrings": {
    "Default": "Server=localhost;Database=Kinetic;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True",
    "TempStore": "Server=localhost;Database=KineticTemp;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True"
  },
  "Redis": {
    "ConnectionString": "localhost:6379"
  },
  "Jwt": {
    "Secret": "your-development-secret-key-at-least-32-characters",
    "Issuer": "Kinetic",
    "Audience": "Kinetic",
    "ExpiryMinutes": 60
  }
}
```

### 4. Run Database Migrations

```bash
cd src/Kinetic.Api
dotnet ef database update
```

### 5. Start the API

```bash
cd src/Kinetic.Api
dotnet run
```

API runs at http://localhost:5000

### 6. Start the UI

```bash
cd ui
npm install
npm run dev
```

UI runs at http://localhost:5173

## Default Credentials

| User | Email | Password |
|------|-------|----------|
| Admin | admin@kinetic.local | Admin123! |

## Verify Installation

1. Open http://localhost:5173
2. Log in with admin credentials
3. Navigate to Connections and create a test connection
4. Create a simple report

## Project Structure

```
kinetic/
├── src/
│   ├── Kinetic.Api/         # REST API host
│   ├── Kinetic.Core/        # Domain models, services
│   ├── Kinetic.Data/        # EF Core, repositories
│   ├── Kinetic.Identity/    # Auth services
│   ├── Kinetic.Store/       # Temp data storage
│   ├── Kinetic.Queue/       # Background jobs
│   ├── Kinetic.Ingest/      # TCP data ingestion
│   └── Kinetic.Adapters/    # Database adapters
├── ui/                      # React frontend
├── embed/                   # Embeddable widget
├── tests/                   # Unit, integration, E2E tests
├── infra/                   # Deployment (Bicep, Terraform)
└── docs/                    # Documentation
```

## Next Steps

- [Architecture Overview](./architecture.md)
- [Create Your First Report](./user-guide.md#creating-reports)
- [Configure Entra ID](./admin-guide.md#entra-id-setup)
