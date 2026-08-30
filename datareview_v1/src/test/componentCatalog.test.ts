/** Testes da camada pura do catálogo de componentes (/componentes). */
import { describe, it, expect } from "vitest";
import {
  catalogStats, groupComponentsByPage, findRepetitionCandidates,
  filterComponents, mostReused, pageFileToPath,
} from "@/lib/componentCatalog";
import { COMPONENT_INVENTORY, PAGE_USAGE } from "@/lib/componentInventory.generated";
import { PAGES } from "@/lib/pages";

describe("componentCatalog", () => {
  it("inventário gerado não está vazio e é consistente", () => {
    expect(COMPONENT_INVENTORY.length).toBeGreaterThan(50);
    expect(PAGE_USAGE.length).toBeGreaterThan(10);
    for (const c of COMPONENT_INVENTORY) {
      expect(c.file.startsWith("components/")).toBe(true);
      expect(c.lines).toBeGreaterThan(0);
      expect(c.consumers).toBeGreaterThanOrEqual(0);
    }
  });

  it("stats cobrem o total sem double-count", () => {
    const s = catalogStats();
    expect(s.totalFiles).toBe(COMPONENT_INVENTORY.length);
    expect(s.shared + s.pageSpecific + s.unused).toBe(s.totalFiles);
    expect(s.totalExports).toBeGreaterThan(0);
  });

  it("pageFileToPath mapeia arquivos de página conhecidos", () => {
    expect(pageFileToPath("pages/Chat.tsx")).toBe("/chat");
    expect(pageFileToPath("pages/Dashboard.tsx")).toBe("/dashboard");
    expect(pageFileToPath("pages/NaoExiste.tsx")).toBeNull();
    // renomes semânticos (aliases)
    expect(pageFileToPath("pages/AICentral.tsx")).toBe("/ia");
    expect(pageFileToPath("pages/Index.tsx")).toBe("/");
    expect(pageFileToPath("pages/Flow.tsx")).toBe("/fluxo");
    expect(pageFileToPath("pages/SettingsPage.tsx")).toBe("/configuracoes");
    // variação com sufixo Page
    expect(pageFileToPath("pages/DesignSystemPage.tsx")).toBe("/design-system");
    // páginas-mãe de rotas parametrizadas
    expect(pageFileToPath("pages/ExperimentDetailPage.tsx")).toBe("/lab");
  });

  it("guarda de regressão: TODA página do inventário mapeia para uma rota conhecida", () => {
    const knownPaths = new Set(PAGES.map((p) => p.path));
    for (const usage of PAGE_USAGE) {
      const path = pageFileToPath(usage.page);
      // null = cai no grupo shared (aceitável para NotFound); senão precisa
      // ser uma rota do registry — senão os componentes somem do catálogo.
      if (path !== null) expect(knownPaths.has(path)).toBe(true);
      // Exceções documentadas: rotas sem entrada no menu (parametrizada/404)
      // — seus componentes aparecem na seção "Sistema / compartilhados".
      const NO_ROUTE = new Set(["pages/NotFound.tsx", "pages/AppDetail.tsx"]);
      if (usage.components.length > 0 && !NO_ROUTE.has(usage.page)) {
        expect(path, `${usage.page} tem ${usage.components.length} componentes mas não mapeia para nenhuma rota`).not.toBeNull();
      }
    }
  });

  it("nenhuma página com componentes no inventário exibe 0 no catálogo", () => {
    const groups = groupComponentsByPage();
    const byPath = new Map(groups.map((g) => [g.pagePath, g.components.length]));
    for (const usage of PAGE_USAGE) {
      if (usage.components.length === 0) continue;
      const path = pageFileToPath(usage.page);
      if (!path) continue;
      expect(byPath.get(path) ?? 0, `${usage.page} → ${path} exibiria 0 componentes`).toBeGreaterThan(0);
    }
  });

  it("agrupa por página seguindo a ordem do menu (PAGES) e termina em shared", () => {
    const groups = groupComponentsByPage();
    expect(groups.length).toBeGreaterThan(1);
    expect(groups[groups.length - 1].pagePath).toBe("shared");
    // ordem dos grupos com componentes respeita a ordem do registry
    const order = groups.filter((g) => g.pagePath !== "shared").map((g) => g.pagePath);
    const registryOrder = order.map((p) => PAGES.findIndex((pg) => pg.path === p));
    expect([...registryOrder].sort((a, b) => a - b)).toEqual(registryOrder);
    // componentes podem aparecer em várias páginas (uso compartilhado);
    // o grupo "shared" só contém os que NENHUMA página importa, e a união
    // de todos os grupos cobre o inventário inteiro.
    const inPages = new Set<string>();
    const shared = groups[groups.length - 1];
    for (const g of groups) {
      if (g.pagePath === "shared") continue;
      for (const c of g.components) inPages.add(c.file);
    }
    for (const c of shared.components) expect(inPages.has(c.file)).toBe(false);
    const union = new Set([...inPages, ...shared.components.map((c) => c.file)]);
    expect(union.size).toBe(COMPONENT_INVENTORY.length);
  });

  it("repetition candidates são determinísticos e referenciam arquivos reais", () => {
    const reps = findRepetitionCandidates();
    const files = new Set(COMPONENT_INVENTORY.map((c) => c.file));
    for (const r of reps) {
      expect(r.files.length).toBeGreaterThan(1);
      for (const f of r.files) expect(files.has(f)).toBe(true);
    }
  });

  it("filterComponents busca por arquivo e export", () => {
    const all = COMPONENT_INVENTORY;
    expect(filterComponents(all, "")).toBe(all);
    const byFile = filterComponents(all, "emptystate");
    expect(byFile.length).toBeGreaterThan(0);
    const byExport = filterComponents(all, "EmptyState");
    expect(byExport.some((c) => c.exports.includes("EmptyState"))).toBe(true);
    expect(filterComponents(all, "zzz-nada-zzz").length).toBe(0);
  });

  it("mostReused ordena por consumidores desc e limita", () => {
    const top = mostReused(5);
    expect(top.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].consumers).toBeGreaterThanOrEqual(top[i].consumers);
    }
  });
});
