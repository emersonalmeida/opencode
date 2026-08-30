/**
 * Testes do ChatComposer — composer de chat padronizado (textarea + ditado
 * por voz + enviar/parar) compartilhado pelas superfícies de chat.
 */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ChatComposer } from "@/components/shared/ChatComposer";

function Harness(props: Partial<Parameters<typeof ChatComposer>[0]>) {
  const [value, setValue] = useState(props.value ?? "");
  return (
    <ChatComposer
      onSend={() => undefined}
      {...props}
      value={value}
      onChange={setValue}
    />
  );
}

describe("ChatComposer", () => {
  it("renderiza textarea + botão enviar; Enter (sem shift) envia", () => {
    const onSend = vi.fn();
    render(<Harness value="olá" onSend={onSend} />);
    const textarea = screen.getByRole("textbox", { name: "Mensagem para a IA" });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSend).toHaveBeenCalledTimes(1);
    // Shift+Enter NÃO envia (quebra de linha).
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("botão enviar desabilitado com input vazio; clique envia com texto", () => {
    const onSend = vi.fn();
    render(<Harness value="" onSend={onSend} />);
    const sendBtn = screen.getByRole("button", { name: "Enviar mensagem" });
    expect((sendBtn as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "teste" } });
    expect((sendBtn as HTMLButtonElement).disabled).toBe(false);
    sendBtn.click();
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("loading + onStop mostra botão Parar (e esconde Enviar)", () => {
    const onStop = vi.fn();
    render(<Harness value="x" loading onStop={onStop} />);
    expect(screen.queryByRole("button", { name: "Enviar mensagem" })).toBeNull();
    screen.getByRole("button", { name: "Parar geração" }).click();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("loading SEM onStop mantém Enviar (superfícies sem cancelamento)", () => {
    render(<Harness value="x" loading />);
    expect(screen.getByRole("button", { name: "Enviar mensagem" })).toBeTruthy();
  });

  it("voice=false esconde o botão de ditado", () => {
    render(<Harness value="x" voice={false} />);
    expect(screen.queryByRole("button", { name: /ditado/i })).toBeNull();
  });

  it("botão de ditado aparece desabilitado quando não há engine STT (jsdom)", () => {
    render(<Harness value="x" />);
    const mic = screen.getByRole("button", { name: "Ditar por voz" });
    expect((mic as HTMLButtonElement).disabled).toBe(true);
  });
});
