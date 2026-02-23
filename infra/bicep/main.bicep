// Kinetic Infrastructure - Main Bicep Template
// Deploy: az deployment sub create --location eastus --template-file main.bicep --parameters main.bicepparam

targetScope = 'subscription'

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Azure region for resources')
param location string = 'eastus'

@description('Base name for resources')
param baseName string = 'kinetic'

@description('SQL Server admin username')
param sqlAdminUsername string = 'kineticadmin'

@secure()
@description('SQL Server admin password')
param sqlAdminPassword string

@secure()
@description('JWT signing secret')
param jwtSecret string

@description('Entra ID tenant ID')
param entraIdTenantId string = ''

@description('Entra ID client ID')
param entraIdClientId string = ''

@secure()
@description('Entra ID client secret')
param entraIdClientSecret string = ''

@description('Environment tier - controls resource SKUs and retention')
@allowed(['dev', 'staging', 'prod'])
param environmentName string = 'dev'

@description('Email address for operational alerts (leave empty to disable)')
param alertEmail string = ''

// Variables
var resourceGroupName = 'rg-${baseName}-${environment}'
var tags = {
  Environment: environment
  Application: 'Kinetic'
  ManagedBy: 'Bicep'
}

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

// SQL Server + Database
module sql 'modules/sql.bicep' = {
  name: 'sql-deployment'
  scope: rg
  params: {
    baseName: baseName
    environment: environment
    location: location
    adminUsername: sqlAdminUsername
    adminPassword: sqlAdminPassword
    tags: tags
    environmentName: environmentName
  }
}

// Redis Cache
module redis 'modules/redis.bicep' = {
  name: 'redis-deployment'
  scope: rg
  params: {
    baseName: baseName
    environment: environment
    location: location
    tags: tags
  }
}

// Storage Account (for DuckDB data, blobs, etc.)
module storage 'modules/storage.bicep' = {
  name: 'storage-deployment'
  scope: rg
  params: {
    baseName: baseName
    environment: environment
    location: location
    tags: tags
  }
}

// Container Apps Environment
module containerAppsEnv 'modules/container-apps-env.bicep' = {
  name: 'container-apps-env-deployment'
  scope: rg
  params: {
    baseName: baseName
    environment: environment
    location: location
    tags: tags
  }
}

// Monitoring (Log Analytics + Application Insights)
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: rg
  params: {
    location: location
    namePrefix: baseName
    environmentName: environmentName
  }
}

// API Container App
module apiApp 'modules/container-app-api.bicep' = {
  name: 'api-deployment'
  scope: rg
  params: {
    baseName: baseName
    environment: environment
    location: location
    containerAppsEnvId: containerAppsEnv.outputs.environmentId
    sqlConnectionString: sql.outputs.connectionString
    redisConnectionString: redis.outputs.connectionString
    storageConnectionString: storage.outputs.connectionString
    jwtSecret: jwtSecret
    entraIdTenantId: entraIdTenantId
    entraIdClientId: entraIdClientId
    entraIdClientSecret: entraIdClientSecret
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    tags: tags
  }
}

// Ingest Container App
module ingestApp 'modules/container-app-ingest.bicep' = {
  name: 'ingest-deployment'
  scope: rg
  params: {
    baseName: baseName
    environment: environment
    location: location
    containerAppsEnvId: containerAppsEnv.outputs.environmentId
    storageConnectionString: storage.outputs.connectionString
    tags: tags
  }
}

// Worker Container App
module workerApp 'modules/container-app-worker.bicep' = {
  name: 'worker-deployment'
  scope: rg
  params: {
    baseName: baseName
    environment: environment
    location: location
    containerAppsEnvId: containerAppsEnv.outputs.environmentId
    sqlConnectionString: sql.outputs.connectionString
    redisConnectionString: redis.outputs.connectionString
    storageConnectionString: storage.outputs.connectionString
    tags: tags
  }
}

// Static Web App (UI)
module ui 'modules/static-web-app.bicep' = {
  name: 'ui-deployment'
  scope: rg
  params: {
    baseName: baseName
    environment: environment
    location: location
    apiUrl: apiApp.outputs.url
    tags: tags
  }
}

// Azure Front Door with WAF Policy
module waf 'modules/waf.bicep' = {
  name: 'waf'
  scope: rg
  params: {
    namePrefix: baseName
    environmentName: environmentName
    apiHostname: apiApp.outputs.fqdn
    uiHostname: ''
  }
}

// Azure Monitor Alerting Rules
module alerts 'modules/alerts.bicep' = {
  name: 'alerts'
  scope: rg
  params: {
    namePrefix: baseName
    environmentName: environmentName
    workspaceId: monitoring.outputs.workspaceId
    alertEmail: alertEmail
  }
}

// Private Endpoints (prod only to save cost in dev/staging)
// NOTE: This module requires a pre-provisioned VNet with a 'private-endpoints' subnet.
// Set subnetId to the fully-qualified resource ID of that subnet before deploying to prod.
module privateEndpoints 'modules/private-endpoints.bicep' = if (environmentName == 'prod') {
  name: 'privateEndpoints'
  scope: rg
  params: {
    location: location
    namePrefix: baseName
    environmentName: environmentName
    sqlServerId: sql.outputs.serverId
    redisCacheId: redis.outputs.id
    storageAccountId: storage.outputs.id
    subnetId: '' // TODO: Replace with the subnet resource ID of your private-endpoints subnet
  }
}

// Outputs
output resourceGroupName string = rg.name
output apiUrl string = apiApp.outputs.url
output uiUrl string = ui.outputs.url
output sqlServerName string = sql.outputs.serverName
output redisHostName string = redis.outputs.hostName
output frontDoorHostname string = waf.outputs.frontDoorEndpointHostname
