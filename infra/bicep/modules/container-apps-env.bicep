// Container Apps Environment Module
param baseName string
param environment string
param location string
param tags object

var envName = 'cae-${baseName}-${environment}'
var logAnalyticsName = 'log-${baseName}-${environment}'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: environment == 'prod' ? 90 : 30
  }
}

resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: envName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    zoneRedundant: environment == 'prod'
  }
}

output environmentId string = containerAppsEnv.id
output environmentName string = containerAppsEnv.name
output logAnalyticsWorkspaceId string = logAnalytics.id
