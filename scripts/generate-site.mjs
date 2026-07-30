import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourceFiles = [
  ["overview", "README.md"],
  ["why", "ARCHITECTURE.md"],
  ["docker", "DOCKER.md"],
  ["azure", "AZURE.md"],
  ["k3s", "K3SPI5.md"],
];

const sources = Object.fromEntries(
  sourceFiles.map(([key, file]) => [key, readFileSync(resolve(root, file), "utf8")]),
);

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

function diagram({ title, width, height, groups = [], nodes, edges }) {
  const defs = `
    <defs>
      <marker id="arrow-${title.replace(/\W/g, "")}" markerWidth="8" markerHeight="8"
        refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L8,4 L0,8 Z" class="arrow-head"/>
      </marker>
      <filter id="shadow-${title.replace(/\W/g, "")}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="8" stdDeviation="9" flood-opacity=".12"/>
      </filter>
    </defs>`;
  const groupSvg = groups
    .map(
      (g) => `<g class="diagram-group">
        <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="18"/>
        <text x="${g.x + 18}" y="${g.y + 27}" class="group-title">${esc(g.label)}</text>
      </g>`,
    )
    .join("");
  const edgeSvg = edges
    .map((e) => {
      const dashed = e.dashed ? " dashed" : "";
      const marker = `url(#arrow-${title.replace(/\W/g, "")})`;
      const reverse = e.both
        ? `<line x1="${e.x2}" y1="${e.y2 + 4}" x2="${e.x1}" y2="${e.y1 + 4}" class="edge${dashed}" marker-end="${marker}"/>`
        : "";
      const label = e.label
        ? `<g class="edge-label"><rect x="${e.lx - e.label.length * 3.2 - 7}" y="${e.ly - 13}" width="${e.label.length * 6.4 + 14}" height="21" rx="10"/><text x="${e.lx}" y="${e.ly + 2}">${esc(e.label)}</text></g>`
        : "";
      return `<g><line x1="${e.x1}" y1="${e.y1 - (e.both ? 4 : 0)}" x2="${e.x2}" y2="${e.y2 - (e.both ? 4 : 0)}" class="edge${dashed}" marker-end="${marker}"/>${reverse}${label}</g>`;
    })
    .join("");
  const nodeSvg = nodes
    .map((n) => {
      const lines = n.label.split("\n");
      const lineHeight = 17;
      const startY = n.y + n.h / 2 - ((lines.length - 1) * lineHeight) / 2 + 5;
      const text = lines
        .map(
          (line, index) =>
            `<text x="${n.x + n.w / 2}" y="${startY + index * lineHeight}">${esc(line)}</text>`,
        )
        .join("");
      return `<g class="diagram-node ${n.kind || ""}" filter="url(#shadow-${title.replace(/\W/g, "")})">
        <rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="${n.kind === "database" ? 24 : 14}"/>
        ${text}
      </g>`;
    })
    .join("");
  return `<figure class="diagram-shell" aria-label="${esc(title)}">
    <div class="diagram-kicker"><span>Architecture map</span><span>Drag horizontally on small screens</span></div>
    <div class="diagram-scroll"><svg class="architecture-diagram" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title-${title.replace(/\W/g, "")}">
      <title id="title-${title.replace(/\W/g, "")}">${esc(title)}</title>
      ${defs}${groupSvg}${edgeSvg}${nodeSvg}
    </svg></div>
  </figure>`;
}

