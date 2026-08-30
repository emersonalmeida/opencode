import { describe, it, expect, beforeEach } from "vitest";
import {
  BOOT_STEPS, BOOT_TOTAL_MS, bootProgress,
  WELCOME_STORAGE_KEY, hasVisited, markVisited,
  greetingFor, aiHintFor,
} from "@/lib/welcome/welcomeModel";
import {
  buildHostScript, hostActionsFor, acceptanceLine,
  FIRST_STEPS_ACTIONS, RETURNING_ACTIONS,
} from "@/lib/welcome/hostScript";
import { WELCOME_CAPABILITIES, welcomeStats } from "@/lib/welcome/welcomeCapabilities";
import { PAGES } from "@/lib/pages";

describe("boas-vindas — boot (loading de entrada)", () => {
  it("etapas têm ids únicos, labels e durações positivas", () => {
    const ids = BOOT_STEPS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of BOOT_STEPS) {
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.minMs).toBeGreaterThan(0);
    }
  });

  it("duração total é a soma das etapas e fica numa faixa confortável (1–8s)", () => {
    expect(BOOT_TOTAL_MS).toBe(BOOT_STEPS.reduce((s, b) => s + b.minMs, 0));
    expect(BOOT_TOTAL_MS).toBeGreaterThanOrEqual(1000);
    expect(BOOT_TOTAL_MS).toBeLessThanOrEqual(8000);
  });

  it("progresso vai de 0 a 100 conforme as etapas concluem", () => {
    expect(bootProgress(0)).toBe(0);
    expect(bootProgress(BOOT_STEPS.length)).toBe(100);
    expect(bootProgress(BOOT_STEPS.length + 5)).toBe(100); // clamp
    const mid = bootProgress(1);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(100);
  });
});

describe("boas-vindas — persistência de visitas", () => {
  beforeEach(() => localStorage.clear());

  it("primeira visita: hasVisited false; markVisited grava e incrementa", () => {
    expect(hasVisited()).toBe(false);
    const s1 = markVisited(undefined, 1000);
    expect(s1.visits).toBe(1);
    expect(s1.firstVisitAt).toBe(1000);
    expect(hasVisited()).toBe(true);
    const s2 = markVisited(undefined, 2000);
    expect(s2.visits).toBe(2);
    expect(s2.firstVisitAt).toBe(1000); // primeira visita preservada
    expect(s2.lastVisitAt).toBe(2000);
  });

  it("storage corrompido → trata como primeira visita (nunca quebra)", () => {
    localStorage.setItem(WELCOME_STORAGE_KEY, "{lixo");
    expect(hasVisited()).toBe(false);
    const s = markVisited(undefined, 500);
    expect(s.visits).toBe(1);
  });

  it("storage inválido (visits não numérico) → primeira visita", () => {
    localStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify({ visits: "muitos" }));
    expect(hasVisited()).toBe(false);
  });
});

describe("boas-vindas — saudação adaptativa do anfitrião", () => {
  it("primeira visita: se apresenta como anfitrião", () => {
    const g = greetingFor({ returning: false, apps: 0, reviews: 0, aiMode: "auto" });
    expect(g.headline).toContain("anfitrião");
    expect(g.subline.length).toBeGreaterThan(20);
  });

  it("retorno com dados: cita apps e reviews do usuário", () => {
    const g = greetingFor({ returning: true, apps: 3, reviews: 1250, aiMode: "auto" });
    expect(g.headline).toContain("de novo");
    expect(g.subline).toContain("3 apps");
    expect(g.subline).toContain("1.250");
  });

  it("retorno sem dados: convida a coletar o primeiro app", () => {
    const g = greetingFor({ returning: true, apps: 0, reviews: 0, aiMode: "none" });
    expect(g.headline).toContain("volta");
    expect(g.subline).toContain("primeiro app");
  });

  it("dica de IA é honesta por modo (none/local/cloud/auto)", () => {
    expect(aiHintFor("none")).toContain("desligada");
    expect(aiHintFor("local")).toContain("localmente");
    expect(aiHintFor("cloud")).toContain("nuvem");
    expect(aiHintFor("auto")).toContain("automático");
    expect(aiHintFor("qualquer-coisa")).toContain("automático"); // fallback
  });
});

