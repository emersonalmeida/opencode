import { describe, it, expect, beforeEach } from "vitest";
import {
  addMonitor, listMonitors, setMonitorEnabled, removeMonitor, recordMonitorRun,
  isDue, dueMonitors, snapshotReviews, diffSnapshots, nextRunLabel, subscribeMonitors,
} from "@/lib/monitor";
import type { ReviewEntry } from "@/lib/appStoreApi";

function rev(rating: number, id = Math.random().toString(36).slice(2)): ReviewEntry {
  return { id, rating, title: "", text: "", author: "u", date: "2026-08-01" } as ReviewEntry;
}

describe("monitor — monitoramento agendado com diff (Onda 3.2)", () => {
  beforeEach(() => {
    localStorage.clear();
    // reset do store: remove todos
    for (const t of listMonitors()) removeMonitor(t.id);
  });

  it("add/list/persist + dedup por appKey (atualiza intervalo)", () => {
    addMonitor({ appKey: "apple:1", appName: "App", intervalMin: 60 });
    addMonitor({ appKey: "apple:1", appName: "App", intervalMin: 1440 });
    const list = listMonitors();
    expect(list).toHaveLength(1);
    expect(list[0].intervalMin).toBe(1440);
    expect(JSON.parse(localStorage.getItem("aso:monitors:v1")!)).toHaveLength(1);
  });

  it("intervalo mínimo é 15min", () => {
    const t = addMonitor({ appKey: "apple:1", appName: "App", intervalMin: 1 });
    expect(t.intervalMin).toBe(15);
  });

  it("isDue: nunca rodou = due; depois do intervalo = due; desativado = nunca", () => {
    const t = addMonitor({ appKey: "apple:1", appName: "App", intervalMin: 60 });
    expect(isDue(t)).toBe(true);
    recordMonitorRun(t.id, snapshotReviews([rev(5)], Date.now()), null);
    const fresh = listMonitors()[0];
    expect(isDue(fresh)).toBe(false);
    // força o relógio 61min no futuro
    expect(isDue(fresh, fresh.lastRunAt! + 61 * 60_000)).toBe(true);
    setMonitorEnabled(fresh.id, false);
    expect(isDue(listMonitors()[0])).toBe(false);
    expect(dueMonitors()).toHaveLength(0);
  });

  it("recordMonitorRun guarda snapshot + diff", () => {
    const t = addMonitor({ appKey: "apple:1", appName: "App", intervalMin: 60 });
    const s1 = snapshotReviews([rev(5), rev(5)], 1000);
    recordMonitorRun(t.id, s1, null);
    const d = diffSnapshots(listMonitors()[0].lastSnapshot, snapshotReviews([rev(5), rev(1), rev(1)], 2000))!;
    recordMonitorRun(t.id, snapshotReviews([rev(5), rev(1), rev(1)], 2000), d);
    const saved = listMonitors()[0];
    expect(saved.lastSnapshot?.reviewCount).toBe(3);
    expect(saved.lastDiff?.newReviews).toBe(1);
  });

  it("snapshotReviews computa count/média/% negativos", () => {
    const s = snapshotReviews([rev(5), rev(4), rev(1), rev(2), rev(3)]);
    expect(s.reviewCount).toBe(5);
    expect(s.avgRating).toBe(3);
    expect(s.pctNegative).toBe(40);
  });

  it("diffSnapshots: honesto no primeiro run + deltas", () => {
    expect(diffSnapshots(undefined, snapshotReviews([rev(5)]))).toBeNull();
    const prev = snapshotReviews([rev(5), rev(5)], 1000);
    const next = snapshotReviews([rev(5), rev(1), rev(1), rev(1)], 2000);
    const d = diffSnapshots(prev, next)!;
    expect(d.newReviews).toBe(2);
    expect(d.ratingDelta).toBeLessThan(0);
    expect(d.pctNegativeDelta).toBeGreaterThan(0);
    expect(d.summary).toContain("+2 reviews novos");
  });

  it("nextRunLabel: agora/em Xmin/em Xh/desativado", () => {
    const t = addMonitor({ appKey: "apple:1", appName: "App", intervalMin: 60 });
    expect(nextRunLabel(t)).toBe("agora");
    recordMonitorRun(t.id, snapshotReviews([], Date.now()), null);
    expect(nextRunLabel(listMonitors()[0])).toBe("em 1h");
    setMonitorEnabled(t.id, false);
    expect(nextRunLabel(listMonitors()[0])).toBe("desativado");
  });

  it("subscribe notifica em mudanças + snapshot memoizado", () => {
    let calls = 0;
    const unsub = subscribeMonitors(() => calls++);
    const ref1 = listMonitors();
    addMonitor({ appKey: "apple:1", appName: "App", intervalMin: 60 });
    expect(calls).toBe(1);
    const ref2 = listMonitors();
    expect(ref2).not.toBe(ref1); // referência nova após write
    expect(listMonitors()).toBe(ref2); // estável entre leituras
    unsub();
  });

  it("storage corrompido = lista vazia honesta", () => {
    localStorage.setItem("aso:monitors:v1", "{quebrado");
    // novo carregamento só aconteceria no reload do módulo — aqui garantimos
    // que o CRUD não quebra com o estado atual
    expect(() => addMonitor({ appKey: "a:1", appName: "A", intervalMin: 60 })).not.toThrow();
  });
});
