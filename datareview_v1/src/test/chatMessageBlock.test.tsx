import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChatMessageBlock } from "@/components/shared/ChatMessageBlock";

vi.mock("@/lib/experimentChatApi", () => ({
  streamExperimentChat: vi.fn(),
}));

function renderBlock(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(() => {
  localStorage.clear();
});

describe("ChatMessageBlock — estrutura header/conteúdo/status", () => {
  it("mensagem do usuário: header com 'Você', badge de origem e conteúdo", () => {
    renderBlock(<ChatMessageBlock role="user" content="analise o nubank" />);
    expect(screen.getByRole("article", { name: "Mensagem de Você" })).toBeInTheDocument();
    expect(screen.getByText("Você")).toBeInTheDocument();
    expect(screen.getByText("analise o nubank")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Conteúdo da mensagem: Você" })).toBeInTheDocument();
  });

  it("mensagem da assistente: header com 'Assistente' e AIOutputCard dentro", () => {
    renderBlock(<ChatMessageBlock role="assistant" content="# Resposta\n\nTudo certo." />);
    expect(screen.getByRole("article", { name: "Mensagem de Assistente" })).toBeInTheDocument();
    expect(screen.getByText("Assistente")).toBeInTheDocument();
    expect(screen.getByText(/Tudo certo/)).toBeInTheDocument();
  });

  it("blocos são independentes: user e assistant são articles separados", () => {
    renderBlock(
      <>
        <ChatMessageBlock role="user" content="pergunta um" />
        <ChatMessageBlock role="assistant" content="resposta um" />
        <ChatMessageBlock role="user" content="pergunta dois" />
      </>,
    );
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(3);
    expect(articles[0].dataset.role).toBe("user");
    expect(articles[1].dataset.role).toBe("assistant");
  });
});

describe("ChatMessageBlock — níveis de expansão", () => {
  it("recolhe e expande pelo header (ciclo)", () => {
    renderBlock(<ChatMessageBlock role="user" content="texto longo aqui" />);
    fireEvent.click(screen.getByLabelText("Recolher mensagem: Você"));
    expect(screen.queryByText("texto longo aqui")).not.toBeInTheDocument();
    expect(screen.getByText(/Mensagem recolhida/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Expandir"));
    expect(screen.getByText("texto longo aqui")).toBeInTheDocument();
  });

  it("persiste o nível com storageKey", () => {
    const { unmount } = renderBlock(
      <ChatMessageBlock role="assistant" content="conteúdo" storageKey="t1" />,
    );
    fireEvent.click(screen.getByLabelText("Recolher mensagem: Assistente"));
    unmount();
    renderBlock(<ChatMessageBlock role="assistant" content="conteúdo" storageKey="t1" />);
    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument();
  });

  it("streaming força nível expandido", () => {
    renderBlock(
      <ChatMessageBlock role="assistant" content="parcial" streaming defaultLevel="collapsed" />,
    );
    expect(screen.getByText(/parcial/)).toBeInTheDocument();
  });
});

describe("ChatMessageBlock — ações", () => {
  it("usuário: copiar mensagem", () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: write } });
    renderBlock(<ChatMessageBlock role="user" content="copie isso" />);
    fireEvent.click(screen.getByLabelText("Copiar sua mensagem"));
    expect(write).toHaveBeenCalledWith("copie isso");
  });

  it("usuário: reenviar chama onResend com o texto", () => {
    const onResend = vi.fn();
    renderBlock(<ChatMessageBlock role="user" content="de novo" onResend={onResend} />);
    fireEvent.click(screen.getByLabelText("Reenviar esta mensagem"));
    expect(onResend).toHaveBeenCalledWith("de novo");
  });

  it("assistente: regenerar chama onRegenerate", () => {
    const onRegenerate = vi.fn();
    renderBlock(<ChatMessageBlock role="assistant" content="resp" onRegenerate={onRegenerate} />);
    fireEvent.click(screen.getByLabelText("Regenerar resposta"));
    expect(onRegenerate).toHaveBeenCalled();
  });

  it("abre a mensagem em modal (tela cheia) e fecha", () => {
    renderBlock(<ChatMessageBlock role="user" content="conteúdo da mensagem" />);
    fireEvent.click(screen.getByLabelText("Abrir mensagem em tela cheia"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document.body, { key: "Escape" });
  });
});

describe("ChatMessageBlock — superfície embutida", () => {
  it("renderiza componente real (EmbeddedSurface) dentro do bloco", () => {
    renderBlock(
      <ChatMessageBlock role="assistant" content="" surfaceId="charts" surfaceLabel="Gráficos" />,
    );
    expect(
      screen.getByRole("region", { name: "Componente embutido: Gráficos" }),
    ).toBeInTheDocument();
  });

  it("recolhido com superfície mostra o rótulo do componente", () => {
    renderBlock(
      <ChatMessageBlock
        role="assistant" content="" surfaceId="charts" surfaceLabel="Gráficos"
        defaultLevel="collapsed"
      />,
    );
    expect(screen.getByText(/Componente recolhido: Gráficos/)).toBeInTheDocument();
  });
});

describe("ChatMessageBlock — quick replies", () => {
  const chips = ["Resuma em 3 pontos", "Quais as evidências disso?"];

  it("renderiza chips na última resposta e clique dispara onQuickReply", () => {
    const onQuickReply = vi.fn();
    renderBlock(
      <ChatMessageBlock role="assistant" content="resposta longa da IA" quickReplies={chips} onQuickReply={onQuickReply} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Resuma em 3 pontos" }));
    expect(onQuickReply).toHaveBeenCalledWith("Resuma em 3 pontos");
  });

  it("em streaming NÃO mostra chips (a resposta ainda está gerando)", () => {
    renderBlock(
      <ChatMessageBlock role="assistant" content="parcial" streaming quickReplies={chips} onQuickReply={() => {}} />,
    );
    expect(screen.queryByText("Próximo passo:")).not.toBeInTheDocument();
  });

  it("mensagem do usuário nunca mostra chips", () => {
    renderBlock(
      <ChatMessageBlock role="user" content="pergunta" quickReplies={chips} onQuickReply={() => {}} />,
    );
    expect(screen.queryByText("Próximo passo:")).not.toBeInTheDocument();
  });

  it("sem onQuickReply não renderiza o footer (evita chips mortos)", () => {
    renderBlock(<ChatMessageBlock role="assistant" content="resposta" quickReplies={chips} />);
    expect(screen.queryByText("Próximo passo:")).not.toBeInTheDocument();
  });
});
