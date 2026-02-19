# Kinetic Development Environment

## Quick Start

```bash
# Start core infrastructure (MSSQL + Redis)
docker-compose up -d

# Start with dev tools (Redis Commander)
docker-compose --profile dev-tools up -d

# Start with sample databases for adapter testing
docker-compose --profile sample-dbs up -d

# Start everything including observability
docker-compose --profile dev-tools --profile sample-dbs --profile observability up -d

# Stop all
docker-compose --profile dev-tools --profile sample-dbs --profile observability down
```

## Services

### Core (always started)
| Service | Port | Description |
|---------|------|-------------|
| MSSQL | 1433 | System database |
| Redis | 6379 | Cache + Message queue |

### Dev Tools (--profile dev-tools)
| Service | Port | Description |
|---------|------|-------------|
| Redis Commander | 8081 | Redis UI |

### Sample DBs (--profile sample-dbs)
| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Sample target DB |
| MySQL | 3306 | Sample target DB |

### Observability (--profile observability)
| Service | Port | Description |
|---------|------|-------------|
| Seq | 5341/8082 | Log aggregation |

## Connection Strings

### MSSQL (System DB)
```
Server=localhost,1433;Database=Kinetic;User Id=sa;Password=Kinetic@Dev123!;TrustServerCertificate=True
```

### Redis
```
localhost:6379
```

### PostgreSQL (Sample)
```
Host=localhost;Port=5432;Database=sample;Username=kinetic;Password=kinetic123
```

### MySQL (Sample)
```
Server=localhost;Port=3306;Database=sample;User=kinetic;Password=kinetic123
```

## Local Development

Run the .NET solution and UI locally, connecting to Docker infrastructure:

```bash
# Terminal 1: Start infrastructure
docker-compose up -d

# Terminal 2: Run API
cd src/Kinetic.Api
dotnet run

# Terminal 3: Run UI
cd ui
npm run dev
```

## Environment Variables

Create `appsettings.Development.json` in Kinetic.Api:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost,1433;Database=Kinetic;User Id=sa;Password=Kinetic@Dev123!;TrustServerCertificate=True"
  },
  "Redis": {
    "ConnectionString": "localhost:6379"
  },
  "DuckDb": {
    "DataPath": "./data/duckdb"
  },
  "Jwt": {
    "Secret": "your-development-secret-key-at-least-32-characters",
    "Issuer": "kinetic-dev",
    "Audience": "kinetic-dev",
    "ExpiryMinutes": 60
  },
  "Ingest": {
    "Port": 9999
  }
}
```

## Volumes

Data is persisted in Docker volumes:
- `kinetic-mssql-data` - MSSQL data files
- `kinetic-redis-data` - Redis AOF persistence
- `kinetic-postgres-data` - PostgreSQL data (sample)
- `kinetic-mysql-data` - MySQL data (sample)
- `kinetic-seq-data` - Seq log data
- `kinetic-duckdb-data` - DuckDB temp store data

To reset all data:
```bash
docker-compose down -v
```
