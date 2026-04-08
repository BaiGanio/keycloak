# keycloak

### How to use it:
Install Azure CLI: Open your terminal and run brew install azure-cli (since you're on a Mac).
- Login: Run az login.
- Create a Resource Group:
```bash
az group create --name KeycloakRG --location eastus
```
- Deploy the Template:
  - Save the code above as main.bicep and run:
```bash
az deployment group create \
  --resource-group KeycloakRG \
  --template-file main.bicep \
  --parameters postgresAdminPassword='YourStrongPassword123!'
```

### Why this setup?
- PostgreSQL: Keycloak is stateless by default. Without a real database in Azure, your users and realms would vanish every time the container restarts.
- start-edge: This tells Keycloak it's behind a proxy (Azure's Ingress), which handles the SSL/HTTPS for you.
- Cost: Using the "Burstable" B1ms tier for Postgres and Container Apps keeps your monthly Azure bill low for dev/test scenarios.

---

### Deploy to Azure (Production) 
For a production setup in Azure, you have three primary options:
- Azure Container Apps (Easiest): Deploy the Keycloak container directly. It's serverless and scales automatically. Use Azure Database for PostgreSQL for persistent storage, as the default local database will lose data on restarts.
- Azure App Service: Similar to Container Apps, but better if you prefer the standard Web App management experience. Ensure you set the KC_HOSTNAME environment variable to your custom domain or the .azurewebsites.net URL.
- Azure Kubernetes Service (AKS): Best for complex, high-availability needs, managed via Helm charts. 

### Key Production Tips:
- Persistence: Always connect to an external PostgreSQL database.
- HTTPS: Azure handles SSL termination, but you must configure Keycloak to trust the proxy by setting KC_PROXY=edge.
- Hostnames: Set KC_HOSTNAME to your production URL so Keycloak generates correct redirect links.