@description('Azure region of the existing App Service plan and all new resources.')
param location string = 'swedencentral'

@description('Name of the existing Linux App Service plan. The plan is reused, not created or changed.')
param appServicePlanName string = 'F1-linux'

@description('Globally unique App Service application name.')
param webAppName string = 'lk-keycloak'

@description('Pinned Keycloak container image version.')
param keycloakVersion string = '26.7.0'

@description('Azure wrapper image containing the committed realm import file.')
param keycloakImage string = 'ghcr.io/baiganio/keycloak-azure:${keycloakVersion}'

@description('Azure SQL logical-server administrator login.')
param sqlAdminLogin string = 'keycloakadmin'

@secure()
@description('Azure SQL logical-server administrator password. Supply this through a secure deployment parameter.')
param sqlAdminPassword string

@description('Temporary Keycloak bootstrap administrator username.')
param keycloakBootstrapAdminUsername string = 'admin'

@secure()
@description('Temporary Keycloak bootstrap administrator password. Supply this through a secure deployment parameter.')
param keycloakBootstrapAdminPassword string

@minValue(1)
@maxValue(32)
@description('Maximum Azure SQL database size in GiB. The confirmed PoC limit is 4 GiB.')
param sqlDatabaseMaxSizeGB int = 4

@minValue(60)
@description('Minutes without sessions or user CPU before Azure SQL serverless can auto-pause.')
param sqlAutoPauseDelayMinutes int = 60

@description('Common resource tags.')
param tags object = {
  workload: 'keycloak-poc'
  environment: 'production-poc'
  managedBy: 'bicep'
}

var keycloakUrl = 'https://${webAppName}.azurewebsites.net'
var sqlServerName = 'lk-keycloak-sql-${uniqueString(subscription().id, resourceGroup().id)}'
var sqlDatabaseName = 'keycloak'
var sqlDatabaseMaxSizeBytes = sqlDatabaseMaxSizeGB * 1024 * 1024 * 1024

resource appServicePlan 'Microsoft.Web/serverfarms@2024-11-01' existing = {
  name: appServicePlanName
}

resource sqlServer 'Microsoft.Sql/servers@2025-01-01' = {
  name: sqlServerName
  location: location
  tags: tags
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
    restrictOutboundNetworkAccess: 'Disabled'
    version: '12.0'
  }
}

resource allowAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource keycloakDatabase 'Microsoft.Sql/servers/databases@2025-01-01' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  tags: tags
  sku: {
    name: 'GP_S_Gen5_2'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2
  }
  properties: {
    autoPauseDelay: sqlAutoPauseDelayMinutes
    collation: 'Latin1_General_100_CI_AS_SC_UTF8'
    createMode: 'Default'
    freeLimitExhaustionBehavior: 'AutoPause'
    licenseType: 'LicenseIncluded'
    maxSizeBytes: sqlDatabaseMaxSizeBytes
    minCapacity: json('0.5')
    readScale: 'Disabled'
    requestedBackupStorageRedundancy: 'Local'
    useFreeLimit: true
    zoneRedundant: false
  }
}

