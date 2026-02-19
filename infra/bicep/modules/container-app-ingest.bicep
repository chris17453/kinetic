// Ingest Container App Module
param baseName string
param environment string
param location string
param containerAppsEnvId string
param storageConnectionString string
param tags object

var appName = 'ca-${baseName}-ingest-${environment}'
var containerImage = 'ghcr.io/${baseName}/ingest:latest'

resource ingestApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnvId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 9999
        transport: 'tcp'
        exposedPort: 9999
      }
      secrets: [
        { name: 'storage-connection', value: storageConnectionString }
      ]
    }
    template: {
      containers: [
        {
          name: 'ingest'
          image: containerImage
          resources: {
            cpu: json(environment == 'prod' ? '1.0' : '0.5')
            memory: environment == 'prod' ? '2Gi' : '1Gi'
          }
          env: [
            { name: 'Ingest__Port', value: '9999' }
            { name: 'Storage__ConnectionString', secretRef: 'storage-connection' }
            { name: 'DuckDb__DataPath', value: '/data' }
          ]
          volumeMounts: [
            {
              volumeName: 'duckdb-data'
              mountPath: '/data'
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
        maxReplicas: environment == 'prod' ? 5 : 2
      }
    }
  }
}

output url string = 'tcp://${ingestApp.properties.configuration.ingress.fqdn}:9999'
output name string = ingestApp.name
