/**
 * uniOutputLog — log estilo terminal da coleta multi-fonte (aba "Output" da
 * sidebar direita interna da página Uni), inspirado na saída do docs/_uni.py:
 * cabeçalhos de bloco, itens numerados, erros em vermelho, metas em cinza.
 *
 * Duas origens de linhas:
 *  1. SSE `/functions/v1/uni-runs/stream` (eventos do rawStore: start/finish/
 *     progress de TODAS as fontes, em tempo real);
 *  2. `logCollectedItems(...)` local — imprime os itens coletados numerados
 *     (como o _uni.py imprime cada sugestão/paper/post no terminal).
 *
 * Tipos de evento são declarados localmente (espelho do payload SSE) — o
 * rawStore do servidor importa node:fs/crypto e NÃO pode ser importado aqui.
 */
import { useEffect, useState } from "react";
import type { UniItem } from "./types";

// ---------------------------------------------------------------------------
// Tipos (espelho do SSE do servidor)
// ---------------------------------------------------------------------------

export interface RunInfo {
  id: string;
  sourceId: string;
  subjectKey?: string;
  collector: string;
  params: Record<string, unknown>;
  startedAt: number;
  finishedAt?: number;
  status: "running" | "completed" | "failed" | "partial";
  requested?: number;
  yielded?: number;
  errors: { endpoint: string; message: string; at: number }[];
}

export type RunEventPayload =
  | { event: "start" | "finish"; run: RunInfo }
  | { event: "progress"; progress: { runId: string; sourceId: string; message: string; at: number } };

export type OutputLineKind = "header" | "item" | "meta" | "success" | "error" | "progress";

export interface OutputLine {
  id: number;
  ts: number;
  kind: OutputLineKind;
  text: string;
}

// ---------------------------------------------------------------------------
// Formatação (puras, testáveis) — estilo terminal do _uni.py
// ---------------------------------------------------------------------------

export function formatClock(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function paramsSummary(params: Record<string, unknown>): string {
  const keys = ["action", "query", "terms", "q", "vertical", "region", "lang", "timeframe", "gprop", "limit", "subreddit", "site", "url"];
  const parts = keys
    .filter((k) => params[k] != null && params[k] !== "")
    .map((k) => `${k}=${Array.isArray(params[k]) ? (params[k] as unknown[]).join(",") : String(params[k])}`);
  return parts.slice(0, 5).join(" · ");
}

export function runStartLine(run: RunInfo): string {
  const summary = paramsSummary(run.params);
  return `═══ ${run.sourceId.toUpperCase()} ▶ iniciado${summary ? ` — ${summary}` : ""}`;
}

export function runFinishLine(run: RunInfo): string {
  const secs = run.finishedAt ? ((run.finishedAt - run.startedAt) / 1000).toFixed(1) : "?";
  if (run.status === "failed") {
    const msg = run.errors[0]?.message ?? "erro desconhecido";
    return `✗ ${run.sourceId} falhou em ${secs}s — ${msg}`;
  }
  const yielded = run.yielded ?? 0;
  const tag = run.status === "partial" ? "parcial" : "concluído";
  return `✓ ${run.sourceId} ${tag} em ${secs}s — ${yielded} ite${yielded === 1 ? "m" : "ns"}`;
}

export function progressLine(message: string): string {
  return `… ${message}`;
}

/** Linhas numeradas dos itens coletados (como o print_list_numbered do _uni.py). */
export function itemLines(items: UniItem[], startIndex: number, maxLines = 40): string[] {
  return items.slice(0, maxLines).map((item, i) => {
    const n = String(startIndex + i + 1).padStart(2, "0");
    const extra = item.score != null && item.score > 0 ? ` (▲ ${item.score})` : "";
    return `${n}. ${item.title}${extra}`;
  });
}

// ---------------------------------------------------------------------------
// Store pub/sub (padrão useDataset — NÃO useSyncExternalStore com array novo)
// ---------------------------------------------------------------------------

const MAX_LINES = 400;
let lines: OutputLine[] = [];
let nextLineId = 1;
let itemCounter = 0;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function push(kind: OutputLineKind, text: string, ts = Date.now()): void {
  lines = [...lines, { id: nextLineId++, ts, kind, text }].slice(-MAX_LINES);
  notify();
}

export function appendRunEvent(e: RunEventPayload): void {
  if (e.event === "start") {
    itemCounter = 0;
    push("header", runStartLine(e.run), e.run.startedAt);
    return;
  }
  if (e.event === "finish") {
    push(e.run.status === "failed" ? "error" : "success", runFinishLine(e.run), e.run.finishedAt ?? Date.now());
    for (const err of e.run.errors.slice(1)) {
      push("error", `✗ ${err.endpoint}: ${err.message}`, err.at);
    }
    return;
  }
  // strict:false — sem narrowing de union; extrai o progress explicitamente.
  const progress = (e as { event: "progress"; progress: { message: string; at: number } }).progress;
  push("progress", progressLine(progress.message), progress.at);
}

/** Imprime os itens recebidos pelo cliente, numerados como no _uni.py. */
export function logCollectedItems(items: UniItem[]): void {
  if (!items.length) return;
  for (const text of itemLines(items, itemCounter)) {
    itemCounter += 1;
    push("item", text);
  }
  if (items.length > 40) {
    push("meta", `… e mais ${items.length - 40} itens (veja a lista no centro)`);
  }
}

export function logOutputNote(text: string): void {
  push("meta", text);
}

export function clearOutputLog(): void {
  lines = [];
  itemCounter = 0;
  notify();
}

export function subscribeOutputLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useUniOutputLog(): OutputLine[] {
  const [value, setValue] = useState<OutputLine[]>(lines);
  useEffect(() => subscribeOutputLog(() => setValue(lines)), []);
  return value;
}

// ---------------------------------------------------------------------------
// Conexão SSE (singleton de módulo; EventSource reconecta sozinho)
// ---------------------------------------------------------------------------

let eventSource: EventSource | null = null;

export function ensureOutputStream(baseUrl: string): void {
  if (eventSource) return;
  try {
    eventSource = new EventSource(`${baseUrl}/functions/v1/uni-runs/stream`);
    eventSource.onmessage = (msg) => {
      try {
        appendRunEvent(JSON.parse(msg.data) as RunEventPayload);
      } catch {
        // Linha malformada nunca quebra o stream.
      }
    };
    eventSource.onerror = () => {
      // EventSource tenta reconectar automaticamente; loga uma única vez.
      push("meta", "Conexão com o servidor de coleta instável — reconectando…");
    };
  } catch {
    // Ambiente sem EventSource (jsdom) — a aba mostra só o log local.
  }
}

/** Somente para testes: fecha o singleton. */
export function resetOutputStreamForTests(): void {
  eventSource?.close();
  eventSource = null;
}
