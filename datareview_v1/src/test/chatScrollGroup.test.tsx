import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatScrollGroup } from "@/components/shared/ChatScrollGroup";

describe("ChatScrollGroup — container padrão de mensagens", () => {
  it("renderiza mensagens dentro de uma região rolável (log)", () => {
    render(
      <ChatScrollGroup empty={false}>
        <div>msg-1</div>
        <div>msg-2</div>
      </ChatScrollGroup>,
    );
    expect(screen.getByRole("log", { name: "Mensagens da conversa" })).toBeInTheDocument();
    expect(screen.getByText("msg-1")).toBeInTheDocument();
    expect(screen.getByText("msg-2")).toBeInTheDocument();
  });

  it("estado vazio renderiza label (não mensagens)", () => {
    render(
      <ChatScrollGroup empty emptyLabel={<span>Comece a conversar</span>}>
        <div>msg</div>
      </ChatScrollGroup>,
    );
    expect(screen.getByText("Comece a conversar")).toBeInTheDocument();
    expect(screen.queryByText("msg")).not.toBeInTheDocument();
  });

  it("empty clicável quando onEmptyAction é passado (role=button)", () => {
    let clicked = 0;
    render(
      <ChatScrollGroup empty emptyLabel={<span>Vazio</span>} onEmptyAction={() => clicked++}>
        <div>x</div>
      </ChatScrollGroup>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(clicked).toBe(1);
  });

  it("toolbar fixa renderiza no topo do grupo", () => {
    render(
      <ChatScrollGroup toolbar={<span>Filtro: tudo</span>} empty={false}>
        <div>msg</div>
      </ChatScrollGroup>,
    );
    expect(screen.getByText("Filtro: tudo")).toBeInTheDocument();
  });

  it("muitas mensagens (100) renderizam todas (rolagem container, não corte)", () => {
    render(
      <ChatScrollGroup empty={false}>
        {Array.from({ length: 100 }, (_, i) => <div key={i}>m{i}</div>)}
      </ChatScrollGroup>,
    );
    expect(screen.getByText("m0")).toBeInTheDocument();
    expect(screen.getByText("m99")).toBeInTheDocument();
  });

  it("botão 'Recentes' aparece ao subir a rolagem (jump-to-bottom)", () => {
    render(
      <ChatScrollGroup empty={false}>
        {Array.from({ length: 50 }, (_, i) => <div key={i}>m{i}</div>)}
      </ChatScrollGroup>,
    );
    const region = screen.getByRole("log");
    // jsdom: scrollTop precisa ser getter/setter configurável (o hook chama
    // scrollTo() no mount — com valor primitivo o read depois daria errado).
    let top = 0;
    Object.defineProperty(region, "scrollHeight", { value: 5000, configurable: true });
    Object.defineProperty(region, "clientHeight", { value: 300, configurable: true });
    Object.defineProperty(region, "scrollTop", {
      get: () => top,
      set: (v: number) => { top = v; },
      configurable: true,
    });
    fireEvent.scroll(region);
    expect(screen.getByRole("button", { name: /recentes/i })).toBeInTheDocument();
  });
});
