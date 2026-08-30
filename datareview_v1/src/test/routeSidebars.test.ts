import { describe, it, expect } from "vitest";
import { resolveRouteSidebarsConfig } from "@/components/pageSidebars/RouteSidebars";
import { PAGES } from "@/lib/pages";

// Rotas com sidebars internas próprias / sem sidebar padrão.
const EXCLUDED_PATHS = ["/ui", "/", "/home", "/os", "/canvas", "/fluxo", "/atlas", "/pipeline", "/concept", "/decision-center", "/design", "/chat-voz", "/chat-arquivos", "/01", "/compare", "/git", "/componentes", "/00", "/testes-fontes"];

describe("RouteSidebars — mapeamento rota → sidebars internas padrão", () => {
  it("cobre todas as páginas do registry que não têm sidebar própria", () => {
    for (const p of PAGES) {
      if (p.external || EXCLUDED_PATHS.includes(p.path)) continue;
      const cfg = resolveRouteSidebarsConfig(p.path);
      expect(cfg, `rota ${p.path} sem sidebars internas padrão`).not.toBeNull();
      expect(cfg!.pageId).toBeTruthy();
    }
  });

  it("páginas com sidebar interna própria ficam excluídas", () => {
    for (const p of EXCLUDED_PATHS) {
      expect(resolveRouteSidebarsConfig(p), `${p} não deveria ter sidebar padrão`).toBeNull();
    }
  });

  it("rotas parametrizadas herdam a config da página", () => {
    expect(resolveRouteSidebarsConfig("/app/apple/12345")?.pageId).toBe("app");
    expect(resolveRouteSidebarsConfig("/lab/experiments/abc")?.pageId).toBe("lab");
  });

  it("a página Explorar expõe âncoras de seções", () => {
    const cfg = resolveRouteSidebarsConfig("/case");
    expect(cfg?.anchors?.length).toBeGreaterThan(5);
  });

  it("rotas desconhecidas não registram sidebars", () => {
    expect(resolveRouteSidebarsConfig("/rota-inexistente")).toBeNull();
  });
});
