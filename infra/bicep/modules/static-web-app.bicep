// Static Web App Module (UI)
param baseName string
param environment string
param location string
param apiUrl string
param tags object

var appName = 'swa-${baseName}-${environment}'

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: appName
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Standard' : 'Free'
    tier: environment == 'prod' ? 'Standard' : 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      appLocation: '/ui'
      apiLocation: ''
      outputLocation: 'dist'
    }
  }
}

// App settings for the static web app
resource staticWebAppSettings 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: staticWebApp
  name: 'appsettings'
  properties: {
    VITE_API_URL: apiUrl
  }
}

output url string = 'https://${staticWebApp.properties.defaultHostname}'
output name string = staticWebApp.name
output deploymentToken string = staticWebApp.listSecrets().properties.apiKey
