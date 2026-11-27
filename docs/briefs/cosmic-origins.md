# Brief: Cosmic Origins import client (keycloak)

> Status: APPROVED 2026-11-24. Copied from baiganio-platform `plans/cosmic-origins/brief-keycloak.md`. Do not edit it here.
> To change it, open an issue in `BaiGanio/baiganio-platform` (template "Change request").
> Master plan: baiganio-platform `plans/cosmic-origins/README.md` (private).
> This brief has all you need. You do not need the platform repo.

## Goal

Cosmic Origins (`https://baiganio.github.io/cosmic-origins/`) gets its data from BGAPI.
The website has **no login** and **no sign-up**. Only one thing needs Keycloak: an
**import script** on the developer's Mac must get a token without a person, and only
that script may write catalog data to BGAPI.

Read `AGENTS.md` first. This task changes identity config, so the "Ask first"
rule applies: Lyuben approved the values below on 2026-11-24. Ask again if you
need to change any value.

## What exists already

- Client roles on `bgapi-api`: `admin`, `user`, `viewer`.
- Client `cosmic-origins-web` (public, PKCE). **Not used now. Do not change it.**
- Sign-up is off in both realms. **Keep it off.**

## Changes

Make each change in **both** `k8s/realm/baiganio-realm.json` and
`dev/realm/baiganio-dev-realm.json`, in the same commit (see `DEV_REALM.md` §7).

1. **New client role on `bgapi-api`:** `cosmic-import`.
2. **New client `cosmic-importer`.** Confidential. `serviceAccountsEnabled: true`,
   `standardFlowEnabled: false`, `directAccessGrantsEnabled: false`. Audience mapper
   to `bgapi-api` (copy the one on `cosmic-origins-web`). Its service account gets
   only `bgapi-api` → `cosmic-import`.
   - Real realm: **no secret in the JSON.** Keycloak makes one. The admin reads it in the console.
   - Dev realm: secret `cosmic-importer-secret` (public, local only, like `dev-service-secret`).
3. **Live real realm.** Realm import is creation-only, so steps 1-2 do not reach the
   running Pi. Write a migration: a `kcadm` script (`scripts/migrate-cosmic-origins.sh`)
   or a runbook section in `K3SPI5.md`. It must be safe to run twice. Lyuben runs it.
4. **Docs.** `DEV_REALM.md`: add `cosmic-importer` to the clients table, with its secret,
   and the `cosmic-import` role. `README.md`: client list.

## Works when (check in local Docker)

1. `./scripts/reset-dev-realm.sh` runs. `python3 -m json.tool` parses both JSON files.
2. Client credentials for `cosmic-importer` (secret `cosmic-importer-secret`) give a token
   with `aud` = `bgapi-api` and `resource_access.bgapi-api.roles` = `["cosmic-import"]` only.
3. `cosmic-importer` is refused for the password grant and the browser login.
4. No other user or client has `cosmic-import`. `dev-cli` with `dev-user` still works.
5. Sign-up is still off in both realms.
6. The migration script, run twice on a fresh `baiganio` realm in Docker, gives the same result as the JSON.

## Out of scope

Sign-up, user accounts, privacy settings for users: not now (a later stage may add them).
Any change to `cosmic-origins-web`, `baiganio-web` or `bgapi-swagger`.
