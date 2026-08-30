import { describe, expect, it } from "vitest";
import {
  computeOpportunityScore,
  scoreLabel,
  parseScore,
} from "@/lib/lab/scoring";
import { parseStructuredResult } from "@/lib/lab/runner";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { LabFinding } from "@/lib/lab/types";
import { annotateFinding } from "@/lib/lab/validation";

describe("lab scoring", () => {
  it("returns undefined when no scores", () => {
    expect(computeOpportunityScore(undefined)).toBeUndefined();
    expect(computeOpportunityScore({})).toBeUndefined();
  });

  it("computes weighted average of present dimensions", () => {
    const score = computeOpportunityScore({
      demand: 80,
      pain: 80,
      competitiveGap: 80,
      dataAvailability: 80,
      technicalFeasibility: 80,
      willingnessToPay: 80,
    });
    expect(score).toBe(80);
  });

  it("penalizes missing dimensions", () => {
    const full = computeOpportunityScore({
      demand: 100, pain: 100, competitiveGap: 100,
      dataAvailability: 100, technicalFeasibility: 100, willingnessToPay: 100,
    });
    const partial = computeOpportunityScore({ demand: 100 });
    expect(partial!).toBeLessThan(full!);
    expect(partial).toBeLessThanOrEqual(100);
  });

  it("clamps to 0-100", () => {
    expect(computeOpportunityScore({
      demand: 999, pain: 999, competitiveGap: 999,
      dataAvailability: 999, technicalFeasibility: 999, willingnessToPay: 999,
    })).toBe(100);
    expect(computeOpportunityScore({
      demand: -5, pain: -5, competitiveGap: -5,
      dataAvailability: -5, technicalFeasibility: -5, willingnessToPay: -5,
    })).toBe(0);
  });

  it("labels score bands", () => {
    expect(scoreLabel(85)).toBe("Muito promissor");
    expect(scoreLabel(65)).toBe("Promissor");
    expect(scoreLabel(45)).toBe("Moderado");
    expect(scoreLabel(25)).toBe("Baixo");
    expect(scoreLabel(5)).toBe("Muito baixo");
    expect(scoreLabel(undefined)).toBe("—");
  });

  it("parses and clamps score input", () => {
    expect(parseScore(50)).toBe(50);
    expect(parseScore(-10)).toBe(0);
    expect(parseScore(150)).toBe(100);
    expect(parseScore("75")).toBe(75);
    expect(parseScore("abc")).toBeUndefined();
  });
});

describe("lab structured result parsing", () => {
  it("parses direct JSON", () => {
    const r = parseStructuredResult('{"summary":"ok","observed":["a"],"inferred":[],"estimated":[],"metrics":{"x":1},"findings":[]}');
    expect(r?.summary).toBe("ok");
    expect(r?.observed).toEqual(["a"]);
    expect(r?.metrics?.x).toBe(1);
    expect(r?.findings).toEqual([]);
  });

  it("extracts JSON from fenced code block", () => {
    const r = parseStructuredResult('Texto\n```json\n{"summary":"bloco","findings":[{"title":"f","description":"d","evidence":[]}]}\n```\n');
    expect(r?.summary).toBe("bloco");
    expect(r?.findings).toHaveLength(1);
    expect(r?.findings?.[0].title).toBe("f");
  });

  it("extracts first balanced object from surrounding text", () => {
    const r = parseStructuredResult('aqui {"summary":"obj","findings":[]} fim');
    expect(r?.summary).toBe("obj");
  });

  it("returns null for non-JSON", () => {
    expect(parseStructuredResult("não é json")).toBeNull();
    expect(parseStructuredResult("")).toBeNull();
  });

  it("normalizes malformed findings (drops missing title)", () => {
    const r = parseStructuredResult('{"findings":[{"title":"ok","description":"d"},{"title":"","description":"sem titulo"}]}');
    expect(r?.findings).toHaveLength(1);
    expect(r?.findings?.[0].title).toBe("ok");
  });
});

describe("lab evidence validation", () => {
  const entries: DatasetEntry[] = [
    {
      app: { store: "google", id: "com.example", name: "Example", developer: "", rating: 4, ratingCount: 0, version: "", genre: "", size: "", contentRating: "", minimumOsVersion: "", downloads: "", lastUpdated: "", price: "", free: true } as never,
      reviews: [
        { id: "r1", store: "google", appId: "com.example", appName: "Example", author: "u", rating: 1, title: "login", text: "Não consigo fazer login no app", date: "2026-01-01" },
        { id: "r2", store: "google", appId: "com.example", appName: "Example", author: "u", rating: 5, title: "bom", text: "Adorei o aplicativo", date: "2026-01-02" },
      ],
      collectedAt: 0,
    },
  ];

  it("validates a finding with real reviewId + matching quote as valid", () => {
    const finding: LabFinding = {
      id: "f1", title: "Login", description: "d",
      experimentId: "e1", type: "evidence", status: "new", createdAt: "",
      evidence: { reviewIds: ["r1"], quotes: ["Não consigo fazer login"] },
    };
    const annotated = annotateFinding(finding, entries);
    expect(annotated.evidence?.validation?.status).toBe("valid");
  });

  it("marks failed when quote does not match review text", () => {
    const finding: LabFinding = {
      id: "f2", title: "Login", description: "d",
      experimentId: "e1", type: "evidence", status: "new", createdAt: "",
      evidence: { reviewIds: ["r1"], quotes: ["trecho que não existe no review"] },
    };
    const annotated = annotateFinding(finding, entries);
    expect(annotated.evidence?.validation?.status).toBe("failed");
    expect(annotated.evidence?.validation?.issues?.length).toBeGreaterThan(0);
  });

  it("marks failed when reviewId does not exist", () => {
    const finding: LabFinding = {
      id: "f3", title: "X", description: "d",
      experimentId: "e1", type: "evidence", status: "new", createdAt: "",
      evidence: { reviewIds: ["inexistente"], quotes: [] },
    };
    const annotated = annotateFinding(finding, entries);
    expect(annotated.evidence?.validation?.status).toBe("failed");
  });

  it("returns unverified when no reviewIds to check", () => {
    const finding: LabFinding = {
      id: "f4", title: "X", description: "d",
      experimentId: "e1", type: "insight", status: "new", createdAt: "",
      evidence: {},
    };
    const annotated = annotateFinding(finding, entries);
    expect(annotated.evidence?.validation?.status).toBe("unverified");
  });
});
