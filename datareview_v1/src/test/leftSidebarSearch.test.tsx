/** Busca do menu da sidebar esquerda: filtra páginas por label/desc/path. */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LeftSidebar } from "@/components/LeftSidebar";
import { setFeatureFlag } from "@/lib/featureFlags";

beforeEach(() => {
  localStorage.clear();
  // Labs são flag-off por padrão (Onda 1.1) — o teste liga explicitamente.
  setFeatureFlag("page.teste", true);
});

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <LeftSidebar collapsed={false} onToggle={() => {}} />
    </MemoryRouter>,
  );
}

describe("LeftSidebar — busca do menu", () => {
  it("renderiza o campo de busca acessível", () => {
    renderSidebar();
    expect(screen.getByRole("search")).toBeTruthy();
    expect(screen.getByLabelText("Buscar página no menu")).toBeTruthy();
  });

  it("filtra páginas por label e mostra contagem de resultados", () => {
    renderSidebar();
    const input = screen.getByLabelText("Buscar página no menu");
    fireEvent.change(input, { target: { value: "dashboard" } });
    expect(screen.getByRole("status").textContent).toContain("resultado");
    expect(screen.getByText("Dashboard")).toBeTruthy();
    // Páginas não relacionadas somem dos resultados
    expect(screen.queryByText("Terminal")).toBeNull();
  });

  it("ignora acentos na busca (configurações → configuracoes)", () => {
    renderSidebar();
    fireEvent.change(screen.getByLabelText("Buscar página no menu"), {
      target: { value: "configurac" },
    });
    expect(screen.getByText("Configurações")).toBeTruthy();
  });

  it("busca por path também funciona", () => {
    renderSidebar();
    fireEvent.change(screen.getByLabelText("Buscar página no menu"), {
      target: { value: "/teste" },
    });
    expect(screen.getByText("Test Center")).toBeTruthy();
  });

  it("empty state honesto quando nada corresponde", () => {
    renderSidebar();
    fireEvent.change(screen.getByLabelText("Buscar página no menu"), {
      target: { value: "xyz-inexistente" },
    });
    expect(screen.getByText(/Nenhuma página corresponde/)).toBeTruthy();
  });

  it("botão limpar e Esc restauram o menu completo", () => {
    renderSidebar();
    const input = screen.getByLabelText("Buscar página no menu");
    fireEvent.change(input, { target: { value: "dashboard" } });
    fireEvent.click(screen.getByLabelText("Limpar busca do menu"));
    expect((input as HTMLInputElement).value).toBe("");
    fireEvent.change(input, { target: { value: "dashboard" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect((input as HTMLInputElement).value).toBe("");
  });
});
