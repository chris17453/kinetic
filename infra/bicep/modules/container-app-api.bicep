// API Container App Module
param baseName string
param environment string
param location string
param containerAppsEnvId string
param sqlConnectionString string
param redisConnectionString string
param storageConnectionString string
@secure()
param jwtSecret string
param entraIdTenantId string
param entraIdClientId string
@secure()
param entraIdClientSecret string
param tags object

var appName = 'ca-${baseName}-api-${environment}'
var containerImage = 'ghcr.io/${baseName}/api:latest'

resource apiApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: appName
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnvId
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
        }
      }
      secrets: [
        { name: 'sql-connection', value: sqlConnectionString }
        { name: 'redis-connection', value: redisConnectionString }
        { name: 'storage-connection', value: storageConnectionString }
        { name: 'jwt-secret', value: jwtSecret }
        { name: 'entra-client-secret', value: entraIdClientSecret }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: containerImage
          resources: {
            cpu: json(environment == 'prod' ? '1.0' : '0.5')
            memory: environment == 'prod' ? '2Gi' : '1Gi'
          }
          env: [
            { name: 'ASPNETCORE_ENVIRONMENT', value: environment == 'prod' ? 'Production' : 'Development' }
            { name: 'ConnectionStrings__DefaultConnection', secretRef: 'sql-connection' }
            { name: 'Redis__ConnectionString', secretRef: 'redis-connection' }
            { name: 'Storage__ConnectionString', secretRef: 'storage-connection' }
            { name: 'Jwt__Secret', secretRef: 'jwt-secret' }
            { name: 'Jwt__Issuer', value: 'kinetic-${environment}' }
            { name: 'Jwt__Audience', value: 'kinetic-${environment}' }
            { name: 'EntraId__TenantId', value: entraIdTenantId }
            { name: 'EntraId__ClientId', value: entraIdClientId }
            { name: 'EntraId__ClientSecret', secretRef: 'entra-client-secret' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 8080
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health/ready'
                port: 8080
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: environment == 'prod' ? 2 : 1
        maxReplicas: environment == 'prod' ? 10 : 3
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

output url string = 'https://${apiApp.properties.configuration.ingress.fqdn}'
output name string = apiApp.name
