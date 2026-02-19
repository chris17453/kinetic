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

// Outputs
output resourceGroupName string = rg.name
output apiUrl string = apiApp.outputs.url
output uiUrl string = ui.outputs.url
output sqlServerName string = sql.outputs.serverName
output redisHostName string = redis.outputs.hostName
