/**
 * Protocolo IA ↔ pipeline — parsing do bloco estruturado que as análises de
 * IA emitem ao final do markdown (ver PROTOCOL em analyses.ts):
 *
 *   ```json
 *   { "findings": [...], "next_analysis": { "type": ..., ... } | null }
 *   ```
 *
 * O parsing é tolerante: aceita fenced ```json, JSON solto no texto, e
 * falha graciosamente (markdown continua utilizável, sem findings).
 */
import type { AIFinding, NextAnalysisRequest } from "./types";

export interface ParsedAIResult {
  /** Markdown sem o bloco de protocolo (para exibição limpa). */
  markdown: string;
  findings: AIFinding[];
  nextAnalysis: NextAnalysisRequest | null;
}

/** Extrai o primeiro objeto JSON balanceado que contenha "findings". */
export function extractProtocolJson(text: string): { json: string; start: number; end: number } | null {
  // 1) fenced ```json ... ```
  const fenced = /```(?:json)?\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fenced.exec(text)) !== null) {
    const body = m[1].trim();
    if (body.startsWith("{") && body.includes("findings")) {
      return { json: body, start: m.index, end: m.index + m[0].length };
    }
  }
  // 2) objeto balanceado contendo "findings"
  const keyIdx = text.indexOf('"findings"');
  if (keyIdx === -1) return null;
  // anda para trás até o '{' que abre o objeto
  let start = -1;
  for (let i = keyIdx; i >= 0; i--) {
    if (text[i] === "{") { start = i; break; }
  }
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return { json: text.slice(start, i + 1), start, end: i + 1 };
    }
  }
  return null;
}

function toFindings(raw: unknown): AIFinding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((f): AIFinding | null => {
      if (!f || typeof f !== "object") return null;
      const o = f as Record<string, unknown>;
      const title = typeof o.title === "string" ? o.title.trim() : "";
      if (!title) return null;
      const conf = typeof o.confidence === "number" ? o.confidence : parseFloat(String(o.confidence));
      return {
        title,
        confidence: Number.isFinite(conf) ? Math.max(0, Math.min(1, conf)) : 0.5,
        evidence: typeof o.evidence === "string" ? o.evidence : undefined,
      };
    })
    .filter((f): f is AIFinding => !!f)
    .slice(0, 8);
}

function toNextAnalysis(raw: unknown): NextAnalysisRequest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = typeof o.type === "string" ? o.type.trim() : "";
  if (!type) return null;
  return {
    type,
    rationale: typeof o.rationale === "string" ? o.rationale : undefined,
    parameters: o.parameters && typeof o.parameters === "object" ? (o.parameters as Record<string, unknown>) : undefined,
  };
}

/** Parse tolerante do output da IA. Nunca lança. */
export function parseAIResult(text: string): ParsedAIResult {
  const found = extractProtocolJson(text);
  if (!found) return { markdown: text, findings: [], nextAnalysis: null };
  try {
    const parsed = JSON.parse(found.json) as Record<string, unknown>;
    // remove o bloco de protocolo do markdown exibido
    const markdown = (text.slice(0, found.start) + text.slice(found.end)).trim();
    return {
      markdown,
      findings: toFindings(parsed.findings),
      nextAnalysis: toNextAnalysis(parsed.next_analysis),
    };
  } catch {
    return { markdown: text, findings: [], nextAnalysis: null };
  }
}
