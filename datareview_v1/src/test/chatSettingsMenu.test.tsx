/**
 * ChatSettingsMenu — config do CHAT no composer (zoom global, voz,
 * exibição). Ações da resposta ficam no header de cada bloco.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatSettingsMenu } from "@/components/shared/ChatSettingsMenu";
import { getAIOutputSettings } from "@/lib/aiOutputSettings";
import { getVoiceSettings } from "@/lib/voice";

describe("ChatSettingsMenu", () => {
  it("abre/fecha o popover pelo botão", () => {
    render(<ChatSettingsMenu />);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /configurações do chat/i }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /configurações do chat/i }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("ajusta o zoom global da saída de IA", () => {
    render(<ChatSettingsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /configurações do chat/i }));
    fireEvent.click(screen.getByRole("button", { name: "150%" }));
    expect(getAIOutputSettings().fontScale).toBe(150);
  });

  it("alterna voz (STT/autoSpeak/live) por switch acessível", () => {
    render(<ChatSettingsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /configurações do chat/i }));
    const tts = screen.getByRole("switch", { name: /respostas em voz alta/i });
    const before = getVoiceSettings().autoSpeak;
    fireEvent.click(tts);
    expect(getVoiceSettings().autoSpeak).toBe(!before);
  });

  it("mostra o concorrência quando callback é fornecido", () => {
    const cb = vi.fn();
    render(<ChatSettingsMenu onConcurrencyChange={cb} parallel={true} />);
    fireEvent.click(screen.getByRole("button", { name: /configurações do chat/i }));
    expect(screen.getByRole("switch", { name: /gerações paralelas/i })).toBeInTheDocument();
  });

  it("não mostra concorrência sem callback", () => {
    render(<ChatSettingsMenu />);
    fireEvent.click(screen.getByRole("button", { name: /configurações do chat/i }));
    expect(screen.queryByRole("switch", { name: /gerações paralelas/i })).not.toBeInTheDocument();
  });
});
