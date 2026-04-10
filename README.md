# keycloak

> - Keycloak's UI is server-rendered and stateful.   
> - The admin console and login pages are served by the Keycloak server process itself — they're not a standalone SPA you can host separately.    
> - They require the Keycloak backend to function.

### How to use it:
```text
[Your App / GitHub Pages SPA]
        ↓  (OIDC/OAuth2 redirects)
[Keycloak Server on Azure Container Instances / App Service]
        ↓
[Azure Database for PostgreSQL]
```

- Keycloak handles auth, sessions, and the UI
- Your actual frontend app can live on GitHub Pages
- The DB is managed by Azure

### Why this setup?
- PostgreSQL: Keycloak is stateless by default. Without a real database in Azure, your users and realms would vanish every time the container restarts.
- start-edge: This tells Keycloak it's behind a proxy (Azure's Ingress), which handles the SSL/HTTPS for you.
- Cost: Using the "Burstable" B1ms tier for Postgres and Container Apps keeps your monthly Azure bill low for dev/test scenarios.

---

### Deploy to Azure (Production) 
```text
┌─────────────────────┐     OIDC/OAuth2      ┌──────────────────────────┐
│  Your Frontend SPA  │ ──────────────────▶  │  Keycloak (Azure CI/ACI) │
│  (GitHub Pages)     │ ◀──────────────────  │  + PostgreSQL (Azure DB) │
└─────────────────────┘   tokens/redirects   └──────────────────────────┘
```

For a production setup in Azure, you have three primary options:
- Azure Container Apps (Easiest): Deploy the Keycloak container directly. It's serverless and scales automatically. Use Azure Database for PostgreSQL for persistent storage, as the default local database will lose data on restarts.
- Azure App Service: Similar to Container Apps, but better if you prefer the standard Web App management experience. Ensure you set the KC_HOSTNAME environment variable to your custom domain or the .azurewebsites.net URL.
- Azure Kubernetes Service (AKS): Best for complex, high-availability needs, managed via Helm charts. 


> Install Azure CLI: Open your terminal and run brew install azure-cli (since you're on a Mac).   
> Login: Run az login.   
1. Create a Resource Group:
```bash
az group create \
  --name rg-keycloak-prod \
  --location east-europe
```
2. Generate Strong Passwords
```bash
# PostgreSQL password (32+ characters, mixed case, numbers, symbols)
postgres_password=$(openssl rand -base64 32)

# Keycloak admin password
keycloak_password=$(openssl rand -base64 32)

echo "PostgreSQL: $postgres_password"
echo "Keycloak: $keycloak_password"
```
3. Deploy Bicep Template:
  - Save the code above as main.bicep and run:
```bash
az deployment group create \
  az deployment group create \
  --name keycloak-deployment \
  --resource-group rg-keycloak-prod \
  --template-file main.bicep \
  --parameters \
    postgresAdminPassword="$postgres_password" \
    keycloakAdminPassword="$keycloak_password" \
    location=eastus \
    environment=prod
```
4. Configure Custom Domain & TLS
```bash
az containerapp hostname bind \
  --resource-group rg-keycloak-prod \
  --name keycloak-prod \
  --hostname keycloak.yourdomain.com \
  --certificate-file /path/to/cert.pfx \
  --password "cert-password"
```

---

### Realms, Clients & Initial Configuration
After deployment, SSH into the Container App or use the Keycloak admin console to configure:

1. Access Keycloak Admin Console
```bash
https://keycloak.yourdomain.com/admin
Username: admin
Password: [keycloak_password from above]
```
2. Create a Realm
- Click "Create Realm" → Name it (e.g., myrealm)
- Set Endpoints and SAML endpoints
- Configure frontend URL to match your domain
3. Create a Client (OAuth 2.0 / OIDC)
- Navigate to Clients → Create Client
- Set Client ID: my-app
- Under Settings:
  - Client authentication: On
  - Valid redirect URIs: https://myapp.com/callback
  - Web origins: https://myapp.com
- Under Credentials → copy Client Secret
4. Create Users & Roles
- Users → Add User → Set username, email
- Set Password → Toggle "Temporary" off
- Role Mapping → Add roles as needed

> Example OAuth 2.0 Flow   
```bash
# 1. Get authorization code
https://keycloak.yourdomain.com/realms/myrealm/protocol/openid-connect/auth?client_id=my-app&response_type=code&redirect_uri=https://myapp.com/callback&scope=openid%20profile%20email

# 2. Exchange code for token
curl -X POST \
  https://keycloak.yourdomain.com/realms/myrealm/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code&code=AUTHORIZATION_CODE&client_id=my-app&client_secret=SECRET&redirect_uri=https://myapp.com/callback"

```

#### Critical Next Steps.  
Before going to production:
- ✅ Replace hardcoded domain (keycloak.example.com) with your actual domain
- ✅ Configure VNET integration for database (remove open firewall rule)
- ✅ Set up automated backups in Key Vault
- ✅ Enable WAF on Front Door
- ✅ Configure SMTP for email verification (Keycloak admin console)
- ✅ Set up alerts in Application Insights for failures
- ✅ Test failover scenarios with zone-redundant setup 
---

### Key Production Tips:
- Persistence: Always connect to an external PostgreSQL database.
- HTTPS: Azure handles SSL termination, but you must configure Keycloak to trust the proxy by setting KC_PROXY=edge.
- Hostnames: Set KC_HOSTNAME to your production URL so Keycloak generates correct redirect links.