# AGENTS.md — BaiGanio Keycloak backbone

> This file orients AI agents working in this repo: what the project is, where the
> sharp edges are, and how the developer wants to fly. It is a light marker, read at
> the start of every session — keep it short, point to deeper docs, never duplicate them.

## Project: BaiGanio Keycloak backbone

A shared [Keycloak](https://www.keycloak.org/) identity service that multiple
BaiGanio applications offload login, sessions, and token issuance to, instead of
each building its own auth. Runs identically across three environments —
local Docker, Azure (PoC), and a home k3s cluster on a Raspberry Pi 5 (production
target) — documented in `DOCKER.md`, `AZURE.md`, and `K3SPI5.md` respectively.

The idea this repo is a shadow of: **this is the security backbone for a set of
public-facing apps and their databases.** When priorities collide: security wins
first, environment parity (Docker/Azure/k3s staying in lockstep) wins second,
simplicity wins over completeness/robustness beyond what's needed today. Shipping
a client integration fast never outranks either of the first two.

## Co-pilot Contract

- **Act freely**: docs, k8s manifests, Azure bicep/workflows, docker-compose,
  config structure — including deploy-affecting changes.
- **Ask first**: anything touching actual secrets/credential values, RBAC/IAM role
  assignments, or OIDC/identity trust configuration (issuer, realm trust, client
  secrets). Structure and plumbing around these is fine to edit; the values and
  trust boundaries are not.
- **Definition of done** (no traditional test suite — this is infra/config):
  - Runtime changes (docker-compose, Keycloak env/args) → local `docker-compose up`
    smoke test: Keycloak boots and is reachable.
  - Deploy-target changes (k8s manifests, Azure bicep, workflows) → validate,
    don't necessarily boot live: `kubectl apply --dry-run`, `az bicep build`,
    workflow lint/syntax check.
- **Communication style**: explain as you go. Some of this ground (Azure OIDC,
  k3s/Flux GitOps, Keycloak realm/client config) is newer territory — walk through
  the reasoning behind infra/security decisions, not just the diff.

## Quick Start

```bash
# Local development (see DOCKER.md for full detail)
docker compose up
```

Key commands live in the per-scenario guides — there is no single daily-driver
command set because the three environments (`DOCKER.md`, `AZURE.md`, `K3SPI5.md`)
each have their own deploy/verify flow.

## Tech Stack

- **Runtime**: Keycloak `26.7.0` (`quay.io/keycloak/keycloak`), pinned by tag in
  Docker/Azure and by digest in k8s — not pinned on purpose, free to bump.
- **Database**: PostgreSQL `17.10-alpine`, same non-pinning status.
- **Local**: Docker Compose.
- **Azure**: Bicep (`azure/main.bicep`) → compiled to ARM JSON (`azure/azuredeploy.json`);
  App Service (Linux, free F1 tier) + Azure SQL.
- **k3s/Pi 5**: Kustomize (`k8s/`) manifests, deployed via Flux (GitOps pull),
  published as an OCI artifact to GHCR by `.github/workflows/publish-k3s.yml`.
- **CI/CD**: GitHub Actions, OIDC-based Azure login (no long-lived Azure secrets
  in GitHub).

## Configuration

Each environment supplies the same Keycloak config surface (`KC_DB*`,
`KC_HOSTNAME`, `KC_BOOTSTRAP_ADMIN_*`) through different mechanisms:

| Environment | Mechanism |
|---|---|
| Docker | plain env vars in `docker-compose.yml` (local only, not for real credentials) |
| Azure | Bicep params (`sqlAdminPassword`, `keycloakBootstrapAdminPassword`) sourced from shell env vars the operator sets manually, never committed |
| k3s | Kubernetes Secret `keycloak-credentials`, created once by hand on the Pi (see `K3SPI5.md` § Secrets boundary) |

Critical settings:
- `KC_HOSTNAME` — must match the real public hostname (`auth.baiganio.io`) or
  OIDC issuer validation breaks for every client relying on it.
- `KC_BOOTSTRAP_ADMIN_*` — temporary bootstrap-only admin; every guide expects a
  permanent admin to be created and the bootstrap one retired after first login.
- `KC_PROXY_HEADERS: xforwarded` (k3s) — required because Traefik terminates TLS
  in front of Keycloak; getting this wrong breaks redirect URIs silently.

## Database

Keycloak owns and migrates its own schema (Liquibase, internal to the Keycloak
image) — there are no application-level migrations in this repo to keep in
lockstep. The only discipline that matters here is environment parity: the same
`KC_DB*` shape and Postgres major version across Docker/Azure/k3s, so a config
that works locally still works in production.

## Fragile / No-Touch Zones

Still an early repo (few commits, no incident history yet). By inspection, the
zones with the largest blast radius if changed carelessly:

- **`azure/main.bicep` → `azure/azuredeploy.json`** — the JSON file is a generated
  artifact (`az bicep build --outfile azuredeploy.json`), not hand-edited. Verify
  with `git diff -- azuredeploy.json` after any bicep change; a hand-edit here
  will silently drift from the source of truth.
- **`k8s/keycloak.yaml` env vars ↔ `keycloak-credentials` Secret keys** — the
  Deployment references `postgres-password` and `bootstrap-admin-password` by
  name; renaming a key on either side breaks Keycloak startup with no obvious
  error beyond a crash-loop.
- **`k8s/ingress.yaml` `X-Forwarded-*` headers ↔ `KC_PROXY_HEADERS`/`KC_HOSTNAME`
  in `keycloak.yaml`** — these three must agree, or OIDC redirect URIs and issuer
  validation break for every client.
- **`.github/workflows/publish-k3s.yml` OCI publish ↔ `k8s/flux/keycloak-sync.yaml`
  Flux source** — Flux pulls whatever this workflow publishes to
  `ghcr.io/baiganio/keycloak-manifests`; the workflow has no path back into the
  cluster (no kube-credentials in CI, by design — see `K3SPI5.md`), so a bad
  publish is only caught by Flux reconciliation on the Pi, not by CI.

Verify a change in any of these by following the relevant guide's own
validate/dry-run step before applying for real — each of `AZURE.md` and
`K3SPI5.md` documents one.

## Module Coupling Map

| Coupling | Why |
|----------|-----|
| `azure/main.bicep` ↔ `azure/azuredeploy.json` | ARM JSON is compiled from bicep; hand-editing the JSON causes silent drift from the real source. |
| `k8s/keycloak.yaml` ↔ k8s Secret `keycloak-credentials` | Env vars pull specific secret keys by name; a rename on either side breaks startup silently. |
| `k8s/backup.yaml` ↔ k8s Secret `keycloak-credentials` | The backup CronJob reads the same `postgres-password` key; a rename stops the nightly dump silently, because nothing else reports a missing backup. |
| `k8s/ingress.yaml` ↔ `k8s/keycloak.yaml` (`KC_HOSTNAME`, `KC_PROXY_HEADERS`) | Reverse-proxy headers and Keycloak's hostname/proxy config must agree or OIDC redirects break. |
| `.github/workflows/publish-k3s.yml` ↔ `k8s/flux/keycloak-sync.yaml` | Flux pulls from the OCI artifact this workflow publishes; they must reference the same GHCR repository. |
| `docker-compose.yml` / `azure/main.bicep` / `k8s/keycloak.yaml` | The same `KC_DB*`/admin-bootstrap config shape must stay in parity across all three so behavior doesn't diverge by environment (see Project eidos above). |
| This repo ↔ downstream BaiGanio apps | Downstream apps and their APIs trust tokens issued by this Keycloak instance; see `ARCHITECTURE.md` for the full picture. |

## Security Model

- **Auth mechanism**: OIDC. Keycloak issues ID/access tokens after browser login;
  downstream APIs validate bearer tokens against Keycloak's issuer and signing
  keys — they never see passwords directly.
- **Primary threat guarded against**: unauthenticated access to the protected
  APIs sitting in front of your databases. The API's job is to reject any
  request without a valid, correctly-issued, non-expired Keycloak token — that
  check is the actual perimeter around the databases, since the databases
  themselves are not meant to be reachable except through the API.
- **Secrets management**: never committed. Azure reads passwords from operator
  shell env vars at deploy time (`AZURE.md` § Configure password secrets); k3s
  stores them in a Kubernetes Secret created once by hand on the Pi
  (`K3SPI5.md` § Secrets boundary); Docker Compose uses plaintext env vars but
  only for local, disposable instances.
- **CI/CD trust boundary**: GitHub Actions authenticates to Azure via OIDC
  (no long-lived cloud secrets in GitHub). For k3s, GitHub Actions has **no**
  Kubernetes credential at all — it only publishes an OCI artifact; Flux
  (running inside the cluster) pulls and applies it. This keeps a compromised
  CI run from ever holding cluster credentials.
- **Realms/clients/users**: the committed `baiganio` realm and its clients are
  now imported on first boot in Docker, Azure, and k3s. User accounts and role
  assignments remain operational tasks; later realm changes require explicit
  migrations and must not silently overwrite an existing realm.

## Code Conventions

- No application source code lives here — this is infrastructure-as-config
  (YAML, Bicep, Compose, GitHub Actions).
- Markdown docs are written to be followed literally: command blocks are meant
  to be copy-pasted verbatim, hedges like "PoC" / "not yet validated" /
  "manifests ready, first deployment pending" are load-bearing status, not
  filler — never paraphrase them away (see `SITE_PROMPT.md` for the standard
  this repo holds its own docs to).
- k8s manifests set explicit `securityContext` (non-root, dropped capabilities,
  seccomp) — new workloads added here should match that baseline, not relax it.

## Contribution Conventions

### Branch naming
AI agent commits: `type: <description> signed by <model-name>`. Humans: same prefix, no signature.
Types: `feature:`, `fix:`, `refactor:`, `chore:`.

### Commit messages
[Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description`.
Types: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`.

### Changelog & versioning
No `CHANGELOG.md` exists yet in this repo — not tracked for now. If one is added
later, follow [Keep a Changelog](https://keepachangelog.com/) conventions.

## Plans

When asked to write or design a plan — architecture, feature design, migration strategy,
refactor roadmap — produce a plan document at `trash/plans/<slug>.md`. Use kebab-case slugs.

### Plan structure
Every plan must include:

1. **Objective** — one sentence: the problem being solved and why it matters
2. **Diagram** — a [Mermaid](https://mermaid.js.org/) diagram showing key components and their
   relationships. Mermaid is text-based, renders on GitHub, and is diffable. For UI mockups,
   generate a PNG and store alongside as `<slug>.png`.
3. **Model recommendation** — which model to use for execution (see Model selection below):
   recommended model, estimated input/output tokens, estimated cost, one-sentence rationale.
4. **Steps** — ordered, each with a concrete acceptance criterion ("works when…"), and a
   reference to the companion test file (`trash/plans/<slug>-tests.md`).
5. **Risks** — what can go wrong, mitigation for each.
6. **Doc updates** — which files need changes after implementation (see Documentation Sync).

### Logical tests, not code tests

This repo has no application code, so "tests" are logical/provable criteria, not
a code test suite: config validates (`az bicep build`, `kubectl --dry-run`), a
service boots and is reachable, a documented invariant (e.g. `KC_HOSTNAME`
matches the ingress host) actually holds. For small changes these criteria can
live directly in the plan; only split out a dedicated
`trash/plans/<slug>-tests.md` when verification is substantial enough to be its
own piece of work.

**Test file structure** (`trash/plans/<slug>-tests.md`), when one is warranted:

1. **Coverage map** — which plan steps each test group covers.
2. **Test cases** — name, input/setup, expected behavior, assertions, edge cases.
3. **Test execution order** — dependencies between test groups.
4. **Diagrams** (optional) — Mermaid, if a scenario is easier to see than read.
5. **Required setup** — fixtures, tools, environment, config, seed data needed.

When a plan is executed: read the test file first, confirm the criteria don't
already hold (red), implement until they do (green), update the test file if
implementation reveals a discrepancy, confirm the coverage map still holds.

### Model selection
Claude Code only — no local models. Default: Sonnet for routine edits (YAML,
Bicep, docs, workflow tweaks); reach for Opus on security-sensitive reasoning
(OIDC/token-validation design, IAM/RBAC changes, anything in Fragile Zones
above) where instruction-following precision matters more than speed.

## Documentation Sync

After any change that alters behavior, adds a feature, fixes a security issue,
or changes configuration, check whether these existing files need updates:

| Change type | Files to update |
|-------------|-----------------|
| Local Docker behavior/config | `DOCKER.md` |
| Azure deployment/config | `AZURE.md` |
| k3s/Flux/Pi deployment | `K3SPI5.md` |
| Overview, architecture, repo contents table | `README.md` |
| Anything covered by the single-page site prompt | `SITE_PROMPT.md` |
| Cross-app relationships / trust boundaries | `ARCHITECTURE.md` |

**Always confirm with the developer before writing doc updates.** State which
files need changes and why. Wait for confirmation. Never silently modify
documentation.

After a commit, push, or release, re-check this table and offer to update any stale docs.

## Reference Files

| Topic | File |
|-------|------|
| Local Docker setup | `DOCKER.md` |
| Local-only dev realm (test users/clients) | `DEV_REALM.md` |
| Azure deployment/ops | `AZURE.md` |
| k3s / Raspberry Pi 5 / Flux GitOps | `K3SPI5.md` |
| Cross-app architecture & trust boundaries | `ARCHITECTURE.md` |
| Single-page site generation prompt | `SITE_PROMPT.md` |

## Maintaining This File

This file is a marker, not a manual. Any agent reading it: if a claim here no longer
matches the repo, say so — a stale briefing is worse than none. Keep updates surgical:
fix the pointer, don't grow the prose. When something new deserves depth, it goes in a
reference file and earns one line here.
