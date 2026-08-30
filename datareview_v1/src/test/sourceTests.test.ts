import { describe, expect, it } from "vitest";
import { aggregate, buildTestPlan, collectFields, runProbe } from "@/lib/sourceTests/sourceTestRunner";
import { PIPELINE_SOURCES } from "@/lib/uni/sourceRunner";
import type { TestProbe } from "@/lib/sourceTests/sourceTestPlan";
import { listTestLog, clearTestLog, logTestEvent, logStats } from "@/lib/sourceTests/sourceTestLog";

describe("sourceTestRunner — plano", () => {
  it("plano cobre todas as fontes coletáveis por termo (PIPELINE_SOURCES)", () => {
    const plan = buildTestPlan();
    const covered = new Set(plan.map((p) => p.sourceId));
    for (const src of PIPELINE_SOURCES) {
      expect(covered.has(src), `fonte ${src} sem probe no plano`).toBe(true);
    }
  });

  it("ids de probes são únicos", () => {
    const ids = buildTestPlan().map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("extratores (web/feed/paste) marcados como needsInput", () => {
    const plan = buildTestPlan();
    const web = plan.find((p) => p.sourceId === "web");
    const feed = plan.find((p) => p.sourceId === "feed");
    const paste = plan.find((p) => p.sourceId === "paste");
    expect(web?.needsInput).toBe("url");
    expect(feed?.needsInput).toBe("url");
    expect(paste?.needsInput).toBe("text");
  });

  it("suggest tem 4 verticais como probes separados", () => {
    const plan = buildTestPlan();
    const suggests = plan.filter((p) => p.sourceId === "suggest");
    expect(suggests.map((p) => p.label)).toEqual([
      "vertical web", "vertical youtube", "vertical news", "vertical shopping",
    ]);
  });

  it("tiktok probe presente (oEmbed público testado ao vivo)", () => {
    const plan = buildTestPlan();
    expect(plan.some((p) => p.sourceId === "tiktok")).toBe(true);
  });
});

describe("sourceTestRunner — helpers", () => {
  it("collectFields une chaves de itens", () => {
    const items = [{ a: 1, b: "x" }, { a: 2, c: true }];
    expect(collectFields(items)).toEqual(["a", "b", "c"]);
  });

  it("runProbe propaga erro real lançado pelo fetcher (não '0 itens sem erro')", async () => {
    const p: TestProbe = {
      id: "reddit:posts",
      sourceId: "reddit",
      label: "posts por termo",
      description: "Search pública .json / OAuth",
      run: async () => {
        throw new Error("Reddit bloqueou este IP (403)");
      },
    };
    const r = await runProbe(p, "nubank", 25);
    expect(r.status).toBe("error");
    expect(r.error).toContain("Reddit bloqueou este IP");
    expect(r.count).toBe(0);
  });

  it("runProbe marca erro honesto quando o fetcher devolve vazio (0 itens)", async () => {
    const p: TestProbe = {
      id: "youtube:videos",
      sourceId: "youtube",
      label: "busca de vídeos",
      description: "Scraping /results",
      run: async () => [],
    };
    const r = await runProbe(p, "xyz-sem-resultados", 25);
    expect(r.status).toBe("error");
    expect(r.error).toBe("0 itens (sem erro — fonte vazia para o termo)");
    expect(r.count).toBe(0);
  });

  it("aggregate soma itens e une campos", () => {
    const r = aggregate("x", [
      { id: "x:1", sourceId: "x", label: "a", status: "done", count: 3, fields: ["a"], sample: [], items: [], durationMs: 10 },
      { id: "x:2", sourceId: "x", label: "b", status: "done", count: 2, fields: ["b"], sample: [], items: [], durationMs: 5 },
    ]);
    expect(r.totalItems).toBe(5);
    expect(r.allFields).toEqual(["a", "b"]);
    expect(r.durationMs).toBe(15);
  });
});

describe("sourceTestLog — log ao vivo", () => {
  it("append + snapshot estável + stats", () => {
    clearTestLog();
    logTestEvent("info", "suggest:web", "suggest", "vertical web", "iniciando", { status: "running" });
    logTestEvent("success", "suggest:web", "suggest", "vertical web", "10 itens", { status: "done" });
    logTestEvent("error", "reddit:posts", "reddit", "posts", "erro: 403", { status: "error" });
    const log = listTestLog();
    expect(log.length).toBe(3);
    const stats = logStats(log);
    expect(stats.done).toBe(1);
    expect(stats.error).toBe(1);
  });

  it("clearTestLog zera", () => {
    clearTestLog();
    expect(listTestLog().length).toBe(0);
  });
});
