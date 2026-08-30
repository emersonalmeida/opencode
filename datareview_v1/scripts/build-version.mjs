#!/usr/bin/env node
/**
 * Gera o build estático de uma tag git em public/versions/<tag>/ — é o que
 * torna as URLs versionadas (/vN, /latest, /oldest) navegáveis de verdade:
 * o VersionGateway redireciona para /versions/<tag>/ quando o build existe
 * (índice em public/versions/index.json).
 *
 * Uso:
 *   npm run build:version v1.0.0
 *   node scripts/build-version.mjs v1.0.0 v1.1.0   (várias tags)
 *
 * Como funciona:
 *   1. git worktree add .version-build/<tag> <tag>  (checkout isolado da tag)
 *   2. symlink node_modules do repo principal (build rápido; se a tag tiver
 *      deps diferentes, rode `npm ci` no worktree manualmente)
 *   3. vite build --base=/versions/<tag>/ --outDir <repo>/public/versions/<tag>
 *   4. atualiza public/versions/index.json { tags: [...] }
 *   5. remove o worktree
 *
 * Os artefatos (public/versions/, .version-build/) são gitignored — cada
 * máquina gera os builds que quiser servir.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WORKTREES = join(ROOT, ".version-build");
const OUT_BASE = join(ROOT, "public", "versions");
const INDEX_JSON = join(OUT_BASE, "index.json");

const tags = process.argv.slice(2);
if (tags.length === 0) {
  console.error("Uso: npm run build:version <tag> [tag2 ...]  (ex.: v1.0.0)");
  process.exit(1);
}

const git = (args, cwd = ROOT) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

const knownTags = git(["tag", "-l"]).split("\n").filter(Boolean);

function readIndex() {
  try {
    const json = JSON.parse(readFileSync(INDEX_JSON, "utf8"));
    return Array.isArray(json.tags) ? json.tags.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function writeIndex(tagList) {
  mkdirSync(OUT_BASE, { recursive: true });
  const sorted = [...new Set(tagList)].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
  writeFileSync(
    INDEX_JSON,
    JSON.stringify({ tags: sorted, generatedAt: new Date().toISOString() }, null, 2) + "\n",
  );
  return sorted;
}

let failures = 0;

for (const tag of tags) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) {
    console.error(`✗ "${tag}" não parece uma tag semver (ex.: v1.0.0) — pulando.`);
    failures++;
    continue;
  }
  if (!knownTags.includes(tag)) {
    console.error(`✗ tag "${tag}" não existe (git tag -l) — pulando.`);
    failures++;
    continue;
  }

  const worktree = join(WORKTREES, tag);
  const outDir = join(OUT_BASE, tag);
  console.log(`\n▶ build ${tag} → public/versions/${tag}/`);

  try {
    rmSync(worktree, { recursive: true, force: true });
    mkdirSync(WORKTREES, { recursive: true });
    git(["worktree", "add", "--detach", worktree, tag]);

    // Reusa os node_modules do checkout principal (build rápido).
    const nmTarget = join(ROOT, "node_modules");
    const nmLink = join(worktree, "node_modules");
    if (existsSync(nmTarget) && !existsSync(nmLink)) {
      symlinkSync(nmTarget, nmLink, "dir");
    }

    execFileSync(
      "npx",
      [
        "vite",
        "build",
        `--base=/versions/${tag}/`,
        `--outDir=${outDir}`,
        "--emptyOutDir",
      ],
      { cwd: worktree, stdio: "inherit" },
    );

    if (!existsSync(join(outDir, "index.html"))) {
      throw new Error("build terminou sem index.html — verifique o log acima");
    }

    const all = writeIndex([...readIndex(), tag]);
    console.log(`✓ ${tag} ok · index.json: ${all.join(", ")}`);
  } catch (err) {
    failures++;
    console.error(`✗ ${tag} falhou: ${err.message}`);
  } finally {
    try {
      git(["worktree", "remove", "--force", worktree]);
    } catch {
      rmSync(worktree, { recursive: true, force: true });
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} tag(s) falharam.`);
  process.exit(1);
}
console.log("\nPronto. Recarregue /latest, /oldest ou /vN no navegador.");
