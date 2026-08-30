/**
 * Guarda do Experiment Planner (briefing §5):
 * - gera matriz de experimentos a partir de dimensões;
 * - respeita orçamento (sem explosão combinatória);
 * - rotula a classe (kind) e produz label reproduzível;
 * - prioritize ordena por classe.
 */
import { describe, expect, it } from "vitest";
import {
  closedOptions,
  dimensionsForSource,
  planExperiments,
  planSourceBaseline,
  planSourceVariations,
  prioritize,
  type ExperimentDimension,
} from "@/lib/audit/experimentPlanner";

const dims = (d: ExperimentDimension[]) => d;

describe("experimentPlanner — planExperiments", () => {
  it("gera matriz controlada operation × dimensões com label", () => {
    const exps = planExperiments("suggest", "coverage", dims([
      { name: "vertical", values: ["web", "news"] },
      { name: "region", values: ["br", "us"] },
    ]));
    expect(exps).toHaveLength(4);
    expect(exps[0].source).toBe("suggest");
    expect(exps[0].kind).toBe("coverage");
    expect(exps[0].label).toContain("vertical=");
    expect(exps[0].label).toContain("region=");
    expect(exps.map((e) => e.params)).toContainEqual({ vertical: "web", region: "br" });
  });

  it("respeita orçamento (maxExperiments) — sem explosão combinatória", () => {
    const exps = planExperiments("trends", "coverage", dims([
      { name: "region", values: ["br", "us", "jp", "de"] },
      { name: "hours", values: [4, 24, 48, 168] },
      { name: "category", values: ["all", "tech", "sports", "health"] },
    ]), { maxExperiments: 6 });
    expect(exps.length).toBeLessThanOrEqual(6);
  });

  it("dimensão vazia não gera experimento", () => {
    const exps = planExperiments("web", "discovery", dims([
      { name: "url", values: [] },
    ]));
    expect(exps).toHaveLength(0);
  });
});

describe("experimentPlanner — prioritize", () => {
  it("ordena por classe (discovery antes de stress)", () => {
    const exps = planExperiments("suggest", "stress", [{ name: "q", values: ["a"] }])
      .concat(planExperiments("suggest", "discovery", [{ name: "q", values: ["b"] }]));
    const ordered = prioritize(exps);
    expect(ordered[0].kind).toBe("discovery");
    expect(ordered[ordered.length - 1].kind).toBe("stress");
  });
});


describe("A16 — ponte catálogo → planner (dimensionsForSource/planSource*)", () => {
  it("closedOptions filtra placeholders abertos", () => {
    expect(closedOptions(["chrome", "firefox", "…qualquer ISO"])).toEqual(["chrome", "firefox"]);
    expect(closedOptions(["(vazio)=web", "yt=youtube"])).toEqual(["yt=youtube"]);
    expect(closedOptions(undefined)).toEqual([]);
    expect(closedOptions([])).toEqual([]);
  });

  it("dimensionsForSource ignora params unavailable e sem options fechadas", () => {
    const source = {
      parameters: [
        { name: "client", type: "string", description: "", options: ["chrome", "firefox"], status: "implemented" as const },
        { name: "hl", type: "string", description: "", options: ["", "pt", "…qualquer hl"], status: "implemented" as const },
        { name: "secret", type: "string", description: "", options: ["a"], status: "unavailable" as const },
        { name: "q", type: "string", description: "", status: "implemented" as const },
      ],
    } as unknown as import("@/lib/audit/auditModel").AuditSource;
    const dims = dimensionsForSource(source);
    expect(dims).toHaveLength(2);
    expect(dims[0]).toEqual({ name: "client", values: ["chrome", "firefox"] });
    expect(dims[1]).toEqual({ name: "hl", values: ["pt"] });
  });

  it("planSourceVariations combina params enumerados com teto", () => {
    const source = {
      id: "suggest",
      parameters: [
        { name: "client", type: "string", description: "", options: ["chrome", "firefox"], status: "implemented" as const },
        { name: "ds", type: "string", description: "", options: ["", "yt", "n"], status: "implemented" as const },
      ],
    } as unknown as import("@/lib/audit/auditModel").AuditSource;
    const exps = planSourceVariations(source, { maxExperiments: 10 });
    // client(2) × ds(2 fechadas: yt,n) = 4
    expect(exps).toHaveLength(4);
    expect(exps[0].kind).toBe("variation");
    expect(exps[0].source).toBe("suggest");
    expect(exps.every((e) => e.label.includes("client="))).toBe(true);
  });

  it("planSourceBaseline usa só defaults documentados", () => {
    const source = {
      id: "trends",
      parameters: [
        { name: "geo", type: "string", description: "", default: "BR", status: "implemented" as const },
        { name: "hours", type: "string", description: "", default: "24", status: "implemented" as const },
        { name: "semDefault", type: "string", description: "", status: "implemented" as const },
      ],
    } as unknown as import("@/lib/audit/auditModel").AuditSource;
    const exps = planSourceBaseline(source);
    expect(exps).toHaveLength(1);
    expect(exps[0].params).toEqual({ geo: "BR", hours: "24" });
    expect(exps[0].kind).toBe("baseline");
  });
});
