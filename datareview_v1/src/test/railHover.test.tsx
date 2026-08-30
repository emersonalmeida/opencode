/**
 * RailHover + rails recolhidos — guarda de regressão do comportamento:
 * tooltip no hover (sem Radix/pointer events), flyout com conteúdo real,
 * hover-intent (entrar no flyout mantém aberto), Esc fecha, clique seleciona.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Sparkles } from "lucide-react";
import { RailHover } from "@/components/shared/RailHover";
import { SidebarTabRail } from "@/components/shared/SidebarTabStrip";

const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("RailHover (tooltip)", () => {
  it("abre tooltip no hover e fecha ao sair", () => {
    render(
      <RailHover side="right" label="Expandir" description="Menu de páginas"
        trigger={<button aria-label="expand">E</button>} />,
    );
    const btn = screen.getByRole("button", { name: "expand" });
    fireEvent.mouseEnter(btn);
    tick(200);
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Expandir");
    expect(tip).toHaveTextContent("Menu de páginas");
    fireEvent.mouseLeave(btn);
    tick(300);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("abre no foco de teclado (a11y)", () => {
    render(<RailHover side="left" label="Aba X" trigger={<button aria-label="x">X</button>} />);
    fireEvent.focus(screen.getByRole("button", { name: "x" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Aba X");
  });
});

describe("RailHover (flyout)", () => {
  it("abre painel flutuante com o conteúdo real no hover", () => {
    render(
      <RailHover side="right" label="Apps" content={<div>CONTEÚDO-ABA</div>}
        trigger={<button aria-label="apps">A</button>} />,
    );
    fireEvent.mouseEnter(screen.getByRole("button", { name: "apps" }));
    tick(300);
    const dialog = screen.getByRole("dialog", { name: "Apps" });
    expect(dialog).toHaveTextContent("CONTEÚDO-ABA");
  });

  it("hover-intent: entrar no flyout mantém aberto; sair fecha; Esc fecha", () => {
    render(
      <RailHover side="right" label="Apps" content={<div>CONTEÚDO-ABA</div>}
        trigger={<button aria-label="apps">A</button>} />,
    );
    const btn = screen.getByRole("button", { name: "apps" });
    fireEvent.mouseEnter(btn);
    tick(300);
    const dialog = screen.getByRole("dialog");
    // sai do gatilho mas entra no painel → continua aberto
    fireEvent.mouseLeave(btn);
    fireEvent.mouseEnter(dialog);
    tick(400);
    expect(screen.getByRole("dialog")).toBeTruthy();
    // sai do painel → fecha
    fireEvent.mouseLeave(dialog);
    tick(300);
    expect(screen.queryByRole("dialog")).toBeNull();
    // Esc fecha
    fireEvent.mouseEnter(btn);
    tick(300);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("SidebarTabRail", () => {
  const tabs = [
    { id: "a", label: "Apps", icon: <Sparkles /> },
    { id: "b", label: "Chats", icon: <Sparkles /> },
  ];

  it("tooltip por item no hover (sem flyout configurado)", () => {
    render(<SidebarTabRail tabs={tabs} onSelect={() => {}} />);
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Abrir Chats" }));
    tick(200);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Chats");
  });

  it("flyout por aba + clique seleciona a aba", () => {
    const onSelect = vi.fn();
    render(
      <SidebarTabRail tabs={tabs} onSelect={onSelect}
        renderFlyout={(t) => <div>FLYOUT-{t.id}</div>} />,
    );
    const btn = screen.getByRole("button", { name: "Abrir Apps" });
    fireEvent.mouseEnter(btn);
    tick(300);
    expect(screen.getByRole("dialog", { name: "Apps" })).toHaveTextContent("FLYOUT-a");
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledWith("a");
  });
});

describe("RailHover (openOnClick — rail funcional sem expandir a sidebar)", () => {
  it("clique no gatilho abre o flyout; clique de novo fecha; hover NÃO abre", () => {
    render(
      <RailHover side="right" openOnClick label="Aba 1" content={<div>BLOCOS-ABA</div>}
        trigger={<button aria-label="aba1">1</button>} />,
    );
    const btn = screen.getByRole("button", { name: "aba1" });
    fireEvent.mouseEnter(btn);
    tick(300);
    expect(screen.queryByRole("dialog")).toBeNull(); // hover não abre no modo clique
    fireEvent.click(btn);
    expect(screen.getByRole("dialog", { name: "Aba 1" })).toHaveTextContent("BLOCOS-ABA");
    fireEvent.click(btn);
    tick(50);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("fecha ao clicar fora (gatilho e painel preservados)", () => {
    render(
      <div>
        <RailHover side="right" openOnClick label="Aba 2" content={<button>interno</button>}
          trigger={<button aria-label="aba2">2</button>} />
        <button aria-label="fora">fora</button>
      </div>,
    );
    fireEvent.click(screen.getByRole("button", { name: "aba2" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    // clique DENTRO do painel não fecha
    fireEvent.pointerDown(screen.getByRole("button", { name: "interno" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    // clique fora fecha
    fireEvent.pointerDown(screen.getByRole("button", { name: "fora" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("modo clique tem botão Fechar no header do flyout", () => {
    render(
      <RailHover side="left" openOnClick label="Painel" content={<div>x</div>}
        trigger={<button aria-label="p">P</button>} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "p" }));
    const close = screen.getByRole("button", { name: "Fechar" });
    fireEvent.click(close);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
