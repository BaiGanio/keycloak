import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(root, "site/content");
const maxAssetBytes = 40 * 1024;
const chunkCharacters = 2_000;
const guides = [
  ["overview", "README.md"],
  ["why", "ARCHITECTURE.md"],
  ["docker", "DOCKER.md"],
  ["azure", "AZURE.md"],
  ["k3s", "K3SPI5.md"],
];

function chunksOf(value, size) {
  const characters = Array.from(value);
  const chunks = [];
  for (let index = 0; index < characters.length; index += size) {
    chunks.push(characters.slice(index, index + size).join(""));
  }
  return chunks;
}

function javascriptString(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function contentAsset(key, markdown, sourceFile) {
  const chunks = chunksOf(markdown, chunkCharacters)
    .map((chunk) => `  ${javascriptString(chunk)}`)
    .join(",\n");

  return `// Generated from ${sourceFile}; run node scripts/generate-site.mjs after editing it.\n` +
    `window.BAIGANIO_GUIDES = window.BAIGANIO_GUIDES || {};\n` +
    `window.BAIGANIO_GUIDES[${JSON.stringify(key)}] = [\n${chunks}\n].join("");\n`;
}

mkdirSync(outputDirectory, { recursive: true });

for (const [key, sourceFile] of guides) {
  const markdown = readFileSync(resolve(root, sourceFile), "utf8");
  const asset = contentAsset(key, markdown, sourceFile);
  const bytes = Buffer.byteLength(asset);
  if (bytes > maxAssetBytes) {
    throw new Error(`${sourceFile} generated ${bytes} bytes; split the guide before publishing`);
  }
  writeFileSync(resolve(outputDirectory, `${key}.js`), asset);
  console.log(`${sourceFile} -> site/content/${key}.js (${bytes} bytes)`);
}
