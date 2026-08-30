/**
 * Prompt overrides — o usuário pode editar o prompt por trás de CADA
 * funcionalidade de IA, sem tocar no código.
 *
 * Modelo: overrides são diretrizes de alta prioridade ANEXADAS ao system
 * prompt do servidor (não substituem metodologia/evidência — segurança).
 * Chaves:
 *  - `"base"` — diretrizes globais, aplicadas a TODAS as chamadas de IA;
 *  - `"section:<id>"` — por seção de análise (ex.: `section:summary`);
 *  - `"chat"` — chats (assistente, copilotos);
 *  - livres — qualquer superfície pode registrar sua própria chave.
 *
 * Persistência: `aso:prompt-overrides:v1`. Pub/sub simples (padrão dos
 * outros stores do projeto).
 */

export interface PromptOverrideTarget {
  key: string;
  label: string;
  description: string;
}

const STORE_KEY = "aso:prompt-overrides:v1";

let overrides: Record<string, string> = load();
const listeners = new Set<() => void>();

function load(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return typeof p === "object" && p !== null ? p : {};
  } catch {
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(overrides));
  } catch { /* quota */ }
}

function notify() {
  listeners.forEach((fn) => {
    try { fn(); } catch { /* listener */ }
  });
}

export function listPromptOverrides(): Record<string, string> {
  return { ...overrides };
}

export function getPromptOverride(key: string): string {
  return (overrides[key] ?? "").trim();
}

export function setPromptOverride(key: string, text: string) {
  const t = text.trim();
  if (!t) {
    const next = { ...overrides };
    delete next[key];
    overrides = next;
  } else {
    overrides = { ...overrides, [key]: t.slice(0, 4000) };
  }
  persist();
  notify();
}

export function clearPromptOverrides() {
  overrides = {};
  persist();
  notify();
}

export function subscribePromptOverrides(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Compõe o `promptOverride` enviado ao servidor: base global + override
 * específico (nesta ordem). Retorna undefined quando não há nenhum — o
 * servidor então não anexa bloco extra.
 */
export function composePromptOverride(specificKey?: string): string | undefined {
  const parts: string[] = [];
  const base = getPromptOverride("base");
  if (base) parts.push(base);
  if (specificKey) {
    const specific = getPromptOverride(specificKey);
    if (specific) parts.push(specific);
  }
  return parts.length > 0 ? parts.join("\n\n") : undefined;
}

/** Hook reativo (padrão useDataset: useState + subscribe). */
import { useEffect, useState } from "react";

export function usePromptOverrides(): Record<string, string> {
  const [o, setO] = useState<Record<string, string>>(listPromptOverrides());
  useEffect(() => subscribePromptOverrides(() => setO(listPromptOverrides())), []);
  return o;
}
