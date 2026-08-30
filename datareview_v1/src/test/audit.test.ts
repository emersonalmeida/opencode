/**
 * Guarda do modelo de auditoria (página /auditoria):
 * - ids únicos, ordem estrita, campos obrigatórios preenchidos;
 * - valores de presença/status válidos (type-level + runtime);
 * - a 1ª fonte é o Suggest (ordem pedida pelo usuário) e Product Hunt está
 *   presente como fonte planejada (não implementada);
 * - helpers (auditStats, sourceCounts, filterAuditSources, auditAnchor).
 */
import { describe, expect, it } from "vitest";
import {
  auditAnchor,
  auditStats,
  filterAuditSources,
  sourceCounts,
  AUDIT_STATUS_META,
  IMPL_STATUS_META,
  PRESENCE_META,
  computeReliability,
  isValidated,
  VALIDATED_STATES,
  UNVALIDATED_STATES,
  type AuditObservation,
  type CapabilityState,
} from "@/lib/audit/auditModel";
import { AUDIT_SOURCES, auditSourceById, auditSourcesOrdered } from "@/lib/audit/auditSources";

const VALID_PRESENCE = new Set(Object.keys(PRESENCE_META));
const VALID_IMPL = new Set(Object.keys(IMPL_STATUS_META));
const VALID_STATUS = new Set(Object.keys(AUDIT_STATUS_META));

describe("audit model — integridade do registry", () => {
  it("ids únicos e ordem estritamente crescente", () => {
    const ids = AUDIT_SOURCES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = auditSourcesOrdered().map((s) => s.order);
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThan(orders[i - 1]);
    }
  });

  it("a ordem começa por suggest → trends → serp → youtube → reddit → producthunt", () => {
    const first6 = auditSourcesOrdered().slice(0, 6).map((s) => s.id);
    expect(first6).toEqual(["suggest", "trends", "serp", "youtube", "reddit", "producthunt"]);
  });

  it("toda fonte tem nome, categoria, resumo e status válidos", () => {
    for (const s of AUDIT_SOURCES) {
      expect(s.name.trim().length, s.id).toBeGreaterThan(0);
      expect(s.category.trim().length, s.id).toBeGreaterThan(0);
      expect(s.summary.trim().length, s.id).toBeGreaterThan(0);
      expect(VALID_STATUS.has(s.status), s.id).toBe(true);
    }
  });

  it("valores de presença/status dos itens são válidos", () => {
    for (const s of AUDIT_SOURCES) {
      for (const f of s.outputs) {
        expect(VALID_PRESENCE.has(f.presence), `${s.id}.${f.name}`).toBe(true);
        expect(VALID_IMPL.has(f.status), `${s.id}.${f.name}`).toBe(true);
      }
      for (const p of s.parameters) expect(VALID_IMPL.has(p.status), `${s.id}.${p.name}`).toBe(true);
      for (const c of s.capabilities) expect(VALID_IMPL.has(c.status), `${s.id}.${c.label}`).toBe(true);
      for (const e of s.endpoints) expect(VALID_IMPL.has(e.status), `${s.id}.${e.label}`).toBe(true);
    }
  });

  it("fonte auditada tem conteúdo completo; pendente é stub honesto", () => {
    for (const s of AUDIT_SOURCES) {
      if (s.status === "audited") {
        expect(s.endpoints.length, s.id).toBeGreaterThan(0);
        expect(s.parameters.length, s.id).toBeGreaterThan(0);
        expect(s.capabilities.length, s.id).toBeGreaterThan(0);
        expect(s.outputs.length, s.id).toBeGreaterThan(0);
        expect(s.reliability.consistency.length, s.id).toBeGreaterThan(0);
      }
    }
  });

  it("producthunt foi implementada e auditada nesta sessão", () => {
    const ph = auditSourceById("producthunt");
    expect(ph).toBeDefined();
    expect(ph!.implemented).toBe(true);
    expect(ph!.status).toBe("audited");
  });
});

