using './main.bicep'

param location = 'swedencentral'
param appServicePlanName = 'F1-linux'
param webAppName = 'lk-keycloak'
param keycloakVersion = '26.7.0'
param sqlAdminLogin = 'keycloakadmin'
param sqlAdminPassword = readEnvironmentVariable('AZURE_SQL_ADMIN_PASSWORD')
param keycloakBootstrapAdminUsername = 'admin'
param keycloakBootstrapAdminPassword = readEnvironmentVariable('KEYCLOAK_BOOTSTRAP_ADMIN_PASSWORD')
param sqlDatabaseMaxSizeGB = 4
param sqlAutoPauseDelayMinutes = 60
