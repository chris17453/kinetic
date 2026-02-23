@description('Name prefix')
param namePrefix string

@description('Environment tier')
@allowed(['dev', 'staging', 'prod'])
param environmentName string = 'dev'

@description('Log Analytics Workspace ID')
param workspaceId string

@description('Action group email for alerts')
param alertEmail string = ''

var actionGroupName = '${namePrefix}-ag-${environmentName}'

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (!empty(alertEmail)) {
  name: actionGroupName
  location: 'global'
  properties: {
    groupShortName: 'kinetic'
    enabled: true
    emailReceivers: [
      {
        name: 'primary'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource highErrorRateAlert 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = {
  name: '${namePrefix}-high-error-rate-${environmentName}'
  location: resourceGroup().location
  properties: {
    displayName: 'High API Error Rate'
    description: 'Fires when 5xx error rate exceeds 5% over 5 minutes'
    enabled: true
    severity: environmentName == 'prod' ? 1 : 3
    evaluationFrequency: 'PT5M'
    windowSize: 'PT5M'
    scopes: [workspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppRequests
            | where TimeGenerated > ago(5m)
            | summarize total = count(), errors = countif(ResultCode >= 500)
            | where total > 10
            | extend errorRate = todouble(errors) / todouble(total) * 100
            | where errorRate > 5
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: !empty(alertEmail) ? {
      actionGroups: [actionGroup.id]
    } : {}
  }
}

resource slowQueryAlert 'Microsoft.Insights/scheduledQueryRules@2022-06-15' = {
  name: '${namePrefix}-slow-queries-${environmentName}'
  location: resourceGroup().location
  properties: {
    displayName: 'Slow Query Execution'
    description: 'Fires when p95 query duration exceeds 10 seconds'
    enabled: true
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [workspaceId]
    criteria: {
      allOf: [
        {
          query: '''
            AppRequests
            | where TimeGenerated > ago(15m)
            | where Url contains "/api/query"
            | summarize p95 = percentile(DurationMs, 95)
            | where p95 > 10000
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: !empty(alertEmail) ? {
      actionGroups: [actionGroup.id]
    } : {}
  }
}
