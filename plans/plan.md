# Kinetic - Multi-Part Report System

## Overview

Kinetic is an enterprise reporting platform with a message bus/queue, .NET API, React frontend, and embeddable report widgets. It supports multiple data sources via adapters, temporary datastores for large queries, and a visual report builder with configurable visualizations.

---

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│  React/Vite │────▶│  API (.NET) │────▶│ Queue/Redis  │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Adapters    │   │ Ingest Port  │   │   Temp DB    │
│  (plugins)   │   │  (TCP:9999)  │   │   (MSSQL)    │
└──────────────┘   └──────┬───────┘   └──────────────┘
                          │
                          ▼
                   ┌──────────────┐
                   │  System DB   │
                   │   (MSSQL)    │
                   └──────────────┘
```

---

## Tech Stack

| Component        | Technology                    |
|------------------|-------------------------------|
| API              | .NET 8 (Minimal APIs)         |
| Queue            | Redis + MassTransit           |
| Ingest           | .NET TCP Listener             |
| UI               | React 18 + Vite + TypeScript  |
| Temp Store       | MSSQL (separate schema/db)    |
| **System DB**    | **Microsoft SQL Server**      |
| Auth             | Local + Microsoft Entra ID    |
| Charts           | Chart.js                      |
| Adapters         | .NET native + plugin protocol |

---

## Project Structure

```
kinetic/
├── src/
│   ├── Kinetic.Api/           # Minimal API host
│   ├── Kinetic.Core/          # Domain, interfaces, services
│   ├── Kinetic.Data/          # EF Core, repositories (MSSQL)
│   ├── Kinetic.Identity/      # Local + Entra auth
│   ├── Kinetic.Store/         # Temp storage (MSSQL schema)
│   ├── Kinetic.Queue/         # Redis/MassTransit
│   ├── Kinetic.Ingest/        # TCP ingest server
│   └── Kinetic.Adapters/      # DB adapters
│       ├── Core/
│       ├── PostgreSQL/
│       ├── MySql/
│       └── SqlServer/
├── plugins/
│   ├── python/
│   └── go/
├── ui/
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   ├── parameters/
│   │   │   │   ├── builder/
│   │   │   │   └── inputs/
│   │   │   ├── columns/
│   │   │   ├── visualizations/
│   │   │   │   ├── picker/
│   │   │   │   ├── config/
│   │   │   │   └── renderers/
│   │   │   ├── query/
│   │   │   ├── reports/
│   │   │   └── catalog/
│   │   ├── pages/
│   │   │   ├── Auth/
│   │   │   ├── Catalog/
│   │   │   ├── Reports/
│   │   │   ├── Connections/
│   │   │   ├── Playground/
│   │   │   ├── TableViewer/
│   │   │   └── Admin/
│   │   ├── hooks/
│   │   └── lib/
│   ├── package.json
│   └── vite.config.ts
├── embed/                     # Embeddable widget JS
├── docker-compose.yml
├── plans/
├── docs/
└── Kinetic.sln
```

---

## Core Features

### 1. Identity & Permissions

- **Local Users**: Email/password, API keys
- **Microsoft Entra ID**: OAuth2/OIDC, group sync
- **Groups**: Permission assignment, ownership
- **Departments**: Organizational hierarchy
- **Permissions**: Granular (reports:create, connections:view, admin:users, etc.)

### 2. Connections

- Multiple database types (Postgres, MySQL, SQL Server, etc.)
- Encrypted credential storage
- Owned by users or groups
- Shareable with access levels (View, Execute, Edit, Manage)

### 3. Data Ingest

- TCP port listener (netcat compatible)
- Auto-detect CSV/JSON format
- Stream directly to DuckDB
- Queryable immediately

### 4. Query System

- Monaco-based query editor
- Parameter injection (user-defined + system variables)
- Query testing with result preview
- Auto-detect columns from results

### 5. Report Builder

#### Parameters (Inputs)
- Visual parameter builder UI
- Types: string, int, decimal, bool, date, datetime, daterange, select, multiselect, user picker, department picker, etc.
- Configurable: label, default, required, validation, error messages
- Dynamic options from queries
- System variables: @_CurrentUserId, @_CurrentUserEmail, @_CurrentDepartment, etc.

#### Columns (Output Mapping)
- Auto-populated from query test
- Reorder via drag-drop
- Human-readable display names
- Show/hide columns
- Formatting: number, currency, percent, date patterns
- Alignment, width

#### Visualizations (Output Types)
- **Tables**: Pagination, sorting, filtering, export (CSV, Excel, PDF)
- **Bar Charts**: Vertical, horizontal, stacked, 3D
- **Line/Area Charts**: Multi-series, stacked
- **Pie/Doughnut**: Percentages, labels
- **Advanced**: Radar, funnel, heatmap, treemap, gauge
- **KPI Cards**: Value, trend, comparison
- Multiple visualizations per report (tabs)

#### Execution Settings
- Auto-run or manual
- Live query or cache to temp DB (MSSQL temp schema)
- Cache TTL

### 6. Report Catalog

- Browse reports with permissions
- Filter: My reports, group reports, department, public
- Categories and tags
- Favorites
- Ratings
- Search
- Grid/list view

### 7. Embed System

- HTML snippet with report ID
- Lightweight JS loader
- Token-based auth
- Configurable (show/hide params, export options)

### 8. Admin

- User management
- Group management
- Department hierarchy
- Connection management
- Audit logs

### 9. Data Upload

- Upload Excel (.xlsx, .xls) and CSV files
- Auto-analyze file structure (sheets, columns, types)
- Create new "database" (schema) in system MSSQL or external connection
- Map sheets to tables with custom names
- Column mapping for existing tables
- Type detection with override options
- Preview data before import
- Options: first row header, truncate, batch size, temp/permanent
- Temporary databases with auto-expiry

---

## Domain Models Summary

### Identity
- User, Group, Department, UserGroup, Permission, GroupPermission

### Ownership
- IOwnedEntity interface, EntityShare, AccessLevel, Visibility

### Reports
- Report, ParameterDefinition, ParameterConfig, ColumnDefinition, ColumnFormat
- VisualizationConfig (Table, Chart, Pie, Gauge, KPI variants)
- Category, UserFavorite, ReportRating

### Connections
- Connection, ConnectionType

### Data Upload
- UploadedDatabase, UploadedTable, UploadedColumn
- FileAnalysisResult, SheetAnalysis, ColumnAnalysis
- ImportRequest, ImportOptions, ImportResult

### Audit
- AuditLog

---

## Tasks

### Phase 1: Foundation ✅
- [x] 1.1 Create .NET solution structure
- [x] 1.2 Set up Kinetic.Core domain models
- [x] 1.3 Set up Kinetic.Data with EF Core + MSSQL
- [x] 1.4 Create React/Vite project with routing
- [x] 1.5 Set up Docker Compose (MSSQL, Redis)

### Phase 2: Identity & Auth ✅
- [x] 2.1 Implement local auth (register, login, JWT)
- [x] 2.2 Implement Entra ID integration
- [x] 2.3 Build permission service
- [x] 2.4 Create user/group/department APIs
- [x] 2.5 Build auth UI (login, profile)
- [x] 2.6 Build admin UI (users, groups, departments)

### Phase 3: Connections & Adapters ✅
- [x] 3.1 Define adapter protocol/interface
- [x] 3.2 Implement PostgreSQL adapter
- [x] 3.3 Implement SQL Server adapter
- [x] 3.4 Implement MySQL adapter
- [x] 3.5 Build connection management API
- [x] 3.6 Build connection management UI

### Phase 4: Query System ✅
- [x] 4.1 Build query executor service
- [x] 4.2 Implement parameter injection
- [x] 4.3 Set up MSSQL temp schema for results caching
- [x] 4.4 Build query editor UI (Monaco)
- [x] 4.5 Build query tester with column detection

### Phase 5: Ingest System ✅
- [x] 5.1 Build TCP ingest server
- [x] 5.2 Implement CSV parser
- [x] 5.3 Implement JSON parser
- [x] 5.4 MSSQL writer for ingested data
- [x] 5.5 Ingest management API/UI

### Phase 6: Report Builder ✅
- [x] 6.1 Parameter builder UI
- [x] 6.2 Column mapper UI
- [x] 6.3 Visualization picker UI
- [x] 6.4 Table config editor
- [x] 6.5 Chart config editors (bar, line, pie, etc.)
- [x] 6.6 Report save/load API

### Phase 7: Report Execution & Viewing ✅
- [x] 7.1 Report execution service
- [x] 7.2 Caching to MSSQL temp schema (TempCacheService)
- [x] 7.3 Parameter input components
- [x] 7.4 Table renderer with pagination/export
- [x] 7.5 Chart renderers (Chart.js integration)
- [x] 7.6 Report viewer page

### Phase 8: Catalog & Discovery ✅
- [x] 8.1 Catalog API with permission filtering
- [x] 8.2 Catalog UI (grid, list, filters)
- [x] 8.3 Favorites and ratings (StarRating component)
- [x] 8.4 Search and categories (tags, scope filters)

### Phase 9: Embed System ✅
- [x] 9.1 Embed token generation
- [x] 9.2 Embed API endpoints
- [x] 9.3 Embeddable JS widget
- [x] 9.4 Embed configuration options

### Phase 10: Queue & Background Jobs ✅
- [x] 10.1 Set up MassTransit with Redis
- [x] 10.2 Long-running query jobs (ExecuteReportConsumer)
- [x] 10.3 Scheduled report execution (ScheduledReportConsumer)
- [x] 10.4 Entra group sync job (EntraGroupSyncConsumer)
- [x] 10.5 Audit log cleanup job (AuditCleanupConsumer)

### Phase 11: Data Upload ✅
- [x] 11.1 Excel/CSV file upload endpoint
- [x] 11.2 File analysis service
- [x] 11.3 Table creation from upload
- [x] 11.4 Column mapping UI
- [x] 11.5 Import to existing tables

### Phase 12: Polish & Production ✅
- [x] 12.1 Error handling and logging (Serilog)
- [x] 12.2 Audit logging (AuditLoggingMiddleware)
- [x] 12.3 Health checks (DB + Redis)
- [x] 12.4 API documentation (OpenAPI + Scalar)
- [x] 12.5 Production Docker builds (Dockerfile.api, Dockerfile.ui)
- [x] 12.6 Azure Bicep deployment (infra/bicep/)

### Phase 13: Azure OpenAI Integration ✅
- [x] 13.1 Add Azure OpenAI service configuration
- [x] 13.2 Natural language to SQL query generator
- [x] 13.3 Report insights/summary generator
- [x] 13.4 Smart column naming suggestions
- [x] 13.5 Visualization suggestion service
- [x] 13.6 Query explainer service
- [x] 13.7 AI API endpoints

### Phase 14: Enhanced Visualizations ✅
- [x] 14.1 Scatter chart config
- [x] 14.2 Bubble chart config
- [x] 14.3 Radar chart config
- [x] 14.4 Funnel chart config
- [x] 14.5 Heatmap config
- [x] 14.6 Treemap config
- [x] 14.7 Waterfall chart config
- [x] 14.8 Sankey diagram config
- [x] 14.9 Geographic/map visualization config
- [x] 14.10 Extended visualization enum (Candlestick, BoxPlot, Histogram, PolarArea, Timeline, Network)

### Phase 15: Export System ✅
- [x] 15.1 Excel export service (EPPlus)
- [x] 15.2 PDF export service (QuestPDF)
- [x] 15.3 CSV export
- [x] 15.4 Export API endpoints
- [x] 15.5 Export request DTOs

### Phase 16: Additional Database Adapters ✅
- [x] 16.1 SQLite adapter
- [x] 16.2 Oracle adapter
- [x] 16.3 Query executors for SQLite/Oracle
- [x] 16.4 Updated adapter factory

### Phase 17: Testing ✅
- [x] 17.1 Unit tests for Core services
- [x] 17.2 Integration tests for API
- [x] 17.3 Adapter tests
- [x] 17.4 UI component tests (Vitest)

### Phase 18: UI Enhancements ✅
- [x] 18.1 Export UI components
- [x] 18.2 AI assistant UI (query builder, insights panel)
- [x] 18.3 Advanced visualization renderers
- [x] 18.4 Chart.js plugins for new chart types

### Phase 19: Organization & Branding ✅
- [x] 19.1 Organization domain model (Org → Group → User hierarchy)
- [x] 19.2 Organization branding (logos, colors, typography)
- [x] 19.3 Organization settings (features, limits, auth)
- [x] 19.4 Group permissions (granular access control)
- [x] 19.5 Group membership with role-based overrides
- [x] 19.6 Resource access (connections, reports per group)
- [x] 19.7 Permission resolution service (inheritance + overrides)
- [x] 19.8 Organization branding UI page
- [x] 19.9 Groups management UI page
- [x] 19.10 Organization API endpoints
- [x] 19.11 Groups API endpoints
- [x] 19.12 Theme provider (apply branding to UI)

### Phase 20: Final Items ✅
- [x] 20.1 Login page with org branding
- [x] 20.2 User profile page with org membership
- [x] 20.3 MongoDB adapter
- [x] 20.4 Snowflake adapter
- [x] 20.5 BigQuery adapter
- [x] 20.6 E2E tests with Playwright
- [x] 20.7 Performance benchmarks
- [x] 20.8 Documentation site

---

## API Endpoints (Draft)

### Auth
- POST /api/auth/login
- POST /api/auth/register
- POST /api/auth/refresh
- GET /api/auth/me
- GET /api/auth/entra/login
- GET /api/auth/entra/callback

### Users
- GET /api/users
- GET /api/users/{id}
- PUT /api/users/{id}
- DELETE /api/users/{id}

### Groups
- GET /api/groups
- POST /api/groups
- GET /api/groups/{id}
- PUT /api/groups/{id}
- DELETE /api/groups/{id}
- POST /api/groups/{id}/members
- DELETE /api/groups/{id}/members/{userId}

### Departments
- GET /api/departments
- POST /api/departments
- GET /api/departments/{id}
- PUT /api/departments/{id}
- DELETE /api/departments/{id}

### Connections
- GET /api/connections
- POST /api/connections
- GET /api/connections/{id}
- PUT /api/connections/{id}
- DELETE /api/connections/{id}
- POST /api/connections/{id}/test

### Queries
- POST /api/queries/execute
- POST /api/queries/test
- GET /api/queries/columns

### Reports
- GET /api/reports
- POST /api/reports
- GET /api/reports/{id}
- PUT /api/reports/{id}
- DELETE /api/reports/{id}
- POST /api/reports/{id}/execute
- GET /api/reports/{id}/results/{executionId}

### Catalog
- GET /api/catalog
- GET /api/catalog/categories
- POST /api/catalog/favorites/{reportId}
- DELETE /api/catalog/favorites/{reportId}
- POST /api/catalog/ratings/{reportId}

### Embed
- GET /api/embed/{token}
- POST /api/embed/tokens

### Ingest
- GET /api/ingest/datasets
- DELETE /api/ingest/datasets/{id}

### Admin
- GET /api/admin/audit
- GET /api/admin/settings
- PUT /api/admin/settings

---

## Environment Variables

```env
# Database (System + Temp)
MSSQL_CONNECTION=Server=localhost;Database=Kinetic;User Id=sa;Password=YourPassword;TrustServerCertificate=True
MSSQL_TEMP_SCHEMA=kinetic_temp

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRY=3600

# Entra ID
ENTRA_CLIENT_ID=xxx
ENTRA_CLIENT_SECRET=xxx
ENTRA_TENANT_ID=xxx

# Ingest
INGEST_PORT=9999
```

---

## Getting Started (Future)

```bash
# Start infrastructure
docker-compose up -d

# Run API
cd src/Kinetic.Api
dotnet run

# Run UI
cd ui
npm install
npm run dev

# Test ingest
echo '{"name":"test","format":"csv"}
id,value
1,hello
2,world' | nc localhost 9999
```
