/**
 * UiShell (render) — guarda de regressão da estrutura da página UI:
 * barras de status, toolbar, 5 colunas com abas/blocos, footer, colunas
 * inteligentes (auto-collapse), rail funcional com overlays por clique
 * (nunca expande a sidebar), reset para 3 colunas e gavetas no mobile.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UiShell } from "@/components/uiShell/UiShell";
import { resetShell, getUiShellState } from "@/lib/uiShell/store";

function renderUiShell(width = 1400) {
  return render(
    <MemoryRouter>
      <UiShell forceWidth={width} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  resetShell();
});
afterEach(cleanup);

describe("UiShell — estrutura (modo colunas)", () => {
  it("renderiza barras de status, toolbar, 5 regiões e footer", () => {
    renderUiShell(1400);
    expect(screen.getByRole("heading", { name: "UI" })).toBeTruthy();
    expect(screen.getByRole("toolbar", { name: "Ferramentas do layout" })).toBeTruthy();
    for (const label of ["Esquerda externa", "Esquerda interna", "Direita interna", "Direita externa"]) {
      expect(screen.getByRole("complementary", { name: new RegExp(`^Coluna ${label}`) })).toBeTruthy();
    }
    expect(screen.getByRole("main", { name: "Coluna central" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Status do layout" })).toBeTruthy();
    expect(screen.getByRole("status", { name: "Status do rodapé" })).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });

  it("padrão = 3 colunas: externas abertas com abas, internas em rail funcional", () => {
    renderUiShell(1400);
    // externas abertas: strip de 2 abas visível
    expect(screen.getAllByRole("tablist").length).toBeGreaterThanOrEqual(3); // 2 colunas + centro
    expect(screen.getAllByRole("tab")).toBeTruthy();
    // internas em rail: ícones das abas com overlay por clique (sem abrir sidebar)
    const railBtn = screen.getByRole("button", { name: "Abrir Contexto da coluna Esquerda interna em overlay" });
    fireEvent.click(railBtn);
    // abriu um overlay (dialog) e a coluna CONTINUA recolhida (toggle segue aria-expanded=false)
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Expandir coluna Esquerda interna" })).toBeTruthy();
  });

  it("toggle único recolhe/expande; reset volta ao padrão de 3 colunas", () => {
    renderUiShell(1400);
    const collapse = screen.getByRole("button", { name: "Recolher coluna Esquerda externa" });
    fireEvent.click(collapse);
    expect(getUiShellState()["left-outer"].collapsed).toBe(true);
    const expand = screen.getByRole("button", { name: "Expandir coluna Esquerda externa" });
    fireEvent.click(expand);
    expect(getUiShellState()["left-outer"].collapsed).toBe(false);
    // suja o layout e reseta
    fireEvent.click(collapse);
    fireEvent.click(screen.getByRole("button", { name: "Resetar padrão — layout dividido em 3 colunas" }));
    expect(getUiShellState()["left-outer"].collapsed).toBe(false);
    expect(getUiShellState()["left-inner"].collapsed).toBe(true);
  });

  it("colunas inteligentes: sem espaço, a menos importante fecha para rail", () => {
    // 859px: dir-externa (prioridade 3) não cabe (320+260+112+280=972) → rail automático
    renderUiShell(859);
    const rail = screen.getByRole("complementary", { name: /Coluna Direita externa/ });
    expect(rail.getAttribute("data-auto-collapsed")).toBe("true");
  });
});

describe("UiShell — modo overlay (mobile)", () => {
  it("laterais saem do fluxo e abrem como gaveta com Esc/fechar", () => {
    renderUiShell(390);
    expect(screen.queryByRole("complementary")).toBeNull(); // sem colunas inline
    expect(screen.getByRole("main", { name: "Coluna central" })).toBeTruthy();
    // abre a gaveta da esquerda externa pelo botão da toolbar
    fireEvent.click(screen.getByRole("button", { name: "Abrir coluna Esquerda externa" }));
    const dialog = screen.getByRole("dialog", { name: "Coluna Esquerda externa" });
    expect(dialog).toBeTruthy();
    expect(screen.getByRole("tablist", { name: "Abas da coluna Esquerda externa" })).toBeTruthy();
    // Esc fecha
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("UiShell — toolbar Tema + abas do centro", () => {
  it("abas do centro: 3 (Principal, Secundária, Terciária), centralizadas", () => {
    renderUiShell(1400);
    for (const t of ["Principal", "Documentação", "Minhas páginas"]) {
      expect(screen.getByRole("tab", { name: new RegExp(`^${t}$`, "i") })).toBeTruthy();
    }
  });

  it("toolbar tem botão Customizar tema (modos/cor/fonte/motion)", () => {
    renderUiShell(1400);
    const btn = screen.getByRole("button", { name: "Customizar tema" });
    fireEvent.click(btn);
    expect(screen.getByRole("dialog", { name: "Customização de tema" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Modo do tema" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Velocidade das animações" })).toBeTruthy();
  });
});