const diagrams = [
  diagram({
    title: "Keycloak backbone request and trust flow",
    width: 960,
    height: 270,
    nodes: [
      { x: 30, y: 93, w: 170, h: 72, label: "Browser application" },
      { x: 300, y: 82, w: 220, h: 94, label: "Keycloak\nLogin · Sessions · Tokens" },
      { x: 635, y: 93, w: 170, h: 72, label: "Protected API" },
      { x: 320, y: 205, w: 180, h: 54, label: "Identity database", kind: "database" },
    ],
    edges: [
      { x1: 200, y1: 112, x2: 300, y2: 112, label: "OIDC redirect", lx: 250, ly: 78 },
      { x1: 300, y1: 150, x2: 200, y2: 150, label: "ID + access tokens", lx: 250, ly: 188 },
      { x1: 520, y1: 112, x2: 635, y2: 112, label: "Bearer token", lx: 578, ly: 78 },
      { x1: 635, y1: 150, x2: 520, y2: 150, label: "Issuer + key check", lx: 578, ly: 188, dashed: true },
      { x1: 410, y1: 176, x2: 410, y2: 205, both: true },
    ],
  }),
  diagram({
    title: "Shared Keycloak trust model across BaiGanio applications",
    width: 1200,
    height: 530,
    groups: [
      { x: 410, y: 25, w: 380, h: 185, label: "This repo: shared Keycloak" },
      { x: 30, y: 300, w: 345, h: 200, label: "App 1" },
      { x: 428, y: 300, w: 345, h: 200, label: "App 2" },
      { x: 826, y: 300, w: 345, h: 200, label: "App N …" },
    ],
    nodes: [
      { x: 440, y: 70, w: 205, h: 80, label: "Keycloak\nLogin · Sessions · Tokens" },
      { x: 665, y: 82, w: 100, h: 58, label: "Identity\ndatabase", kind: "database" },
      { x: 55, y: 350, w: 90, h: 60, label: "Client" },
      { x: 165, y: 350, w: 90, h: 60, label: "Protected\nAPI" },
      { x: 275, y: 350, w: 75, h: 60, label: "App DB", kind: "database" },
      { x: 453, y: 350, w: 90, h: 60, label: "Client" },
      { x: 563, y: 350, w: 90, h: 60, label: "Protected\nAPI" },
      { x: 673, y: 350, w: 75, h: 60, label: "App DB", kind: "database" },
      { x: 851, y: 350, w: 90, h: 60, label: "Client" },
      { x: 961, y: 350, w: 90, h: 60, label: "Protected\nAPI" },
      { x: 1071, y: 350, w: 75, h: 60, label: "App DB", kind: "database" },
    ],
    edges: [
      { x1: 645, y1: 110, x2: 665, y2: 110, both: true },
      { x1: 145, y1: 380, x2: 165, y2: 380, label: "token", lx: 155, ly: 438 },
      { x1: 255, y1: 380, x2: 275, y2: 380 },
      { x1: 543, y1: 380, x2: 563, y2: 380, label: "token", lx: 553, ly: 438 },
      { x1: 653, y1: 380, x2: 673, y2: 380 },
      { x1: 941, y1: 380, x2: 961, y2: 380, label: "token", lx: 951, ly: 438 },
      { x1: 1051, y1: 380, x2: 1071, y2: 380 },
      { x1: 100, y1: 350, x2: 470, y2: 150, label: "OIDC redirect / tokens", lx: 250, ly: 235 },
      { x1: 498, y1: 350, x2: 540, y2: 150, label: "OIDC", lx: 500, ly: 250 },
      { x1: 896, y1: 350, x2: 610, y2: 150, label: "OIDC redirect / tokens", lx: 775, ly: 235 },
      { x1: 210, y1: 350, x2: 510, y2: 150, dashed: true },
      { x1: 608, y1: 350, x2: 575, y2: 150, dashed: true },
      { x1: 1006, y1: 350, x2: 610, y2: 150, dashed: true },
    ],
  }),
  diagram({
    title: "Azure proof-of-concept deployment",
    width: 960,
    height: 330,
    nodes: [
      { x: 35, y: 120, w: 150, h: 70, label: "Browser or\napplication" },
      { x: 310, y: 95, w: 245, h: 110, label: "Azure App Service\nF1-linux · Keycloak 26.7.0" },
      { x: 730, y: 95, w: 190, h: 110, label: "Azure SQL Database\nFree offer · Serverless\n4 GB cap", kind: "database" },
      { x: 310, y: 255, w: 245, h: 60, label: "GitHub Actions · OIDC" },
    ],
    edges: [
      { x1: 185, y1: 155, x2: 310, y2: 155, label: "HTTPS", lx: 248, ly: 126 },
      { x1: 555, y1: 150, x2: 730, y2: 150, label: "Encrypted JDBC · mssql", lx: 642, ly: 119 },
      { x1: 432, y1: 255, x2: 432, y2: 205, label: "Deploy · operate", lx: 525, ly: 236, dashed: true },
      { x1: 555, y1: 285, x2: 800, y2: 205, label: "Deploy · inspect", lx: 697, ly: 270, dashed: true },
    ],
  }),
  diagram({
    title: "k3s, Flux, Cloudflare, and GHCR deployment flow",
    width: 1320,
    height: 555,
    groups: [
      { x: 30, y: 25, w: 1260, h: 220, label: "Public request path" },
      { x: 30, y: 285, w: 1260, h: 240, label: "GitOps delivery path" },
    ],
    nodes: [
      { x: 60, y: 95, w: 120, h: 62, label: "Browser" },
      { x: 245, y: 85, w: 170, h: 82, label: "Cloudflare edge\nHTTPS + baiganio.io" },
      { x: 480, y: 95, w: 155, h: 62, label: "cloudflared\ntunnel" },
      { x: 700, y: 95, w: 155, h: 62, label: "k3s ingress" },
      { x: 920, y: 85, w: 175, h: 82, label: "Keycloak\nproduction · ARM64" },
      { x: 1145, y: 95, w: 115, h: 62, label: "PostgreSQL\nPVC", kind: "database" },
      { x: 60, y: 360, w: 120, h: 62, label: "GitHub push" },
      { x: 245, y: 350, w: 170, h: 82, label: "GitHub-hosted job\ncheckout + kustomize" },
      { x: 480, y: 350, w: 155, h: 82, label: "GHCR OCI bundle\nrevision + production" },
      { x: 700, y: 350, w: 155, h: 82, label: "Authenticated\nwebhook" },
      { x: 920, y: 350, w: 175, h: 82, label: "Flux in k3s\npull + reconcile" },
      { x: 1145, y: 360, w: 115, h: 62, label: "Upstream\nregistries" },
    ],
    edges: [
      { x1: 180, y1: 126, x2: 245, y2: 126, label: "HTTPS", lx: 212, ly: 100 },
      { x1: 415, y1: 126, x2: 480, y2: 126 },
      { x1: 635, y1: 126, x2: 700, y2: 126 },
      { x1: 855, y1: 126, x2: 920, y2: 126 },
      { x1: 1095, y1: 126, x2: 1145, y2: 126 },
      { x1: 180, y1: 391, x2: 245, y2: 391 },
      { x1: 415, y1: 391, x2: 480, y2: 391 },
      { x1: 415, y1: 415, x2: 700, y2: 415, label: "notify", lx: 555, ly: 472, dashed: true },
      { x1: 855, y1: 391, x2: 920, y2: 391 },
      { x1: 920, y1: 365, x2: 635, y2: 365, label: "pull", lx: 777, ly: 335 },
      { x1: 1008, y1: 350, x2: 1008, y2: 167, label: "reconcile", lx: 1080, ly: 270, dashed: true },
      { x1: 1145, y1: 391, x2: 1095, y2: 150, label: "image pulls", lx: 1180, ly: 268, dashed: true },
    ],
  }),
];

const sourceJson = JSON.stringify(sources).replaceAll("<", "\\u003c");
const diagramJson = JSON.stringify(diagrams).replaceAll("<", "\\u003c");

