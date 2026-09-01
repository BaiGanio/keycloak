"use strict";

const guides = window.BAIGANIO_GUIDES || {};
const diagrams = window.BAIGANIO_DIAGRAMS || [];
let diagramIndex = 0;
const collapsible = new Set([
  "Temporary bootstrap administrator", "Container lifecycle",
  "PostgreSQL persistence and reset behavior", "Troubleshooting",
  "Understand the Azure SQL free offer", "Use the native ARM template",
  "Configure GitHub-to-Azure OIDC", "Start, stop, and inspect the deployment",
  "Logs and troubleshooting", "Backup, upgrade, and rollback", "Cleanup",
  "Promotion beyond the PoC", "Check where the existing Cloudflare Tunnel runs",
  "Coexistence with other PostgreSQL servers", "One-time Flux and credential bootstrap",
  "Cloudflare Tunnel and TLS boundary", "GitHub-to-Pi deployment model",
  "Secrets boundary", "Relationship to the existing SD-card backup guide", "Deferred work",
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
  const hold = (html) => {
    const token = `@@INLINE${stash.length}@@`;
    stash.push(html);
    return token;
  };
  let text = value;
  text = text.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const sections = {
      "README.md": "#overview", "ARCHITECTURE.md": "#why", "DOCKER.md": "#docker",
      "AZURE.md": "#azure", "K3SPI5.md": "#k3s",
    };
    return hold(`<a href="${escapeHtml(sections[href] || href)}">${inline(label)}</a>`);
  });
  text = text.replace(/<(https?:\/\/[^>]+)>/g, (_, href) =>
    hold(`<a href="${escapeHtml(href)}">${escapeHtml(href)}</a>`));
  text = escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  for (let index = stash.length - 1; index >= 0; index -= 1) {
    text = text.replace(`@@INLINE${index}@@`, stash[index]);
  }
  return text;
}

function isBlockStart(lines, index) {
  const line = lines[index] || "";
  const next = lines[index + 1] || "";
  return !line.trim() || /^#{1,4}\s/.test(line) || /^```/.test(line) ||
    /^>\s?/.test(line) || /^([-*_])\1\1+$/.test(line.trim()) ||
    /^\s*([-*]|\d+\.)\s+/.test(line) ||
    (line.includes("|") && /^\s*\|?\s*:?-+:?\s*\|/.test(next));
}

function renderMarkdown(markdown, namespace) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const out = [];
  let index = 0;
  let detailOpen = false;
  const closeDetail = () => {
    if (detailOpen) out.push("</div></details>");
    detailOpen = false;
  };

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (namespace === "overview" && /^##\s+License\s*$/.test(line)) {
      closeDetail();
      break;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      const title = heading[2].replace(/[*`]/g, "");
      if (level <= 3) closeDetail();
      if (level === 3 && collapsible.has(title)) {
        out.push(`<details class="topic" id="${namespace}-${slug(title)}"><summary>${inline(title)}</summary><div class="topic-body">`);
        detailOpen = true;
      } else {
        out.push(`<h${level} id="${namespace}-${slug(title)}">${inline(heading[2])}</h${level}>`);
      }
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const language = line.slice(3).trim() || "text";
      const body = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) body.push(lines[index++]);
      index += 1;
      if (language === "mermaid" && diagrams[diagramIndex]) {
        out.push(diagrams[diagramIndex++]);
      } else {
        out.push(`<figure class="code-shell"><div class="code-topbar"><span>${escapeHtml(language)}</span><button class="copy-button" type="button">Copy</button></div><pre><code>${escapeHtml(body.join("\n"))}</code></pre></figure>`);
      }
      continue;
    }

    if (line.includes("|") && /^\s*\|?\s*:?-+:?\s*\|/.test(lines[index + 1] || "")) {
      const rows = [];
      const splitRow = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "")
        .split("|").map((cell) => cell.trim());
      const headers = splitRow(line);
      index += 2;
      while (index < lines.length && lines[index].includes("|") && lines[index].trim()) {
        rows.push(splitRow(lines[index++]));
      }
      out.push(`<div class="table-shell"><table><thead><tr>${headers.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && (/^>\s?/.test(lines[index]) || !lines[index].trim())) {
        if (lines[index].trim()) quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      out.push(`<blockquote><p>${inline(quote.join(" "))}</p></blockquote>`);
      continue;
    }

    const listStart = line.match(/^\s*([-*]|\d+\.)\s+(.+)$/);
    if (listStart) {
      const ordered = /\d+\./.test(listStart[1]);
      const tag = ordered ? "ol" : "ul";
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s*([-*]|\d+\.)\s+(.+)$/);
        if (!item || (/\d+\./.test(item[1]) !== ordered)) break;
        let content = item[2];
        index += 1;
        while (index < lines.length && lines[index].trim() &&
          !/^\s*([-*]|\d+\.)\s+/.test(lines[index]) && !isBlockStart(lines, index)) {
          content += ` ${lines[index++].trim()}`;
        }
        items.push(content);
        if (!lines[index] || !lines[index].trim()) break;
      }
      out.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</${tag}>`);
      continue;
    }

    if (/^([-*_])\1\1+$/.test(line.trim())) {
      out.push("<hr>");
      index += 1;
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;
    while (index < lines.length && !isBlockStart(lines, index)) paragraph.push(lines[index++].trim());
    out.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  closeDetail();
  return out.join("\n");
}

document.querySelectorAll("[data-source]").forEach((target) => {
  const markdown = guides[target.dataset.source];
  target.innerHTML = typeof markdown === "string"
    ? renderMarkdown(markdown, target.dataset.source)
    : '<p class="render-error">This guide asset is missing. Run <code>node scripts/generate-site.mjs</code> and reload the page.</p>';
});

document.addEventListener("click", (event) => {
  const button = event.target.closest(".copy-button");
  if (!button) return;
  const code = button.closest(".code-shell").querySelector("code").textContent;
  const copy = navigator.clipboard && window.isSecureContext
    ? navigator.clipboard.writeText(code)
    : Promise.reject(new Error("Clipboard API unavailable"));
  copy.then(() => {
    button.textContent = "Copied";
    window.setTimeout(() => { button.textContent = "Copy"; }, 1400);
  }).catch(() => { button.textContent = "Select and copy"; });
});

if ("IntersectionObserver" in window) {
  const navLinks = Array.from(document.querySelectorAll("nav a"));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => link.classList.toggle("active", link.hash === `#${entry.target.id}`));
    });
  }, { rootMargin: "-15% 0px -75% 0px" });
  document.querySelectorAll(".doc-section").forEach((section) => observer.observe(section));
}
