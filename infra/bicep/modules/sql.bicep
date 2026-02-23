// SQL Server Module
param baseName string
param environment string
param location string
param adminUsername string
@secure()
param adminPassword string
param tags object

@allowed(['dev', 'staging', 'prod'])
param environmentName string = 'dev'

var serverName = 'sql-${baseName}-${environment}'
var databaseName = '${baseName}-db'

resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: serverName
  location: location
  tags: tags
  properties: {
    administratorLogin: adminUsername
    administratorLoginPassword: adminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'S2' : 'S0'
    tier: 'Standard'
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: environment == 'prod' ? 268435456000 : 2147483648
    zoneRedundant: environment == 'prod'
  }
}

resource sqlDbShortTermRetention 'Microsoft.Sql/servers/databases/backupShortTermRetentionPolicies@2021-11-01' = {
  name: 'default'
  parent: sqlDatabase
  properties: {
    retentionDays: environmentName == 'prod' ? 35 : 7
    diffBackupIntervalInHours: 24
  }
}

// Allow Azure services
resource firewallRule 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

output serverName string = sqlServer.name
output databaseName string = sqlDatabase.name
output connectionString string = 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${databaseName};User Id=${adminUsername};Password=${adminPassword};Encrypt=True;TrustServerCertificate=False;'
output serverId string = sqlServer.id