const page = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="The BaiGanio Keycloak backbone: architecture and deployment guides for Docker, Azure, and k3s on Raspberry Pi 5.">
  <title>BaiGanio · Keycloak backbone</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f7f2;
      --surface: rgba(255,255,255,.82);
      --surface-solid: #fff;
      --surface-soft: #eef1e9;
      --ink: #17211b;
      --muted: #617067;
      --line: rgba(26,47,36,.14);
      --green: #1f6d4d;
      --green-2: #2e8b62;
      --green-soft: #dceee4;
      --amber: #9a6410;
      --amber-soft: #f7e8c8;
      --blue: #266da3;
      --blue-soft: #dfeef8;
      --danger: #a33a3a;
      --code: #101b17;
      --code-ink: #deebe4;
      --shadow: 0 18px 50px rgba(29,52,39,.09);
      --radius: 20px;
      --sidebar: 286px;
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; scroll-padding-top: 24px; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--green) 12%, transparent), transparent 35rem),
        var(--bg);
      color: var(--ink);
      font: 16px/1.68 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-rendering: optimizeLegibility;
    }
    body::before {
      content: ""; position: fixed; inset: 0; pointer-events: none; opacity: .17;
      background-image: radial-gradient(var(--muted) .55px, transparent .55px);
      background-size: 18px 18px; mask-image: linear-gradient(to bottom, #000, transparent 70%);
    }
    a { color: var(--green); text-underline-offset: 3px; }
    a:hover { color: var(--green-2); }
    .skip-link { position: fixed; left: 12px; top: -80px; z-index: 20; padding: 10px 14px; background: var(--ink); color: var(--bg); border-radius: 8px; }
    .skip-link:focus { top: 12px; }
    .layout { display: grid; grid-template-columns: var(--sidebar) minmax(0,1fr); min-height: 100vh; position: relative; }
    aside {
      position: sticky; top: 0; height: 100vh; padding: 28px 22px;
      border-right: 1px solid var(--line); background: color-mix(in srgb, var(--bg) 88%, transparent);
      backdrop-filter: blur(18px); z-index: 5; overflow-y: auto;
    }
    .brand { display: flex; gap: 12px; align-items: center; margin: 2px 4px 30px; text-decoration: none; color: var(--ink); }
    .brand-mark { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; background: var(--green); color: var(--bg); font-weight: 800; letter-spacing: -.06em; box-shadow: var(--shadow); }
    .brand-copy { display: grid; line-height: 1.2; }
    .brand-copy strong { font-size: 15px; letter-spacing: -.01em; }
    .brand-copy span { font-size: 12px; color: var(--muted); margin-top: 3px; }
    .nav-label { margin: 0 9px 9px; color: var(--muted); font-size: 10px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    nav { display: grid; gap: 6px; }
    nav a { display: grid; gap: 3px; padding: 10px 11px; border-radius: 12px; color: var(--muted); text-decoration: none; font-size: 13px; transition: .2s ease; }
    nav a:hover, nav a.active { color: var(--ink); background: var(--surface-soft); }
    nav a.active { box-shadow: inset 3px 0 var(--green); }
    nav a > span:first-child { font-weight: 700; }
    .nav-status { font-size: 10px; line-height: 1.35; opacity: .82; }
    .sidebar-note { margin: 28px 5px 0; padding-top: 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; line-height: 1.55; }
    main { min-width: 0; width: min(100%, 1080px); padding: 48px clamp(24px, 5vw, 76px) 110px; }
    .masthead { margin-bottom: 64px; padding: 22px 0 38px; border-bottom: 1px solid var(--line); }
    .eyebrow { color: var(--green); font-size: 11px; font-weight: 850; letter-spacing: .15em; text-transform: uppercase; }
    .masthead h1 { margin: 13px 0 14px; max-width: 820px; font-size: clamp(44px, 7vw, 82px); line-height: .98; letter-spacing: -.065em; }
    .masthead p { margin: 0; max-width: 680px; color: var(--muted); font-size: clamp(17px, 2vw, 21px); line-height: 1.55; }
    .scenario-strip { display: grid; grid-template-columns: repeat(3,1fr); gap: 10px; margin-top: 28px; }
    .scenario-jump { border: 1px solid var(--line); border-radius: 14px; padding: 13px 14px; background: var(--surface); text-decoration: none; color: var(--ink); }
    .scenario-jump:hover { border-color: var(--green); color: var(--ink); transform: translateY(-1px); }
    .scenario-jump strong { display: block; font-size: 12px; }
    .scenario-jump span { display: block; color: var(--muted); font-size: 10px; margin-top: 3px; line-height: 1.4; }
    .doc-section { position: relative; margin: 0 0 96px; }
    .section-marker { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin: 0 0 18px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
    .section-marker > span:first-child { color: var(--muted); font-size: 11px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    .badge { display: inline-flex; align-items: center; gap: 7px; max-width: 420px; padding: 6px 9px; border-radius: 999px; background: var(--green-soft); color: var(--green); font-size: 10px; font-weight: 800; line-height: 1.25; text-align: right; }
    .badge::before { content: ""; flex: 0 0 auto; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .badge.poc { color: var(--amber); background: var(--amber-soft); }
    .badge.pending { color: var(--blue); background: var(--blue-soft); }
    .doc-content > h1:first-child { margin-top: 0; }
    h1, h2, h3, h4 { color: var(--ink); line-height: 1.15; letter-spacing: -.035em; text-wrap: balance; }
    h1 { margin: 0 0 26px; font-size: clamp(34px, 5vw, 56px); }
    h2 { margin: 64px 0 20px; font-size: clamp(26px, 3.5vw, 36px); }
    h3 { margin: 46px 0 16px; font-size: clamp(21px, 2.4vw, 27px); }
    h4 { margin: 30px 0 12px; font-size: 18px; }
    p { margin: 0 0 18px; max-width: 78ch; }
    strong { color: color-mix(in srgb, var(--ink) 94%, var(--green)); }
    ul, ol { max-width: 78ch; margin: 0 0 22px; padding-left: 1.35rem; }
    li { margin: 7px 0; padding-left: .25rem; }
    li::marker { color: var(--green); font-weight: 800; }
    blockquote { margin: 24px 0; padding: 17px 20px; border: 1px solid color-mix(in srgb, var(--amber) 26%, var(--line)); border-left: 4px solid var(--amber); border-radius: 4px 14px 14px 4px; background: color-mix(in srgb, var(--amber-soft) 55%, transparent); }
    blockquote p:last-child { margin-bottom: 0; }
    hr { border: 0; border-top: 1px solid var(--line); margin: 52px 0; }
    :not(pre) > code { padding: .16em .42em; border: 1px solid var(--line); border-radius: 6px; background: var(--surface-soft); color: var(--ink); font: .87em/1.45 ui-monospace, SFMono-Regular, Consolas, monospace; overflow-wrap: anywhere; }
    .table-shell { width: 100%; overflow-x: auto; margin: 24px 0 30px; border: 1px solid var(--line); border-radius: 15px; background: var(--surface); box-shadow: 0 8px 26px rgba(29,52,39,.04); }
    table { width: 100%; border-collapse: collapse; min-width: 590px; font-size: 13px; line-height: 1.5; }
    th, td { padding: 13px 15px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
    th { background: var(--surface-soft); color: var(--ink); font-size: 11px; letter-spacing: .045em; text-transform: uppercase; }
    tr:last-child td { border-bottom: 0; }
    tr:hover td { background: color-mix(in srgb, var(--green-soft) 35%, transparent); }
    .code-shell { max-width: 100%; margin: 22px 0 28px; border: 1px solid rgba(255,255,255,.09); border-radius: 15px; overflow: hidden; background: var(--code); box-shadow: var(--shadow); }
    .code-topbar { display: flex; align-items: center; justify-content: space-between; min-height: 41px; padding: 0 8px 0 15px; border-bottom: 1px solid rgba(255,255,255,.09); color: #93a79c; font: 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace; text-transform: uppercase; letter-spacing: .1em; }
    .copy-button { border: 0; border-radius: 8px; padding: 7px 9px; background: rgba(255,255,255,.08); color: #c9d8d0; cursor: pointer; font: 10px/1 ui-sans-serif, system-ui, sans-serif; }
    .copy-button:hover { background: rgba(255,255,255,.15); color: white; }
    pre { margin: 0; padding: 18px 20px 20px; overflow-x: auto; color: var(--code-ink); font: 12.5px/1.65 ui-monospace, SFMono-Regular, Consolas, monospace; tab-size: 2; }
    pre code { font: inherit; }
    .diagram-shell { margin: 28px 0 36px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); overflow: hidden; box-shadow: var(--shadow); }
    .diagram-kicker { display: flex; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line); color: var(--muted); font-size: 10px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
    .diagram-kicker span:last-child { font-weight: 500; text-transform: none; letter-spacing: 0; }
    .diagram-scroll { overflow-x: auto; padding: 20px; }
    .architecture-diagram { width: 100%; min-width: 720px; height: auto; display: block; }
    .diagram-group rect { fill: color-mix(in srgb, var(--surface-soft) 65%, transparent); stroke: var(--line); stroke-width: 1; }
    .group-title { fill: var(--muted); font: 700 12px ui-sans-serif, system-ui; letter-spacing: .04em; text-transform: uppercase; }
    .diagram-node rect { fill: var(--surface-solid); stroke: color-mix(in srgb, var(--green) 30%, var(--line)); stroke-width: 1.3; }
    .diagram-node.database rect { fill: color-mix(in srgb, var(--green-soft) 68%, var(--surface-solid)); }
    .diagram-node text { fill: var(--ink); text-anchor: middle; font: 650 13px ui-sans-serif, system-ui; }
    .edge { stroke: color-mix(in srgb, var(--green) 72%, var(--muted)); stroke-width: 1.8; fill: none; }
    .edge.dashed { stroke-dasharray: 5 5; }
    .arrow-head { fill: color-mix(in srgb, var(--green) 72%, var(--muted)); }
    .edge-label rect { fill: var(--surface-solid); stroke: var(--line); }
    .edge-label text { fill: var(--muted); text-anchor: middle; font: 600 10px ui-sans-serif, system-ui; }
    details.topic { margin: 24px 0; border: 1px solid var(--line); border-radius: 15px; background: var(--surface); overflow: clip; }
    details.topic > summary { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 17px 19px; cursor: pointer; list-style: none; font-size: 17px; font-weight: 780; line-height: 1.3; }
    details.topic > summary::-webkit-details-marker { display: none; }
    details.topic > summary::after { content: "+"; flex: 0 0 auto; width: 27px; height: 27px; display: grid; place-items: center; border-radius: 50%; background: var(--surface-soft); color: var(--green); font-size: 19px; }
    details.topic[open] > summary::after { content: "−"; }
    details.topic > summary:hover { background: color-mix(in srgb, var(--green-soft) 35%, transparent); }
    .topic-body { padding: 2px 19px 18px; border-top: 1px solid var(--line); }
    .topic-body > :first-child { margin-top: 19px; }
    .source-note { margin-top: 64px; padding-top: 20px; border-top: 1px solid var(--line); color: var(--muted); font-size: 11px; }
    .mobile-bar { display: none; }
    @media (max-width: 900px) {
      .layout { display: block; }
      aside { display: none; }
      .mobile-bar { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 11px 16px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(18px); }
      .mobile-bar .brand { margin: 0; }
      .mobile-bar select { max-width: 45vw; border: 1px solid var(--line); border-radius: 9px; padding: 8px 9px; background: var(--surface-solid); color: var(--ink); font: 12px system-ui; }
      main { width: 100%; padding: 32px clamp(18px, 5vw, 46px) 80px; }
      .masthead { margin-bottom: 52px; }
    }
    @media (max-width: 650px) {
      .masthead h1 { font-size: 43px; }
      .scenario-strip { grid-template-columns: 1fr; }
      .section-marker { align-items: flex-start; flex-direction: column; }
      .badge { text-align: left; }
      .diagram-scroll { padding: 12px; }
      .architecture-diagram { min-width: 680px; }
      th, td { padding: 11px 12px; }
      pre { padding: 16px; font-size: 11.5px; }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      *, *::before, *::after { transition-duration: .001ms !important; animation-duration: .001ms !important; animation-iteration-count: 1 !important; }
    }
    @media print {
      aside, .mobile-bar, .copy-button, .scenario-strip { display: none !important; }
      .layout { display: block; }
      main { width: 100%; max-width: none; padding: 0; }
      .doc-section { break-before: page; }
      details.topic:not([open]) > *:not(summary) { display: block; }
      .diagram-shell, .code-shell, .table-shell { box-shadow: none; break-inside: avoid; }
    }

    /* Sharp technical system: top navigation, no cards, no ornamental softness. */
    :root {
      --bg: #f4f3ef;
      --surface: #f4f3ef;
      --surface-solid: #ffffff;
      --surface-soft: #e9e8e3;
      --ink: #101010;
      --muted: #666660;
      --line: #c8c7c0;
      --green: #1747ff;
      --green-2: #002dcf;
      --green-soft: #dfe5ff;
      --amber: #a24b00;
      --amber-soft: #f5dfc9;
      --blue: #1747ff;
      --blue-soft: #dfe5ff;
      --code: #0b0b0b;
      --code-ink: #f4f3ef;
      --shadow: none;
      --radius: 0;
      --sidebar: 0px;
    }
    * { border-radius: 0 !important; }
    body {
      background: var(--bg);
      font-family: Arial, Helvetica, sans-serif;
    }
    body::before {
      opacity: .28;
      background-image:
        linear-gradient(var(--line) 1px, transparent 1px),
        linear-gradient(90deg, var(--line) 1px, transparent 1px);
      background-size: 48px 48px;
      mask-image: linear-gradient(to bottom, rgba(0,0,0,.32), transparent 620px);
    }
    .layout { display: block; min-height: 100vh; }
    aside {
      position: sticky;
      top: 0;
      display: flex !important;
      align-items: stretch;
      height: 68px;
      width: 100%;
      padding: 0 32px;
      border: 0;
      border-bottom: 1px solid var(--line);
      background: color-mix(in srgb, var(--bg) 93%, transparent);
      backdrop-filter: blur(18px);
      overflow: hidden;
      z-index: 30;
    }
    aside .brand {
      flex: 0 0 auto;
      gap: 10px;
      min-width: 220px;
      margin: 0;
      padding-right: 28px;
      border-right: 1px solid var(--line);
    }
    .brand-mark {
      width: 30px;
      height: 30px;
      background: var(--ink);
      color: var(--bg);
      box-shadow: none;
      font-size: 13px;
    }
    .brand-copy strong { font-size: 13px; }
    .brand-copy span { font-size: 10px; }
    .nav-label, .sidebar-note, .nav-status { display: none; }
    aside nav {
      display: flex;
      align-items: stretch;
      gap: 0;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: none;
    }
    aside nav::-webkit-scrollbar { display: none; }
    aside nav a {
      display: flex;
      align-items: center;
      flex: 0 0 auto;
      padding: 0 22px;
      border-right: 1px solid var(--line);
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    aside nav a:hover, aside nav a.active {
      color: var(--bg);
      background: var(--ink);
      box-shadow: none;
    }
    .mobile-bar { display: none !important; }
    main {
      width: min(100%, 1320px);
      margin: 0 auto;
      padding: 0 44px 140px;
    }
    .masthead {
      min-height: 530px;
      margin: 0;
      padding: 86px 0 62px;
      border-bottom: 2px solid var(--ink);
    }
    .eyebrow {
      display: inline-block;
      padding: 7px 10px;
      background: var(--green);
      color: white;
      font: 800 11px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
      letter-spacing: .12em;
    }
    .masthead h1 {
      max-width: 1050px;
      margin: 34px 0 20px;
      font-size: clamp(70px, 10vw, 146px);
      line-height: .82;
      letter-spacing: -.085em;
      text-transform: uppercase;
    }
    .masthead p {
      max-width: 760px;
      color: var(--ink);
      font-size: clamp(19px, 2vw, 28px);
      line-height: 1.35;
    }
    .scenario-strip {
      grid-template-columns: repeat(3, 1fr);
      gap: 0;
      margin-top: 62px;
      border-top: 1px solid var(--ink);
      border-bottom: 1px solid var(--ink);
    }
    .scenario-jump {
      min-height: 105px;
      padding: 18px 20px;
      border: 0;
      border-right: 1px solid var(--ink);
      background: transparent;
    }
    .scenario-jump:last-child { border-right: 0; }
    .scenario-jump:hover {
      color: white;
      background: var(--green);
      transform: none;
    }
    .scenario-jump:hover span { color: rgba(255,255,255,.78); }
    .scenario-jump strong {
      font-size: 12px;
      letter-spacing: .02em;
      text-transform: uppercase;
    }
    .scenario-jump span { margin-top: 18px; font-size: 11px; }
    .doc-section {
      margin: 0;
      padding: 94px 0 112px;
      border-bottom: 1px solid var(--ink);
    }
    .section-marker {
      justify-content: flex-start;
      margin-bottom: 50px;
      padding: 0;
      border: 0;
    }
    .section-marker > span:first-child {
      min-width: 130px;
      padding: 8px 10px;
      background: var(--ink);
      color: var(--bg);
      font: 800 10px/1 ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .badge {
      max-width: none;
      padding: 8px 10px;
      background: var(--green);
      color: white;
      font: 800 10px/1.3 ui-monospace, SFMono-Regular, Consolas, monospace;
      text-align: left;
    }
    .badge::before { display: none; }
    .badge.poc { background: var(--amber); color: white; }
    .badge.pending { background: var(--blue); color: white; }
    h1, h2, h3, h4 { text-wrap: balance; }
    h1 {
      max-width: 1000px;
      font-size: clamp(48px, 7vw, 92px);
      line-height: .93;
      text-transform: uppercase;
    }
    h2 {
      margin-top: 84px;
      padding-top: 18px;
      border-top: 2px solid var(--ink);
      font-size: clamp(32px, 4vw, 54px);
    }
    h3 { font-size: clamp(23px, 2.7vw, 34px); }
    h4 { font-size: 19px; }
    p, ul, ol { max-width: 82ch; }
    blockquote {
      padding: 18px 22px;
      border: 0;
      border-left: 8px solid var(--amber);
      background: var(--surface-soft);
    }
    :not(pre) > code {
      border: 0;
      border-bottom: 1px solid var(--green);
      background: var(--surface-soft);
    }
    .table-shell {
      border: 1px solid var(--ink);
      background: var(--surface);
      box-shadow: none;
    }
    th, td { border-color: var(--line); }
    th {
      border-bottom: 1px solid var(--ink);
      background: var(--ink);
      color: var(--bg);
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    tr:hover td { background: var(--green-soft); }
    .code-shell {
      border: 1px solid var(--ink);
      background: var(--code);
      box-shadow: none;
    }
    .code-topbar {
      border-color: #383838;
      color: #a8a8a8;
    }
    .copy-button {
      border-left: 1px solid #383838;
      background: transparent;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .diagram-shell {
      border: 1px solid var(--ink);
      background: var(--surface-solid);
      box-shadow: none;
    }
    .diagram-kicker {
      border-color: var(--ink);
      background: var(--ink);
      color: var(--bg);
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .diagram-node rect,
    .diagram-group rect,
    .edge-label rect { rx: 0; }
    .diagram-node rect {
      fill: var(--surface-solid);
      stroke: var(--ink);
      stroke-width: 1.5;
    }
    .diagram-node.database rect { fill: var(--green-soft); }
    .diagram-group rect { fill: var(--surface-soft); stroke: var(--line); }
    .edge { stroke: var(--green); stroke-width: 2.2; }
    .arrow-head { fill: var(--green); }
    .edge-label rect { fill: var(--surface-solid); stroke: var(--ink); }
    details.topic {
      border: 0;
      border-top: 1px solid var(--ink);
      border-bottom: 1px solid var(--ink);
      background: transparent;
    }
    details.topic + details.topic { border-top: 0; }
    details.topic > summary {
      min-height: 68px;
      padding: 17px 0;
      font-size: 18px;
      text-transform: uppercase;
    }
    details.topic > summary::after {
      width: 38px;
      height: 38px;
      border-left: 1px solid var(--ink);
      background: transparent;
      color: var(--green);
    }
    details.topic > summary:hover {
      padding-left: 14px;
      background: var(--green-soft);
    }
    .topic-body {
      padding: 4px 0 24px;
      border-top: 1px solid var(--line);
    }
    .source-note {
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      text-transform: uppercase;
      letter-spacing: .04em;
    }
    @media (max-width: 900px) {
      aside {
        display: flex !important;
        height: 58px;
        padding: 0 16px;
      }
      aside .brand {
        min-width: auto;
        padding-right: 16px;
      }
      aside .brand-copy span { display: none; }
      aside nav a { padding: 0 16px; font-size: 10px; }
      main { width: 100%; padding: 0 22px 90px; }
      .masthead { min-height: auto; padding: 68px 0 42px; }
      .scenario-strip { grid-template-columns: 1fr; }
      .scenario-jump { min-height: 84px; border-right: 0; border-bottom: 1px solid var(--ink); }
      .scenario-jump:last-child { border-bottom: 0; }
      .scenario-jump span { margin-top: 10px; }
    }
    @media (max-width: 650px) {
      aside .brand-copy { display: none; }
      aside .brand { min-width: 47px; }
      .masthead h1 {
        max-width: 100%;
        font-size: clamp(48px, 15vw, 62px);
        letter-spacing: -.075em;
      }
      .masthead p { font-size: 18px; }
      .doc-section { padding: 72px 0 84px; }
      .section-marker { align-items: stretch; gap: 0; margin-bottom: 38px; }
      .section-marker > span:first-child { min-width: 88px; }
      .badge { flex: 1; }
      h1 { font-size: 46px; }
      h2 { font-size: 34px; }
      .diagram-kicker span:last-child { display: none; }
    }

    /* Final visual direction: restrained, light-only editorial documentation. */
    :root {
      color-scheme: light;
      --bg: #f7f7f4;
      --surface: #f7f7f4;
      --surface-solid: #ffffff;
      --surface-soft: #ecece7;
      --ink: #191918;
      --muted: #65655f;
      --line: #d1d1ca;
      --green: #d4472f;
      --green-2: #a93220;
      --green-soft: #f7e5e0;
      --amber: #d4472f;
      --amber-soft: #f7e5e0;
      --blue: #d4472f;
      --blue-soft: #f7e5e0;
      --code: #20201e;
      --code-ink: #f6f6f2;
      --shadow: none;
    }
    body {
      background: var(--bg);
      color: var(--ink);
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      letter-spacing: -.006em;
    }
    body::before { display: none; }
    aside {
      height: 72px;
      padding: 0 max(28px, calc((100vw - 1180px) / 2));
      border-top: 3px solid var(--green);
      border-bottom: 1px solid var(--line);
      background: rgba(247,247,244,.96);
    }
    aside .brand {
      min-width: 214px;
      padding-right: 26px;
      border-color: var(--line);
    }
    .brand-mark {
      width: 32px;
      height: 32px;
      background: var(--ink);
      color: white;
    }
    .brand-copy strong { font-size: 14px; }
    .brand-copy span { color: var(--muted); font-size: 10px; }
    aside nav a {
      padding: 0 20px;
      border-right: 0;
      color: var(--muted);
      font-size: 10px;
      letter-spacing: .055em;
    }
    aside nav a:hover,
    aside nav a.active {
      color: var(--ink);
      background: transparent;
      box-shadow: inset 0 -3px var(--green);
    }
    main {
      width: min(100%, 1180px);
      padding: 0 28px 120px;
    }
    .masthead {
      min-height: 0;
      padding: 94px 0 66px;
      border-bottom: 1px solid var(--ink);
    }
    .eyebrow {
      position: relative;
      padding: 0 0 0 34px;
      background: transparent;
      color: var(--green);
      font-size: 10px;
      letter-spacing: .14em;
    }
    .eyebrow::before {
      content: "";
      position: absolute;
      left: 0;
      top: 50%;
      width: 22px;
      border-top: 2px solid var(--green);
    }
    .masthead h1 {
      max-width: 900px;
      margin: 28px 0 24px;
      font-size: clamp(66px, 8vw, 108px);
      line-height: .94;
      letter-spacing: -.07em;
      text-transform: none;
    }
    .masthead p {
      max-width: 710px;
      color: #44443f;
      font-size: clamp(20px, 2.1vw, 27px);
      line-height: 1.42;
      letter-spacing: -.025em;
    }
    .scenario-strip {
      margin-top: 58px;
      border-color: var(--line);
    }
    .scenario-jump {
      min-height: 112px;
      padding: 20px 22px;
      border-color: var(--line);
    }
    .scenario-jump:hover {
      color: var(--ink);
      background: var(--surface-soft);
    }
    .scenario-jump:hover span { color: var(--muted); }
    .scenario-jump strong {
      color: var(--ink);
      font-size: 11px;
      letter-spacing: .045em;
    }
    .scenario-jump span {
      max-width: 31ch;
      margin-top: 20px;
      color: var(--muted);
      font-size: 11px;
      line-height: 1.4;
    }
    .doc-section {
      padding: 82px 0 100px;
      border-color: var(--line);
    }
    .section-marker {
      align-items: center;
      gap: 16px;
      margin-bottom: 42px;
    }
    .section-marker > span:first-child {
      min-width: 0;
      padding: 0 0 0 13px;
      border-left: 3px solid var(--green);
      background: transparent;
      color: var(--ink);
      font-size: 10px;
      line-height: 1.3;
    }
    .badge,
    .badge.poc,
    .badge.pending {
      flex: 0 1 auto;
      padding: 0;
      background: transparent;
      color: var(--muted);
      font: 700 10px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .badge::before {
      display: block;
      width: 5px;
      height: 5px;
      background: var(--green);
    }
    h1 {
      max-width: 930px;
      font-size: clamp(46px, 6vw, 76px);
      line-height: .98;
      letter-spacing: -.058em;
      text-transform: none;
    }
    h2 {
      margin-top: 72px;
      padding-top: 16px;
      border-top: 1px solid var(--ink);
      font-size: clamp(31px, 3.7vw, 46px);
      letter-spacing: -.045em;
    }
    h3 {
      margin-top: 44px;
      font-size: clamp(22px, 2.5vw, 30px);
      letter-spacing: -.035em;
    }
    h4 { font-size: 18px; }
    p, ul, ol { max-width: 76ch; }
    p { line-height: 1.7; }
    blockquote {
      padding: 18px 22px;
      border-left: 3px solid var(--green);
      background: var(--surface-soft);
    }
    a { color: var(--green-2); }
    :not(pre) > code {
      border-color: #bbb9b2;
      background: #eae9e4;
      color: #252522;
    }
    .table-shell {
      border-color: var(--line);
      background: white;
    }
    th {
      border-bottom-color: var(--ink);
      background: #262623;
      color: white;
    }
    tr:hover td { background: #f0efea; }
    .code-shell { border-color: #20201e; }
    .code-topbar { background: #20201e; }
    .diagram-shell {
      border-color: var(--line);
      background: white;
    }
    .diagram-kicker {
      border-color: var(--line);
      background: #f0efea;
      color: var(--muted);
    }
    .diagram-node rect {
      fill: #ffffff;
      stroke: #555550;
      stroke-width: 1.2;
    }
    .diagram-node.database rect { fill: #f7e5e0; }
    .diagram-group rect { fill: #f1f0eb; stroke: #d1d1ca; }
    .edge { stroke: var(--green); stroke-width: 1.8; }
    .arrow-head { fill: var(--green); }
    .edge-label rect { fill: white; stroke: #d1d1ca; }
    details.topic {
      border-color: var(--line);
      background: transparent;
    }
    details.topic > summary {
      min-height: 62px;
      font-size: 16px;
      letter-spacing: .01em;
      text-transform: none;
    }
    details.topic > summary::after {
      width: 34px;
      height: 34px;
      border-color: var(--line);
      color: var(--green);
    }
    details.topic > summary:hover {
      padding-left: 10px;
      background: #efeee9;
    }
    .source-note { color: var(--muted); }
    @media (max-width: 900px) {
      aside {
        height: 62px;
        padding: 0 18px;
      }
      main { padding: 0 22px 90px; }
      .masthead { padding: 72px 0 50px; }
      .scenario-strip { margin-top: 46px; }
    }
    @media (max-width: 650px) {
      .masthead h1 {
        font-size: clamp(48px, 14vw, 58px);
        letter-spacing: -.065em;
      }
      .masthead p { font-size: 18px; }
      .scenario-jump { min-height: 88px; }
      .section-marker { align-items: flex-start; gap: 10px; }
      .section-marker > span:first-child { min-width: auto; }
      .badge { flex: 0 1 auto; }
      h1 { font-size: 43px; }
      h2 { font-size: 32px; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="mobile-bar">
    <a class="brand" href="#overview"><span class="brand-mark">K</span><span class="brand-copy"><strong>BaiGanio</strong><span>Keycloak backbone</span></span></a>
    <select id="mobile-nav" aria-label="Jump to section">
      <option value="#overview">Overview</option>
      <option value="#why">Why this matters</option>
      <option value="#docker">A. Local Docker</option>
      <option value="#azure">B. Azure</option>
      <option value="#k3s">C. k3s · Pi 5</option>
    </select>
  </div>
  <div class="layout">
    <aside>
      <a class="brand" href="#overview"><span class="brand-mark">K</span><span class="brand-copy"><strong>BaiGanio</strong><span>Keycloak backbone</span></span></a>
      <div class="nav-label">On this page</div>
      <nav aria-label="Primary">
        <a href="#overview"><span>Overview</span></a>
        <a href="#why"><span>Why this matters</span></a>
        <a href="#docker"><span>A. Local development</span><span class="nav-status">Usable today</span></a>
        <a href="#azure"><span>B. Azure</span><span class="nav-status">Cost-constrained proof of concept; not yet validated end-to-end in a subscription</span></a>
        <a href="#k3s"><span>C. k3s on Pi 5</span><span class="nav-status">Manifests and pipeline are prepared; first real deployment to the cluster is still pending</span></a>
      </nav>
      <p class="sidebar-note">One page generated directly from README.md, ARCHITECTURE.md, DOCKER.md, AZURE.md, and K3SPI5.md.</p>
    </aside>
    <main id="main">
      <header class="masthead">
        <div class="eyebrow">BaiGanio / keycloak</div>
        <h1>Keycloak backbone</h1>
        <p>This repository is a starting point for a shared Keycloak identity service that can support multiple applications.</p>
        <div class="scenario-strip">
          <a class="scenario-jump" href="#docker"><strong>A · Local development</strong><span>Usable today</span></a>
          <a class="scenario-jump" href="#azure"><strong>B · Azure</strong><span>Cost-constrained proof of concept; not yet validated end-to-end in a subscription</span></a>
          <a class="scenario-jump" href="#k3s"><strong>C · k3s on Raspberry Pi 5</strong><span>Manifests and pipeline are prepared; first real deployment to the cluster is still pending</span></a>
        </div>
      </header>
      <section class="doc-section" id="overview">
        <div class="section-marker"><span>Overview</span></div>
        <div class="doc-content" data-source="overview"></div>
      </section>
      <section class="doc-section" id="why">
        <div class="section-marker"><span>Why this matters</span></div>
        <div class="doc-content" data-source="why"></div>
      </section>
      <section class="doc-section" id="docker">
        <div class="section-marker"><span>Scenario A</span><span class="badge">Usable today</span></div>
        <div class="doc-content" data-source="docker"></div>
      </section>
      <section class="doc-section" id="azure">
        <div class="section-marker"><span>Scenario B</span><span class="badge poc">Cost-constrained proof of concept; not yet validated end-to-end in a subscription</span></div>
        <div class="doc-content" data-source="azure"></div>
      </section>
      <section class="doc-section" id="k3s">
        <div class="section-marker"><span>Scenario C</span><span class="badge pending">Manifests and pipeline are prepared; first real deployment to the cluster is still pending</span></div>
        <div class="doc-content" data-source="k3s"></div>
      </section>
      <p class="source-note">Content is rendered from the repository’s five canonical Markdown guides. Status caveats and commands are intentionally preserved.</p>
    </main>
  </div>
  <script>
    "use strict";
    const sources = __SOURCES__;
    const diagrams = __DIAGRAMS__;
    let diagramIndex = 0;

    const collapsible = new Set([
      "Temporary bootstrap administrator",
      "Container lifecycle",
      "PostgreSQL persistence and reset behavior",
      "Troubleshooting",
      "Understand the Azure SQL free offer",
      "Use the native ARM template",
      "Configure GitHub-to-Azure OIDC",
      "Start, stop, and inspect the deployment",
      "Logs and troubleshooting",
      "Backup, upgrade, and rollback",
      "Cleanup",
      "Promotion beyond the PoC",
      "Check where the existing Cloudflare Tunnel runs",
      "Coexistence with other PostgreSQL servers",
      "One-time Flux and credential bootstrap",
      "Cloudflare Tunnel and TLS boundary",
      "GitHub-to-Pi deployment model",
      "Secrets boundary",
      "Relationship to the existing SD-card backup guide",
      "Deferred work"
    ]);

    function escapeHtml(value) {
      return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
    }

    function slug(value) {
      return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }

    function inline(value) {
      const stash = [];
      const hold = function(html) {
        const token = "@@INLINE" + stash.length + "@@";
        stash.push(html);
        return token;
      };
      let text = value;
      text = text.replace(/\x60([^\x60]+)\x60/g, function(_, code) {
        return hold("<code>" + escapeHtml(code) + "</code>");
      });
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, label, href) {
        let target = href;
        if (href === "DOCKER.md") target = "#docker";
        if (href === "AZURE.md") target = "#azure";
        if (href === "K3SPI5.md") target = "#k3s";
        if (href === "ARCHITECTURE.md") target = "#why";
        return hold('<a href="' + escapeHtml(target) + '">' + inline(label) + "</a>");
      });
      text = text.replace(/<(https?:\/\/[^>]+)>/g, function(_, href) {
        return hold('<a href="' + escapeHtml(href) + '">' + escapeHtml(href) + "</a>");
      });
      text = escapeHtml(text)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
      stash.forEach(function(html, index) {
        text = text.replace("@@INLINE" + index + "@@", html);
      });
      return text;
    }

    function isBlockStart(lines, index) {
      const line = lines[index] || "";
      const next = lines[index + 1] || "";
      return !line.trim() || /^#{1,4}\s/.test(line) || /^\x60\x60\x60/.test(line) ||
        /^>\s?/.test(line) || /^([-*_])\1\1+$/.test(line.trim()) ||
        /^\s*([-*]|\d+\.)\s+/.test(line) ||
        (line.includes("|") && /^\s*\|?\s*:?-+:?\s*\|/.test(next));
    }

    function renderMarkdown(markdown, namespace) {
      const lines = markdown.replace(/\r/g, "").split("\n");
      const out = [];
      let i = 0;
      let detailOpen = false;
      const closeDetail = function() {
        if (detailOpen) {
          out.push("</div></details>");
          detailOpen = false;
        }
      };

      while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i += 1; continue; }

        const heading = line.match(/^(#{1,4})\s+(.+)$/);
        if (heading) {
          const level = heading[1].length;
          const title = heading[2].replace(/[*\x60]/g, "");
          if (level <= 3) closeDetail();
          if (level === 3 && collapsible.has(title)) {
            const id = namespace + "-" + slug(title);
            out.push('<details class="topic" id="' + id + '"><summary>' + inline(title) + '</summary><div class="topic-body">');
            detailOpen = true;
          } else {
            out.push("<h" + level + ' id="' + namespace + "-" + slug(title) + '">' + inline(heading[2]) + "</h" + level + ">");
          }
          i += 1;
          continue;
        }

        if (/^\x60\x60\x60/.test(line)) {
          const language = line.slice(3).trim() || "text";
          const body = [];
          i += 1;
          while (i < lines.length && !/^\x60\x60\x60/.test(lines[i])) {
            body.push(lines[i]);
            i += 1;
          }
          i += 1;
          if (language === "mermaid") {
            out.push(diagrams[diagramIndex++] || "");
          } else {
            const code = body.join("\n");
            out.push('<figure class="code-shell"><div class="code-topbar"><span>' +
              escapeHtml(language) + '</span><button class="copy-button" type="button">Copy</button></div><pre><code>' +
              escapeHtml(code) + "</code></pre></figure>");
          }
          continue;
        }

        if (line.includes("|") && /^\s*\|?\s*:?-+:?\s*\|/.test(lines[i + 1] || "")) {
          const rows = [];
          const splitRow = function(row) {
            return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(function(cell) { return cell.trim(); });
          };
          const headers = splitRow(line);
          i += 2;
          while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
            rows.push(splitRow(lines[i]));
            i += 1;
          }
          out.push('<div class="table-shell"><table><thead><tr>' +
            headers.map(function(cell) { return "<th>" + inline(cell) + "</th>"; }).join("") +
            "</tr></thead><tbody>" +
            rows.map(function(row) { return "<tr>" + row.map(function(cell) { return "<td>" + inline(cell) + "</td>"; }).join("") + "</tr>"; }).join("") +
            "</tbody></table></div>");
          continue;
        }

        if (/^>\s?/.test(line)) {
          const quote = [];
          while (i < lines.length && (/^>\s?/.test(lines[i]) || !lines[i].trim())) {
            if (lines[i].trim()) quote.push(lines[i].replace(/^>\s?/, ""));
            i += 1;
          }
          out.push("<blockquote><p>" + inline(quote.join(" ")) + "</p></blockquote>");
          continue;
        }

        const listStart = line.match(/^\s*([-*]|\d+\.)\s+(.+)$/);
        if (listStart) {
          const ordered = /\d+\./.test(listStart[1]);
          const tag = ordered ? "ol" : "ul";
          const items = [];
          while (i < lines.length) {
            const item = lines[i].match(/^\s*([-*]|\d+\.)\s+(.+)$/);
            if (!item || (/\d+\./.test(item[1]) !== ordered)) break;
            let content = item[2];
            i += 1;
            while (i < lines.length && lines[i].trim() && !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) && !isBlockStart(lines, i)) {
              content += " " + lines[i].trim();
              i += 1;
            }
            items.push(content);
            if (!lines[i] || !lines[i].trim()) break;
          }
          out.push("<" + tag + ">" + items.map(function(item) { return "<li>" + inline(item) + "</li>"; }).join("") + "</" + tag + ">");
          continue;
        }

        if (/^([-*_])\1\1+$/.test(line.trim())) {
          out.push("<hr>");
          i += 1;
          continue;
        }

        const paragraph = [line.trim()];
        i += 1;
        while (i < lines.length && !isBlockStart(lines, i)) {
          paragraph.push(lines[i].trim());
          i += 1;
        }
        out.push("<p>" + inline(paragraph.join(" ")) + "</p>");
      }
      closeDetail();
      return out.join("\n");
    }

    document.querySelectorAll("[data-source]").forEach(function(target) {
      target.innerHTML = renderMarkdown(sources[target.dataset.source], target.dataset.source);
    });

    document.addEventListener("click", function(event) {
      const button = event.target.closest(".copy-button");
      if (!button) return;
      const code = button.closest(".code-shell").querySelector("code").textContent;
      const copy = navigator.clipboard && window.isSecureContext
        ? navigator.clipboard.writeText(code)
        : new Promise(function(resolve, reject) {
            const area = document.createElement("textarea");
            area.value = code;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            try {
              document.execCommand("copy") ? resolve() : reject(new Error("Copy failed"));
            } catch (error) {
              reject(error);
            } finally {
              area.remove();
            }
          });
      copy.then(function() {
        button.textContent = "Copied";
        window.setTimeout(function() { button.textContent = "Copy"; }, 1400);
      });
    });

    const navLinks = Array.from(document.querySelectorAll("aside nav a"));
    const sections = Array.from(document.querySelectorAll(".doc-section"));
    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function(link) {
          link.classList.toggle("active", link.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-15% 0px -75% 0px" });
    sections.forEach(function(section) { observer.observe(section); });

    document.getElementById("mobile-nav").addEventListener("change", function(event) {
      location.hash = event.target.value;
    });
  </script>
</body>
</html>`;

writeFileSync(
  resolve(root, "index.html"),
  page.replace("__SOURCES__", sourceJson).replace("__DIAGRAMS__", diagramJson),
);

console.log("Generated index.html from " + sourceFiles.map((entry) => entry[1]).join(", "));
