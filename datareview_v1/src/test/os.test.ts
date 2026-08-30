/**
 * Nexus OS — testes da camada lib: motor de aprendizado (memory) + registry
 * de comandos do CLI (commands). Usa o dataset factory local.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  trackOSEvent, listOSEvents, clearOSMemory, commandFrequency, analysisCoverage,
  buildOSInsights, learningScore,
} from "@/lib/os/memory";
import {
  executeCLI, matchCommands, OS_COMMANDS, type OSCommandContext,
} from "@/lib/os/commands";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";

/* ------------------------------------------------------------ factories - */

function mkApp(over: Partial<AppInfo> = {}): AppInfo {
  return {
    id: "1", store: "apple", name: "AppTest", icon: "", developer: "Dev",
    rating: 4.2, ratingCount: 1000, price: "0", genre: "Finanças",
    description: "", version: "1.0", releaseDate: "", currentVersionReleaseDate: "",
    screenshots: [], url: "", ...over,
  };
}

function mkReview(i: number, rating: number): ReviewEntry {
  return {
    id: `r${i}`, store: "apple", appId: "1", appName: "AppTest",
    author: `user${i}`, rating, title: `t${i}`, text: `texto ${i}`, date: "2026-01-01",
  };
}

function mkEntry(over: Partial<AppInfo> = {}, reviews: ReviewEntry[] = [mkReview(1, 5)]): DatasetEntry {
  return { app: mkApp(over), reviews, collectedAt: Date.now() };
}

function mkCtx(entries: DatasetEntry[], aiEnabled = true): OSCommandContext & {
  calls: Record<string, unknown[]>;
} {
  const calls: Record<string, unknown[]> = {};
  const record = (name: string) => (v: unknown) => {
    (calls[name] = calls[name] ?? []).push(v);
  };
  const ctx: OSCommandContext = {
    entries,
    aiEnabled,
    navigate: (p) => record("navigate")(p),
    setView: (v) => record("setView")(v),
    runSection: (id) => record("runSection")(id),
    runAgent: (id) => record("runAgent")(id),
    collectTerm: async (t) => `✓ coletado ${t}`,
    exportDataset: () => "arquivo gerado",
  };
  return Object.assign(ctx, { calls });
}

/* ------------------------------------------------------------ memory ---- */

describe("os/memory", () => {
  beforeEach(() => clearOSMemory());

  it("registra e lista eventos com timestamps crescentes", () => {
    trackOSEvent("command", "stats");
    trackOSEvent("view", "overview");
    const events = listOSEvents();
    expect(events).toHaveLength(2);
    expect(events[1].ts).toBeGreaterThan(events[0].ts);
    expect(events[0].id).toBe("stats");
  });

  it("clearOSMemory zera o log", () => {
    trackOSEvent("command", "help");
    clearOSMemory();
    expect(listOSEvents()).toHaveLength(0);
  });

  it("commandFrequency ranqueia os mais usados", () => {
    trackOSEvent("command", "stats");
    trackOSEvent("command", "stats");
    trackOSEvent("analysis", "problems");
    const top = commandFrequency(listOSEvents());
    expect(top[0][0]).toBe("stats");
    expect(top[0][1]).toBe(2);
  });

  it("analysisCoverage separa seções geradas das faltantes", () => {
    trackOSEvent("analysis", "summary");
    const { done, missing } = analysisCoverage(listOSEvents());
    expect(done).toContain("summary");
    expect(missing).toContain("problems");
  });

  it("buildOSInsights: sem dados pede coleta", () => {
    const insights = buildOSInsights([], []);
    expect(insights[0].id).toBe("no-data");
    expect(insights[0].tone).toBe("action");
  });

  it("buildOSInsights: alerta de negatividade alta vem primeiro (warn)", () => {
    const negReviews = Array.from({ length: 20 }, (_, i) => mkReview(i, i % 2 === 0 ? 1 : 2));
    const insights = buildOSInsights([mkEntry({}, negReviews)], []);
    const warn = insights.find((i) => i.tone === "warn");
    expect(warn?.title).toContain("negativos");
  });

  it("buildOSInsights: sugere resumo quando nada foi analisado", () => {
    const insights = buildOSInsights([mkEntry()], []);
    const first = insights.find((i) => i.id === "first-analysis");
    expect(first?.command).toBe("/analyze summary");
  });

  it("learningScore sobe com dados + análises e fica entre 0-100", () => {
    const entries = [mkEntry()];
    const s0 = learningScore(entries, []);
    trackOSEvent("analysis", "summary");
    const s1 = learningScore(entries, listOSEvents());
    expect(s1).toBeGreaterThan(s0);
    expect(s1).toBeGreaterThanOrEqual(0);
    expect(s1).toBeLessThanOrEqual(100);
  });
});

