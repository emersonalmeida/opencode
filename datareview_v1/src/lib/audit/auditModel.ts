/**
 * auditModel — modelo canônico da AUDITORIA DE FONTES E DADOS.
 *
 * Cada fonte do sistema é descrita de forma maximalista e HONESTA:
 * endpoints, parâmetros (com todas as opções/variações), capacidades,
 * combinações, saídas (campos com presença real nos dados), derivações,
 * limites, confiabilidade e referências. O status de cada item distingue
 * o que o sistema JÁ extrai hoje (implemented/partial) do que a fonte
 * OFERECE mas ainda não coletamos (available) — é assim que a auditoria
 * responde "o que temos e o que não temos".
 *
 * Lib pura/testável (sem React/DOM) — alimenta a página /auditoria.
 */

/** Estado da auditoria da fonte como um todo. */
export type AuditStatus = "audited" | "in-progress" | "pending";

// ---------------------------------------------------------------------------
// ESTADOS RICOS DE CAPACIDADE (briefing §1) — o ciclo de vida real de uma
// capacidade/parâmetro/campo. Nunca confundir "documentado" com "verificado".
// ---------------------------------------------------------------------------

/**
 * Estado rico do ciclo de vida de uma capacidade/parâmetro/campo.
 *
 * documented→discovered→implemented→tested→verified→reproducible,
 * com estados de falha honestos: limited (a fonte limita), blocked (anti-bot/
 * auth/rate-limit), unsupported (a fonte não oferece), unknown (válido) e
 * not_tested (diferente de "não suportado").
 */
export type CapabilityState =
  | "documented"
  | "discovered"
  | "implemented"
  | "tested"
  | "verified"
  | "reproducible"
  | "limited"
  | "blocked"
  | "unsupported"
  | "unknown"
  | "not_tested";

/** Estados considerados "validados" (evidência real existe). */
export const VALIDATED_STATES: CapabilityState[] = ["tested", "verified", "reproducible"];

/** Estados considerados "sem evidência" (só documentação/descoberta). */
export const UNVALIDATED_STATES: CapabilityState[] = ["documented", "discovered", "not_tested", "unknown"];

/** Classificação honesta: validado = tem evidência; não validado = só doc. */
export function isValidated(state: CapabilityState): boolean {
  return VALIDATED_STATES.includes(state);
}

// ---------------------------------------------------------------------------
// OBSERVAÇÃO AUDITÁVEL (briefing §2) — cada teste produz evidência.
// ---------------------------------------------------------------------------

/**
 * Uma observação auditável de um teste real contra a fonte. rawStore continua
 * com runs/artifacts imutáveis; este modelo é a camada DEDUZIDA do Engine
 * (duração, http, schema, confidence) derivada dos artifacts.
 */
export interface AuditObservation {
  source: string;
  operation: string;
  capability?: string;
  parameters?: Record<string, unknown>;
  endpoint?: string;
  url?: string;
  /** Epoch ms. */
  timestamp: number;
  durationMs?: number;
  httpStatus?: number;
  /** Campos encontrados na resposta (schema observado). */
  schema?: string[];
  records?: number;
  errors?: { endpoint: string; message: string; at: number }[];
  /** Confiança da observação (0–1: 1 = resposta completa e estável). */
  confidence?: number;
  /** Reproduzível? (a mesma chamada retorna o mesmo schema/conjunto). */
  reproducible?: boolean;
  /** Referência documental usada (quando veio de doc/online). */
  reference?: string;
}

/** Métricas objetivas agregadas por fonte (briefing §18 — sem "score mágico"). */
export interface ReliabilityMetrics {
  source: string;
  observations: number;
  successRate: number;
  errorRate: number;
  rateLimited: number;
  avgDurationMs: number;
  avgConfidence: number;
}

/** Agrega métricas objetivas a partir de uma lista de observações. */
export function computeReliability(source: string, observations: AuditObservation[]): ReliabilityMetrics {
  const total = observations.length || 1;
  let errors = 0;
  let rateLimited = 0;
  let duration = 0;
  let confidence = 0;
  for (const o of observations) {
    if (o.errors && o.errors.length > 0) errors += 1;
    const rl = o.errors?.some((e) => /rate.?limit|429/i.test(e.message)) ? 1 : 0;
    rateLimited += rl;
    duration += o.durationMs ?? 0;
    confidence += o.confidence ?? 0.5;
  }
  return {
    source,
    observations: observations.length,
    successRate: (total - errors) / total,
    errorRate: errors / total,
    rateLimited: rateLimited / total,
    avgDurationMs: duration / total,
    avgConfidence: confidence / total,
  };
}

/** Presença de um campo nos dados reais coletados. */
export type FieldPresence = "always" | "common" | "conditional" | "rare" | "absent";

/** Status de implementação de um item (endpoint, parâmetro, capacidade, campo). */
export type ImplStatus = "implemented" | "partial" | "available" | "unavailable";

export interface AuditEndpoint {
  label: string;
  url: string;
  method: string;
  auth: string;
  notes?: string;
  status: ImplStatus;
}

export interface AuditParam {
  name: string;
  type: string;
  description: string;
  /** Valores enumerados (quando fechado). */
  options?: string[];
  default?: string;
  /** Faixa livre (ex.: "1–500"). */
  range?: string;
  status: ImplStatus;
}

