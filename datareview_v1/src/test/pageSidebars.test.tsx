/**
 * PageSidebars — o mecanismo canônico de sidebars INTERNAS (por página).
 * Guarda de regressão: host renderiza a sidebar registrada (título+conteúdo),
 * collapse vira rail, última registrada do mesmo lado vence, e sem shell o
 * <PageSidebar> cai no fallback inline (página nunca quebra).
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import {
  PageSidebarsProvider, PageSidebarHost, PageSidebar,
} from "@/context/PageSidebarsContext";

beforeEach(() => localStorage.clear());

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageSidebarsProvider>
      <PageSidebarHost side="left" />
      <PageSidebarHost side="right" />
      {children}
    </PageSidebarsProvider>
  );
}

describe("PageSidebars — sidebars internas por página", () => {
  it("host renderiza a sidebar registrada com título e conteúdo", () => {
    render(
      <Shell>
        <PageSidebar
          id="p1" side="left" title="Painel da página" storageKey="aso:test-w"
          defaultWidth={280} defaultCollapsed={false} content={<p>conteúdo da página</p>}
        />
      </Shell>,
    );
    expect(screen.getByText("Painel da página")).toBeTruthy();
    expect(screen.getByText("conteúdo da página")).toBeTruthy();
  });

  it("recolhe para rail e expande novamente sem perder a sidebar", () => {
    render(
      <Shell>
        <PageSidebar
          id="p2" side="right" title="Controle" storageKey="aso:test2-w"
          defaultWidth={300} defaultCollapsed={false} railIcons={<span>rail-ação</span>}
          content={<p>corpo</p>}
        />
      </Shell>,
    );
    expect(screen.getByText("corpo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Recolher" }));
    expect(screen.getByText("rail-ação")).toBeTruthy();
    expect(screen.queryByText("corpo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expandir" }));
    expect(screen.getByText("corpo")).toBeTruthy();
  });

  it("lado sem sidebar registrada não ocupa espaço (centro fluido)", () => {
    const { container } = render(
      <Shell>
        <PageSidebar
          id="p3" side="left" title="Apenas esquerda" storageKey="aso:test3-w"
          defaultWidth={280} defaultCollapsed={false} content={<p>x</p>}
        />
      </Shell>,
    );
    const asides = container.querySelectorAll("aside");
    expect(asides.length).toBe(1);
    expect(screen.getByText("Apenas esquerda")).toBeTruthy();
  });

  it("a última sidebar registrada do mesmo lado vence", () => {
    render(
      <Shell>
        <PageSidebar id="a" side="left" title="Primeira" storageKey="aso:a" defaultWidth={200} defaultCollapsed={false} content={<p>a</p>} />
        <PageSidebar id="b" side="left" title="Segunda" storageKey="aso:b" defaultWidth={200} defaultCollapsed={false} content={<p>b</p>} />
      </Shell>,
    );
    expect(screen.getByText("Segunda")).toBeTruthy();
    expect(screen.queryByText("Primeira")).toBeNull();
  });

  it("fallback inline quando não há shell (página renderizada isolada)", () => {
    render(
      <PageSidebar
        id="solo" side="left" title="X" storageKey="aso:solo" defaultWidth={200}
        content={<p>inline fallback</p>}
      />,
    );
    expect(screen.getByText("inline fallback")).toBeTruthy();
  });

  it("railIcons portaled aparecem somente quando recolhida", () => {
    render(
      <Shell>
        <PageSidebar
          id="p6" side="left" title="Tabs" storageKey="aso:t6" defaultWidth={240} defaultCollapsed={false}
          railIcons={<button>ir-aba</button>} content={<p>corpo</p>}
        />
      </Shell>,
    );
    expect(screen.queryByText("ir-aba")).toBeNull(); // expandida: rail oculto
    fireEvent.click(screen.getByRole("button", { name: "Recolher" }));
    expect(screen.getByText("ir-aba")).toBeTruthy();
  });
});
