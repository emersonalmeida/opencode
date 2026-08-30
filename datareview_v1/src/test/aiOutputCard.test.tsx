import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { setAIMode } from "@/lib/aiSettings";

// Mock do stream de IA: captura o prompt e permite simular tokens/erro.
const streamMock = vi.fn();
vi.mock("@/lib/experimentChatApi", () => ({
  streamExperimentChat: (...args: unknown[]) => streamMock(...args),
}));

beforeEach(() => {
  localStorage.clear();
  streamMock.mockReset();
  delete (window as unknown as Record<string, unknown>).speechSynthesis;
  // O default do sistema é SEM IA (mode "none") — estes testes exercitam
  // superfícies de IA, então ativam explicitamente.
  setAIMode("local");
});

describe("AIOutputCard — níveis de expansão", () => {
  it("nasce EXPANDIDO por padrão (conteúdo completo, sem scroll interno)", () => {
    const { container } = render(<AIOutputCard title="Análise" content="# Olá mundo" />);
    expect(screen.getByText(/Olá mundo/)).toBeInTheDocument();
    const region = screen.getByRole("region", { name: "Conteúdo de Análise" });
    expect(region.className).not.toContain("max-h-72");
    void container;
  });

  it("respeita defaultLevel='collapsed'", () => {
    render(<AIOutputCard title="Análise" content="# Olá" defaultLevel="collapsed" />);
    expect(screen.queryByRole("region", { name: "Conteúdo de Análise" })).not.toBeInTheDocument();
  });

  it("botão de ciclo colapsa e reabre", () => {
    render(<AIOutputCard title="Análise" content="# Olá" />);
    fireEvent.click(screen.getByLabelText("Recolher (só título)"));
    expect(screen.queryByRole("region", { name: "Conteúdo de Análise" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Expandir"));
    expect(screen.getByRole("region", { name: "Conteúdo de Análise" })).toBeInTheDocument();
  });

  it("persiste o nível quando storageKey é passado", () => {
    render(<AIOutputCard title="Análise" content="# Olá" storageKey="teste" />);
    fireEvent.click(screen.getByLabelText("Recolher (só título)"));
    expect(localStorage.getItem("aso:ai-output-level:teste")).toBe("collapsed");
  });

  it("streaming força expansão mesmo com nível 'default' persistido", () => {
    localStorage.setItem("aso:ai-output-level:stream", "default");
    render(<AIOutputCard title="Análise" content="parcial" streaming storageKey="stream" />);
    const region = screen.getByRole("region", { name: "Conteúdo de Análise" });
    expect(region.className).not.toContain("max-h-72");
    expect(screen.getByRole("status", { name: "Status da geração" })).toHaveTextContent(/Gerando há/);
  });
});

describe("AIOutputCard — comportamento geral", () => {
  it("não renderiza nada sem conteúdo e sem streaming", () => {
    const { container } = render(<AIOutputCard title="Vazio" content="" />);
    expect(container.firstChild).toBeNull();
  });

  it("mostra placeholder de streaming sem conteúdo", () => {
    render(<AIOutputCard title="Análise" content="" streaming />);
    expect(screen.getByRole("status", { name: "Status da geração" })).toHaveTextContent(/Aguardando IA/);
  });

  it("mostra contagem de palavras no cabeçalho", () => {
    render(<AIOutputCard title="Análise" content="um dois três quatro" />);
    expect(screen.getByTitle(/4 palavras · 19 caracteres/)).toBeInTheDocument();
  });

  it("barra de status mostra métricas finais (tokens, palavras, tempo de leitura)", () => {
    render(<AIOutputCard title="Análise" content="um dois três quatro" />);
    const status = screen.getByRole("status", { name: "Métricas do conteúdo" });
    expect(status).toHaveTextContent(/~\d+ tokens/);
    expect(status).toHaveTextContent(/4 palavras/);
    expect(status).toHaveTextContent(/leitura ~1 min/);
  });

  it("controles de escala (A−/%/A+) ajustam e resetam", () => {
    render(<AIOutputCard title="Análise" content="texto" storageKey="escala" />);
    const region = screen.getByRole("region", { name: "Conteúdo de Análise" });
    const zoomOf = () => (region.firstChild as HTMLElement).style.zoom;
    expect(zoomOf()).toBe("1.25");
    fireEvent.click(screen.getByLabelText("Aumentar fonte do conteúdo"));
    expect(screen.getByLabelText(/Tamanho do texto 150%/)).toBeInTheDocument();
    expect(zoomOf()).toBe("1.5");
    // reset (% button) volta ao padrão global (125%)
    fireEvent.click(screen.getByLabelText(/Tamanho do texto 150%\. Redefinir/));
    expect(zoomOf()).toBe("1.25");
    fireEvent.click(screen.getByLabelText("Diminuir fonte do conteúdo"));
    expect(zoomOf()).toBe("1");
  });

  it("abre e fecha o fullscreen", () => {
    render(<AIOutputCard title="Análise" content="# Grande" />);
    fireEvent.click(screen.getByLabelText("Maximizar conteúdo"));
    expect(screen.getByRole("dialog", { name: /em tela cheia/ })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Fechar tela cheia"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("modo bare: recolhido mostra contagem de caracteres e expande ao clicar", () => {
    render(<AIOutputCard bare content="texto qualquer" defaultLevel="collapsed" />);
    const btn = screen.getByText(/Conteúdo recolhido/);
    fireEvent.click(btn);
    expect(screen.getByText(/texto qualquer/)).toBeInTheDocument();
  });

  it("botão regenerar dispara callback", () => {
    let called = 0;
    render(<AIOutputCard title="Análise" content="x" onRegenerate={() => called++} />);
    fireEvent.click(screen.getByLabelText("Regenerar análise"));
    expect(called).toBe(1);
  });
});

describe("AIOutputCard — auto-follow com scroll livre", () => {
  const wheel = (deltaY: number) =>
    fireEvent(document, new WheelEvent("wheel", { deltaY, bubbles: true }));

  it("rolar para cima durante o streaming pausa o auto-follow (chip aparece)", () => {
    render(<AIOutputCard title="Análise" content="parcial" streaming />);
    expect(screen.queryByLabelText(/Acompanhar a geração/)).not.toBeInTheDocument();
    wheel(-120);
    expect(screen.getByLabelText(/Acompanhar a geração/)).toBeInTheDocument();
  });

  it("clicar no chip retoma o auto-follow (chip some)", () => {
    render(<AIOutputCard title="Análise" content="parcial" streaming />);
    wheel(-120);
    const chip = screen.getByLabelText(/Acompanhar a geração/);
    fireEvent.click(chip);
    expect(screen.queryByLabelText(/Acompanhar a geração/)).not.toBeInTheDocument();
  });

  it("rolar até o fim retoma o auto-follow automaticamente", () => {
    render(<AIOutputCard title="Análise" content="parcial" streaming />);
    wheel(-120);
    expect(screen.getByLabelText(/Acompanhar a geração/)).toBeInTheDocument();
    // jsdom: getBoundingClientRect = zeros → endRef visível (top 0 ≤ innerHeight+120)
    wheel(120);
    expect(screen.queryByLabelText(/Acompanhar a geração/)).not.toBeInTheDocument();
  });

  it("não mostra chip fora do streaming nem quando followStreaming=false", () => {
    const { rerender } = render(<AIOutputCard title="A" content="x" streaming />);
    wheel(-120);
    rerender(<AIOutputCard title="A" content="x" />); // streaming acabou
    expect(screen.queryByLabelText(/Acompanhar a geração/)).not.toBeInTheDocument();
  });
});

describe("AIOutputCard — leitura em voz alta (TTS)", () => {
  it("NÃO mostra botão Ouvir quando o navegador não suporta TTS", () => {
    render(<AIOutputCard title="Análise" content="texto" />);
    expect(screen.queryByRole("group", { name: "Leitura em voz alta" })).not.toBeInTheDocument();
  });

  it("mostra Ouvir + Configurações de voz quando TTS é suportado", () => {
    Object.defineProperty(window, "speechSynthesis", {
      value: { speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), getVoices: () => [] },
      configurable: true,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class { constructor(public text: string) {} },
      configurable: true,
    });
    render(<AIOutputCard title="Análise" content="texto" />);
    expect(screen.getByLabelText("Ouvir em voz alta")).toBeInTheDocument();
    expect(screen.getByLabelText("Configurações de voz")).toBeInTheDocument();
  });

  it("clicar em Ouvir inicia a fala (speechSynthesis.speak) e vira Pausar", () => {
    // Navegador COM vozes → engine "auto" fala via speechSynthesis.
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(),
        getVoices: () => [{ voiceURI: "v1", name: "Voz PT", lang: "pt-BR", default: true, localService: true }],
      },
      configurable: true,
    });
    Object.defineProperty(window, "SpeechSynthesisUtterance", {
      value: class { constructor(public text: string) {} },
      configurable: true,
    });
    render(<AIOutputCard title="Análise" content="texto falável" />);
    fireEvent.click(screen.getByLabelText("Ouvir em voz alta"));
    expect(window.speechSynthesis.speak).toHaveBeenCalled();
    expect(screen.getByLabelText("Pausar leitura em voz alta")).toBeInTheDocument();
    expect(screen.getByLabelText("Parar leitura em voz alta")).toBeInTheDocument();
  });

  it("modo bare também oferece Ouvir (bolhas de chat)", () => {
    Object.defineProperty(window, "speechSynthesis", {
      value: { speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), getVoices: () => [] },
      configurable: true,
    });
    render(<AIOutputCard bare content="texto" />);
    expect(screen.getByLabelText("Ouvir em voz alta")).toBeInTheDocument();
  });

  it("speak={false} oculta os controles de voz", () => {
    Object.defineProperty(window, "speechSynthesis", {
      value: { speak: vi.fn(), cancel: vi.fn(), pause: vi.fn(), resume: vi.fn(), getVoices: () => [] },
      configurable: true,
    });
    render(<AIOutputCard title="Análise" content="texto" speak={false} />);
    expect(screen.queryByRole("group", { name: "Leitura em voz alta" })).not.toBeInTheDocument();
  });
});