describe("audit model — helpers", () => {
  it("auditAnchor gera id estável", () => {
    expect(auditAnchor("suggest")).toBe("audit-suggest");
  });

  it("auditStats soma corretamente", () => {
    const stats = auditStats(AUDIT_SOURCES);
    expect(stats.sources).toBe(AUDIT_SOURCES.length);
    expect(stats.audited).toBe(AUDIT_SOURCES.filter((s) => s.status === "audited").length);
    expect(stats.pending).toBe(AUDIT_SOURCES.filter((s) => s.status === "pending").length);
    expect(stats.endpoints).toBe(AUDIT_SOURCES.reduce((a, s) => a + s.endpoints.length, 0));
    expect(stats.fieldsAvailable).toBeGreaterThan(0); // suggest tem lacunas mapeadas
    expect(stats.implemented).toBe(AUDIT_SOURCES.filter((s) => s.implemented).length);
  });

  it("sourceCounts conta lacunas (available) de campos + capacidades + parâmetros", () => {
    const suggest = auditSourceById("suggest")!;
    const c = sourceCounts(suggest);
    expect(c.fields).toBe(suggest.outputs.length);
    expect(c.gaps).toBeGreaterThan(0);
  });

  it("filterAuditSources é acento-insensível e cobre nome/categoria", () => {
    expect(filterAuditSources(AUDIT_SOURCES, "autocomplete").some((s) => s.id === "suggest")).toBe(true);
    expect(filterAuditSources(AUDIT_SOURCES, "intencao").some((s) => s.id === "suggest")).toBe(true);
    expect(filterAuditSources(AUDIT_SOURCES, "academica").length).toBeGreaterThan(3);
    expect(filterAuditSources(AUDIT_SOURCES, "")).toHaveLength(AUDIT_SOURCES.length);
    expect(filterAuditSources(AUDIT_SOURCES, "zzz-inexistente")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Briefing §1 (estados ricos) + §2/§18 (observações → métricas objetivas).
// ---------------------------------------------------------------------------

describe("audit model — estados ricos de capacidade (briefing §1)", () => {
  it("validated = só estados com evidência; o resto é inválido por definição", () => {
    const validated = new Set(VALIDATED_STATES);
    expect([...validated].sort()).toEqual(["reproducible", "tested", "verified"]);
    // UNVALIDATED é a lista auxiliar dos estados "só documentação/descoberta".
    expect(UNVALIDATED_STATES).toContain("documented");
    expect(UNVALIDATED_STATES).toContain("not_tested");
    expect(UNVALIDATED_STATES).not.toContain("verified");
    // Nenhum estado pode estar nos dois grupos auxiliares ao mesmo tempo.
    expect(UNVALIDATED_STATES.filter((s) => validated.has(s as CapabilityState))).toHaveLength(0);
  });

  it("isValidated só aceita estados com evidência", () => {
    expect(isValidated("verified")).toBe(true);
    expect(isValidated("reproducible")).toBe(true);
    expect(isValidated("documented")).toBe(false);
    expect(isValidated("unknown")).toBe(false);
    expect(isValidated("not_tested")).toBe(false);
  });
});

describe("audit model — computeReliability (métricas objetivas)", () => {
  const obs = (over: Partial<AuditObservation>): AuditObservation => ({
    source: "suggest", operation: "suggest", timestamp: 1, ...over,
  });

  it("agrega success/error/rate-limit/duration/confidence sem 'score mágico'", () => {
    const list = [
      obs({ httpStatus: 200, durationMs: 100, confidence: 1 }),
      obs({ httpStatus: 200, durationMs: 200, confidence: 0.8 }),
      obs({ errors: [{ endpoint: "x", message: "HTTP 429 rate limit", at: 1 }], durationMs: 50, confidence: 0.2 }),
    ];
    const m = computeReliability("suggest", list);
    expect(m.source).toBe("suggest");
    expect(m.observations).toBe(3);
    expect(m.successRate).toBeCloseTo(2 / 3);
    expect(m.errorRate).toBeCloseTo(1 / 3);
    expect(m.rateLimited).toBeCloseTo(1 / 3);
    expect(m.avgDurationMs).toBeCloseTo((100 + 200 + 50) / 3);
    expect(m.avgConfidence).toBeCloseTo((1 + 0.8 + 0.2) / 3);
  });

  it("lista vazia não quebra (divisão por zero protegida)", () => {
    const m = computeReliability("web", []);
    expect(m.observations).toBe(0);
    expect(m.successRate).toBe(1);
    expect(m.errorRate).toBe(0);
  });
});


describe("audit model — cobertura dos notebooks de teste (pedido do usuário)", () => {
  // Os notebooks docs/fontes/notebooks/*-fonte.md são os "scripts de teste e
  // saídas de exemplo" pedidos na auditoria. Cada um DEVE ser referenciado
  // por algum manifest — a revisão é permanente.
  const NOTEBOOKS = [
    "appstore", "arxiv", "gdelt", "github", "gnews", "hackernews",
    "reddit", "scholar", "serp", "stackexchange", "suggest", "trends",
    "wiki", "youtube",
  ];
  it("todo notebook é referenciado por algum manifest", () => {
    const allRefs = auditSourcesOrdered().flatMap((s) => s.references.map((r) => r.url));
    for (const n of NOTEBOOKS) {
      const ok = allRefs.some((u) => u.includes(`notebooks/${n}-fonte`) || u.includes(`notebooks/${n}-output`));
      expect(ok, `notebook ${n} sem referência em nenhum manifest`).toBe(true);
    }
  });
  it("fontes típicas referenciam fonte + saída", () => {
    const byId = new Map(auditSourcesOrdered().map((s) => [s.id, s] as const));
    const check = (id: string, nb: string) => {
      const refs = (byId.get(id)?.references ?? []).map((r) => r.url);
      const hasF = refs.some((u) => u.includes(`notebooks/${nb}-fonte`));
      const hasO = refs.some((u) => u.includes(`notebooks/${nb}-output`));
      expect(hasF && hasO).toBe(true);
    };
    check("suggest", "suggest");
    check("trends", "trends");
    check("youtube", "youtube");
    check("reddit", "reddit");
    check("serp", "serp");
    check("googlenews", "gnews");
  });
});
