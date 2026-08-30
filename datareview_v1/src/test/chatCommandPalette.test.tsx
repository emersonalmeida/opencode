/**
 * ChatCommandPalette — catálogo "/" com abas (páginas · componentes ·
 * comandos) e busca. Verifica abertura, filtro e seleção (frase enviada).
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatCommandPalette } from "@/components/shared/ChatCommandPalette";
import { setFeatureFlag } from "@/lib/featureFlags";


function renderPalette(onCommand = vi.fn(), open = true) {
  return {
    onCommand,
    ...render(
      <MemoryRouter>
        <ChatCommandPalette open={open} onOpenChange={() => {}} onCommand={onCommand} />
      </MemoryRouter>,
    ),
  };
}

describe("ChatCommandPalette", () => {
  // Labs são flag-off por padrão (Ondas 1.1 + 2.5) — os testes de listagem
  // ligam as labs explicitamente para comparar com o registry inteiro.
  beforeEach(() => {
    for (const k of ["page.concept", "page.playground", "page.teste", "page.01", "page.nucleo", "page.conversa"]) setFeatureFlag(k, true);
  });

  it("renderiza as 3 abas com contagem", () => {
    renderPalette();
    expect(screen.getByRole("tab", { name: /Páginas/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Componentes/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Comandos/ })).toBeInTheDocument();
  });

  it("lista páginas habilitadas (registry, filtradas por flag)", () => {
    renderPalette();
    expect(screen.getByText("Hub 01")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("clicar numa página emite a frase goto", () => {
    const onCommand = vi.fn();
    renderPalette(onCommand);
    fireEvent.click(screen.getByText("Dashboard"));
    expect(onCommand).toHaveBeenCalledWith("abra a página /dashboard");
  });

  it("aba Componentes lista superfícies embutíveis", () => {
    renderPalette();
    fireEvent.click(screen.getByRole("tab", { name: /Componentes/ }));
    expect(screen.getByText("Gráficos")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
  });

  it("clicar num componente emite a frase show", () => {
    const onCommand = vi.fn();
    renderPalette(onCommand);
    fireEvent.click(screen.getByRole("tab", { name: /Componentes/ }));
    fireEvent.click(screen.getByText("Gráficos"));
    expect(onCommand.mock.calls[0][0]).toMatch(/^exiba /);
  });

  it("aba Comandos lista ações sem IA", () => {
    renderPalette();
    fireEvent.click(screen.getByRole("tab", { name: /Comandos/ }));
    expect(screen.getByText("Ajuda")).toBeInTheDocument();
    expect(screen.getByText("Executar pipeline")).toBeInTheDocument();
  });

  it("busca filtra em tempo real (acento-insensível)", () => {
    renderPalette();
    const input = screen.getByRole("searchbox", { name: /buscar no catálogo/i });
    fireEvent.change(input, { target: { value: "configurac" } });
    expect(screen.queryByText("Hub 01")).not.toBeInTheDocument();
    expect(screen.getByText(/Configura/)).toBeInTheDocument();
  });

  it("busca sem resultado mostra empty state honesto", () => {
    renderPalette();
    const input = screen.getByRole("searchbox", { name: /buscar no catálogo/i });
    fireEvent.change(input, { target: { value: "zzzznada" } });
    expect(screen.getByText("Nenhuma página encontrada.")).toBeInTheDocument();
  });

  it("fechado (open=false) não renderiza conteúdo", () => {
    render(
      <MemoryRouter>
        <ChatCommandPalette open={false} onOpenChange={() => {}} onCommand={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });
});
