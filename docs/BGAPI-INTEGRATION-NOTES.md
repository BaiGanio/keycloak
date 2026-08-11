# BGAPI integration notes

This is an additive handoff for the BGAPI team. It does not replace or alter
[`INTEGRATION.md`](INTEGRATION.md), which remains the complete integration
reference.

## Swagger UI authentication

BGAPI Swagger UI authenticates browser users against the shared BaiGanio
Keycloak realm using OAuth 2.0 authorization code flow with PKCE.

| Setting | Value |
| --- | --- |
| Issuer | `https://auth.baiganio.io/realms/baiganio` |
| Client ID | `bgapi-swagger` |
| Authorization endpoint | `https://auth.baiganio.io/realms/baiganio/protocol/openid-connect/auth` |
| Token endpoint | `https://auth.baiganio.io/realms/baiganio/protocol/openid-connect/token` |
| Local Swagger callback | `https://localhost:44364/swagger/oauth2-redirect.html` |
| Required scopes | `openid profile email` |
| PKCE method | `S256` |

`bgapi-swagger` is a **public browser client**. Do not configure a client
secret in Swagger UI, user secrets, application settings, or source code. PKCE
is the protection for this flow.

The callback must remain an exact match for the configured Keycloak client.
Changing the local HTTPS port or Swagger callback path requires a reviewed
update to the Keycloak realm configuration before it will work.

## Development test user

A fresh Keycloak realm import creates the enabled user
`swagger@baiganio.io`. It has only the `viewer` client role on `bgapi-api`, so
it is suitable for verifying authenticated read-only endpoints from Swagger.

The password is intentionally not documented or committed. For local Docker it
is supplied by the local Compose configuration; for k3s it is supplied by the
non-committed `keycloak-credentials` Kubernetes Secret. Request it from the
operator responsible for the environment.

The account is created only on a fresh realm import. Existing Keycloak realms
are not modified automatically on container restart or Flux reconciliation.

## Expected token behavior

After a successful Swagger login, the access token should:

- have issuer `https://auth.baiganio.io/realms/baiganio`;
- contain the `bgapi-api` audience;
- include the `viewer` client role under `resource_access.bgapi-api.roles`.

BGAPI must validate the token signature, issuer, expiry, and audience. It must
not authorize a request merely because it contains a JWT or a client-supplied
role claim.

## Fast troubleshooting

| Symptom | Check |
| --- | --- |
| Keycloak says the action expired | Start a fresh Swagger authorization flow; do not reuse an old Keycloak login tab or URL. |
| Login reports user not found | Confirm the account exists in the `baiganio` realm, not `master`. |
| Keycloak rejects the callback URI | Confirm Swagger is running on `https://localhost:44364` and using `/swagger/oauth2-redirect.html`. |
| API returns 401 | Verify the access token issuer, expiry, signature, and `bgapi-api` audience. |
| API returns 403 | Verify the endpoint permits the `viewer` role; use a separate account with the required role for write operations. |