describe("AIOutputCard — IA analisa IA", () => {
  it("botão Analisar com IA chama o stream com o conteúdo no prompt", async () => {
    streamMock.mockImplementation((_scope: unknown, _msgs: unknown, handlers: { onDone: (t: string) => void }) => {
      handlers.onDone("## Auditoria\nOk.");
      return Promise.resolve();
    });
    render(<AIOutputCard title="Análise" content="A nota média é 4.2." />);
    fireEvent.click(screen.getByLabelText("Analisar esta resposta com IA"));
    await waitFor(() => expect(streamMock).toHaveBeenCalled());
    const [, msgs] = streamMock.mock.calls[0];
    expect(String(msgs[0].content)).toContain("A nota média é 4.2.");
    expect(String(msgs[0].content)).toContain("RESPOSTA A ANALISAR");
  });

  it("resultado da análise aparece em card aninhado (sem botão de análise próprio)", async () => {
    streamMock.mockImplementation((_scope: unknown, _msgs: unknown, handlers: { onDone: (t: string) => void }) => {
      handlers.onDone("## Veredito\nConfiabilidade alta.");
      return Promise.resolve();
    });
    render(<AIOutputCard title="Análise" content="Resposta original." />);
    fireEvent.click(screen.getByLabelText("Analisar esta resposta com IA"));
    await waitFor(() => expect(screen.getByText(/Confiabilidade alta/)).toBeInTheDocument());
    // aninhado não oferece nova análise (sem recursão)
    expect(screen.getAllByLabelText("Analisar esta resposta com IA")).toHaveLength(1);
  });

  it("analyzeWithAI={false} oculta o botão", () => {
    render(<AIOutputCard title="Análise" content="texto" analyzeWithAI={false} />);
    expect(screen.queryByLabelText("Analisar esta resposta com IA")).not.toBeInTheDocument();
  });

  it("modo bare não mostra o botão de análise (bolhas de chat)", () => {
    render(<AIOutputCard bare content="texto" />);
    expect(screen.queryByLabelText("Analisar esta resposta com IA")).not.toBeInTheDocument();
  });
});