resource keycloakApp 'Microsoft.Web/sites@2024-11-01' = {
  name: webAppName
  location: location
  kind: 'app,linux,container'
  tags: tags
  properties: {
    clientAffinityEnabled: false
    enabled: true
    httpsOnly: true
    publicNetworkAccess: 'Enabled'
    reserved: true
    serverFarmId: appServicePlan.id
    siteConfig: {
      alwaysOn: false
      appCommandLine: 'start --import-realm'
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          name: 'WEBSITES_CONTAINER_START_TIME_LIMIT'
          value: '1800'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'false'
        }
        {
          name: 'KC_DB'
          value: 'mssql'
        }
        {
          name: 'KC_DB_URL'
          value: 'jdbc:sqlserver://${sqlServer.properties.fullyQualifiedDomainName}:1433;databaseName=${sqlDatabaseName};encrypt=true;trustServerCertificate=false;hostNameInCertificate=*.database.windows.net;loginTimeout=30'
        }
        {
          name: 'KC_DB_USERNAME'
          value: sqlAdminLogin
        }
        {
          name: 'KC_DB_PASSWORD'
          value: sqlAdminPassword
        }
        {
          name: 'KC_DB_POOL_INITIAL_SIZE'
          value: '1'
        }
        {
          name: 'KC_DB_POOL_MIN_SIZE'
          value: '1'
        }
        {
          name: 'KC_DB_POOL_MAX_SIZE'
          value: '5'
        }
        {
          name: 'KC_HOSTNAME'
          value: keycloakUrl
        }
        {
          name: 'KC_HTTP_ENABLED'
          value: 'true'
        }
        {
          name: 'KC_PROXY_HEADERS'
          value: 'xforwarded'
        }
        {
          name: 'KC_BOOTSTRAP_ADMIN_USERNAME'
          value: keycloakBootstrapAdminUsername
        }
        {
          name: 'KC_BOOTSTRAP_ADMIN_PASSWORD'
          value: keycloakBootstrapAdminPassword
        }
        {
          name: 'KC_HEALTH_ENABLED'
          value: 'true'
        }
        {
          name: 'KC_HTTP_MANAGEMENT_HEALTH_ENABLED'
          value: 'false'
        }
        {
          name: 'KC_METRICS_ENABLED'
          value: 'false'
        }
        {
          name: 'KC_LOG_LEVEL'
          value: 'INFO'
        }
        {
          name: 'REALM_FRONTEND_URL'
          value: keycloakUrl
        }
        {
          name: 'SWAGGER_REDIRECT_URI_PUBLIC'
          value: 'https://api.baiganio.io/swagger/oauth2-redirect.html'
        }
        {
          name: 'SWAGGER_REDIRECT_URI_AZURE'
          value: '${keycloakUrl}/swagger/oauth2-redirect.html'
        }
        {
          name: 'SWAGGER_REDIRECT_URI_LOCAL'
          value: 'https://localhost:44364/swagger/oauth2-redirect.html'
        }
        {
          name: 'SWAGGER_ORIGIN_PUBLIC'
          value: 'https://api.baiganio.io'
        }
        {
          name: 'SWAGGER_ORIGIN_AZURE'
          value: keycloakUrl
        }
        {
          name: 'SWAGGER_ORIGIN_LOCAL'
          value: 'https://localhost:44364'
        }
        {
          name: 'BAIGANIO_REDIRECT_URI_PUBLIC'
          value: 'https://baiganio.github.io/'
        }
        {
          name: 'BAIGANIO_REDIRECT_URI_LOCAL'
          value: 'http://localhost:4299/'
        }
        {
          name: 'BAIGANIO_ORIGIN_PUBLIC'
          value: 'https://baiganio.github.io'
        }
        {
          name: 'BAIGANIO_ORIGIN_LOCAL'
          value: 'http://localhost:4299'
        }
        {
          name: 'COSMIC_ORIGINS_REDIRECT_URI_PUBLIC'
          value: 'https://baiganio.github.io/cosmic-origins/'
        }
        {
          name: 'COSMIC_ORIGINS_REDIRECT_URI_LOCAL'
          value: 'http://localhost:4300/'
        }
        {
          name: 'COSMIC_ORIGINS_ORIGIN_PUBLIC'
          value: 'https://baiganio.github.io'
        }
        {
          name: 'COSMIC_ORIGINS_ORIGIN_LOCAL'
          value: 'http://localhost:4300'
        }
        {
          name: 'JAVA_OPTS_KC_HEAP'
          value: '-XX:InitialRAMPercentage=20 -XX:MaxRAMPercentage=60'
        }
      ]
      ftpsState: 'Disabled'
      http20Enabled: true
      httpLoggingEnabled: true
      linuxFxVersion: 'DOCKER|${keycloakImage}'
      minTlsVersion: '1.2'
      remoteDebuggingEnabled: false
      scmMinTlsVersion: '1.2'
      webSocketsEnabled: false
    }
  }
  dependsOn: [
    allowAzureServices
    keycloakDatabase
  ]
}

output webAppName string = keycloakApp.name
output webAppUrl string = keycloakUrl
output oidcDiscoveryUrl string = '${keycloakUrl}/realms/baiganio/.well-known/openid-configuration'
output sqlServerName string = sqlServer.name
output sqlServerHost string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = keycloakDatabase.name
output sqlDatabaseMaxSizeGB int = sqlDatabaseMaxSizeGB
output appServicePlanResourceId string = appServicePlan.id
