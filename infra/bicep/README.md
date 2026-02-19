# Kinetic Azure Infrastructure

## Prerequisites

- Azure CLI installed and logged in (`az login`)
- Subscription with permissions to create resources
- GitHub Container Registry (GHCR) for container images

## Deployment

### Development

```bash
# Deploy dev environment
az deployment sub create \
  --location eastus \
  --template-file main.bicep \
  --parameters main.bicepparam \
  --parameters environment=dev \
  --parameters sqlAdminPassword='YourSecurePassword123!' \
  --parameters jwtSecret='your-jwt-secret-at-least-32-characters-long'
```

### Staging

```bash
az deployment sub create \
  --location eastus \
  --template-file main.bicep \
  --parameters environment=staging \
  --parameters sqlAdminPassword='YourSecurePassword123!' \
  --parameters jwtSecret='your-jwt-secret-at-least-32-characters-long' \
  --parameters entraIdTenantId='your-tenant-id' \
  --parameters entraIdClientId='your-client-id' \
  --parameters entraIdClientSecret='your-client-secret'
```

### Production

```bash
az deployment sub create \
  --location eastus \
  --template-file main.bicep \
  --parameters environment=prod \
  --parameters sqlAdminPassword='YourSecurePassword123!' \
  --parameters jwtSecret='your-jwt-secret-at-least-32-characters-long' \
  --parameters entraIdTenantId='your-tenant-id' \
  --parameters entraIdClientId='your-client-id' \
  --parameters entraIdClientSecret='your-client-secret'
```

## Resources Created

| Resource | Dev SKU | Prod SKU |
|----------|---------|----------|
| SQL Server | S0 (10 DTUs) | S2 (50 DTUs) |
| SQL Database | 2GB | 250GB |
| Redis Cache | Basic C0 | Standard C1 |
| Storage Account | Standard LRS | Standard GRS |
| Container Apps | 0.5 CPU / 1GB | 1 CPU / 2GB |
| Static Web App | Free | Standard |
| Log Analytics | 30 day retention | 90 day retention |

## Architecture

```
                    ┌─────────────────┐
                    │  Static Web App │
                    │      (UI)       │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Container App  │
                    │     (API)       │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│  SQL Server   │   │  Redis Cache  │   │ Storage Acct  │
│  (System DB)  │   │ (Cache/Queue) │   │ (Blobs/Data)  │
└───────────────┘   └───────────────┘   └───────────────┘
                             │
                    ┌────────▼────────┐
                    │  Container App  │
                    │    (Worker)     │
                    └─────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Container App  │
                    │    (Ingest)     │
                    └─────────────────┘
```

## Environment Variables

The following secrets are stored in Container Apps:

| Secret | Description |
|--------|-------------|
| sql-connection | SQL Server connection string |
| redis-connection | Redis connection string |
| storage-connection | Storage account connection string |
| jwt-secret | JWT signing key |
| entra-client-secret | Entra ID client secret |

## Container Images

Push container images to GitHub Container Registry:

```bash
# Build and push API
docker build -t ghcr.io/kinetic/api:latest -f src/Kinetic.Api/Dockerfile .
docker push ghcr.io/kinetic/api:latest

# Build and push Worker
docker build -t ghcr.io/kinetic/worker:latest -f src/Kinetic.Worker/Dockerfile .
docker push ghcr.io/kinetic/worker:latest

# Build and push Ingest
docker build -t ghcr.io/kinetic/ingest:latest -f src/Kinetic.Ingest/Dockerfile .
docker push ghcr.io/kinetic/ingest:latest
```

## Scaling

### API
- Scales 1-10 replicas based on HTTP concurrency (100 requests/replica)
- Prod: min 2 replicas for HA

### Worker  
- Scales 1-10 replicas based on Redis queue length
- Triggers at 10 pending jobs per replica

### Ingest
- Fixed scaling: 1-5 replicas (TCP connection based)

## Cleanup

```bash
# Delete entire resource group
az group delete --name rg-kinetic-dev --yes --no-wait
```
