import { describe, it, expect, beforeEach } from "vitest";
import { PAGES } from "@/lib/pages";
import {
  PAGE_EMBEDS, pageFramesInMenuOrder, renderablePageFrames, catalogSectionId,
} from "@/lib/pageFrames";
import {
  getSelectedComponent, selectComponent, subscribeSelectedComponent,
} from "@/lib/catalogSelection";

describe("pageEmbeds registry", () => {
  it("cobre TODAS as páginas do registry PAGES", () => {
    for (const p of PAGES) {
      if (p.external) continue; // links externos não renderizam em frame
      expect(PAGE_EMBEDS[p.path], `faltou spec para ${p.path}`).toBeDefined();
    }
  });

  it("não tem specs órfãs (fora do registry)", () => {
    const paths = new Set(PAGES.map((p) => p.path));
    for (const key of Object.keys(PAGE_EMBEDS)) {
      expect(paths.has(key), `spec órfã ${key}`).toBe(true);
    }
  });

  it("segue a ordem do menu", () => {
    const ordered = pageFramesInMenuOrder().map((s) => s.path);
    expect(ordered).toEqual(PAGES.filter((p) => !p.external).map((p) => p.path));
  });

  it("a própria página do catálogo tem nota (sem recursão)", () => {
    expect(PAGE_EMBEDS["/componentes"].note).toBeTruthy();
  });

  it("rotas de redirect puro têm nota explicativa", () => {
    expect(PAGE_EMBEDS["/compare"].note).toBeTruthy();
  });

  it("renderizáveis = todas menos as com nota", () => {
    const renderable = renderablePageFrames();
    const internal = PAGES.filter((p) => !p.external);
    expect(renderable.length).toBe(internal.length - 2);
    expect(renderable.every((s) => !s.note)).toBe(true);
  });

  it("toda spec renderizável tem loader", () => {
    for (const s of renderablePageFrames()) {
      expect(typeof s.loader).toBe("function");
    }
  });
});

describe("catalogSectionId", () => {
  it("gera ids estáveis e válidos", () => {
    expect(catalogSectionId("/")).toBe("cat-page-inicial");
    expect(catalogSectionId("/dashboard")).toBe("cat-page-dashboard");
    expect(catalogSectionId("/pipeline-dados")).toBe("cat-page-pipeline-dados");
    expect(catalogSectionId("/design-system")).toBe("cat-page-design-system");
  });

  it("ids são únicos por página", () => {
    const ids = PAGES.map((p) => catalogSectionId(p.path));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("catalogSelection", () => {
  beforeEach(() => selectComponent(null));

  const sel = { file: "components/shared/EmptyState.tsx", pagePath: "shared", pageLabel: "Sistema" };

  it("começa sem seleção", () => {
    expect(getSelectedComponent()).toBeNull();
  });

  it("seleciona e limpa", () => {
    selectComponent(sel);
    expect(getSelectedComponent()?.file).toBe(sel.file);
    selectComponent(null);
    expect(getSelectedComponent()).toBeNull();
  });

  it("notifica subscribers só quando muda", () => {
    let calls = 0;
    const unsub = subscribeSelectedComponent(() => calls++);
    selectComponent(sel);
    selectComponent(sel); // mesma seleção: sem notificação
    expect(calls).toBe(1);
    selectComponent(null);
    expect(calls).toBe(2);
    unsub();
    selectComponent(sel);
    expect(calls).toBe(2);
  });

  it("dispara evento global ao selecionar (sidebar direita reage)", () => {
    let fired = 0;
    const handler = () => fired++;
    window.addEventListener("catalog:select-component", handler);
    selectComponent(sel);
    selectComponent(null);
    window.removeEventListener("catalog:select-component", handler);
    expect(fired).toBe(1); // só quando seleciona (não ao limpar)
  });
});
