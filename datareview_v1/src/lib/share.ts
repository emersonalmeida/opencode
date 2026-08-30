/**
 * Compartilhamento de sessões/artefatos (todo.md P1): exporta UM item
 * (sessão de chat ou geração de IA) como bundle JSON minimalista que pode
 * ser importado em outra instalação sem tocar no resto do localStorage.
 */
import { listSessions, saveSession, type ChatSession } from "@/lib/chatHistoryStore";
import { getGeneration, listGenerations, recordGeneration, type GenerationRecord } from "@/lib/sessionStore";

export type ShareKind = "chat-session" | "generation";

export interface ShareBundle {
  app: "app-intelligence";
  kind: ShareKind;
  version: 1;
  exportedAt: string;
  payload: ChatSession | GenerationRecord;
}

function downloadBundle(bundle: ShareBundle, baseName: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exporta UMA sessão de chat para download. Retorna false se o id não existir. */
export function shareChatSession(id: string): boolean {
  const session = listSessions().find((s) => s.id === id);
  if (!session) return false;
  downloadBundle(
    { app: "app-intelligence", kind: "chat-session", version: 1, exportedAt: new Date().toISOString(), payload: session },
    `chat-${id.slice(0, 8)}`,
  );
  return true;
}

/** Exporta UMA geração de IA para download. Retorna false se o id não existir. */
export function shareGeneration(id: string): boolean {
  const rec = getGeneration(id);
  if (!rec) return false;
  downloadBundle(
    { app: "app-intelligence", kind: "generation", version: 1, exportedAt: new Date().toISOString(), payload: rec },
    `geracao-${id.slice(0, 8)}`,
  );
  return true;
}

export interface ImportResult {
  ok: boolean;
  kind?: ShareKind;
  error?: string;
}

/** Importa um bundle de 1 item: sessão de chat → adiciona; geração → adiciona. */
export function importShareBundle(json: string): ImportResult {
  let bundle: ShareBundle;
  try {
    bundle = JSON.parse(json) as ShareBundle;
  } catch {
    return { ok: false, error: "Arquivo inválido (JSON)" };
  }
  if (bundle.app !== "app-intelligence" || !bundle.kind || typeof bundle.payload !== "object" || bundle.payload == null) {
    return { ok: false, error: "Bundle não é do App Intelligence" };
  }
  if (bundle.kind === "chat-session") {
    const s = bundle.payload as ChatSession;
    if (!s.messages?.length) return { ok: false, error: "Sessão sem mensagens" };
    // nova id local: preserva as mensagens, evita colisão com ids existentes
    saveSession(null, s.messages as ChatSession["messages"], s.selectedAppKeys ?? [], s.origin);
    return { ok: true, kind: "chat-session" };
  }
  if (bundle.kind === "generation") {
    const g = bundle.payload as GenerationRecord;
    if (!g.markdown && !g.summary) return { ok: false, error: "Geração sem conteúdo" };
    // recordGeneration realoca id/timestamp novos — sem colisão com ids locais
    recordGeneration({ ...g });
    return { ok: true, kind: "generation" };
  }
  return { ok: false, error: `Tipo desconhecido: ${bundle.kind}` };
}

/** Lista sessões/importáveis de geração para a UI de importação. */
export function listShareCandidates(): { sessions: ChatSession[]; generations: GenerationRecord[] } {
  return { sessions: listSessions(), generations: listGenerations() };
}
