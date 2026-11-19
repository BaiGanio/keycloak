# Dev realm — test users and clients for local development

The local Docker Keycloak has a second realm: **`baiganio-dev`**. It contains
ready-made test users and clients. Use it to build and test login in your app
(BGAPI, baiganio.github.io, or anything new) without touching the real
`baiganio` realm.

> **Local only.** Every password in this realm is public, because it is in git.
> This realm runs only in local Docker. It is never deployed to Azure or to the
> k3s Pi, and its file lives outside `k8s/` so that Flux cannot pick it up.
> Never copy these users, secrets, or the `dev-cli` password login into the
> real realm.

## 1. Start it

From the root of this repo:

```bash
docker compose up -d
```

Check that it runs:

```bash
curl --fail --silent \
  http://localhost:8080/realms/baiganio-dev/.well-known/openid-configuration |
  jq -r .issuer
```

Expected output: `http://localhost:8080/realms/baiganio-dev`

## 2. What to put in your app

| Setting | Dev value | Real value (for comparison) |
|---|---|---|
| Issuer / Authority | `http://localhost:8080/realms/baiganio-dev` | `https://auth.baiganio.io/realms/baiganio` |
| Audience | `bgapi-api` | `bgapi-api` |
| Roles claim | `resource_access.bgapi-api.roles` | same |

Client IDs and role names are the same as in the real realm. To switch between
dev and real, change only the issuer.

Dev runs on plain `http`. If your API library demands HTTPS metadata, turn that
check off **for local development only** (for example, in ASP.NET:
`RequireHttpsMetadata = false` in the Development environment only).

## 3. Users

All users have the same password: **`DevPass123!`**

| Username | Role on `bgapi-api` | Use it to test |
|---|---|---|
| `dev-admin` | `admin` | full access |
| `dev-user` | `user` | normal access |
| `dev-viewer` | `viewer` | read-only access |
| `dev-norole` | none | API must answer **403** |
| `dev-unverified` | `user` | token has `email_verified: false` |
| `dev-disabled` | `user` | login must fail |

## 4. Clients

| Client ID | Type | Use it for |
|---|---|---|
| `bgapi-api` | bearer-only | The audience your API checks. Nobody logs in with it. |
| `bgapi-swagger` | browser, PKCE | BGAPI Swagger UI at `https://localhost:44364` |
| `baiganio-web` | browser, PKCE | baiganio.github.io on `http://localhost:4299/` |
| `cosmic-origins-web` | browser, PKCE | Cosmic Origins on `http://localhost:4300/` |
| `dev-spa` | browser, PKCE | Any new browser app on port `3000`, `4200`, `5173`, or `8000` |
| `dev-cli` | password login | Scripts, tests, and AI agents that need a token without a browser |
| `dev-service` | client credentials | Server-to-server calls. Secret: `dev-service-secret`. Gets role `user`. |

Every token carries `aud: bgapi-api`.

## 5. Get a token from the command line

As a user (through `dev-cli`):

```bash
curl --fail --silent \
  -d client_id=dev-cli \
  -d grant_type=password \
  -d username=dev-user \
  -d 'password=DevPass123!' \
  http://localhost:8080/realms/baiganio-dev/protocol/openid-connect/token |
  jq -r .access_token
```

As a service (through `dev-service`):

```bash
curl --fail --silent \
  -d client_id=dev-service \
  -d client_secret=dev-service-secret \
  -d grant_type=client_credentials \
  http://localhost:8080/realms/baiganio-dev/protocol/openid-connect/token |
  jq -r .access_token
```

Call your API with the token:

```bash
curl -H "Authorization: Bearer $TOKEN" https://localhost:44364/<your-endpoint>
```

## 6. Experiment, then throw it away

You can add users, clients, or roles in the admin console
(<http://localhost:8080/admin/>, login `admin` / `admin`, then switch to the
`baiganio-dev` realm). To go back to the clean version from git:

```bash
./scripts/reset-dev-realm.sh
```

This deletes only `baiganio-dev` and loads it again from
`dev/realm/baiganio-dev-realm.json`. The real `baiganio` realm is not touched.

If you changed the local admin login, pass it like this:

```bash
KC_ADMIN_USER=me KC_ADMIN_PASSWORD='...' ./scripts/reset-dev-realm.sh
```

## 7. Keep it in step with the real realm

`dev/realm/baiganio-dev-realm.json` copies the client IDs, roles, and security
settings of `k8s/realm/baiganio-realm.json` by hand. If you change a client or
a role in the real realm, change it in the dev realm in the same commit.
Otherwise dev and real drift apart, and code that works in dev can fail in
production.

Want a permanent new test user or client for everyone? Add it to
`dev/realm/baiganio-dev-realm.json` and open a pull request. Experiments that
only you need stay in the admin console, and the next reset removes them.
