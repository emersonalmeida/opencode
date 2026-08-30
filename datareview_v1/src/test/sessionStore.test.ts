import { describe, it, expect, beforeEach } from "vitest";
import {
  recordGeneration, listGenerations, getGeneration, deleteGeneration, clearGenerations,
  saveCanvasSnapshot, listSnapshots, getSnapshot, deleteSnapshot, renameSnapshot,
  subscribeSessions, type GenerationType, type GenerationRecord,
} from "@/lib/sessionStore";

const GEN_KEY = "aso:generations:v1";
const SNAP_KEY = "aso:canvas-sessions:v1";

beforeEach(() => {
  localStorage.clear();
});

describe("sessionStore — generations", () => {
  it("records and lists generations", () => {
    const id = recordGeneration({ type: "collect", title: "Nubank · apple", appKeys: ["apple:1"], summary: "100 reviews", source: "collect" });
    expect(id).toBeTruthy();
    const list = listGenerations();
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("Nubank · apple");
    expect(list[0].type).toBe("collect");
  });

  it("gets a generation by id", () => {
    const id = recordGeneration({ type: "ai-section", title: "Resumo", appKeys: [], markdown: "# Resumo\nok", source: "atlas" });
    const g = getGeneration(id);
    expect(g?.markdown).toContain("# Resumo");
    expect(g?.source).toBe("atlas");
  });

  it("deletes a generation", () => {
    const id = recordGeneration({ type: "collect", title: "x", appKeys: [], source: "collect" });
    deleteGeneration(id);
    expect(listGenerations().length).toBe(0);
  });

  it("clears all generations", () => {
    recordGeneration({ type: "collect", title: "a", appKeys: [], source: "collect" });
    recordGeneration({ type: "chat", title: "b", appKeys: [], source: "chat" });
    clearGenerations();
    expect(listGenerations().length).toBe(0);
  });

  it("orders generations newest-first", () => {
    recordGeneration({ type: "collect", title: "old", appKeys: [], source: "collect" });
    recordGeneration({ type: "collect", title: "new", appKeys: [], source: "collect" });
    const list = listGenerations();
    expect(list[0].title).toBe("new");
    expect(list[1].title).toBe("old");
  });

  it("capped at max generations", () => {
    for (let i = 0; i < 205; i++) recordGeneration({ type: "collect", title: `g${i}`, appKeys: [], source: "collect" });
    expect(listGenerations().length).toBeLessThanOrEqual(200);
  });

  it("filters by type via listGenerations(type)", () => {
    recordGeneration({ type: "collect", title: "Nubank apple", appKeys: [], summary: "100 reviews", source: "collect" });
    recordGeneration({ type: "chat", title: "Spotify google", appKeys: [], summary: "200 reviews", source: "chat" });
    expect(listGenerations("collect").length).toBe(1);
    expect(listGenerations("chat").length).toBe(1);
    expect(listGenerations().length).toBe(2);
  });

  it("supports pub/sub subscription", () => {
    let calls = 0;
    const unsub = subscribeSessions(() => calls++);
    recordGeneration({ type: "collect", title: "x", appKeys: [], source: "collect" });
    expect(calls).toBeGreaterThan(0);
    unsub();
  });
});

describe("sessionStore — canvas snapshots", () => {
  it("saves and restores a canvas snapshot", () => {
    const nodes = [{ id: "n1", type: "analyze", position: { x: 0, y: 0 }, data: { kind: "analyze" as const, label: "A", config: {} } }];
    const edges = [{ id: "e1", source: "n1", target: "n2", animated: true }];
    const output = { n1: { markdown: "# ok" } };
    const status = { n1: "done" };
    const id = saveCanvasSnapshot("Minha sessão", nodes, edges, output, status);
    expect(id).toBeTruthy();
    const snap = getSnapshot(id);
    expect(snap?.title).toBe("Minha sessão");
    expect(snap?.nodes.length).toBe(1);
    expect(snap?.outputs.n1).toEqual({ markdown: "# ok" });
  });

  it("lists snapshots newest-first", () => {
    const n: never[] = [];
    saveCanvasSnapshot("old", [], [], {}, {});
    saveCanvasSnapshot("new", [], [], {}, {});
    const list = listSnapshots();
    expect(list[0].title).toBe("new");
  });

  it("renames a snapshot", () => {
    const id = saveCanvasSnapshot("x", [], [], {}, {});
    renameSnapshot(id, "renamed");
    expect(getSnapshot(id)?.title).toBe("renamed");
  });

  it("deletes a snapshot", () => {
    const id = saveCanvasSnapshot("x", [], [], {}, {});
    deleteSnapshot(id);
    expect(listSnapshots().length).toBe(0);
  });
});

describe("sessionStore — persistence across reload", () => {
  it("generations survive a localStorage reload", () => {
    recordGeneration({ type: "atlas-run", title: "Pipeline completo", appKeys: ["apple:1"], markdown: "# Atlas", source: "atlas" });
    // Simulate reload: listGenerations reads from localStorage fresh.
    expect(listGenerations().length).toBe(1);
    // Verify the raw key exists.
    expect(localStorage.getItem(GEN_KEY)).toBeTruthy();
    expect(localStorage.getItem(SNAP_KEY)).toBeNull();
  });
});

describe("sessionStore — type coverage", () => {
  it("accepts all generation types", () => {
    const types: GenerationType[] = ["collect", "atlas-run", "canvas-run", "chat", "ai-section"];
    for (const t of types) {
      recordGeneration({ type: t, title: t, appKeys: [], source: "test" });
    }
    expect(listGenerations().length).toBe(types.length);
  });
});