describe("boas-vindas — roteiro do anfitrião", () => {
  it("primeira visita: roteiro completo (apresentação → regras → IA → sugestão)", () => {
    const lines = buildHostScript({ returning: false, apps: 0, reviews: 0, aiMode: "auto" });
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines[0].text).toContain("anfitrião");
    expect(lines.some((l) => l.text.includes("navegador"))).toBe(true);
    expect(lines.some((l) => l.text.includes("demo"))).toBe(true);
    const ids = lines.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("retorno com dados: cita o estado do usuário e pergunta por onde continuar", () => {
    const lines = buildHostScript({ returning: true, apps: 2, reviews: 800, aiMode: "local" });
    expect(lines[0].text).toContain("2 apps");
    expect(lines[0].text).toContain("800");
    expect(lines.some((l) => l.text.includes("continuar"))).toBe(true);
  });

  it("retorno sem dados: convida à primeira coleta (sem citar contagens)", () => {
    const lines = buildHostScript({ returning: true, apps: 0, reviews: 0, aiMode: "none" });
    expect(lines[0].text).toContain("volta");
    expect(lines.some((l) => l.text.includes("app"))).toBe(true);
  });

  it("ações seguem o contexto: primeiros passos vs. continuação", () => {
    expect(hostActionsFor({ returning: false, apps: 0, reviews: 0, aiMode: "auto" })).toBe(FIRST_STEPS_ACTIONS);
    expect(hostActionsFor({ returning: true, apps: 0, reviews: 0, aiMode: "auto" })).toBe(FIRST_STEPS_ACTIONS);
    expect(hostActionsFor({ returning: true, apps: 5, reviews: 100, aiMode: "auto" })).toBe(RETURNING_ACTIONS);
  });

  it("toda ação tem label e rota real do sistema", () => {
    for (const a of [...FIRST_STEPS_ACTIONS, ...RETURNING_ACTIONS]) {
      expect(a.label.trim().length).toBeGreaterThan(0);
      expect(a.path).toMatch(/^\//);
    }
  });

  it("aceite é falado como anfitrião (não como sistema) e sempre define", () => {
    for (const a of [...FIRST_STEPS_ACTIONS, ...RETURNING_ACTIONS]) {
      const line = acceptanceLine(a.id);
      expect(line.length).toBeGreaterThan(10);
      expect(line).toMatch(/…$/);
    }
    expect(acceptanceLine("desconhecida")).toContain("Te levo");
  });
});

describe("boas-vindas — tour de capacidades e stats ao vivo", () => {
  it("capacidades têm ids únicos e textos completos", () => {
    const ids = WELCOME_CAPABILITIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of WELCOME_CAPABILITIES) {
      expect(c.title.trim().length).toBeGreaterThan(0);
      expect(c.desc.trim().length).toBeGreaterThan(20);
    }
  });

  it("toda capacidade aponta para uma página real do registry PAGES", () => {
    const paths = new Set(PAGES.map((p) => p.path));
    for (const c of WELCOME_CAPABILITIES) {
      expect(paths.has(c.path), `capacidade ${c.id} → ${c.path} existe no registry`).toBe(true);
    }
  });

  it("stats: 4 números com labels; singular/plural correto em apps", () => {
    const one = welcomeStats({ apps: 1, reviews: 10, pages: 50, sources: 34 });
    expect(one).toHaveLength(4);
    expect(one[0].label).toBe("app coletado");
    const many = welcomeStats({ apps: 3, reviews: 0, pages: 50, sources: 34 });
    expect(many[0].label).toBe("apps coletados");
    expect(many.map((s) => s.value)).toEqual([3, 0, 50, 34]);
  });

  it("stats zerados carregam dica honesta (apps/reviews), os demais não", () => {
    const stats = welcomeStats({ apps: 0, reviews: 0, pages: 50, sources: 34 });
    expect(stats.find((s) => s.id === "apps")?.emptyHint).toBeTruthy();
    expect(stats.find((s) => s.id === "reviews")?.emptyHint).toBeTruthy();
    expect(stats.find((s) => s.id === "pages")?.emptyHint).toBeUndefined();
    expect(stats.find((s) => s.id === "sources")?.emptyHint).toBeUndefined();
  });
});
