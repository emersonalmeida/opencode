/**
 * page01.test.tsx — blocos verticais (TabsBlock/SplitColumn) e painéis novos
 * da página 01: divisão com divisor a11y, abas com persistência, flags,
 * dados coletados (estado vazio) e artefatos do Pipeline (vazio + com dados).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TabsBlock, SplitColumn } from "@/components/page01/SplitColumn";
import {
  FeatureFlagsPanel, CollectedDataPanel, DataQualityPanel, PipelineArtifactsPanel,
} from "@/components/page01/panels";
import { saveArtifact } from "@/lib/pipeline/artifactStore";

beforeEach(() => localStorage.clear());

describe("TabsBlock", () => {
  const tabs = [
    { id: "a", label: "A", icon: null, content: <p>PAINEL_A</p> },
    { id: "b", label: "B", icon: null, content: <p>PAINEL_B</p> },
  ];

  it("renderiza a strip e o primeiro tab ativo; inativos ficam montados", () => {
    render(<TabsBlock tabs={tabs} storageKey="t1" />);
    expect(screen.getByRole("tablist")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "A" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("PAINEL_B").closest("[role=tabpanel]")?.hasAttribute("hidden")).toBe(true);
  });

  it("troca de aba persiste a escolha e reabre se recolhido", () => {
    render(<TabsBlock tabs={tabs} storageKey="t2" />);
    fireEvent.click(screen.getByRole("button", { name: "Recolher bloco" }));
    expect(screen.queryByText("PAINEL_A")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "B" }));
    expect(screen.getByText("PAINEL_B").closest("[role=tabpanel]")?.hasAttribute("hidden")).toBe(false);
    expect(localStorage.getItem("t2-tab")).toBe("b");
  });
});

describe("SplitColumn", () => {
  it("renderiza os dois blocos + divisor a11y (separator horizontal)", () => {
    render(
      <SplitColumn storageKey="sc1" top={<div>TOPO</div>} bottom={<div>BASE</div>} />,
    );
    expect(screen.getByText("TOPO")).toBeTruthy();
    expect(screen.getByText("BASE")).toBeTruthy();
    const sep = screen.getByRole("separator");
    expect(sep.getAttribute("aria-orientation")).toBe("horizontal");
    expect(sep.getAttribute("aria-valuenow")).toBe("50");
  });

  it("teclado ajusta a razão (ArrowDown aumenta o bloco superior)", () => {
    render(
      <SplitColumn storageKey="sc2" top={<div>TOPO</div>} bottom={<div>BASE</div>} />,
    );
    const sep = screen.getByRole("separator");
    fireEvent.keyDown(sep, { key: "ArrowDown" });
    expect(sep.getAttribute("aria-valuenow")).toBe("54");
    expect(localStorage.getItem("sc2-ratio")).toBe("54");
    fireEvent.keyDown(sep, { key: "ArrowUp", shiftKey: true });
    expect(sep.getAttribute("aria-valuenow")).toBe("44");
  });
});

describe("Painéis da página 01", () => {
  it("FeatureFlagsPanel lista flags com busca e alterna um toggle", () => {
    render(<FeatureFlagsPanel />);
    expect(screen.getByRole("status")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Buscar funcionalidade"), { target: { value: "canvas" } });
    const toggle = screen.getByRole("switch", { name: "Canvas" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(toggle);
    expect(JSON.parse(localStorage.getItem("aso:feature-flags:v1") ?? "{}")["page.canvas"]).toBe(false);
  });

  it("CollectedDataPanel mostra empty-state quando o dataset está vazio", () => {
    render(<MemoryRouter><CollectedDataPanel /></MemoryRouter>);
    expect(screen.getByText(/Nenhum app coletado/)).toBeTruthy();
  });

  it("DataQualityPanel indica falta de dados sem quebrar", () => {
    render(<MemoryRouter><DataQualityPanel /></MemoryRouter>);
    expect(screen.getByText(/Sem dados para validar/)).toBeTruthy();
  });

  it("PipelineArtifactsPanel lista artefatos salvos", () => {
    render(<MemoryRouter><PipelineArtifactsPanel /></MemoryRouter>);
    expect(screen.getByText(/Nada ainda/)).toBeTruthy();
    saveArtifact({
      kind: "facts", stage: "compute", title: "Fatos computados", methodology: "deterministic:facts",
      engine: "deterministic", inputIds: [], appKeys: ["apple:1"], markdown: "## Fatos\nKPIs",
    });
    render(<MemoryRouter><PipelineArtifactsPanel /></MemoryRouter>);
    expect(screen.getAllByText("Fatos computados").length).toBeGreaterThan(0);
  });
});

describe("Página 01 — composição", () => {
  // A página é pesada (13 painéis + chat embutido) — timeout generoso porque
  // sob carga paralela do vitest o render passa fácil de 5s.
  it("Page01 renderiza as 4 strips de abas + chat + bottom bar", { timeout: 20000 }, async () => {
    const { default: Page01 } = await import("@/pages/Page01");
    render(
      <MemoryRouter initialEntries={["/01"]}>
        <Page01 />
      </MemoryRouter>,
    );
    for (const name of ["Coleta", "Config", "Histórico", "Coletados", "Qualidade",
      "IA", "Prompts", "Voz", "Recursos", "Análises", "Pipeline", "Gerações", "Insights"]) {
      expect(screen.getAllByRole("tab", { name }).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole("separator").length).toBe(2);
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    // O chat embutido está presente (header + composer da rota /chat).
    expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
  });
});
