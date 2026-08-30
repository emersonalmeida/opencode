import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PAGES } from "@/lib/pages";
import { pagePathToFlag, isFeatureEnabled } from "@/lib/featureFlags";

/**
 * Os menus de navegação (nav da LeftSidebar + PagesMenu da sidebar direita)
 * derivam do registry PAGES, e os deep links do Flow/Jornada + RouteSidebars
 * resolvem contra ele. Esta guarda evita deriva: toda página navegável precisa
 * estar no registry com path único, ícone e descrição, e (exceto os
 * passthroughs Busca/Comparar) mapear para uma feature flag.
 */
describe("pages registry (PAGES)", () => {
  it("has unique paths for every entry", () => {
    const paths = PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("every entry has a label, description and icon component", () => {
    for (const p of PAGES) {
      expect(p.label.trim().length, `label for ${p.path}`).toBeGreaterThan(0);
      expect(p.desc.trim().length, `desc for ${p.path}`).toBeGreaterThan(0);
      expect(p.icon, `icon for ${p.path}`).toBeTruthy(); // lucide icons may be memo objects, not plain fns
    }
  });

  it("keyboard hints are unique single letters (Home quick actions)", () => {
    const hinted = PAGES.filter((p) => p.hint).map((p) => [p.path, p.hint!] as const);
    const hints = hinted.map(([, h]) => h);
    expect(new Set(hints).size, "atalhos duplicados").toBe(hints.length);
    for (const [, h] of hinted) expect(h, `hint '${h}'`).toMatch(/^[a-z]$/);
  });

  it("registry ↔ App.tsx routes stay in sync (add a page = registry + route)", () => {
    // Static parity check: every PAGES entry must have a <Route> in App.tsx,
    // and every concrete <Route path> must exist in the registry (or be a
    // known parameterized/404 route). This fails when a page is added to
    // App.tsx without registering it in PAGES (nav menus, flow deep links,
    // RouteSidebars and Configurações all derive from the registry).
    const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
    const registryPaths = PAGES.map((p) => p.path);
    for (const p of PAGES) {
      if (p.external) continue; // links externos não são rotas do app
      expect(app, `App.tsx tem <Route> para ${p.path}`).toContain(`path="${p.path}"`);
    }
    const KNOWN_PARAM_ROUTES = ["/app/:store/:id", "/lab/experiments/:id", "/assistente", "/p/:id", "/latest", "/oldest"];
    const routePaths = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);
    for (const rp of routePaths) {
      if (rp === "*" || KNOWN_PARAM_ROUTES.includes(rp)) continue;
      expect(registryPaths, `rota ${rp} existe no registry PAGES`).toContain(rp);
    }
    // parameter routes themselves must be present too (kept explicit)
    for (const pr of KNOWN_PARAM_ROUTES) {
      expect(app, `App.tsx tem rota parametrizada ${pr}`).toContain(`path="${pr}"`);
    }
  });

  it("page flags map correctly; feature-flagged entries hide/show", () => {
    // /search and /compare are passthroughs without flags — the rest must map.
    for (const p of PAGES) {
      if (p.external) continue; // links externos não têm flag/rota própria
      if (p.path === "/search" || p.path === "/compare") continue;
      expect(pagePathToFlag(p.path)).toMatch(/^page\./);
    }
    // Locked pages always resolve (they are marked locked in features).
    expect(isFeatureEnabled("page.home")).toBe(true);
    expect(isFeatureEnabled("page.dados")).toBe(true);
    expect(isFeatureEnabled("page.configuracoes")).toBe(true);
  });
});
