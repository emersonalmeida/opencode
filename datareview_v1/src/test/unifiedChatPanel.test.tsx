/**
 * UnifiedChatPanel — chat unificado (com e sem IA).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UnifiedChatPanel } from "@/components/shared/UnifiedChatPanel";

// IA desativada por padrão nos testes (modo "none").
vi.mock("@/lib/aiSettings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/aiSettings")>();
  return {
    ...actual,
    useAISettings: () => ({ ...actual.getAISettings(), mode: "none" as const }),
    isAIEnabled: () => false,
    getAISettings: () => ({ ...actual.getAISettings(), mode: "none" as const }),
  };
});

function renderPanel(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function sendMessage(text: string) {
  const input = screen.getByLabelText("Mensagem para a IA");
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyDown(input, { key: "Enter", shiftKey: false });
}

describe("UnifiedChatPanel — sem IA (ações locais)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renderiza empty state com sugestões", () => {
    renderPanel(<UnifiedChatPanel />);
    expect(screen.getByText(/Converse com o sistema/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ajuda" })).toBeInTheDocument();
  });

  it('"exiba os gráficos" renderiza o componente real na conversa', async () => {
    renderPanel(<UnifiedChatPanel />);
    sendMessage("exiba os gráficos");
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /Componente embutido: Gráficos/ })).toBeInTheDocument();
    });
  });

  it('"exiba a página de pipeline" embute o pipeline', async () => {
    renderPanel(<UnifiedChatPanel />);
    sendMessage("exiba a página de pipeline");
    await waitFor(() => {
      expect(screen.getByRole("region", { name: /Componente embutido: Pipeline/ })).toBeInTheDocument();
    });
  });

  it('"ajuda" responde com as capacidades sem IA', async () => {
    renderPanel(<UnifiedChatPanel />);
    sendMessage("ajuda");
    await waitFor(() => {
      expect(screen.getByText(/Posso agir mesmo sem IA/)).toBeInTheDocument();
    });
  });

  it('"gere um relatório" com dataset vazio responde honesto', async () => {
    renderPanel(<UnifiedChatPanel />);
    sendMessage("gere um relatório");
    await waitFor(() => {
      expect(screen.getByText(/dataset está vazio/i)).toBeInTheDocument();
    });
  });

  it("pergunta livre sem IA orienta o usuário (sem quebrar)", async () => {
    renderPanel(<UnifiedChatPanel />);
    sendMessage("qual o sentido da vida?");
    await waitFor(() => {
      expect(screen.getByText(/IA está desativada/)).toBeInTheDocument();
    });
  });

  it("clique numa sugestão dispara a ação", async () => {
    renderPanel(<UnifiedChatPanel />);
    fireEvent.click(screen.getByRole("button", { name: "gere um relatório" }));
    await waitFor(() => {
      expect(screen.getByText(/dataset está vazio/i)).toBeInTheDocument();
    });
  });

  it("mensagem do usuário aparece na conversa", async () => {
    renderPanel(<UnifiedChatPanel />);
    sendMessage("ajuda");
    await waitFor(() => {
      expect(screen.getByText("ajuda")).toBeInTheDocument();
    });
  });

  it("onMessagesChange é chamado a cada atualização", async () => {
    const onChange = vi.fn();
    renderPanel(<UnifiedChatPanel onMessagesChange={onChange} />);
    sendMessage("ajuda");
    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      const last = onChange.mock.calls.at(-1)?.[0];
      expect(last.some((m: { role: string }) => m.role === "assistant")).toBe(true);
    });
  });

  it("welcomeMessage aparece como primeira mensagem", () => {
    renderPanel(<UnifiedChatPanel welcomeMessage="Olá! Como posso ajudar?" />);
    expect(screen.getByText("Olá! Como posso ajudar?")).toBeInTheDocument();
  });
});
