
## Local development with Docker

### Prerequisites

- Docker Desktop, Docker Engine with the Compose plugin, or an equivalent
  Docker-compatible environment
- Docker Compose v2 (`docker compose`, not the legacy `docker-compose` command)
- port `8080` available on the host

Confirm that Docker is running:

```bash
docker info
docker compose version
```

### Start Keycloak

From the repository root:

```bash
docker compose pull
docker compose up -d
docker compose logs -f keycloak
```

Wait for the log message that says Keycloak has started, then open:

- Admin Console: <http://localhost:8080/admin/>
- OpenID Connect discovery document:
  <http://localhost:8080/realms/baiganio/.well-known/openid-configuration>

The committed realm is mounted read-only at
`/opt/keycloak/data/import` and imported with `start-dev --import-realm`.
The import creates the `baiganio` realm, its four clients, and the `bgapi-api`
roles on a fresh database. Existing realms are skipped on restart.

A second, local-only realm, `baiganio-dev`, is mounted next to it from
`dev/realm/baiganio-dev-realm.json`. It has test users and clients with public
passwords for app development, and it is never deployed. Reset only that realm
with `./scripts/reset-dev-realm.sh`. See [`DEV_REALM.md`](DEV_REALM.md).

### Examine the imported configuration

After `docker compose up -d`, verify the import and inspect the public realm
metadata:

```bash
docker compose logs keycloak | grep -E "Realm 'baiganio' imported|Import finished successfully"

curl --fail --silent \
  http://localhost:8080/realms/baiganio/.well-known/openid-configuration |
  jq '{issuer,authorization_endpoint,token_endpoint,jwks_uri}'
```

To inspect clients and API roles through the local Admin API, use the disposable
bootstrap account:

```bash
access_token="$(curl --fail --silent \
  --data 'client_id=admin-cli&username=admin&password=admin&grant_type=password' \
  http://localhost:8080/realms/master/protocol/openid-connect/token |
  jq -er .access_token)"

curl --fail --silent \
  -H "Authorization: Bearer $access_token" \
  'http://localhost:8080/admin/realms/baiganio/clients?briefRepresentation=true' |
  jq '[.[].clientId]'

api_client_uuid="$(curl --fail --silent \
  -H "Authorization: Bearer $access_token" \
  'http://localhost:8080/admin/realms/baiganio/clients?clientId=bgapi-api' |
  jq -er '.[0].id')"

curl --fail --silent \
  -H "Authorization: Bearer $access_token" \
  "http://localhost:8080/admin/realms/baiganio/clients/$api_client_uuid/roles" |
  jq '[.[].name]'
```

For a clean first-boot verification, reset only the disposable local database
and start again. This permanently removes the local Keycloak data:

```bash
docker compose down --volumes
docker compose up -d
```

The development bootstrap credentials currently defined in
`docker-compose.yml` are:

```text
username: admin
password: admin
```

The fresh `baiganio` realm also creates this local-only Swagger demo user with
the `viewer` role on `bgapi-api`:

```text
username: swagger@baiganio.io
password: SwaggerTest123!
```

This password exists only for disposable local development. The k3s deployment
uses its own password from the Kubernetes Secret and does not commit it.

### Temporary bootstrap administrator

After logging in as `admin`, Keycloak displays this message:

> You are logged in as a temporary admin user. To harden security, create a
> permanent admin account and delete the temporary one.

This is expected. `KC_BOOTSTRAP_ADMIN_USERNAME` and
`KC_BOOTSTRAP_ADMIN_PASSWORD` create a full-access account whose purpose is to
bootstrap or recover administrator access. "Temporary" is an account
classification and does not mean that it will expire after a few minutes.

For this disposable local environment, it is acceptable to keep using the
temporary `admin` account while experimenting. Do not keep it for a persistent,
shared, or production environment.

To replace it with a permanent server administrator:

1. Log in with `admin` and make sure the current realm is **master**.
2. Open **Users**, choose **Add user**, enter a new administrator username, and
   create the user.