/* ------------------------------------------------------------ commands -- */

describe("os/commands", () => {
  beforeEach(() => clearOSMemory());

  it("/help lista todos os grupos", async () => {
    const ctx = mkCtx([]);
    const { lines } = await executeCLI("/help", ctx);
    const text = lines.map((l) => l.text).join("\n");
    expect(text).toContain("DADOS");
    expect(text).toContain("NAVEGAÇÃO");
  });

  it("matchCommands filtra por prefixo e alias", () => {
    expect(matchCommands("/sta").map((c) => c.id)).toContain("stats");
    expect(matchCommands("ajuda").map((c) => c.id)).toContain("help");
  });

  it("/stats computa determinístico sobre o dataset", async () => {
    const reviews = [mkReview(1, 5), mkReview(2, 1), mkReview(3, 3)];
    const ctx = mkCtx([mkEntry({}, reviews)]);
    const { lines } = await executeCLI("/stats", ctx);
    expect(lines[0].text).toContain("3 reviews");
    expect(lines[0].kind).toBe("ok");
  });

  it("/stats com dataset vazio retorna erro amigável", async () => {
    const ctx = mkCtx([]);
    const { lines } = await executeCLI("/stats", ctx);
    expect(lines[0].kind).toBe("err");
  });

  it("/analyze sem IA ativada retorna hint", async () => {
    const ctx = mkCtx([mkEntry()], false);
    const { lines } = await executeCLI("/analyze problems", ctx);
    expect(lines[0].kind).toBe("err");
    expect(lines[0].text).toContain("IA desativada");
  });

  it("/analyze despacha runSection + troca a view", async () => {
    const ctx = mkCtx([mkEntry()]);
    const { lines } = await executeCLI("/analyze problems", ctx);
    expect(lines[0].kind).toBe("ok");
    expect(ctx.calls.runSection?.[0]).toBe("problems");
    expect(ctx.calls.setView?.[0]).toBe("analises");
  });

  it("/analyze resolve por label (fuzzy)", async () => {
    const ctx = mkCtx([mkEntry()]);
    await executeCLI("/analyze resumo", ctx);
    expect(ctx.calls.runSection?.[0]).toBe("summary");
  });

  it("/agent despacha o agente resolvido", async () => {
    const ctx = mkCtx([mkEntry()]);
    const { lines } = await executeCLI("/agent seg-produto", ctx);
    expect(lines[0].kind).toBe("ok");
    expect(ctx.calls.runAgent?.[0]).toBe("seg-produto");
  });

  it("/goto navega para página existente (path ou label)", async () => {
    const ctx = mkCtx([]);
    await executeCLI("/goto dashboard", ctx);
    expect(ctx.calls.navigate?.[0]).toBe("/dashboard");
    await executeCLI("/goto /pipeline", ctx);
    expect(ctx.calls.navigate?.[1]).toBe("/pipeline");
  });

  it("entrada linguagem natural retorna aiPrompt", async () => {
    const ctx = mkCtx([mkEntry()]);
    const { aiPrompt, lines } = await executeCLI("quais os maiores problemas?", ctx);
    expect(aiPrompt).toBe("quais os maiores problemas?");
    expect(lines.some((l) => l.kind === "out")).toBe(true);
  });

  it("comando desconhecido sugere o mais próximo", async () => {
    const ctx = mkCtx([]);
    const { lines } = await executeCLI("/statz", ctx);
    expect(lines[0].kind).toBe("err");
    expect(lines[0].text).toContain("/stat");
  });

  it("todo comando do registry tem usage/description/categoria válida", () => {
    for (const c of OS_COMMANDS) {
      expect(c.usage.startsWith("/")).toBe(true);
      expect(c.description.length).toBeGreaterThan(5);
      expect(["dados", "ia", "navegação", "sistema"]).toContain(c.category);
    }
  });

  it("/memory resume o aprendizado", async () => {
    trackOSEvent("command", "stats");
    const ctx = mkCtx([mkEntry()]);
    const { lines } = await executeCLI("/memory", ctx);
    expect(lines[0].text).toContain("eventos");
  });
});
