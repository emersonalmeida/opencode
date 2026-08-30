/**
 * Portabilidade de dados — exportar/importar TODO o estado local do sistema
 * (dataset, artefatos, chats, canvas, lab, sessões, configurações) num único
 * arquivo JSON.
 *
 * - `exportAllData()` → string JSON com todas as chaves `aso:*`.
 * - `importAllData(json, mode)` → "merge" (só adiciona chaves ausentes) ou
 *   "replace" (sobrescreve as presentes no arquivo).
 *
 * Segurança: chaves de API da IA (aso:ai-settings) NÃO são exportadas por
 * padrão — credenciais ficam no dispositivo de origem.
 */

const EXPORT_VERSION = 1;

/** Prefixos/chaves exportáveis. Chaves sensíveis ficam de fora. */
const EXPORT_PREFIXES = ["aso:"];
const SENSITIVE_KEYS = new Set(["aso:ai-settings:v1"]);

export interface ExportBundle {
  app: "app-intelligence";
  version: number;
  exportedAt: string;
  /** mapa localStorage key → raw string value */
  data: Record<string, string>;
}

export function listExportableKeys(): string[] {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && EXPORT_PREFIXES.some((p) => k.startsWith(p)) && !SENSITIVE_KEYS.has(k)) {
      keys.push(k);
    }
  }
  return keys.sort();
}

export function exportAllData(): string {
  return exportSelectedData(listExportableKeys());
}

/** Exporta um SUBCONJUNTO de chaves como bundle JSON (mesmo formato do full). */
export function exportSelectedData(keys: string[]): string {
  const data: Record<string, string> = {};
  for (const k of keys) {
    if (SENSITIVE_KEYS.has(k)) continue;
    const v = localStorage.getItem(k);
    if (v != null) data[k] = v;
  }
  const bundle: ExportBundle = {
    app: "app-intelligence",
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
  return JSON.stringify(bundle, null, 2);
}

export function downloadExport(): void {
  downloadExportSelected(listExportableKeys(), "app-intelligence-backup");
}

/** Baixa um backup JSON contendo apenas as chaves selecionadas. */
export function downloadExportSelected(keys: string[], baseName = "app-intelligence-selecao"): void {
  const json = exportSelectedData(keys);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${baseName}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Conta as chaves de um bundle SEM importar (pré-visualização do upload). */
export function inspectBackup(json: string): { ok: boolean; keys: number; error?: string } {
  try {
    const bundle = JSON.parse(json) as ExportBundle;
    if (bundle.app !== "app-intelligence" || typeof bundle.data !== "object" || !bundle.data) {
      return { ok: false, keys: 0, error: "Formato de backup não reconhecido" };
    }
    return { ok: true, keys: Object.keys(bundle.data).length };
  } catch {
    return { ok: false, keys: 0, error: "Arquivo não é um JSON válido" };
  }
}

export interface ImportResult {
  ok: boolean;
  imported: number;
  skipped: number;
  error?: string;
}

export function importAllData(json: string, mode: "merge" | "replace"): ImportResult {
  let bundle: ExportBundle;
  try {
    bundle = JSON.parse(json);
  } catch {
    return { ok: false, imported: 0, skipped: 0, error: "Arquivo não é um JSON válido" };
  }
  if (bundle.app !== "app-intelligence" || typeof bundle.data !== "object" || !bundle.data) {
    return { ok: false, imported: 0, skipped: 0, error: "Formato de backup não reconhecido" };
  }
  let imported = 0;
  let skipped = 0;
  for (const [key, value] of Object.entries(bundle.data)) {
    if (typeof value !== "string" || SENSITIVE_KEYS.has(key)) {
      skipped++;
      continue;
    }
    if (mode === "merge" && localStorage.getItem(key) != null) {
      skipped++;
      continue;
    }
    try {
      localStorage.setItem(key, value);
      imported++;
    } catch {
      skipped++;
    }
  }
  return { ok: true, imported, skipped };
}