export interface AuditCapability {
  label: string;
  status: ImplStatus;
  notes?: string;
}

export interface AuditField {
  name: string;
  type: string;
  description: string;
  presence: FieldPresence;
  status: ImplStatus;
  /** Nota de consistência/confiabilidade do campo (opcional). */
  reliability?: string;
}

export interface AuditReliability {
  /** Consistência: a mesma consulta retorna resultados estáveis? */
  consistency: string;
  /** Estabilidade: a API/endpoint muda com que frequência? */
  stability: string;
  /** Riscos conhecidos (rate-limit, bloqueio, deprecação, ToS). */
  risks: string[];
  /** O que o sistema faz quando a fonte falha. */
  fallbacks: string[];
}

export interface AuditReference {
  label: string;
  url: string;
}

export interface AuditSource {
  id: string;
  /** Posição na página (ordem definida na auditoria). */
  order: number;
  name: string;
  category: string;
  status: AuditStatus;
  /** A fonte está implementada no sistema? */
  implemented: boolean;
  /** Id da fonte no sistema (UniSourceId, loja canônica ou nova). */
  sourceId?: string;
  summary: string;
  endpoints: AuditEndpoint[];
  parameters: AuditParam[];
  capabilities: AuditCapability[];
  /** Combinações relevantes de parâmetros (matrizes de coleta). */
  combinations: string[];
  outputs: AuditField[];
  /** Dados deriváveis/computáveis a partir do bruto (sem nova coleta). */
  derivations: string[];
  limits: string[];
  reliability: AuditReliability;
  references: AuditReference[];
}

// ---------------------------------------------------------------------------
// Metadados visuais (labels PT-BR) — fonte única para badges da página.
// ---------------------------------------------------------------------------

export const AUDIT_STATUS_META: Record<AuditStatus, { label: string; tone: "ok" | "warn" | "muted" }> = {
  audited: { label: "Auditada", tone: "ok" },
  "in-progress": { label: "Em auditoria", tone: "warn" },
  pending: { label: "Pendente", tone: "muted" },
};

export const PRESENCE_META: Record<FieldPresence, { label: string; tone: "ok" | "warn" | "muted" | "info" }> = {
  always: { label: "sempre presente", tone: "ok" },
  common: { label: "comum", tone: "info" },
  conditional: { label: "condicional", tone: "warn" },
  rare: { label: "raro", tone: "warn" },
  absent: { label: "ausente", tone: "muted" },
};

export const IMPL_STATUS_META: Record<ImplStatus, { label: string; tone: "ok" | "warn" | "info" | "muted" }> = {
  implemented: { label: "implementado", tone: "ok" },
  partial: { label: "parcial", tone: "warn" },
  available: { label: "disponível (não coletado)", tone: "info" },
  unavailable: { label: "indisponível", tone: "muted" },
};

// ---------------------------------------------------------------------------
// Helpers puros
// ---------------------------------------------------------------------------

/** Âncora de seção da página para uma fonte. */
export function auditAnchor(id: string): string {
  return `audit-${id}`;
}

export interface AuditStats {
  sources: number;
  audited: number;
  inProgress: number;
  pending: number;
  implemented: number;
  endpoints: number;
  parameters: number;
  capabilities: number;
  fields: number;
  /** Campos que o sistema já extrai (implemented/partial). */
  fieldsImplemented: number;
  /** Campos que a fonte oferece e ainda não coletamos. */
  fieldsAvailable: number;
}

export function auditStats(sources: AuditSource[]): AuditStats {
  const s: AuditStats = {
    sources: sources.length,
    audited: 0,
    inProgress: 0,
    pending: 0,
    implemented: 0,
    endpoints: 0,
    parameters: 0,
    capabilities: 0,
    fields: 0,
    fieldsImplemented: 0,
    fieldsAvailable: 0,
  };
  for (const src of sources) {
    if (src.status === "audited") s.audited += 1;
    else if (src.status === "in-progress") s.inProgress += 1;
    else s.pending += 1;
    if (src.implemented) s.implemented += 1;
    s.endpoints += src.endpoints.length;
    s.parameters += src.parameters.length;
    s.capabilities += src.capabilities.length;
    s.fields += src.outputs.length;
    for (const f of src.outputs) {
      if (f.status === "implemented" || f.status === "partial") s.fieldsImplemented += 1;
      if (f.status === "available") s.fieldsAvailable += 1;
    }
  }
  return s;
}

/** Contadores por fonte (para o índice e o header da seção). */
export function sourceCounts(src: AuditSource): {
  endpoints: number;
  parameters: number;
  capabilities: number;
  fields: number;
  gaps: number;
} {
  const gaps =
    src.outputs.filter((f) => f.status === "available").length +
    src.capabilities.filter((c) => c.status === "available").length +
    src.parameters.filter((p) => p.status === "available").length;
  return {
    endpoints: src.endpoints.length,
    parameters: src.parameters.length,
    capabilities: src.capabilities.length,
    fields: src.outputs.length,
    gaps,
  };
}

/** Filtro textual acento-insensível sobre nome/categoria/resumo. */
export function filterAuditSources(sources: AuditSource[], term: string): AuditSource[] {
  const t = norm(term);
  if (!t) return sources;
  return sources.filter((s) =>
    norm(`${s.name} ${s.category} ${s.summary} ${s.id}`).includes(t),
  );
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
