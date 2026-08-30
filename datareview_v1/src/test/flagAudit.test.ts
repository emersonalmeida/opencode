/**
 * Auditoria de flags órfãs (Onda 1.4): cruza as flags definidas em
 * featureFlags.ts com o USO real no código — flag sem consumidor é órfã
 * (ligar/desligar não muda nada) e referência a flag inexistente é fantasma
 * (erro silencioso de digitação). Flags de páginas são consumidas pelo
 * circuito canônico: FlaggedRoute (App.tsx) + menus (pagePathToFlag).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FEATURE_FLAGS, pagePathToFlag } from "@/lib/featureFlags";
import { PAGES } from "@/lib/pages";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "test" || name === "node_modules") continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const SRC_FILES = walk("src").filter((f) => !f.includes("/test/"));
const SRC = SRC_FILES.map((f) => readFileSync(f, "utf8")).join("\n");

describe("auditoria de flags órfãs (Onda 1.4)", () => {
  it("nenhuma flag é órfã — toda flag definida tem consumidor no código", () => {
    const orphans = FEATURE_FLAGS.filter((f) => !SRC.includes(`"${f.key}"`));
    expect(
      orphans.map((f) => f.key),
      `flags sem consumidor (órfãs): ${orphans.map((f) => f.key).join(", ") || "nenhuma"}`,
    ).toEqual([]);
  });

  it("nenhuma referência fantasma — toda flag citada no código existe no registry", () => {
    const defined = new Set(FEATURE_FLAGS.map((f) => f.key));
    const refs = new Set<string>();
    for (const m of SRC.matchAll(/(?:isFeatureEnabled|useFeatureFlag|setFeatureFlag)\(\s*"([^"]+)"/g)) {
      refs.add(m[1]);
    }
    for (const m of SRC.matchAll(/flag:\s*"(page\.[^"]+)"/g)) refs.add(m[1]);
    const ghosts = [...refs].filter((r) => !defined.has(r));
    expect(ghosts, `flags inexistentes referenciadas: ${ghosts.join(", ") || "nenhuma"}`).toEqual([]);
  });

  it("toda página do registry tem flag page.* correspondente (ou é rota livre)", () => {
    // Passthroughs sem flag própria (documentados em pages.test.ts):
    // /search e /compare são rotas utilitárias sempre disponíveis.
    const PASSTHROUGH = new Set(["/search", "/compare"]);
    const missing = PAGES.filter((p) => !p.external && !PASSTHROUGH.has(p.path) && !pagePathToFlag(p.path)).map((p) => p.path);
    expect(missing, `páginas sem flag: ${missing.join(", ") || "nenhuma"}`).toEqual([]);
  });

  it("toda flag page.* mapeia para uma página do registry (via pagePathToFlag)", () => {
    const pageFlags = FEATURE_FLAGS.filter((f) => f.key.startsWith("page."));
    const dangling = pageFlags.filter(
      (f) => !PAGES.some((p) => pagePathToFlag(p.path) === f.key),
    );
    expect(
      dangling.map((f) => f.key),
      `flags de página sem página: ${dangling.map((f) => f.key).join(", ") || "nenhuma"}`,
    ).toEqual([]);
  });

  it("flags locked não são escondidas por engano (home/dados/configurações)", () => {
    for (const key of ["page.home", "page.dados", "page.configuracoes"]) {
      expect(FEATURE_FLAGS.find((f) => f.key === key)?.locked).toBe(true);
    }
  });
});