3. Open the new user's **Credentials** tab and set a strong password with
   **Temporary** set to **Off**.
4. Open **Role mapping**, choose **Assign role**, filter by realm roles, and
   assign the `admin` role.
5. Log out and verify that the new account can sign in to the Admin Console and
   manage realms.
6. Only after that verification, sign in with the new account and delete the
   temporary `admin` user.

The local PostgreSQL data is stored in the
`keycloak_postgres_data` named volume. A permanent administrator and other
Keycloak configuration therefore survive container replacement and
`docker compose down`. The bootstrap variables do not recreate a deleted
temporary administrator in an already initialized database.

You can also check that the HTTP endpoint is responding without opening a
browser:

```bash
curl --fail \
  http://localhost:8080/realms/baiganio/.well-known/openid-configuration
```

Frontends can use this local Keycloak, or they can authenticate against the
deployed `https://auth.baiganio.io/realms/baiganio` issuer. The deployed realm
intentionally allows the explicit localhost callback URLs from the committed
configuration.

The first startup can take longer while Docker downloads both images,
initializes PostgreSQL, and lets Keycloak create its schema.

### Container lifecycle

Run these commands from the repository root:

| Task | Command |
| --- | --- |
| Show status | `docker compose ps` |
| Follow logs | `docker compose logs -f keycloak` |
| Follow database logs | `docker compose logs -f postgres` |
| Stop both services without removing them | `docker compose stop` |
| Start both stopped services | `docker compose start` |
| Restart Keycloak | `docker compose restart keycloak` |
| Remove the container and Compose network | `docker compose down` |
| Pull the configured image and recreate | `docker compose pull && docker compose up -d` |

Press `Ctrl+C` to stop following logs. Because Keycloak is started in detached
mode, this does not stop the server.

### PostgreSQL persistence and reset behavior

Local Docker and Azure intentionally use different supported database vendors:

```text
Local Docker: Keycloak → PostgreSQL 17
Azure:        Keycloak → Azure SQL Database (mssql)
```

The Compose PostgreSQL service mounts
`keycloak_postgres_data:/var/lib/postgresql/data`:

- `docker compose stop` followed by `docker compose start` keeps all data;
- `docker compose down` removes containers and the network but keeps the volume;
- `docker compose up -d` after `down` reconnects to the existing database;
- `docker compose down --volumes` permanently deletes the local database.

To perform a complete local reset:

```bash
docker compose down --volumes
docker compose up -d
```

The next startup creates a fresh PostgreSQL database and temporary `admin`
account. Do not run the reset command if the volume contains configuration you
need.

### Local security boundaries

The Compose configuration deliberately favors convenience and must not be used
as a production deployment:

- `start-dev` enables development-mode defaults;
- the bootstrap administrator and PostgreSQL passwords are public and trivial;
- HTTP is used instead of HTTPS;
- port 8080 is deliberately bound only to `127.0.0.1`;
- PostgreSQL is reachable only inside the Compose network and is not published
  on a host port;
- images are pinned to Keycloak `26.7.0` and PostgreSQL `17.10-alpine`;
- the PostgreSQL health check orders startup but is not production monitoring;
- there is no backup, TLS between containers, resource limit, or production
  proxy configuration.

### Troubleshooting

**Docker cannot connect to the daemon**

Start Docker Desktop or the Docker service, then retry `docker info`.

**Port 8080 is already in use**

Find the process or container using the port, or change the host side of the
mapping, for example `127.0.0.1:8180:8080`. If the port changes, use
`http://localhost:8180` in local application configuration.

**Keycloak exits during startup**

Inspect the complete logs and the resolved Compose configuration:

```bash
docker compose logs keycloak
docker compose logs postgres
docker compose ps
docker compose config
```

**The admin credentials no longer work**

The bootstrap environment variables create a temporary administrator only when
the `master` realm is first created; they do not reset an existing
administrator's password. The PostgreSQL volume preserves the existing account.
If no local data must be retained, use `docker compose down --volumes` and start
again. This permanently deletes all local Keycloak data.
