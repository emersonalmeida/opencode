/**
 * pageTabs.test.tsx — modelo de 5 colunas: PageTabsSidebar (1 sidebar interna
 * com abas) + fallback inline sem provider + integração provider/host.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PageTabsSidebar } from "@/components/PageTabsSidebar";
import { PageSidebar, PageSidebarsProvider, PageSidebarHost } from "@/context/PageSidebarsContext";

describe("PageTabsSidebar — fallback inline (sem provider)", () => {
  it("renderiza todas as abas + conteúdo da primeira por padrão", () => {
    render(
      <PageTabsSidebar
        id="x" side="right" title="Canvas" storageKey="t" icon={null}
        tabs={[
          { id: "a", label: "Canvas", icon: null, content: <p>CONTEUDO_A</p> },
          { id: "b", label: "Terminal", icon: null, content: <p>CONTEUDO_B</p> },
        ]}
      />,
    );
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Canvas" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("CONTEUDO_A")).toBeTruthy();
    // todas ficam montadas (preserva estado), ocultas quando inativas
    const second = screen.getByText("CONTEUDO_B");
    expect(second.closest("[role=tabpanel]")?.hasAttribute("hidden")).toBe(true);
  });

  it("trocar de aba alterna a visibilidade (conteúdo não remonta)", () => {
    render(
      <PageTabsSidebar
        id="x" side="left" title="Teste" storageKey="t" icon={null}
        tabs={[
          { id: "a", label: "A", icon: null, content: <p>PAINEL_A</p> },
          { id: "b", label: "B", icon: null, content: <p>PAINEL_B</p> },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByRole("tab", { name: "B" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("PAINEL_B").closest("[role=tabpanel]")?.hasAttribute("hidden")).toBe(false);
    expect(screen.getByText("PAINEL_A").closest("[role=tabpanel]")?.hasAttribute("hidden")).toBe(true);
  });
});

describe("PageSidebar — fallback inline", () => {
  it("renderiza conteúdo inline marcado com o id quando não há provider", () => {
    const { container } = render(
      <PageSidebar meta={{ id: "m1", side: "left", title: "T", storageKey: "t", defaultWidth: 240 }} content={<p>OK</p>} />,
    );
    expect(container.querySelector("[data-page-sidebar='m1']")).toBeTruthy();
    expect(screen.getByText("OK")).toBeTruthy();
  });
});

describe("PageSidebarsProvider + Host — integração", () => {
  it("o host renderiza a coluna interna com o conteúdo registrado", async () => {
    render(
      <PageSidebarsProvider>
        <PageSidebarHost side="left" />
        <PageSidebar meta={{ id: "mod", side: "left", title: "Módulos", storageKey: "aso:test-w", defaultWidth: 240, defaultCollapsed: false }} content={<p>ARVORE</p>} />
      </PageSidebarsProvider>,
    );
    // registro (efeito) → host monta → portal do conteúdo: 2 renders
    expect(await screen.findByText("Módulos")).toBeTruthy();
    expect(await screen.findByText("ARVORE")).toBeTruthy();
  });
});
