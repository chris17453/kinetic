# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                      │
├────────────────┬────────────────┬─────────────────┬──────────────────────┤
│   React UI     │  Embedded      │   External      │     TCP Ingest       │
│   (Vite)       │  Widget        │   APIs          │     (netcat)         │
└───────┬────────┴───────┬────────┴────────┬────────┴──────────┬───────────┘
        │                │                 │                   │
        └────────────────┴─────────────────┴───────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                     │
│                         (.NET 8 Minimal APIs)                            │
├──────────────────────────────────────────────────────────────────────────┤
│  Auth  │  Reports  │  Catalog  │  Connections  │  Admin  │  AI  │  Export│
└────────┴───────────┴───────────┴───────────────┴─────────┴──────┴────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
        ▼                          ▼                          ▼
┌───────────────┐        ┌─────────────────┐        ┌─────────────────┐
│  Redis Queue  │        │  System DB      │        │   Temp Store    │
│  (MassTransit)│        │  (MSSQL)        │        │   (MSSQL)       │
└───────────────┘        └─────────────────┘        └─────────────────┘
        │                          │
        │                          │
        ▼                          ▼
┌───────────────┐        ┌─────────────────────────────────────────────────┐
│  Background   │        │              DATABASE ADAPTERS                   │
│  Workers      │        ├─────────┬─────────┬─────────┬─────────┬─────────┤
│  - Query Jobs │        │ SQL Srv │ Postgres│  MySQL  │  Oracle │ MongoDB │
│  - Sync Jobs  │        │ SQLite  │Snowflake│ BigQuery│         │         │
│  - Cleanup    │        └─────────┴─────────┴─────────┴─────────┴─────────┘
└───────────────┘                              │
                                               ▼
                                 ┌─────────────────────────────┐
                                 │      External Databases     │
                                 │      (Customer Data)        │
                                 └─────────────────────────────┘
```

## Core Components

### Kinetic.Api
The REST API host using .NET 8 Minimal APIs.

- **Endpoints**: Auth, Users, Groups, Connections, Reports, Catalog, Embed, Admin, AI, Export
- **Middleware**: Authentication, Authorization, Audit Logging, Error Handling
- **OpenAPI**: Full API documentation with Scalar UI

### Kinetic.Core
Domain models, interfaces, and core services.

- **Entities**: User, Group, Organization, Report, Connection, etc.
- **Interfaces**: IRepository, IAdapter, IQueryExecutor
- **Services**: PermissionService, ReportExecutionService, AIService

### Kinetic.Data
Entity Framework Core data layer with MSSQL.

- **DbContext**: KineticDbContext
- **Repositories**: Generic and specialized repositories
- **Migrations**: Database schema management

### Kinetic.Identity
Authentication and authorization services.

- **Local Auth**: JWT-based email/password authentication
- **Entra ID**: Microsoft Entra ID OAuth2/OIDC integration
- **Permissions**: Role-based and attribute-based access control

### Kinetic.Store
Temporary data storage for query results.

- **TempCacheService**: Store large query results
- **Auto-expiry**: Configurable TTL for cached data
- **Pagination**: Efficient access to cached results

### Kinetic.Queue
Background job processing with MassTransit and Redis.

- **Consumers**: ExecuteReportConsumer, ScheduledReportConsumer, etc.
- **Scheduling**: Cron-based report scheduling
- **Retry**: Automatic retry with backoff

### Kinetic.Ingest
TCP server for data ingestion.

- **Protocol**: Netcat-compatible text protocol
- **Parsers**: CSV and JSON parsing
- **Storage**: Direct write to MSSQL

### Kinetic.Adapters
Database connectivity adapters.

- **Supported**: SQL Server, PostgreSQL, MySQL, Oracle, SQLite, MongoDB, Snowflake, BigQuery
- **Interface**: Common IAdapter interface
- **Features**: Connection pooling, parameterized queries, schema introspection

## Data Flow

### Report Execution

```
1. User submits report with parameters
2. API validates permissions
3. API retrieves report definition
4. Query executor:
   a. Gets connection from pool
   b. Injects parameters into query
   c. Executes against target database
   d. Transforms results
5. Results cached to temp store (if configured)
6. Response returned to client
```

### Background Query Execution

```
1. User submits long-running report
2. API creates job in Redis queue
3. Worker picks up job
4. Worker executes query
5. Worker stores results in temp store
6. Worker notifies completion
7. Client polls/receives notification
8. Client retrieves results from temp store
```

## Security Model

### Authentication
- JWT tokens with configurable expiry
- Refresh token rotation
- Microsoft Entra ID federation

### Authorization

```
Organization
    └── Groups
         └── Users
              └── Permissions

Permission Types:
- reports:create, reports:view, reports:execute, reports:delete
- connections:create, connections:view, connections:delete
- admin:users, admin:groups, admin:settings
- catalog:view, catalog:manage
```

### Permission Resolution
1. Check user-level permissions
2. Check group-level permissions (user's groups)
3. Check organization-level defaults
4. Apply most permissive (union of all)

## Scalability

### Horizontal Scaling
- Stateless API instances behind load balancer
- Redis cluster for queue distribution
- Read replicas for reporting databases

### Caching Strategy
- Redis: Session data, query result references
- Temp Store: Large query results (MSSQL)
- Client: React Query cache for UI data

### Performance Optimizations
- Connection pooling per adapter
- Prepared statements
- Streaming for large results
- Pagination at database level
