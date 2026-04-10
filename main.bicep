param location string = resourceGroup().location
param postgresAdminLogin string = 'keycloakadmin'
param keycloakVersion string = '23.0.7'
param containerAppMinReplicas int = 2
param containerAppMaxReplicas int = 5
param environment string = 'prod'

@secure()
param postgresAdminPassword string

@secure()
param keycloakAdminPassword string

// Key Vault for secrets management
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-keycloak-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: containerAppIdentity.properties.principalId
        permissions: {
          secrets: ['get', 'list']
        }
      }
    ]
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
  }
}

// Store secrets in Key Vault
resource postgresPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'postgres-password'
  properties: {
    value: postgresAdminPassword
  }
}

resource keycloakAdminSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'keycloak-admin-password'
  properties: {
    value: keycloakAdminPassword
  }
}

// Managed Identity for Container App
resource containerAppIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'identity-keycloak-app'
  location: location
}

// PostgreSQL Flexible Server with production settings
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: 'keycloak-db-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_B2s'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    version: '15'
    storage: {
      storageSizeGB: 128
    }
    backup: {
      backupRetentionDays: 30
      geoRedundantBackup: 'Enabled'
    }
    highAvailability: {
      mode: 'ZoneRedundant'
    }
  }
}

// PostgreSQL Firewall Rule - Allow Container App only
resource postgresFirewall 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2022-12-01' = {
  parent: postgres
  name: 'AllowContainerApp'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
    // Note: In production, restrict this to specific IPs or use VNET integration
  }
}

// PostgreSQL Database
resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  parent: postgres
  name: 'keycloak'
}

// Container App Environment with monitoring
resource containerAppEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: 'keycloak-env-${environment}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: listKeys(logAnalytics.id, logAnalytics.apiVersion).primarySharedKey
      }
    }
  }
}

// Log Analytics Workspace
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: 'law-keycloak-${uniqueString(resourceGroup().id)}'
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'ai-keycloak-${uniqueString(resourceGroup().id)}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

// Keycloak Container App with production settings
resource keycloakApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'keycloak-${environment}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${containerAppIdentity.id}': {}
    }
  }
  properties: {
    managedEnvironmentId: containerAppEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'auto'
        allowInsecure: false
      }
      registries: []
      secrets: [
        {
          name: 'postgres-password'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/postgres-password'
          identity: containerAppIdentity.id
        }
        {
          name: 'keycloak-admin-password'
          keyVaultUrl: '${keyVault.properties.vaultUri}secrets/keycloak-admin-password'
          identity: containerAppIdentity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'keycloak'
          image: 'quay.io/keycloak/keycloak:${keycloakVersion}'
          args: ['start']
          resources: {
            cpu: '0.5'
            memory: '1Gi'
          }
          env: [
            { name: 'KC_DB', value: 'postgres' }
            { name: 'KC_DB_URL', value: 'jdbc:postgresql://${postgres.properties.fullyQualifiedDomainName}:5432/keycloak' }
            { name: 'KC_DB_USERNAME', value: postgresAdminLogin }
            { name: 'KC_DB_PASSWORD', secretRef: 'postgres-password' }
            { name: 'KC_HOSTNAME', value: 'keycloak.example.com' } // Change to your domain
            { name: 'KC_HOSTNAME_STRICT', value: 'true' }
            { name: 'KC_HOSTNAME_STRICT_HTTPS', value: 'true' }
            { name: 'KC_PROXY', value: 'edge' }
            { name: 'KC_PROXY_ADDRESS_FORWARDING', value: 'true' }
            { name: 'KC_BOOTSTRAP_ADMIN_USERNAME', value: 'admin' }
            { name: 'KC_BOOTSTRAP_ADMIN_PASSWORD', secretRef: 'keycloak-admin-password' }
            { name: 'KC_LOG_LEVEL', value: 'INFO' }
            { name: 'KC_METRICS_ENABLED', value: 'true' }
          ]
        }
      ]
      scale: {
        minReplicas: containerAppMinReplicas
        maxReplicas: containerAppMaxReplicas
        rules: [
          {
            name: 'http-requests'
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
  dependsOn: [
    postgresDatabase
  ]
}

// Outputs
output keycloakUrl string = 'https://${keycloakApp.properties.configuration.ingress.fqdn}'
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output logAnalyticsId string = logAnalytics.id
output appInsightsInstrumentationKey string = appInsights.properties.InstrumentationKey
