param location string = resourceGroup().location
param postgresAdminLogin string = 'keycloakadmin'
@secure()
param postgresAdminPassword string

// This template provisions an Azure Container App for Keycloak and an Azure Database for PostgreSQL (Flexible Server) for persistent storage.
// 1. Database for Persistence
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: 'keycloak-db-${uniqueString(resourceGroup().id)}'
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    version: '14'
    storage: { storageSizeGB: 32 }
  }
}

// 2. Container App Environment
resource env 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: 'keycloak-env'
  location: location
  properties: {}
}

// 3. Keycloak Container App
resource keycloakApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: 'keycloak'
  location: location
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
      }
    }
    template: {
      containers: [
        {
          name: 'keycloak'
          image: 'quay.io/keycloak/keycloak:latest'
          args: [ 'start-edge' ]
          env: [
            { name: 'KC_DB', value: 'postgres' }
            { name: 'KC_DB_URL', value: 'jdbc:postgresql://${postgres.properties.fullyQualifiedDomainName}:5432/postgres' }
            { name: 'KC_DB_USERNAME', value: postgresAdminLogin }
            { name: 'KC_DB_PASSWORD', value: postgresAdminPassword }
            { name: 'KC_HOSTNAME', value: 'keycloak.${env.properties.defaultDomain}' }
            { name: 'KC_PROXY', value: 'edge' }
            { name: 'KC_BOOTSTRAP_ADMIN_USERNAME', value: 'admin' }
            { name: 'KC_BOOTSTRAP_ADMIN_PASSWORD', value: postgresAdminPassword }
          ]
        }
      ]
    }
  }
}
