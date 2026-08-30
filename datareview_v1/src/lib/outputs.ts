/**
 * Inventário de outputs — varredura de todo o armazenamento local do sistema
 * (chaves `aso:*` no localStorage), agrupada por natureza do dado:
 *   - base:     dados coletados (apps + reviews)
 *   - noai:     gerados sem IA / determinísticos (cache, artefatos de fatos)
 *   - ia:       gerados com IA (análises, insights, sessões, findings)
 *   - projetos: arquivos/projetos criados (canvas, design, decks, jornada)
 *   - sistema:  configurações e personalização
 *
 * Cada entrada tem tamanho em bytes (UTF-16 → aproximação por length*2 não;
 * usamos Blob().size para bytes reais UTF-8), contagem de itens quando o
 * valor é um array/objeto JSON, e ações de exportar/apagar por chave.
 */

export type OutputGroupId = "base" | "noai" | "ia" | "projetos" | "sistema" | "outros";

export interface OutputGroup {
  id: OutputGroupId;
  label: string;
  description: string;
  /** Prefixos de chave que pertencem a este grupo (startsWith). */
  prefixes: string[];
  /** Chaves sensíveis (não exportáveis por padrão) marcadas na UI. */
  sensitive?: string[];
}

export const OUTPUT_GROUPS: OutputGroup[] = [
  {
    id: "base",
    label: "Base de dados (coletado)",
    description: "Apps e reviews coletados das lojas — a fonte de verdade do sistema.",
    prefixes: ["aso:dataset:", "aso:history"],
  },
  {
    id: "noai",
    label: "Gerado sem IA (determinístico)",
    description: "Caches e artefatos computados localmente, sem modelo de IA.",
    prefixes: ["aso:cache:", "aso:artifacts"],
  },
  {
    id: "ia",
    label: "Gerado com IA",
    description: "Análises, insights, sessões, findings e decisões produzidos por modelos de IA.",
    prefixes: ["aso:ai-outputs:", "aso:insights:", "aso:generations:", "aso:pipeline-artifacts:", "aso:lab:", "aso:chat-history:", "aso:agents:"],
  },
  {
    id: "projetos",
    label: "Projetos & arquivos",
    description: "Canvas, Design Canvas, apresentações e jornadas criadas por você.",
    prefixes: ["aso:canvas:", "aso:canvas-history:", "aso:canvas-sessions:", "aso:design-canvas:", "aso:presentations:", "aso:journey:"],
  },
  {
    id: "sistema",
    label: "Configurações & personalização",
    description: "Preferências de IA, aparência, feature flags, seleção e layout.",
    prefixes: ["aso:ai-settings", "aso:appearance-bg:", "aso:ui-settings:", "aso:feature-flags:", "aso:selected-apps:", "aso:windows:", "aso:sidebar-", "aso:region", "aso:lang", "aso:ui-lang", "aso:collection-settings", "aso:ai-knowledge", "aso:ai-panel", "aso:uni-source-secrets:"],
    // Credenciais NUNCA exportadas (apiKey de IA cloud + vault de segredos
    // das fontes custom com autenticação — Onda 4.3).
    sensitive: ["aso:ai-settings:v1", "aso:uni-source-secrets:v1"],
  },
];

export interface KeyEntry {
  key: string;
  bytes: number;
  /** nº de itens (array) ou campos (objeto) quando parseável. */
  items: number | null;
  /** true para valores JSON válidos. */
  json: boolean;
  sensitive: boolean;
}

export interface GroupInventory {
  group: OutputGroup;
  entries: KeyEntry[];
  totalBytes: number;
}

export function listAsoKeys(): string[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("aso:")) keys.push(k);
    }
  } catch { /* storage indisponível */ }
  return keys.sort();
}

function byteSize(raw: string): number {
  try {
    return new Blob([raw]).size;
  } catch {
    return raw.length;
  }
}

function inspectKey(key: string, sensitive: boolean): KeyEntry {
  const raw = localStorage.getItem(key) ?? "";
  let items: number | null = null;
  let json = false;
  try {
    const parsed: unknown = JSON.parse(raw);
    json = true;
    if (Array.isArray(parsed)) items = parsed.length;
    else if (parsed && typeof parsed === "object") items = Object.keys(parsed as object).length;
  } catch { /* valor não-JSON (string simples) */ }
  return { key, bytes: byteSize(raw), items, json, sensitive };
}

function groupOf(key: string): OutputGroup {
  for (const g of OUTPUT_GROUPS) {
    if (g.prefixes.some((p) => key.startsWith(p))) return g;
  }
  return { id: "outros", label: "Outros", description: "Chaves não classificadas.", prefixes: [] };
}

export function inventoryOutputs(): GroupInventory[] {
  const keys = listAsoKeys();
  const map = new Map<OutputGroupId, GroupInventory>();
  for (const key of keys) {
    const group = groupOf(key);
    const sensitive = group.sensitive?.includes(key) ?? false;
    const inv = map.get(group.id) ?? { group, entries: [], totalBytes: 0 };
    const entry = inspectKey(key, sensitive);
    inv.entries.push(entry);
    inv.totalBytes += entry.bytes;
    map.set(group.id, inv);
  }
  const order: OutputGroupId[] = ["base", "noai", "ia", "projetos", "sistema", "outros"];
  return order.map((id) => map.get(id)).filter((g): g is GroupInventory => !!g && g.entries.length > 0);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Exporta UMA chave como arquivo JSON {key, value, exportedAt}. */
export function downloadKey(key: string): void {
  const value = localStorage.getItem(key);
  if (value == null) return;
  let parsed: unknown = value;
  try { parsed = JSON.parse(value); } catch { /* mantém string crua */ }
  const payload = JSON.stringify({ app: "app-intelligence", key, exportedAt: new Date().toISOString(), value: parsed }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${key.replace(/[:/]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Apaga uma chave (retorna false se não existia). */
export function deleteKey(key: string): boolean {
  if (localStorage.getItem(key) == null) return false;
  localStorage.removeItem(key);
  return true;
}

/** Apaga um conjunto arbitrário de chaves (seleção do usuário). */
export function deleteKeys(keys: string[]): number {
  let n = 0;
  for (const k of keys) if (deleteKey(k)) n++;
  return n;
}

/** Apaga todas as chaves de um grupo (retorna quantas foram apagadas). */
export function deleteGroup(groupId: OutputGroupId): number {
  const inv = inventoryOutputs().find((g) => g.group.id === groupId);
  if (!inv) return 0;
  let n = 0;
  for (const e of inv.entries) {
    if (deleteKey(e.key)) n++;
  }
  return n;
}

/** Reset total: apaga TODAS as chaves aso:* (inclui configurações). */
export function resetAllLocalData(): number {
  const keys = listAsoKeys();
  for (const k of keys) localStorage.removeItem(k);
  return keys.length;
}

/**
 * RESET DE FÁBRICA — garante wipe TOTAL: `localStorage.clear()` +
 * `sessionStorage.clear()` (não remove chave-por-chave, então nada escapa —
 * incluindo chaves fora do prefixo aso:* como app-theme/collection-settings).
 * O caller deve recarregar a página em seguida (estado de primeiro acesso).
 */
export function factoryReset(): number {
  let n = 0;
  try {
    n = localStorage.length;
    localStorage.clear();
  } catch { /* storage indisponível */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  return n;
}

/** Contagem de registros locais (chaves aso:*). */
export function countLocalRecords(): number {
  return listAsoKeys().length;
}
