/**
 * AI generation ops for the Design Canvas page builder.
 *
 * O copiloto não apenas conversa — ele *constrói*. Quando o usuário pede
 * "crie um dashboard com KPIs e um gráfico", streamamos a IA pelo mesmo
 * endpoint experiment-analyze pedindo um payload JSON de ops. Este módulo faz
 * o parse (tolerante) do texto streamado numa lista de `GenerateOp`s que o
 * store aplica para adicionar nós, conectar edges, definir props e vincular
 * fontes de dados.
 *
 * Somente funções puras → testáveis em unidade.
 */

export type GenerateOp =
  | { type: "add"; kind: string; label?: string; props?: Record<string, unknown>; dataSource?: string }
  | { type: "connect"; fromLabel?: string; toLabel?: string; label?: string }
  | { type: "setProps"; label?: string; props: Record<string, unknown> }
  | { type: "setDataSource"; label?: string; dataSource: string }
  | { type: "note"; text: string };

export interface GenerateResult {
  ops: GenerateOp[];
  /** Any prose the AI emitted outside JSON (shown as a chat message). */
  prose: string;
}

/** Extract the first balanced {...} or [...] JSON block from text. */
export function extractJsonBlock(text: string): string | null {
  const start = text.indexOf("{");
  const arrStart = text.indexOf("[");
  let idx = -1;
  let open: string;
  let close: string;
  if (start === -1 && arrStart === -1) return null;
  if (start === -1) { idx = arrStart; open = "["; close = "]"; }
  else if (arrStart === -1) { idx = start; open = "{"; close = "}"; }
  else { idx = Math.min(start, arrStart); open = idx === start ? "{" : "["; close = idx === start ? "}" : "]"; }
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = idx; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(idx, i + 1);
    }
  }
  return null;
}

/** Normalize a raw parsed object/array into a list of GenerateOp. */
export function normalizeOps(raw: unknown): GenerateOp[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { ops?: unknown }).ops) ? (raw as { ops: unknown[] }).ops : [raw];
  const ops: GenerateOp[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const t = (o.type as string) ?? (o.op as string);
    if (t === "add" || t === "addNode") {
      ops.push({
        type: "add",
        kind: String(o.kind ?? o.component ?? "note"),
        label: o.label ? String(o.label) : undefined,
        props: (o.props ?? {}) as Record<string, unknown>,
        dataSource: o.dataSource ? String(o.dataSource) : undefined,
      });
    } else if (t === "connect" || t === "connectNodes") {
      ops.push({
        type: "connect",
        fromLabel: o.from ? String(o.from) : undefined,
        toLabel: o.to ? String(o.to) : undefined,
        label: o.label ? String(o.label) : "navigate",
      });
    } else if (t === "setProps" || t === "props") {
      ops.push({ type: "setProps", label: o.label ? String(o.label) : undefined, props: (o.props ?? {}) as Record<string, unknown> });
    } else if (t === "setDataSource" || t === "bind") {
      ops.push({ type: "setDataSource", label: o.label ? String(o.label) : undefined, dataSource: String(o.dataSource ?? "selected") });
    } else if (t === "note") {
      ops.push({ type: "note", text: String(o.text ?? "") });
    }
  }
  return ops;
}

/** Parse streamed AI text into a GenerateResult (tolerant of prose + JSON). */
export function parseGenerateResult(text: string): GenerateResult {
  const block = extractJsonBlock(text);
  if (!block) return { ops: [], prose: text.trim() };
  let parsed: unknown = null;
  try { parsed = JSON.parse(block); } catch {
    // Try fenced ```json block.
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try { parsed = JSON.parse(fenced[1]); } catch { parsed = null; }
    }
  }
  const ops = normalizeOps(parsed);
  const prose = text.replace(block, "").replace(/```(?:json)?\s*([\s\S]*?)```/gi, "").trim();
  return { ops, prose };
}

/** The system instruction appended to a generate request. */
export const GENERATE_SYSTEM_PROMPT = [
  "Você é um construtor de páginas do Design Canvas. Gere uma lista JSON de OPS que constroem a página pedida.",
  "Cada op é um objeto com `type` em {\"add\",\"connect\",\"setProps\",\"setDataSource\",\"note\"}.",
  "- add: {\"type\":\"add\",\"kind\":\"<componentKind>\",\"label\":\"<rótulo>\",\"props\":{...},\"dataSource\":\"selected|all|app:<store:id>\"}",
  "- setProps: {\"type\":\"setProps\",\"label\":\"<rótulo>\",\"props\":{...}}",
  "- setDataSource: {\"type\":\"setDataSource\",\"label\":\"<rótulo>\",\"dataSource\":\"selected\"}",
  "- connect: {\"type\":\"connect\",\"from\":\"<rótulo>\",\"to\":\"<rótulo>\",\"label\":\"navigate\"}",
  "- note: {\"type\":\"note\",\"text\":\"explicação\"}",
  "Componentes disponíveis: button, badge, input, textarea, switch, checkbox, select, label, separator, alert, card, tabs, table, progress, skeleton, tooltip, accordion, avatar, slider, toggle-group, dialog, sheet, drawer, scroll-area, breadcrumb, pagination, calendar, kpi-card, rating-chart, sentiment-chart, timeline-chart, store-comparison, word-cloud, reviews-list, app-card, per-app-table, markdown, ai-analysis, section, row, columns2, pageframe, note.",
  "Responda APENAS com um bloco JSON (array de ops). Pode preceder com uma frase curta de prosa.",
].join("\n");
