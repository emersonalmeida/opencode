import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizePath, trackPageView, pageLabel, pageViewFrequency, kindFrequency,
  generationTypeFrequency, generationSourceFrequency, neverOpenedPages,
  usageSummary, buildUsageMarkdown, PAGE_VIEW_PREFIX,
} from "@/lib/usage";
import { trackOSEvent, listOSEvents, clearOSMemory, type OSEvent } from "@/lib/os/memory";
import type { GenerationRecord } from "@/lib/sessionStore";
import type { ActivityEvent } from "@/lib/activityStore";

const ev = (kind: OSEvent["kind"], id: string, ts = 1000): OSEvent => ({ ts, kind, id });

const gen = (type: GenerationRecord["type"], source?: string): GenerationRecord => ({
  id: Math.random().toString(36).slice(2), type, title: "t", appKeys: [],
  createdAt: 2000, source,
});

const act = (source: string): ActivityEvent => ({
  id: Math.random().toString(36).slice(2), ts: 1500, source,
  phase: "done", message: "m",
});

describe("usage — telemetria local", () => {
  beforeEach(() => {
    localStorage.clear();
    clearOSMemory();
  });

  it("normalizePath colapsa rotas parametrizadas", () => {
    expect(normalizePath("/app/apple/123")).toBe("/app/:store/:id");
    expect(normalizePath("/app/google/com.x")).toBe("/app/:store/:id");
    expect(normalizePath("/lab/experiments/exp_1")).toBe("/lab/experiments/:id");
    expect(normalizePath("/p/minha-pagina")).toBe("/p/:id");
    expect(normalizePath("/dashboard")).toBe("/dashboard");
    expect(normalizePath("")).toBe("/");
  });

  it("trackPageView registra com prefixo page: e normaliza", () => {
    trackPageView("/dashboard");
    trackPageView("/app/apple/814456780");
    const events = listOSEvents();
    expect(events).toHaveLength(2);
    expect(events[0].id).toBe(`${PAGE_VIEW_PREFIX}/dashboard`);
    expect(events[1].id).toBe(`${PAGE_VIEW_PREFIX}/app/:store/:id`);
  });

  it("pageViewFrequency conta só views de página (não views internas do OS)", () => {
    const events = [
      ev("view", "page:/dashboard"), ev("view", "page:/dashboard"),
      ev("view", "page:/chat"), ev("view", "overview"), // view interna do OS
    ];
    expect(pageViewFrequency(events)).toEqual([["/dashboard", 2], ["/chat", 1]]);
  });

  it("pageLabel resolve o registry e cai no path quando desconhecido", () => {
    expect(pageLabel("/dashboard")).toBe("Dashboard");
    expect(pageLabel("/nao-existe")).toBe("/nao-existe");
  });

  it("kindFrequency e contagens de gerações/atividades ordenam desc", () => {
    const events = [ev("command", "/stats"), ev("command", "/stats"), ev("command", "/help"), ev("collect", "nubank")];
    expect(kindFrequency(events, "command")).toEqual([["/stats", 2], ["/help", 1]]);
    expect(kindFrequency(events, "collect")).toEqual([["nubank", 1]]);
    const gens = [gen("collect", "home"), gen("chat", "chat"), gen("chat", "chat"), gen("canvas-run")];
    expect(generationTypeFrequency(gens)).toEqual([["chat", 2], ["collect", 1], ["canvas-run", 1]]);
    expect(generationSourceFrequency(gens)).toEqual([["chat", 2], ["home", 1], ["desconhecida", 1]]);
  });

  it("neverOpenedPages lista páginas do registry sem page view", () => {
    const events = [ev("view", "page:/dashboard")];
    const never = neverOpenedPages(events);
    expect(never).not.toContain("/dashboard");
    expect(never).toContain("/canvas");
    expect(never.length).toBeGreaterThan(30);
  });

  it("usageSummary agrega KPIs dos 3 stores", () => {
    const events = [
      ev("view", "page:/dashboard", 100), ev("view", "page:/chat", 200),
      ev("command", "/stats", 300), ev("analysis", "summary", 400), ev("collect", "app", 500),
    ];
    const gens = [gen("collect"), gen("ai-section"), gen("ai-section")];
    const acts = [act("coleta"), act("ia"), act("coleta")];
    const s = usageSummary(events, gens, acts);
    expect(s.pageViews).toBe(2);
    expect(s.distinctPages).toBe(2);
    expect(s.commands).toBe(1);
    expect(s.analyses).toBe(1);
    expect(s.collects).toBe(2); // 1 evento + 1 geração collect
    expect(s.generations).toBe(3);
    expect(s.aiGenerations).toBe(2);
    expect(s.activities).toBe(3);
    expect(s.firstEventAt).toBe(100);
    expect(s.lastEventAt).toBe(2000);
  });

  it("usageSummary vazio não quebra", () => {
    const s = usageSummary([], [], []);
    expect(s.totalEvents).toBe(0);
    expect(s.firstEventAt).toBeNull();
    expect(s.lastEventAt).toBeNull();
  });

  it("buildUsageMarkdown gera relatório com seções e labels do registry", () => {
    const s = usageSummary([ev("view", "page:/dashboard")], [gen("ai-section")], []);
    const md = buildUsageMarkdown(s, [["/dashboard", 3]], [["/stats", 5]], [["ai-section", 1]], ["/canvas"]);
    expect(md).toContain("# Uso do sistema");
    expect(md).toContain("| Dashboard | 3 |");
    expect(md).toContain("| /stats | 5 |");
    expect(md).toContain("- Canvas (`/canvas`)");
  });

  it("eventos de view do OS não viram page views", () => {
    trackOSEvent("view", "overview");
    trackOSEvent("view", "analises");
    expect(pageViewFrequency(listOSEvents())).toEqual([]);
  });
});
