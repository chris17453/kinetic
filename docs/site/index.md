# Kinetic Documentation

Welcome to Kinetic - Enterprise Multi-Part Reporting System.

## Quick Navigation

- [Getting Started](./getting-started.md)
- [Architecture](./architecture.md)
- [API Reference](./api-reference.md)
- [User Guide](./user-guide.md)
- [Admin Guide](./admin-guide.md)
- [Embedding Reports](./embedding.md)
- [Adapters](./adapters.md)
- [Deployment](./deployment.md)

## What is Kinetic?

Kinetic is a comprehensive enterprise reporting platform that enables organizations to:

- **Connect** to multiple data sources (SQL Server, PostgreSQL, MySQL, Oracle, MongoDB, Snowflake, BigQuery)
- **Build** interactive reports with a visual query editor and parameter system
- **Visualize** data with charts, tables, KPIs, and more
- **Share** reports across teams with granular permissions
- **Embed** reports in any application with a simple HTML snippet
- **Export** data to Excel, PDF, and CSV

## Key Features

### Multi-Tenant Organization Support
- Organization-level branding and settings
- Hierarchical permissions (Org → Group → User)
- Microsoft Entra ID integration
- Local user management

### Visual Report Builder
- Monaco-based SQL editor with IntelliSense
- Parameter builder with multiple input types
- Column mapping and formatting
- 20+ visualization types

### Enterprise Security
- Role-based access control
- Audit logging
- Encrypted credentials
- Token-based embedding

## System Requirements

### Server
- .NET 8.0 Runtime
- SQL Server 2019+ (System database)
- Redis 7.0+ (Queue/caching)
- 4GB RAM minimum
- 2 CPU cores minimum

### Client
- Modern browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled

## Quick Start

```bash
# Clone repository
git clone https://github.com/your-org/kinetic.git
cd kinetic

# Start infrastructure
docker-compose up -d

# Run API
cd src/Kinetic.Api
dotnet run

# Run UI (in another terminal)
cd ui
npm install
npm run dev
```

Open http://localhost:5173 and log in with the default admin credentials.
