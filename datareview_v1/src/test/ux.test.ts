import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  confirmLabel, matchShortcut, shortcutLabel, setDocumentTitle, UX_COPY,
  type ShortcutDef,
} from "@/lib/ux";

function keyEvent(key: string, opts: Partial<KeyboardEvent> = {}, target?: EventTarget): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { key, ...opts });
  if (target) Object.defineProperty(e, "target", { value: target });
  return e;
}

describe("confirmLabel", () => {
  it("gera rótulos consistentes por tipo de ação", () => {
    expect(confirmLabel("excluir", "a conversa")).toContain("Excluir a conversa?");
    expect(confirmLabel("limpar", "o histórico")).toContain("Limpar o histórico?");
    expect(confirmLabel("apagar", "o dataset")).toContain("Apagar o dataset?");
  });

  it("inclui contagem quando fornecida", () => {
    expect(confirmLabel("excluir", "as gerações", 1)).toContain("(1 item)");
    expect(confirmLabel("excluir", "as gerações", 12)).toContain("(12 itens)");
  });

  it("menciona a possibilidade de desfazer", () => {
    expect(confirmLabel("limpar", "tudo")).toContain("Desfazer");
  });
});

describe("matchShortcut", () => {
  const base: ShortcutDef = { key: "d", label: "Ir ao Dashboard", run: () => {} };

  it("casa tecla simples sem modificadores", () => {
    expect(matchShortcut(keyEvent("d"), base)).toBe(true);
    expect(matchShortcut(keyEvent("x"), base)).toBe(false);
  });

  it("exige mod quando definido", () => {
    const s: ShortcutDef = { ...base, key: "k", mod: true };
    expect(matchShortcut(keyEvent("k", { ctrlKey: true }), s)).toBe(true);
    expect(matchShortcut(keyEvent("k", { metaKey: true }), s)).toBe(true);
    expect(matchShortcut(keyEvent("k"), s)).toBe(false);
  });

  it("exige shift quando definido", () => {
    const s: ShortcutDef = { ...base, key: "z", mod: true, shift: true };
    expect(matchShortcut(keyEvent("z", { ctrlKey: true, shiftKey: true }), s)).toBe(true);
    expect(matchShortcut(keyEvent("z", { ctrlKey: true }), s)).toBe(false);
  });

  it("ignora teclas simples quando o foco está em campo de texto", () => {
    const input = document.createElement("input");
    expect(matchShortcut(keyEvent("d", {}, input), base)).toBe(false);
    const ta = document.createElement("textarea");
    expect(matchShortcut(keyEvent("d", {}, ta), base)).toBe(false);
  });

  it("atalhos com mod funcionam mesmo em campo de texto", () => {
    const s: ShortcutDef = { ...base, key: "k", mod: true };
    const input = document.createElement("input");
    expect(matchShortcut(keyEvent("k", { ctrlKey: true }, input), s)).toBe(true);
  });

  it("respeita a guarda when()", () => {
    const s: ShortcutDef = { ...base, when: () => false };
    expect(matchShortcut(keyEvent("d"), s)).toBe(false);
  });
});

describe("shortcutLabel", () => {
  it("formata Ctrl/Cmd conforme a plataforma", () => {
    const s: ShortcutDef = { key: "k", mod: true, label: "Buscar", run: () => {} };
    const label = shortcutLabel(s);
    expect(label === "Ctrl+K" || label === "⌘+K").toBe(true);
  });

  it("inclui Shift e tecla maiúscula", () => {
    const s: ShortcutDef = { key: "z", mod: true, shift: true, label: "Redo", run: () => {} };
    expect(shortcutLabel(s)).toContain("Shift+Z");
  });

  it("tecla de caractere único fica maiúscula", () => {
    const s: ShortcutDef = { key: "?", label: "Ajuda", run: () => {} };
    expect(shortcutLabel(s)).toBe("?");
  });
});

describe("setDocumentTitle", () => {
  beforeEach(() => { document.title = ""; });

  it("usa o título base quando vazio", () => {
    setDocumentTitle();
    expect(document.title).toBe("App Review Intelligence");
  });

  it("prefixa o título da página", () => {
    setDocumentTitle("Dashboard");
    expect(document.title).toBe("Dashboard · App Review Intelligence");
  });

  it("mostra ● quando há tarefa em andamento", () => {
    setDocumentTitle("Chat", { running: true });
    expect(document.title).toBe("● Chat · App Review Intelligence");
  });
});

describe("UX_COPY", () => {
  it("todas as mensagens são acionáveis (verbo de recuperação)", () => {
    expect(UX_COPY.network).toContain("tente novamente");
    expect(UX_COPY.serverDown).toContain("npm run dev:server");
    expect(UX_COPY.aiDisabled).toContain("Configurações");
    expect(UX_COPY.noApps).toContain("Colete");
    expect(UX_COPY.emptyDataset).toContain("Busque");
  });
});
