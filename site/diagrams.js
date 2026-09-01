"use strict";

const diagram = (title, content) =>
  `<figure class="diagram" aria-label="${title}"><figcaption>${title}</figcaption>${content}</figure>`;
const node = (label, kind = "") =>
  `<div class="diagram-node ${kind}">${label}</div>`;
const arrow = (label = "→") => `<span class="diagram-arrow" aria-hidden="true">${label}</span>`;

window.BAIGANIO_DIAGRAMS = [
  diagram("Keycloak backbone request and trust flow",
    `<div class="diagram-flow">${node("Browser application")}${arrow()}${node("Keycloak<span class=\"diagram-note\">Login · sessions · tokens</span>")}${arrow()}${node("Protected API")}${arrow("↕")}${node("Identity database", "database")}</div>`),
  diagram("Shared Keycloak trust model across BaiGanio applications",
    `<div class="diagram-flow">${node("App clients")}${arrow("⇄")}${node("Shared Keycloak<span class=\"diagram-note\">OIDC issuer</span>")}${arrow("⇢")}${node("Protected APIs")}${arrow()}${node("Application databases", "database")}</div>`),
  diagram("Azure proof-of-concept deployment",
    `<div class="diagram-flow">${node("Browser or application")}${arrow()}${node("Azure App Service<span class=\"diagram-note\">Keycloak 26.7.0</span>")}${arrow()}${node("Azure SQL Database<span class=\"diagram-note\">Serverless · 4 GB</span>", "database")}</div>`),
  diagram("k3s, Flux, Cloudflare, and GHCR deployment flow",
    `<div class="diagram-stack"><div class="diagram-flow">${node("Browser")}${arrow()}${node("Cloudflare")}${arrow()}${node("cloudflared")}${arrow()}${node("Traefik")}${arrow()}${node("Keycloak")}${arrow()}${node("PostgreSQL", "database")}</div><div class="diagram-flow">${node("GitHub push")}${arrow()}${node("GHCR OCI bundle")}${arrow("⇠")}${node("Flux poll + reconcile")}${arrow()}${node("k3s workload")}</div></div>`),
];
