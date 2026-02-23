@description('Location for resources')
param location string

@description('Name prefix for resources')
param namePrefix string

@description('Environment tier')
@allowed(['dev', 'staging', 'prod'])
param environmentName string = 'dev'

var workspaceName = '${namePrefix}-logs-${environmentName}'
var appInsightsName = '${namePrefix}-ai-${environmentName}'

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: workspaceName
  location: location
  properties: {
    sku: {
      name: environmentName == 'prod' ? 'PerGB2018' : 'PerGB2018'
    }
    retentionInDays: environmentName == 'prod' ? 90 : 30
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    RetentionInDays: environmentName == 'prod' ? 90 : 30
  }
}

output appInsightsConnectionString string = appInsights.properties.ConnectionString
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
output workspaceId string = logAnalyticsWorkspace.id
