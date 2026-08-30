import { describe, it, expect, beforeEach } from "vitest";
import {
  ANALYSIS_SHORTCUTS, PIPELINE_SHORTCUTS, SYSTEM_CHAT_SUGGESTIONS,
  buildDataAwareSuggestions, buildSystemContextSummary,
} from "@/lib/aiChatShared";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { BUILTIN_AGENTS } from "@/lib/agents";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { AppInfo } from "@/lib/appStoreApi";
import type { ReviewEntry } from "@/lib/appStoreApi";
import { taskStart, taskEnd, clearAll } from "@/lib/activityStore";

function app(over: Partial<AppInfo> = {}): AppInfo {
  return {
    id: "com.test", store: "google", name: "TestApp", icon: "", developer: "Dev",
    rating: 4.2, ratingCount: 1000, price: "Grátis", genre: "Tools",
    description: "", version: "1.0", releaseDate: "", currentVersionReleaseDate: "",
    screenshots: [], url: "", ...over,
  };
}
function review(over: Partial<ReviewEntry> = {}): ReviewEntry {
  return {
    id: Math.random().toString(36).slice(2), store: "google", appId: "com.test", appName: "TestApp",
    author: "U", rating: 4,
    title: "", text: "ótimo app, recomendo muito", date: "2026-01-05", ...over,
  };
}
function entry(a: AppInfo, reviews: ReviewEntry[]): DatasetEntry {
  return { app: a, reviews, collectedAt: Date.now() };
}

describe("AI chat shared — atalhos", () => {
  it("ANALYSIS_SHORTCUTS = as 12 seções de IA do sistema", () => {
    const aiCount = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai").length;
    expect(ANALYSIS_SHORTCUTS).toHaveLength(aiCount);
    expect(ANALYSIS_SHORTCUTS.every((s) => s.kind === "ai")).toBe(true);
    for (const s of ANALYSIS_SHORTCUTS) {
      expect(s.id).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });

  it("PIPELINE_SHORTCUTS = agentes builtin com ids de seção válidos", () => {
    expect(PIPELINE_SHORTCUTS).toHaveLength(BUILTIN_AGENTS.length);
    const sectionIds = new Set(EXPERIMENT_SECTIONS.map((s) => s.id));
    for (const p of PIPELINE_SHORTCUTS) {
      expect(p.steps.length).toBeGreaterThan(0);
      for (const step of p.steps) {
        expect(step.section === "custom" || sectionIds.has(step.section)).toBe(true);
      }
    }
  });
});

describe("AI chat shared — sugestões por forma dos dados", () => {
  it("dataset vazio → nenhuma sugestão", () => {
    expect(buildDataAwareSuggestions([])).toEqual([]);
  });

  it("multi-app gera sugestão comparativa nomeando os apps", () => {
    const entries = [
      entry(app({ id: "a", name: "Alfa" }), [review()]),
      entry(app({ id: "b", name: "Beta" }), [review()]),
    ];
    const sug = buildDataAwareSuggestions(entries);
    expect(sug.some((s) => s.includes("Alfa") && s.includes("Beta") && s.includes("Compare"))).toBe(true);
  });

  it("multi-versão → sugestão de evolução/regressão", () => {
    const entries = [entry(app(), [review({ version: "1.0" }), review({ version: "2.0" })])];
    expect(buildDataAwareSuggestions(entries).some((s) => s.includes("versão") || s.includes("versões"))).toBe(true);
  });

  it("multi-país → sugestão regional", () => {
    const entries = [entry(app(), [review({ country: "br" }), review({ country: "us" })])];
    expect(buildDataAwareSuggestions(entries).some((s) => s.includes("país") || s.includes("países"))).toBe(true);
  });

  it("multi-loja → sugestão Apple × Google", () => {
    const entries = [
      entry(app({ id: "1", store: "apple" }), [review()]),
      entry(app({ id: "2", store: "google" }), [review()]),
    ];
    expect(buildDataAwareSuggestions(entries).some((s) => s.includes("App Store") && s.includes("Google Play"))).toBe(true);
  });

  it("alta taxa de negativos → sugestão de investigar causas raiz", () => {
    const entries = [entry(app(), [
      review({ rating: 1 }), review({ rating: 2 }), review({ rating: 1 }), review({ rating: 5 }),
    ])];
    expect(buildDataAwareSuggestions(entries).some((s) => s.includes("negativos") || s.includes("causas raiz"))).toBe(true);
  });

  it("alta taxa de positivos → sugestão de proteger diferenciais", () => {
    const entries = [entry(app(), [
      review({ rating: 5 }), review({ rating: 5 }), review({ rating: 4 }), review({ rating: 5 }),
    ])];
    expect(buildDataAwareSuggestions(entries).some((s) => s.includes("diferenciais"))).toBe(true);
  });

  it("dataset mínimo ainda traz sugestões universais (resumo executivo etc.)", () => {
    const sug = buildDataAwareSuggestions([entry(app(), [review()])]);
    expect(sug.length).toBeGreaterThan(0);
    expect(sug.some((s) => s.includes("Resumo executivo"))).toBe(true);
  });

  it("respeita o máximo e nunca duplica", () => {
    const entries = [entry(app(), [review({ version: "1" }), review({ version: "2", country: "us" })])];
    const sug = buildDataAwareSuggestions(entries, 3);
    expect(sug.length).toBeLessThanOrEqual(3);
    expect(new Set(sug).size).toBe(sug.length);
  });
});

describe("AI chat shared — contexto vivo do sistema", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAll();
  });

  it("sem tarefas ativas não cita execução; com tarefas, cita", () => {
    expect(buildSystemContextSummary()).not.toContain("EM EXECUÇÃO");
    const id = taskStart(null, "Coleta: Nubank", "collect");
    const summary = buildSystemContextSummary();
    expect(summary).toContain("EM EXECUÇÃO");
    expect(summary).toContain("Nubank");
    taskEnd(id, "done");
  });

  it("resolve o label da página atual", () => {
    expect(buildSystemContextSummary("/dashboard")).toContain("Dashboard");
  });

  it("sugestões do chat de sistema cobrem o essencial", () => {
    expect(SYSTEM_CHAT_SUGGESTIONS.length).toBeGreaterThanOrEqual(8);
    expect(SYSTEM_CHAT_SUGGESTIONS.some((s) => s.includes("IA"))).toBe(true);
  });
});
