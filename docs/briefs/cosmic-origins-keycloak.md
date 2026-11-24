# Brief: Cosmic Origins sign-up and roles (keycloak)

> Status: APPROVED 2026-11-24. Copied from baiganio-platform `plans/cosmic-origins/brief-keycloak.md`.
> If the contract below must change, tell Lyuben: the master plan changes first.
> Master plan: baiganio-platform `plans/cosmic-origins/README.md` (private).
> This brief has all you need. You do not need the platform repo.

## Goal

Cosmic Origins (`https://baiganio.github.io/cosmic-origins/`) moves from Firebase
to Keycloak. People must be able to **sign up** and **log in**. A new import script
must get a token **without a person**. BGAPI checks the roles.

Read `AGENTS.md` first. This task changes identity config, so the "Ask first"
rule applies: Lyuben approved the decisions below on 2026-11-24. Ask again if you
need to change any value.

## What exists already

- Client `cosmic-origins-web` in both realms: public, PKCE S256, audience mapper to `bgapi-api`.
- Dev redirect `http://localhost:4300/`. Real redirect `https://baiganio.github.io/cosmic-origins/`.
- Client roles on `bgapi-api`: `admin`, `user`, `viewer`.
- Sign-up is **off** in both realms. No SMTP server is set.

## Changes

Make each change in **both** `k8s/realm/baiganio-realm.json` and
`dev/realm/baiganio-dev-realm.json`, in the same commit (see `DEV_REALM.md` §7).

1. **Sign-up on.** `registrationAllowed: true`, `loginWithEmailAllowed: true`,
   `duplicateEmailsAllowed: false`. Keep `verifyEmail` off and `resetPasswordAllowed`
   off: there is no SMTP server yet. Keep the password rule and brute-force guard.
2. **Two new client roles on `bgapi-api`:** `cosmic-user` and `cosmic-import`.
3. **Default role.** Add `bgapi-api` → `cosmic-user` to the realm default role
   (`default-roles-baiganio` / `default-roles-baiganio-dev`). Every new user then gets it.
   Do **not** add `user`: that role can write articles in BGAPI.
4. **New client `cosmic-importer`.** Confidential. `serviceAccountsEnabled: true`,
   `standardFlowEnabled: false`, `directAccessGrantsEnabled: false`. Audience mapper
   to `bgapi-api` (copy the one on `cosmic-origins-web`). Its service account gets
   only `bgapi-api` → `cosmic-import`.
   - Real realm: **no secret in the JSON.** Keycloak makes one. The admin reads it in the console.
   - Dev realm: secret `cosmic-importer-secret` (public, local only, like `dev-service-secret`).
5. **Dev realm only:** new user `dev-cosmic`, password `DevPass123!`, role `cosmic-user` only.
6. **Live real realm.** Realm import is creation-only, so steps 1-4 do not reach the
   running Pi. Write a migration: a `kcadm` script (`scripts/migrate-cosmic-origins.sh`)
   or a runbook section in `K3SPI5.md`. It must be safe to run twice. Lyuben runs it.
7. **Docs.** `DEV_REALM.md`: add `dev-cosmic`, `cosmic-importer`, the 2 roles, and the
   sign-up URL. `README.md`: client list.

## Open point to check

Users in the dev realm JSON have explicit `clientRoles`. Check whether the import
still gives them the default role. Write down what you find. BGAPI tests expect
`dev-norole` to get 403 on `user` endpoints. `cosmic-user` alone must not change that.

## Works when (check in local Docker)

1. `./scripts/reset-dev-realm.sh` runs. Then `python3 -m json.tool` parses both JSON files.
2. Sign-up page opens:
   `http://localhost:8080/realms/baiganio-dev/protocol/openid-connect/registrations?client_id=cosmic-origins-web&response_type=code&scope=openid&redirect_uri=http://localhost:4300/`
3. A new user made on that page gets a token with `aud` = `bgapi-api` and
   `resource_access.bgapi-api.roles` = `["cosmic-user"]`. It has **no** `user` role.
4. Client credentials for `cosmic-importer` (secret `cosmic-importer-secret`) give a token
   with roles `["cosmic-import"]` only.
5. `cosmic-importer` is refused for the password grant and the browser login.
6. `dev-cli` with `dev-user` still works. Old roles are not changed.
7. The migration script, run twice on a fresh `baiganio` realm in Docker, gives the same result as the JSON.

## Out of scope

SMTP and email check (later, before launch). Any change to `baiganio-web` or `bgapi-swagger`.
