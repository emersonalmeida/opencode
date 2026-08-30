/**
 * Testes dos modos de coleta da Uni (rápida/normal/max/custom) e dos helpers
 * de multi-seleção de recursos (toggle, dedup, cartesiano).
 */
import { describe, expect, it } from "vitest";
import {
  COLLECT_MODES,
  CUSTOM_LIMIT_MAX,
  cartesianCap,
  dedupItems,
  modeExpand,
  modeLimit,
  toggleInList,
} from "@/lib/uni/collectModes";
import type { UniItem } from "@/lib/uni/types";

describe("collectModes — modos de coleta", () => {
  it("define os 4 modos na ordem rápida → max → custom", () => {
    expect(COLLECT_MODES.map((m) => m.id)).toEqual(["fast", "normal", "max", "custom"]);
  });

  it("limites por modo: fast < normal < max", () => {
    expect(modeLimit("fast")).toBe(5);
    expect(modeLimit("normal")).toBe(12);
    expect(modeLimit("max")).toBe(50);
    expect(modeLimit("fast") < modeLimit("normal")).toBe(true);
    expect(modeLimit("normal") < modeLimit("max")).toBe(true);
  });

  it("custom faz clamp entre 1 e 500", () => {
    expect(modeLimit("custom", 0)).toBe(1);
    expect(modeLimit("custom", 37)).toBe(37);
    expect(modeLimit("custom", 9999)).toBe(CUSTOM_LIMIT_MAX);
    expect(modeLimit("custom", Number.NaN)).toBe(1);
  });

  it("expand profundo só no modo max", () => {
    expect(modeExpand("max")).toBe(true);
    expect(modeExpand("fast")).toBe(false);
    expect(modeExpand("normal")).toBe(false);
    expect(modeExpand("custom")).toBe(false);
  });

  it("toggleInList adiciona e remove", () => {
    expect(toggleInList(["web"], "youtube")).toEqual(["web", "youtube"]);
    expect(toggleInList(["web", "youtube"], "web")).toEqual(["youtube"]);
  });

  it("dedupItems mantém o maior score por id", () => {
    const items: UniItem[] = [
      { id: "s:a", source: "suggest", kind: "suggestion", title: "a", score: 10 },
      { id: "s:a", source: "suggest", kind: "suggestion", title: "a", score: 99 },
      { id: "s:b", source: "suggest", kind: "suggestion", title: "b" },
    ];
    const out = dedupItems(items);
    expect(out).toHaveLength(2);
    expect(out.find((i) => i.id === "s:a")?.score).toBe(99);
  });

  it("cartesianCap gera pares até o teto", () => {
    const pares = cartesianCap(["a", "b", "c"], ["x", "y"], 4);
    expect(pares).toEqual([
      ["a", "x"],
      ["a", "y"],
      ["b", "x"],
      ["b", "y"],
    ]);
    expect(cartesianCap(["a"], ["x"], 10)).toEqual([["a", "x"]]);
  });
});
