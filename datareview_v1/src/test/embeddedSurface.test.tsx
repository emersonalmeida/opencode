import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EmbeddedSurface } from "@/components/shared/EmbeddedSurface";

function renderSurface(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(() => localStorage.clear());

describe("EmbeddedSurface — níveis e modal", () => {
  it("renderiza superfície conhecida com header e conteúdo", () => {
    renderSurface(<EmbeddedSurface id="charts" />);
    expect(screen.getByRole("region", { name: "Componente embutido: Gráficos" })).toBeInTheDocument();
  });

  it("superfície desconhecida mostra erro honesto", () => {
    renderSurface(<EmbeddedSurface id="nao-existe" />);
    expect(screen.getByRole("alert")).toHaveTextContent("Superfície desconhecida");
  });

  it("recolhe para só o header e re-expande (ciclo)", () => {
    renderSurface(<EmbeddedSurface id="activity" />);
    const body = () => document.querySelector("section div.max-h-\\[480px\\]");
    expect(body()).not.toBeNull();
    fireEvent.click(screen.getByLabelText("Recolher Atividade (só título)"));
    expect(body()).toBeNull();
    // Clicar no header cicla collapsed → default (conteúdo volta).
    fireEvent.click(screen.getByLabelText("Expandir Atividade"));
    expect(body()).not.toBeNull();
  });

  it("persiste o nível por superfície", () => {
    const { unmount } = renderSurface(<EmbeddedSurface id="activity" />);
    fireEvent.click(screen.getByLabelText("Recolher Atividade (só título)"));
    unmount();
    renderSurface(<EmbeddedSurface id="activity" />);
    // Re-montou recolhida (nível persistido).
    expect(document.querySelector("section div.max-h-\\[480px\\]")).toBeNull();
  });

  it("abre a superfície em modal e o conteúdo real aparece nele", () => {
    renderSurface(<EmbeddedSurface id="charts" />);
    fireEvent.click(screen.getByLabelText("Abrir Gráficos em tela cheia"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
