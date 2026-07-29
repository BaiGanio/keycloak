# Architecture: this Keycloak instance and the rest of BaiGanio

This is the logical relationship between this repo (a single, shared Keycloak
instance) and every other BaiGanio application: their clients, their protected
APIs, and their databases. It is environment-agnostic — the same trust shape
holds whether Keycloak is running via `DOCKER.md`, `AZURE.md`, or `K3SPI5.md`.
For the concrete deployment topology of a specific environment, see that
environment's own guide (`K3SPI5.md` has the k3s/Flux diagram, `AZURE.md` has
the Azure resource diagram).

## Trust model in one picture

```mermaid
flowchart LR
    subgraph kc["This repo: shared Keycloak"]
        keycloak["Keycloak<br/>Login · Sessions · Tokens"]
        kcdb[("Identity database<br/>(realms, users, sessions)")]
        keycloak <--> kcdb
    end

    subgraph app1["App 1"]
        client1["Client<br/>(web / mobile)"]
        api1["Protected API"]
        db1[("App 1 database")]
        client1 -- "Bearer access token" --> api1
        api1 --> db1
    end

    subgraph app2["App 2"]
        client2["Client<br/>(web / mobile)"]
        api2["Protected API"]
        db2[("App 2 database")]
        client2 -- "Bearer access token" --> api2
        api2 --> db2
    end

    subgraph appN["App N ..."]
        clientN["Client"]
        apiN["Protected API"]
        dbN[("App N database")]
        clientN -- "Bearer access token" --> apiN
        apiN --> dbN
    end

    client1 -- "OIDC redirect" --> keycloak
    keycloak -- "ID / access tokens" --> client1
    client2 -- "OIDC redirect" --> keycloak
    keycloak -- "ID / access tokens" --> client2
    clientN -- "OIDC redirect" --> keycloak
    keycloak -- "ID / access tokens" --> clientN

    api1 -. "issuer + signing-key validation" .-> keycloak
    api2 -. "issuer + signing-key validation" .-> keycloak
    apiN -. "issuer + signing-key validation" .-> keycloak
```

## What this means for security

The threat this whole setup is designed to guard against: **unauthenticated
access to a protected API sitting in front of an app's database.** Each app's
database is never meant to be reachable directly from the public internet or
from a client — only through that app's own API, and that API's job is to
reject any request that doesn't carry a valid, non-expired, correctly-signed
token issued by this Keycloak instance for the right issuer/realm.

Concretely, each downstream app needs:

- **A client** registered in this Keycloak (public client for browser/mobile,
  confidential client for server-to-server), which redirects users here for
  login and never sees their password.
- **A protected API** that validates the bearer token's signature and issuer
  against this Keycloak's OIDC discovery document — not just checks "a token
  was present."
- **A database reachable only from that app's own API** — never exposed
  publicly, never trusting a client-supplied identity claim without the token
  behind it.

Blast radius if this instance is compromised: **every** app that trusts it,
since they all validate tokens against the same issuer. That is the reason
`Fragile / No-Touch Zones` in `AGENTS.md` treats OIDC/issuer trust config and
credential values as ask-first, not act-freely.

## What's not built yet

Per `README.md`: no realms, clients, or users are configured in any
environment yet — every scenario currently boots a bare Keycloak with only the
built-in `master` realm. The diagram above is the target trust shape;
provisioning real realms/clients per downstream app is planned, not done.
