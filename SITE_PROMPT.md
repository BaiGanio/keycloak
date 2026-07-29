# Prompt: single-page HTML site for this repository

Use this prompt to generate one self-contained HTML page that presents this
project (`BaiGanio/keycloak`). Paste it as-is, giving the model read access to
`README.md`, `ARCHITECTURE.md`, `K3SPI5.md`, `DOCKER.md`, and `AZURE.md`.

---

## The prompt

You are building a single static HTML page that presents the `BaiGanio/keycloak`
repository to a reader who is not deeply technical, but who still needs to be
able to follow real commands if they choose to. Before writing anything, read
these five files in full:

- `README.md` — project overview and the three-scenario map
- `ARCHITECTURE.md` — why this exists: the trust relationship between this
  Keycloak instance and the other BaiGanio apps/clients/databases it protects
- `DOCKER.md` — Scenario A, local development
- `AZURE.md` — Scenario B, Azure proof of concept
- `K3SPI5.md` — Scenario C, k3s on a Raspberry Pi 5, including why Flux is used

**Content fidelity is the priority.** This page must follow the five source
files 1:1 — same facts, same caveats, same status disclaimers, same commands,
same order of ideas within each section. Do not paraphrase away hedges like
"not yet validated," "PoC," "requires an end-to-end test," or "reads passwords
from environment variables" — carry them over faithfully; they are load-bearing,
not filler. Do not invent features, marketing language, or claims the source
files don't make. Where a source file gives a command block, reproduce that
command block verbatim (same flags, same order) rather than summarizing it.
If a source file changes in the future, this page should be regenerated from
the new version rather than patched from memory — treat the five files as the
single source of truth every time this prompt is run.

### Structure

One page, one URL, with a persistent left-hand or top nav linking to same-page
anchors for:

1. **Overview** — from `README.md`: what Keycloak is, the architecture diagram,
   the repository-contents table, and the "no realms/clients/users configured
   yet" note.
2. **Why this matters** — from `ARCHITECTURE.md`: the trust-model diagram
   showing this Keycloak instance next to the other BaiGanio apps, and the
   plain-language explanation of what it actually guards against (unauthenticated
   access reaching an app's database) and what's not built yet.
3. **A. Local development (Docker)** — from `DOCKER.md`.
4. **B. Azure** — from `AZURE.md`.
5. **C. k3s on Raspberry Pi 5** — from `K3SPI5.md`, including the "Why Flux is
   part of this" explanation near the top of that section, not buried below
   the operational steps.

Each of the three scenario sections should open with the same short framing
the README uses for it (usable / PoC needing validation / manifests ready but
untested) so a reader landing on any section alone still gets the right
expectations before they start copying commands.

### Non-technical-reader affordances

- Render the three Mermaid diagrams (from `README.md`, `ARCHITECTURE.md`, and
  `K3SPI5.md`) as actual diagrams, not text dumps.
- Give every command block a visible "copy" button — readers following this by
  hand should never have to manually select multi-line shell text.
- Use collapsible/expandable blocks for the longer procedural sequences (Flux
  bootstrap, Azure OIDC setup, troubleshooting tables) so the page reads as
  approachable rather than as a wall of shell commands; keep them open by
  default only for the short, essential "first steps" of each scenario.
- Reproduce the existing Markdown tables (repository contents, Azure settings,
  Kubernetes resources, troubleshooting) as real HTML tables, not screenshots
  or preformatted text.
- Add a small status badge per scenario (e.g. "Usable", "PoC — not yet
  validated", "Manifests ready — first deployment pending") near each nav
  entry and section heading, using the exact status language from `README.md`.

### Technical constraints

- Single HTML file, fully self-contained: inline all CSS and JS, no external
  fonts, scripts, or stylesheets, no network calls. If Mermaid rendering needs
  a library, inline it rather than loading it from a CDN.
- Must look correct in both light and dark mode (respect the reader's OS
  theme preference).
- Responsive down to a narrow mobile width; code blocks and tables scroll
  horizontally inside their own container rather than breaking page layout.
- No tracking, no analytics, no external links other than the ones already
  present in the source Markdown (e.g. the `k3s-pi5` backup-guide link, the
  Keycloak project link).

### What NOT to do

- Don't summarize a whole section into a shorter paragraph "for readability" —
  length parity with the source material is expected; this page is meant to be
  the same information in a nicer shell, not an abridged version.
- Don't reorder content to read better as marketing copy — keep each source
  file's own internal ordering.
- Don't add sections, FAQs, or claims that don't exist in `README.md`,
  `ARCHITECTURE.md`, `DOCKER.md`, `AZURE.md`, or `K3SPI5.md`.
