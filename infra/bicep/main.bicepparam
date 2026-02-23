using 'main.bicep'

param environment = 'dev'
param location = 'eastus'
param baseName = 'kinetic'
param sqlAdminUsername = 'kineticadmin'
param environmentName = 'dev'
param alertEmail = ''
// Set these via --parameters or environment variables:
// param sqlAdminPassword = ''
// param jwtSecret = ''
// param entraIdTenantId = ''
// param entraIdClientId = ''
// param entraIdClientSecret = ''
