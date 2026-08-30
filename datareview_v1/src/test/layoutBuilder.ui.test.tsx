import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LayoutBuilder from "@/pages/LayoutBuilder";

/**
 * UI da página `/layouts`: o fluxo estrutural (colunas + divisões + linhas
 * topo/rodapé), o binding de componentes reais e o modo Visualizar (tela
 * funcional com dados do dataset) devem funcionar pela interface.
 */
function renderPage() {
  return render(<MemoryRouter initialEntries={["/layouts"]}><LayoutBuilder /></MemoryRouter>);
}

/** Coluna N renderizada como região nomeada (desambigua de botões/blocos). */
function columnRegion(n: number): HTMLElement {
  const regions = screen.getAllByRole("region").filter((el) =>
    new RegExp(`^Coluna ${n}( \\(recolhida\\))?$`).test(el.getAttribute("aria-label") ?? ""),
  );
  if (regions.length !== 1) throw new Error(`coluna ${n} não encontrada (${regions.length})`);
  return regions[0];
}

function columnCount(): number {
  return screen.getAllByRole("region").filter((el) => /^Coluna \d+( \(recolhida\))?$/.test(el.getAttribute("aria-label") ?? "")).length;
}

describe("LayoutBuilder (UI)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza o preset inicial (3 colunas, 5 blocos) e as seções", () => {
    renderPage();
    columnRegion(1);
    columnRegion(2);
    columnRegion(3);
    expect(screen.getAllByText(/Componente expansível/i).length).toBe(5);
    expect(screen.getByRole("button", { name: /Adicionar coluna/i })).toBeTruthy();
    expect(screen.getByText(/Telas & templates salvos/i)).toBeTruthy();
    // device preview aparece no modo Página (visualização)
    fireEvent.click(screen.getByRole("button", { name: /Modo Página/i }));
    const mobile = screen.getByRole("button", { name: /Preview Mobile/i });
    expect(mobile.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(mobile);
    expect(mobile.getAttribute("aria-pressed")).toBe("true");
  });

  it("coluna pode ser dividida horizontalmente (+ 1 bloco) pela UI", () => {
    renderPage();
    const col = columnRegion(2);
    fireEvent.click(within(col).getByRole("button", { name: /Dividir Coluna 2/i }));
    expect(screen.getAllByText(/Componente expansível/i).length).toBe(6);
  });

  it("adicionar coluna + dividir reproduz o fluxo do usuário (4 colunas, 7 blocos)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar coluna/i }));
    const newCol = columnRegion(4);
    fireEvent.click(within(newCol).getByRole("button", { name: /Dividir Coluna 4/i }));
    expect(columnCount()).toBe(4);
    expect(screen.getAllByText(/Componente expansível/i).length).toBe(7);
  });

  it("linhas: adiciona bloco no topo e no rodapé (header + status)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar linha no topo/i }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar linha no rodapé/i }));
    expect(screen.getByRole("region", { name: /Linha do topo/i })).toBeTruthy();
    expect(screen.getByRole("region", { name: /Linha do rodapé/i })).toBeTruthy();
  });

  it("vincula um componente real a um bloco (galeria) e o preview renderiza conteúdo", () => {
    renderPage();
    const col = columnRegion(2);
    // abre a galeria de componentes do bloco
    fireEvent.click(within(col).getByLabelText(/Componente do bloco/i));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByText("KPIs"));
    // sem dados coletados → empty state honesto do componente KPIs
    expect(screen.getByText(/Colete apps para ver KPIs aqui/i)).toBeTruthy();
  });

  it("modo Página renderiza a tela funcional (Tela completa com componentes reais)", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Aplicar preset Tela completa/i }));
    fireEvent.click(screen.getByRole("button", { name: /Modo Página/i }));
    // header (topo) com resumo do escopo + status (rodapé) com IA/ociosidade
    expect(screen.getByText(/Tela customizada/i)).toBeTruthy();
    expect(screen.getByText(/Sistema ocioso|tarefa\(s\) em andamento/i)).toBeTruthy();
    // chat IA presente no centro
    expect(screen.getByLabelText(/Mensagem para a IA/i)).toBeTruthy();
    // busca separada: campo de busca + seção de resultados + seleção
    expect(screen.getByLabelText(/Buscar app nas lojas/i)).toBeTruthy();
    expect(screen.getByText(/Os resultados da busca aparecem aqui/i)).toBeTruthy();
    expect(screen.getByText(/Nenhum app coletado ainda/i)).toBeTruthy();
  });

  it("modo Página: coluna pode ser recolhida (rail) e expandida de volta", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Modo Página/i }));
    const col = columnRegion(1);
    fireEvent.click(within(col).getByRole("button", { name: /Recolher Coluna 1/i }));
    // virou rail
    const rail = screen.getByRole("region", { name: /Coluna 1 \(recolhida\)/i });
    fireEvent.click(within(rail).getByRole("button", { name: /Expandir Coluna 1/i }));
    columnRegion(1);
  });

  it("handles de redimensionamento são acessíveis (role=separator, teclado)", () => {
    renderPage();
    const separators = screen.getAllByRole("separator");
    expect(separators.length).toBeGreaterThanOrEqual(4);
    const first = separators[0];
    expect(first.getAttribute("aria-orientation")).toBeTruthy();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    fireEvent.keyDown(first, { key: "ArrowLeft", shiftKey: true });
  });

  it("recolher/expandir bloco pela UI alterna aria-expanded", () => {
    renderPage();
    const toggle = screen.getAllByRole("button", { name: /Recolher Componente/i })[0];
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(toggle);
    expect(screen.getAllByRole("button", { name: /Expandir Componente/i }).length).toBeGreaterThan(0);
  });

  it("salvar template com linhas + componentes e Visualizar a tela salva", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Aplicar preset Tela completa/i }));
    const input = screen.getByLabelText(/Salvar o canvas atual como/i);
    fireEvent.change(input, { target: { value: "Tela 360" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar template$/i }));
    expect(screen.getByText("Tela 360")).toBeTruthy();
    // Visualizar a tela salva (funcional)
    fireEvent.click(screen.getByRole("button", { name: /Visualizar tela Tela 360/i }));
    expect(screen.getByText(/Tela customizada/i)).toBeTruthy();
  });
});
