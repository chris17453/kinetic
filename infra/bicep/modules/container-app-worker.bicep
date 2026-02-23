// Worker Container App Module
param baseName string
param environment string
param location string
param containerAppsEnvId string
param sqlConnectionString string
param redisConnectionString string
param storageConnectionString string
param tags object

var appName = 'ca-${baseName}-worker-${environment}'
var containerImage = 'ghcr.io/${baseName}/worker:latest'

resource workerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnvId
    configuration: {
      activeRevisionsMode: 'Single'
      secrets: [
        { name: 'sql-connection', value: sqlConnectionString }
        { name: 'redis-connection', value: redisConnectionString }
        { name: 'storage-connection', value: storageConnectionString }
      ]
    }
    template: {
      containers: [
        {
          name: 'worker'
          image: containerImage
          resources: {
            cpu: json(environment == 'prod' ? '1.0' : '0.5')
            memory: environment == 'prod' ? '2Gi' : '1Gi'
          }
          env: [
            { name: 'ConnectionStrings__DefaultConnection', secretRef: 'sql-connection' }
            { name: 'Redis__ConnectionString', secretRef: 'redis-connection' }
            { name: 'Storage__ConnectionString', secretRef: 'storage-connection' }
            { name: 'DuckDb__DataPath', value: '/data' }
          ]
          volumeMounts: [
            {
              volumeName: 'duckdb-data'
              mountPath: '/data'
            }
          ]
          probes: [
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 10
              periodSeconds: 10
              failureThreshold: 3
              successThreshold: 1
              timeoutSeconds: 5
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
                scheme: 'HTTP'
              }
              initialDelaySeconds: 15
              periodSeconds: 30
              failureThreshold: 3
              timeoutSeconds: 5
            }
          ]
        }
      ]
      volumes: [
        {
          name: 'duckdb-data'
          storageType: 'EmptyDir'
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: environment == 'prod' ? 10 : 3
        rules: [
          {
            name: 'queue-scaling'
            custom: {
              type: 'redis'
              metadata: {
                host: split(redisConnectionString, ',')[0]
                listName: 'kinetic-jobs'
                listLength: '10'
              }
              auth: [
                {
                  secretRef: 'redis-connection'
                  triggerParameter: 'password'
                }
              ]
            }
          }
        ]
      }
    }
  }
}

output name string = workerApp.name
