/**
 * AI Output Store — persistência dos conteúdos gerados por IA.
 *
 * Bug que este módulo resolve: antes, os outputs de IA viviam apenas em
 * `useState` das páginas — qualquer reload (ex.: após `git pull` + restart do
 * dev server) apagava da interface tudo que a IA havia gerado. Agora todo
 * output concluído é persistido em localStorage (`aso:ai-outputs:v1`),
 * indexado por uma chave determinística `(section, appKeys)`, e as superfícies
 * reidratam o último output ao montar — regenerar sobrescreve a mesma chave.
 *
 * - `saveAIOutput(section, appKeys, markdown)` — upsert (idempotente).
 * - `getAIOutputFor(section, appKeys)` — último output daquele escopo exato.
 * - `usePersistentAIOutput(section, appKeys)` — [markdown, setters] com
 *   hidratação + persistência automáticas (drop-in para o useState das páginas).
 *
 * Cap: 200 registros / ~3.5MB (LRU — os mais antigos são descartados), pois
 * localStorage costuma ter quota de ~5MB compartilhada com todo o app.
 */
import { useCallback, useEffect, useState } from "react";
import { datasetRevision } from "@/lib/datasetStore";

export interface AIOutputRecord {
  /** chave determinística: `${section}|${appKeys ordenadas}` ou chave custom */
  key: string;
  section: string;
  appKeys: string[];
  markdown: string;
  /** ex.: "local gemma3:12b" — best-effort */
  provenance?: string;
  /** Revisão do dataset na geração (freshness/proveniência). */
  datasetRev?: number;
  updatedAt: number;
}

const STORAGE_KEY = "aso:ai-outputs:v1";
const MAX_RECORDS = 200;
const MAX_TOTAL_CHARS = 3_500_000;

const listeners = new Set<() => void>();
let records: AIOutputRecord[] = [];
let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        records = parsed.filter(
          (r): r is AIOutputRecord =>
            r && typeof r.key === "string" && typeof r.markdown === "string",
        );
      }
    }
  } catch { /* corrupt → começa vazio */ }
}
load();

function persist(): void {
  // LRU: mais antigos primeiro no array; mantém os mais recentes no fim.
  while (records.length > MAX_RECORDS) records.shift();
  let total = records.reduce((s, r) => s + r.markdown.length, 0);
  while (total > MAX_TOTAL_CHARS && records.length > 0) {
    total -= records[0].markdown.length;
    records.shift();
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch { /* quota cheia — descarta o mais antigo e tenta de novo uma vez */
    if (records.length > 1) {
      records.shift();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); } catch { /* ignore */ }
    }
  }
  listeners.forEach((l) => l());
}

/** Chave determinística de um output: seção + conjunto de apps (ordem-insensível). */
export function aiOutputKey(section: string, appKeys: string[]): string {
  return `${section}|${[...appKeys].sort().join(",")}`;
}

/**
 * Upsert do output. Sobrescreve a MESMA chave (regenerar substitui); chaves
 * diferentes coexistem (ex.: summary de apps X,Y e problems de apps X,Y).
 */
export function saveAIOutput(
  section: string,
  appKeys: string[],
  markdown: string,
  provenance?: string,
  customKey?: string,
): AIOutputRecord | null {
  if (!markdown.trim()) return null;
  const key = customKey ?? aiOutputKey(section, appKeys);
  const existing = records.findIndex((r) => r.key === key);
  let datasetRev: number | undefined;
  try { datasetRev = datasetRevision(); } catch { /* storage indisponível */ }
  const rec: AIOutputRecord = {
    key, section, appKeys, markdown, provenance, datasetRev, updatedAt: Date.now(),
  };
  if (existing >= 0) records[existing] = rec;
  else records.push(rec);
  persist();
  return rec;
}

export function getAIOutput(key: string): AIOutputRecord | undefined {
  load();
  return records.find((r) => r.key === key);
}

/** Último output gerado para (seção, conjunto de apps) — usado na reidratação. */
export function getAIOutputFor(section: string, appKeys: string[]): AIOutputRecord | undefined {
  return getAIOutput(aiOutputKey(section, appKeys));
}

export function listAIOutputs(): AIOutputRecord[] {
  load();
  return [...records].reverse(); // newest first
}

export function removeAIOutput(key: string): void {
  load();
  records = records.filter((r) => r.key !== key);
  persist();
}

export function clearAIOutputs(): void {
  records = [];
  persist();
}

export function subscribeAIOutputs(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Hook reativo: todos os outputs (newest first). */
export function useAIOutputs(): AIOutputRecord[] {
  const [, force] = useState(0);
  useEffect(() => subscribeAIOutputs(() => force((n) => n + 1)), []);
  return listAIOutputs();
}

/**
 * Hook drop-in para páginas: [markdown, save] com hidratação do último output
 * persistido para (section, appKeys) e persistência ao salvar. O valor local
 * acompanha o store (se outra superfície regenerar o mesmo escopo, reflete).
 */
export function usePersistentAIOutput(
  section: string,
  appKeys: string[],
): { value: string; save: (markdown: string, provenance?: string) => void; clear: () => void } {
  const key = aiOutputKey(section, appKeys);
  const [, force] = useState(0);
  useEffect(() => subscribeAIOutputs(() => force((n) => n + 1)), []);
  const rec = getAIOutput(key);
  const save = useCallback(
    (markdown: string, provenance?: string) => {
      saveAIOutput(section, appKeys, markdown, provenance);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [section, key],
  );
  const clear = useCallback(() => removeAIOutput(key), [key]);
  return { value: rec?.markdown ?? "", save, clear };
}
