/**
 * Histórico de chats com a IA — persiste sessões de conversa em localStorage
 * (como o histórico de chats do ChatGPT). Cada sessão guarda o título (gerado
 * da 1ª pergunta), as mensagens, os apps selecionados e o timestamp.
 *
 * O store é pub/sub: componentes podem assinar mudanças via `subscribe`.
 */
import type { ChatMessage } from "@/lib/experimentChatApi";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  /** Chaves dos apps selecionados na forma `${store}:${id}` — para restaurar. */
  selectedAppKeys: string[];
  /** Origem da conversa (chat padrão, arquivos, voz) — separa abas no histórico. */
  origin?: "chat" | "files" | "voice";
  createdAt: number;
  updatedAt: number;
}

const KEY = "aso:chat-history:v1";
const MAX_SESSIONS = 100;

type Listener = () => void;
const listeners = new Set<Listener>();

function read(): ChatSession[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(list: ChatSession[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Quota — drop oldest sessions and retry once.
    try {
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
    } catch {
      /* give up */
    }
  }
  listeners.forEach((l) => l());
}

export function listSessions(): ChatSession[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSession(id: string): ChatSession | undefined {
  return read().find((s) => s.id === id);
}

function genId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function deriveTitle(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 48 ? t.slice(0, 48) + "…" : t || "Nova conversa";
}

/** Cria (se preciso) e atualiza uma sessão com as mensagens atuais. */
export function saveSession(
  id: string | null,
  messages: ChatMessage[],
  selectedAppKeys: string[],
  origin?: ChatSession["origin"],
): string {
  const list = read();
  const now = Date.now();
  const firstUser = messages.find((m) => m.role === "user");
  const title = firstUser ? deriveTitle(firstUser.content) : "Nova conversa";
  if (id) {
    const idx = list.findIndex((s) => s.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], title, messages, selectedAppKeys, origin: origin ?? list[idx].origin, updatedAt: now };
      write(list);
      return id;
    }
  }
  const sid = genId();
  list.push({ id: sid, title, messages, selectedAppKeys, origin, createdAt: now, updatedAt: now });
  // Cap to MAX_SESSIONS (drop oldest by updatedAt).
  if (list.length > MAX_SESSIONS) {
    list.sort((a, b) => b.updatedAt - a.updatedAt);
    write(list.slice(0, MAX_SESSIONS));
  } else {
    write(list);
  }
  return sid;
}

export function renameSession(id: string, title: string): void {
  const list = read();
  const idx = list.findIndex((s) => s.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], title: title.trim() || list[idx].title, updatedAt: Date.now() };
  write(list);
}

export function deleteSession(id: string): void {
  write(read().filter((s) => s.id !== id));
}

/** Restaura sessões (ex.: undo de exclusão em lote/individual). */
export function restoreSessions(sessions: ChatSession[]): void {
  const list = read();
  const merged = [...sessions, ...list.filter((s) => !sessions.some((r) => r.id === s.id))];
  write(merged.slice(0, MAX_SESSIONS));
}

export function clearAllSessions(): void {
  write([]);
}

export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
