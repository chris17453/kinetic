# Deployment Guide

Deploy Kinetic to Azure using Bicep or other cloud platforms.

## Prerequisites

- Azure subscription
- Azure CLI installed
- Docker (for building images)
- .NET 8 SDK (for local builds)

## Azure Deployment

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure Resource Group                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ App Service  │    │ App Service  │    │   Azure      │      │
│  │ (API)        │    │ (UI)         │    │   CDN        │      │
│  └──────┬───────┘    └──────────────┘    └──────────────┘      │
│         │                                                        │
│  ┌──────┴───────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Azure SQL    │    │ Redis Cache  │    │ Key Vault    │      │
│  │ Database     │    │              │    │              │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ Container    │    │ Log          │    │ Application  │      │
│  │ Registry     │    │ Analytics    │    │ Insights     │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Quick Deploy

```bash
# Login to Azure
az login

# Create resource group
az group create --name kinetic-rg --location eastus

# Deploy infrastructure
az deployment group create \
  --resource-group kinetic-rg \
  --template-file infra/bicep/main.bicep \
  --parameters environment=prod \
  --parameters sqlAdminPassword='YourSecurePassword!'
```

### Bicep Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `environment` | Deployment environment | `prod` |
| `location` | Azure region | Resource group location |
| `sqlAdminPassword` | SQL admin password | Required |
| `appServicePlanSku` | App Service SKU | `P1v3` |
| `sqlSku` | SQL Database SKU | `S2` |
| `redisSku` | Redis Cache SKU | `C1` |

### Environment Variables

Set in App Service Configuration:

```bash
# Database
MSSQL_CONNECTION="Server=tcp:kinetic-sql.database.windows.net,1433;Database=Kinetic;..."

# Redis
REDIS_URL="kinetic-redis.redis.cache.windows.net:6380,password=...,ssl=True"

# JWT
JWT_SECRET="your-production-secret-at-least-32-characters"
JWT_ISSUER="Kinetic"
JWT_AUDIENCE="Kinetic"

# Entra ID
ENTRA_TENANT_ID="your-tenant-id"
ENTRA_CLIENT_ID="your-client-id"
ENTRA_CLIENT_SECRET="@Microsoft.KeyVault(SecretUri=...)"

# Azure OpenAI
AZURE_OPENAI_ENDPOINT="https://your-openai.openai.azure.com/"
AZURE_OPENAI_KEY="@Microsoft.KeyVault(SecretUri=...)"
AZURE_OPENAI_DEPLOYMENT="gpt-4"

# Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING="InstrumentationKey=..."
```

## Docker Deployment

### Build Images

```bash
# Build API
docker build -t kinetic-api:latest -f docker/Dockerfile.api .

# Build UI
docker build -t kinetic-ui:latest -f docker/Dockerfile.ui .
```

### Docker Compose (Production)

```yaml
version: '3.8'
services:
  api:
    image: kinetic-api:latest
    ports:
      - "5000:8080"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - ConnectionStrings__Default=${MSSQL_CONNECTION}
      - Redis__ConnectionString=${REDIS_URL}
    depends_on:
      - redis
    restart: unless-stopped
    
  ui:
    image: kinetic-ui:latest
    ports:
      - "80:80"
    depends_on:
      - api
    restart: unless-stopped
    
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kinetic-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kinetic-api
  template:
    metadata:
      labels:
        app: kinetic-api
    spec:
      containers:
        - name: api
          image: kinetic-api:latest
          ports:
            - containerPort: 8080
          env:
            - name: ConnectionStrings__Default
              valueFrom:
                secretKeyRef:
                  name: kinetic-secrets
                  key: mssql-connection
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 30
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: kinetic-api
spec:
  selector:
    app: kinetic-api
  ports:
    - port: 80
      targetPort: 8080
  type: ClusterIP
```

## Database Migration

### Initial Setup

```bash
# From src/Kinetic.Api directory
dotnet ef database update --connection "Server=...;Database=Kinetic;..."
```

### Production Migration

```bash
# Generate migration script
dotnet ef migrations script -o migration.sql

# Review and apply in production
sqlcmd -S server -d Kinetic -i migration.sql
```

## SSL/TLS Configuration

### Azure App Service
SSL is automatic with Azure App Service.

### Custom Domain
1. Add custom domain in App Service
2. Add TXT record for verification
3. Upload or generate certificate
4. Bind certificate to domain

### Let's Encrypt (Self-hosted)
```bash
# Using certbot
certbot --nginx -d kinetic.example.com
```

## Scaling

### Horizontal Scaling
- Increase App Service instance count
- API is stateless - scale freely
- Redis handles session/queue distribution

### Vertical Scaling
- Upgrade App Service Plan SKU
- Upgrade SQL Database tier
- Upgrade Redis Cache tier

### Auto-scaling Rules
```json
{
  "rules": [
    {
      "metricTrigger": {
        "metricName": "CpuPercentage",
        "operator": "GreaterThan",
        "threshold": 70,
        "timeAggregation": "Average",
        "timeWindow": "PT5M"
      },
      "scaleAction": {
        "direction": "Increase",
        "value": "1",
        "cooldown": "PT10M"
      }
    }
  ]
}
```

## Backup & Recovery

### SQL Database Backup
Azure SQL has automatic backups. Configure retention:
- Point-in-time restore: 7-35 days
- Long-term retention: Up to 10 years

### Redis Backup
Enable Redis data persistence:
```bash
az redis update --name kinetic-redis --resource-group kinetic-rg \
  --set redisConfiguration.rdb-backup-enabled=true
```

## Monitoring

### Application Insights
Automatic with Azure App Service. Configure:
- Live Metrics
- Availability Tests
- Alerts

### Log Analytics
Query logs:
```kusto
AppRequests
| where TimeGenerated > ago(1h)
| where Success == false
| summarize count() by Name, ResultCode
| order by count_ desc
```

### Health Checks
- `/health` - Basic health
- `/health/ready` - All dependencies ready
- `/health/live` - Application alive

## Security Hardening

### Network Security
- Use Azure Virtual Network
- Configure NSG rules
- Enable Private Endpoints for SQL/Redis

### Secrets Management
- Store secrets in Key Vault
- Use Managed Identity
- Rotate secrets regularly

### CORS Configuration
```json
{
  "Cors": {
    "AllowedOrigins": ["https://kinetic.example.com"],
    "AllowedMethods": ["GET", "POST", "PUT", "DELETE"],
    "AllowedHeaders": ["Authorization", "Content-Type"]
  }
}
```

## Troubleshooting

### Deployment Failures
1. Check deployment logs in Azure Portal
2. Verify resource quotas
3. Check ARM template errors

### Application Errors
1. Check Application Insights
2. Review App Service logs
3. Enable detailed error pages (dev only)

### Database Issues
1. Check connection string
2. Verify firewall rules
3. Check SQL metrics

### Performance Issues
1. Review Application Insights metrics
2. Check SQL query performance
3. Monitor Redis memory usage
