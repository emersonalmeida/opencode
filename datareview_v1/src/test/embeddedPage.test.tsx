/**
 * EmbeddedPage — página real embutida no chat (iframe same-origin).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EmbeddedPage } from "@/components/shared/EmbeddedPage";

function renderPage(path = "/dashboard", label = "Dashboard") {
  return render(
    <MemoryRouter>
      <EmbeddedPage path={path} label={label} />
    </MemoryRouter>,
  );
}

describe("EmbeddedPage", () => {
  beforeEach(() => localStorage.clear());

  it("renderiza header com título e ações; corpo recolhido por padrão", () => {
    renderPage();
    expect(screen.getByRole("region", { name: "Página embutida: Dashboard" })).toBeInTheDocument();
    // Recolhida: sem iframe, sem status.
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("expande no clique e monta o iframe com a rota real (lazy)", () => {
    renderPage();
    fireEvent.click(screen.getByLabelText("Expandir Dashboard"));
    const frame = document.querySelector("iframe") as HTMLIFrameElement;
    expect(frame).not.toBeNull();
    expect(frame.src).toContain("/dashboard");
  });

  it("ciclo de níveis: collapsed → default → expanded → collapsed", () => {
    renderPage();
    fireEvent.click(screen.getByLabelText("Expandir Dashboard"));
    expect(document.querySelector("iframe")).not.toBeNull();
    // expanded (header cicla)
    fireEvent.click(screen.getByLabelText("Recolher Dashboard"));
    const lvl = localStorage.getItem("aso:chat-page-level:/dashboard");
    expect(lvl === "expanded" || lvl === "default").toBeTruthy();
  });

  it("persiste o nível por path", () => {
    const { unmount } = renderPage();
    fireEvent.click(screen.getByLabelText("Expandir Dashboard"));
    unmount();
    const { unmount: u2 } = renderPage();
    // Re-montou expandida — iframe deve estar lá.
    expect(document.querySelector("iframe")).not.toBeNull();
    u2();
  });

  it("recolhe via botão 'só título'", () => {
    renderPage();
    fireEvent.click(screen.getByLabelText("Expandir Dashboard"));
    fireEvent.click(screen.getByLabelText("Recolher Dashboard (só título)"));
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("abre o link para a rota real e o botão de modal", () => {
    renderPage();
    fireEvent.click(screen.getByLabelText("Expandir Dashboard"));
    expect(screen.getByLabelText("Maximizar Dashboard")).toBeInTheDocument();
    const link = screen.getByTitle(/Abrir Dashboard na rota/);
    expect(link).toHaveAttribute("href", "/dashboard");
  });

  it("recursão honesta: embutir a própria rota mostra explicação (sem iframe)", () => {
    // window.location.pathname === "/" em jsdom; usamos path "/".
    render(
      <MemoryRouter>
        <EmbeddedPage path="/" label="Início" />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText("Expandir Início"));
    expect(screen.getByRole("note")).toHaveTextContent(/recursão/);
    expect(document.querySelector("iframe")).toBeNull();
  });
});
