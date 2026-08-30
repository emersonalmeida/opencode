// Telemetria de rate-limit (todo.md P0): contadores do servidor + regra de
// degradado + alerta ao usuário no cliente (guarda permanente).
import { describe, it, expect, beforeEach } from "vitest";
import { listActivities, clearActivity } from "@/lib/activityStore";
import { checkAppleTelemetry } from "@/lib/rateLimitAlerts";
import { recordStatus, getTelemetry, isDegraded } from "../../server/lib/rateLimitTelemetry";

describe("rateLimitTelemetry (servidor)", () => {
  it("recordStatus conta por fonte e separa 429/transitório/outros", () => {
    const before = getTelemetry();
    recordStatus("amp", 200);
    recordStatus("amp", 429);
    recordStatus("amp", 0);
    recordStatus("amp", 404);
    const after = getTelemetry();
    expect(after.sources.amp.ok - before.sources.amp.ok).toBe(1);
    expect(after.sources.amp.status429 - before.sources.amp.status429).toBe(1);
    expect(after.sources.amp.status0 - before.sources.amp.status0).toBe(1);
    expect(after.sources.amp.other - before.sources.amp.other).toBe(1);
  });

  it("getTelemetry é snapshot independente (mutações futuras não afetam)", () => {
    const snap = getTelemetry();
    recordStatus("ssr", 429);
    const next = getTelemetry();
    expect(next.sources.ssr.status429).toBe(snap.sources.ssr.status429 + 1);
  });

  it("isDegraded: <10 tentativas nunca degradada; ≥30% 429s degrada", () => {
    expect(isDegraded({ attempts: 9, ok: 0, status429: 9, status0: 0, other: 0, last429At: null })).toBe(false);
    expect(isDegraded({ attempts: 10, ok: 7, status429: 3, status0: 0, other: 0, last429At: null })).toBe(true);
    expect(isDegraded({ attempts: 100, ok: 80, status429: 20, status0: 0, other: 0, last429At: null })).toBe(false);
  });

  it("isDegraded: threshold apertado — 29% ainda não degrada", () => {
    expect(isDegraded({ attempts: 100, ok: 60, status429: 29, status0: 0, other: 0, last429At: null })).toBe(false);
  });
});

describe("checkAppleTelemetry (cliente)", () => {
  beforeEach(() => {
    clearActivity();
    localStorage.clear();
  });

  it("degraded=true loga no activityStore com contagem de 429", () => {
    checkAppleTelemetry({ amp: { attempts: 20, ok: 10, status429: 10, status0: 0, other: 0, last429At: null }, degraded: true }, "Nubank");
    const events = listActivities();
    expect(events.length).toBe(1);
    expect(events[0].source).toBe("apple-reviews");
    expect(events[0].message).toContain("10/20");
  });

  it("sem telemetria ou degraded=false não loga nada", () => {
    checkAppleTelemetry(undefined, "x");
    checkAppleTelemetry({ amp: { attempts: 4, ok: 4, status429: 0, status0: 0, other: 0, last429At: null }, degraded: false }, "x");
    expect(listActivities()).toEqual([]);
  });
});
