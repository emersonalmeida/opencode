import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUDIT_SNAPSHOT_SCHEMA,
  clearAuditSnapshots,
  createAuditSnapshot,
  deleteAuditSnapshot,
  listAuditSnapshots,
  snapshotToJson,
} from "@/lib/audit/auditSnapshots";

const CATALOG = { sources: 55, endpoints: 90, parameters: 120, capabilities: 80, fields: 200 };

describe("auditSnapshots (A14, §7)", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAuditSnapshots();
  });

  it("cria snapshot versionado sem sobrescrever (versões sequenciais)", () => {
    const s1 = createAuditSnapshot({ catalog: CATALOG, reliability: [], runs: {} });
    const s2 = createAuditSnapshot({ catalog: CATALOG, reliability: [], runs: {} });
    expect(s1.version).toBe(1);
    expect(s2.version).toBe(2);
    expect(listAuditSnapshots()).toHaveLength(2);
    // Mais novo primeiro (ordem de listagem)
    expect(listAuditSnapshots()[0].id).toBe(s2.id);
  });

  it("resumo deriva runs done/error sem recalcular", () => {
    const snap = createAuditSnapshot({
      catalog: CATALOG,
      reliability: [{ id: "suggest" }],
      runs: {
        suggest: { status: "done" },
        trends: { status: "error" },
        youtube: { status: "pending" },
      },
    });
    expect(snap.summary).toEqual({ sourcesObserved: 1, runsDone: 1, runsError: 1 });
  });

  it("persiste no localStorage e hidrata com o schema declarado", () => {
    const snap = createAuditSnapshot({ label: "Teste", catalog: CATALOG, reliability: [], runs: {} });
    const raw = localStorage.getItem("aso:audit-snapshots:v1");
    expect(raw).toBeTruthy();
    const saved = JSON.parse(raw as string)[0];
    expect(saved.schema).toBe(AUDIT_SNAPSHOT_SCHEMA);
    expect(saved.label).toBe("Teste");
    expect(snapshotToJson(snap)).toContain(`"version": ${snap.version}`);
  });

  it("delete remove e retorna falso para id inexistente", () => {
    const snap = createAuditSnapshot({ catalog: CATALOG, reliability: [], runs: {} });
    expect(deleteAuditSnapshot(snap.id)).toBe(true);
    expect(deleteAuditSnapshot(snap.id)).toBe(false);
    expect(listAuditSnapshots()).toHaveLength(0);
  });

  it("respeita o teto de 20 snapshots (descarta o mais antigo)", () => {
    for (let i = 0; i < 25; i++) {
      createAuditSnapshot({ catalog: CATALOG, reliability: [], runs: {} });
    }
    const list = listAuditSnapshots();
    expect(list).toHaveLength(20);
    expect(list[0].version).toBe(25); // mais novo primeiro
    expect(list.at(-1)?.version).toBe(6);
  });

  it("storage corrompido hidrata vazio sem quebrar", () => {
    localStorage.setItem("aso:audit-snapshots:v1", "{não-json");
    expect(listAuditSnapshots()).toEqual([]);
  });
});

describe("auditEvidence client (A15)", () => {
  it("normaliza resposta parcial/ausente sem quebrar", async () => {
    vi.stubGlobal("fetch", async () =>
      new Response("null", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const { fetchAuditEvidence } = await import("@/lib/audit/auditEngine");
    const ev = await fetchAuditEvidence("suggest");
    expect(ev.source).toBe("suggest");
    expect(ev.observations).toEqual([]);
    expect(ev.runs).toEqual([]);
    expect(ev.artifacts).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("passa source/limit/raw na rota e lê observações", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: unknown) => {
      calls.push(String(url));
      const body = JSON.stringify({
        source: "trends",
        observations: [{ runId: "r1", sourceId: "trends", endpoint: "trending", params: {}, at: 1 }],
        runs: [],
        artifacts: [],
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
    });
    const { fetchAuditEvidence } = await import("@/lib/audit/auditEngine");
    const ev = await fetchAuditEvidence("trends", 5);
    expect(calls.some((u) => u.includes("audit-evidence?source=trends&limit=5&raw=1"))).toBe(true);
    expect(ev.observations).toHaveLength(1);
    vi.unstubAllGlobals();
  });
});
