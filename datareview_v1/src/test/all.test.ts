/**
 * Modelo da jornada `/all` — a cobertura do registry PAGES é a guarda de
 * regressão: toda página nova tem que entrar na jornada (ou ser removida).
 */
import { describe, it, expect } from "vitest";
import { PAGES } from "@/lib/pages";
import {
  ALL_ACTS, ALL_LEVELS, LEVEL_META, allSections, allSectionPaths,
  actOfSection, sectionById, allCoverage, anchorId, sectionIndex, totalTasks,
  type AllSectionDef,
} from "@/lib/all/allModel";
import { nextDone, doneProgress, getDoneIds, setDoneIds, subscribeAllDone } from "@/lib/all/allProgress";

describe("modelo da jornada /all", () => {
  it("atos têm índices únicos e sequenciais com seções", () => {
    const indexes = ALL_ACTS.map((a) => a.index);
    expect(new Set(indexes).size).toBe(indexes.length);
    for (const a of ALL_ACTS) {
      expect(a.id).toBeTruthy();
      expect(a.title).toBeTruthy();
      expect(a.focus).toBeTruthy();
      expect(a.sections.length).toBeGreaterThan(0);
    }
  });

  it("cobertura total do registry PAGES — nenhuma página fora da jornada (exceto a própria /all)", () => {
    const { covered, missing, extrac } = allCoverage();
    const registry = PAGES.filter((p) => p.path !== "/all");
    expect(missing.filter((p) => p !== "/all"), `páginas fora da jornada: ${missing.join(", ")}`).toEqual([]);
    expect(extrac, `seções apontando páginas inexistentes: ${extrac.join(", ")}`).toEqual([]);
    expect(covered.length).toBe(registry.length);
  });

  it("cada path do registry aparece exatamente uma vez na jornada", () => {
    const paths = allSectionPaths();
    for (const p of PAGES) {
      if (p.path === "/all") continue; // a própria página não se embute
      const count = paths.filter((x) => x === p.path).length;
      expect(count, `${p.path} deveria aparecer 1x, aparece ${count}x`).toBe(1);
    }
  });

  it("âncoras únicas e estáveis (sem colisões entre seções)", () => {
    const ids = allSections().map((s) => anchorId(s.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of allSections()) expect(anchorId(s.id)).toMatch(/^all-[a-z0-9-]+$/);
  });

  it("toda seção tem tarefa, motivo e resultado (enquadramento da tarefa)", () => {
    for (const s of allSections()) {
      expect(s.task, `task de ${s.id}`).toBeTruthy();
      expect(s.why, `why de ${s.id}`).toBeTruthy();
      expect(s.result, `result de ${s.id}`).toBeTruthy();
      expect(s.title).toBeTruthy();
    }
  });

  it("primeira tarefa da jornada é a recepção (boas-vindas)", () => {
    const first = allSections()[0];
    expect(first.id).toBe("boas-vindas");
    expect(actOfSection(first.id)?.id).toBe("conhecer");
  });

  it("coleta vem antes de análise — o fundamento da jornada", () => {
    const iCollect = allSections().findIndex((s) => s.id === "inicio");
    const iAnalyze = allSections().findIndex((s) => s.id === "experiments");
    expect(iCollect).toBeGreaterThan(-1);
    expect(iAnalyze).toBeGreaterThan(iCollect);
  });

  it("3 níveis declarados com descrição honesta", () => {
    expect(ALL_LEVELS).toEqual(["collapsed", "default", "expanded"]);
    expect(LEVEL_META.map((l) => l.id).sort()).toEqual([...ALL_LEVELS].sort());
    for (const l of LEVEL_META) expect(l.blurb.length).toBeGreaterThan(10);
  });

  it("helpers de lookup: sectionById, actOfSection, sectionIndex", () => {
    const all = allSections();
    expect(all.length).toBe(PAGES.filter((p) => p.path !== "/all").length);
    expect(sectionById("dashboard")?.path).toBe("/dashboard");
    expect(actOfSection("dashboard")?.id).toBe("entender");
    expect(sectionIndex("boas-vindas")).toBe(1);
    expect(sectionIndex("configuracoes")).toBeGreaterThan(1);
    expect(totalTasks()).toBe(all.filter((s: AllSectionDef) => !s.note).length);
    expect(totalTasks()).toBeLessThan(all.length); // compare + frontend-starter têm nota
  });

  it("seções com nota explicam por que não embutem", () => {
    for (const s of allSections()) {
      if (s.note) expect(s.note!.length).toBeGreaterThan(15);
    }
    expect(sectionById("compare")?.note).toBeTruthy();
    expect(sectionById("frontend-starter")?.note).toBeTruthy();
  });
});

describe("progresso da jornada (checklist)", () => {
  it("nextDone alterna marcação sem mutar a entrada", () => {
    const base = ["a", "b"];
    expect(nextDone(base, "c")).toEqual(["a", "b", "c"]);
    expect(nextDone(base, "a")).toEqual(["b"]);
    expect(base).toEqual(["a", "b"]); // imutável
  });

  it("doneProgress clampa 0..1 sobre o total de tarefas", () => {
    expect(doneProgress([], 10)).toBe(0);
    expect(doneProgress(["a"], 10)).toBeCloseTo(0.1);
    expect(doneProgress(["a", "b", "c"], 0)).toBe(0);
    expect(doneProgress(Array(20).fill("x"), 10)).toBe(1);
  });

  it("storage: set/get + pub/sub + storage corrompido → vazio", () => {
    localStorage.clear();
    expect(getDoneIds()).toEqual([]);
    let notified = 0;
    const unsub = subscribeAllDone(() => { notified += 1; });
    setDoneIds(["boas-vindas", "inicio"]);
    expect(getDoneIds()).toEqual(["boas-vindas", "inicio"]);
    expect(notified).toBe(1);
    unsub();
    localStorage.setItem("aso:all:done:v1", "{broken");
    expect(getDoneIds()).toEqual([]);
    localStorage.removeItem("aso:all:done:v1");
  });
});
