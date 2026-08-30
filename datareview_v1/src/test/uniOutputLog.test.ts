/**
 * Testes do uniOutputLog — formatação terminal (estilo _uni.py) e store da
 * aba "Output" da página Uni.
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  appendRunEvent,
  clearOutputLog,
  formatClock,
  itemLines,
  logCollectedItems,
  progressLine,
  runFinishLine,
  runStartLine,
  subscribeOutputLog,
  useUniOutputLog,
  type RunInfo,
} from "@/lib/uni/uniOutputLog";
import type { UniItem } from "@/lib/uni/types";
import { renderHook } from "@testing-library/react";

function makeRun(overrides: Partial<RunInfo> = {}): RunInfo {
  return {
    id: "run_1",
    sourceId: "suggest",
    collector: "uni-suggest",
    params: { action: "expand", query: "bitcoin", vertical: "web", region: "br" },
    startedAt: 1000,
    status: "running",
    errors: [],
    ...overrides,
  };
}

function makeItem(title: string, score?: number): UniItem {
  return { id: `x:${title}`, source: "suggest", kind: "suggestion", title, score };
}

beforeEach(() => {
  clearOutputLog();
});

describe("formatação terminal", () => {
  it("formatClock produz HH:MM:SS", () => {
    const ts = new Date(2026, 7, 23, 9, 5, 3).getTime();
    expect(formatClock(ts)).toBe("09:05:03");
  });

  it("runStartLine traz fonte em maiúsculo + resumo de params", () => {
    const line = runStartLine(makeRun());
    expect(line).toContain("SUGGEST");
    expect(line).toContain("query=bitcoin");
    expect(line).toContain("vertical=web");
  });

  it("runFinishLine concluído mostra duração e yield", () => {
    const line = runFinishLine(makeRun({ status: "completed", finishedAt: 3500, yielded: 42 }));
    expect(line).toContain("concluído");
    expect(line).toContain("2.5s");
    expect(line).toContain("42 itens");
  });

  it("runFinishLine falha mostra o primeiro erro", () => {
    const line = runFinishLine(makeRun({
      status: "failed",
      finishedAt: 2000,
      errors: [{ endpoint: "google-suggest", message: "HTTP 429", at: 2000 }],
    }));
    expect(line).toContain("falhou");
    expect(line).toContain("HTTP 429");
  });

  it("progressLine prefixa com …", () => {
    expect(progressLine("expansão 4/37")).toBe("… expansão 4/37");
  });

  it("itemLines numera a partir do índice e mostra score", () => {
    const lines = itemLines([makeItem("bitcoin hoje", 900), makeItem("bitcoin preço")], 3);
    expect(lines[0]).toBe("04. bitcoin hoje (▲ 900)");
    expect(lines[1]).toBe("05. bitcoin preço");
  });

  it("itemLines respeita maxLines", () => {
    const items = Array.from({ length: 50 }, (_, i) => makeItem(`q${i}`));
    expect(itemLines(items, 0, 10)).toHaveLength(10);
  });
});

describe("store do log", () => {
  it("appendRunEvent start/finish adiciona linhas header/success", () => {
    appendRunEvent({ event: "start", run: makeRun() });
    appendRunEvent({ event: "finish", run: makeRun({ status: "completed", finishedAt: 2000, yielded: 5 }) });
    let seen: unknown[] = [];
    const unsub = subscribeOutputLog(() => {
      /* noop */
    });
    const { result } = renderHook(() => useUniOutputLog());
    expect(result.current.map((l) => l.kind)).toEqual(["header", "success"]);
    unsub();
    seen = [];
    void seen;
  });

  it("falha vira linha de erro e erros extras viram linhas próprias", () => {
    appendRunEvent({
      event: "finish",
      run: makeRun({
        status: "failed",
        finishedAt: 2000,
        errors: [
          { endpoint: "a", message: "e1", at: 1 },
          { endpoint: "b", message: "e2", at: 2 },
        ],
      }),
    });
    const { result } = renderHook(() => useUniOutputLog());
    expect(result.current.filter((l) => l.kind === "error")).toHaveLength(2);
  });

  it("logCollectedItems imprime itens numerados continuamente entre runs", () => {
    appendRunEvent({ event: "start", run: makeRun() });
    logCollectedItems([makeItem("a"), makeItem("b")]);
    logCollectedItems([makeItem("c")]);
    const { result } = renderHook(() => useUniOutputLog());
    const texts = result.current.filter((l) => l.kind === "item").map((l) => l.text);
    expect(texts).toEqual(["01. a", "02. b", "03. c"]);
  });

  it("start de nova run reinicia a numeração de itens", () => {
    logCollectedItems([makeItem("a")]);
    appendRunEvent({ event: "start", run: makeRun({ id: "run_2" }) });
    logCollectedItems([makeItem("b")]);
    const { result } = renderHook(() => useUniOutputLog());
    const texts = result.current.filter((l) => l.kind === "item").map((l) => l.text);
    expect(texts).toEqual(["01. a", "01. b"]);
  });

  it("respeita o cap de 400 linhas", () => {
    for (let i = 0; i < 450; i++) {
      appendRunEvent({ event: "progress", progress: { runId: "r", sourceId: "suggest", message: `p${i}`, at: i } });
    }
    const { result } = renderHook(() => useUniOutputLog());
    expect(result.current.length).toBe(400);
    expect(result.current[result.current.length - 1].text).toContain("p449");
  });

  it("clearOutputLog esvazia e notifica", () => {
    logCollectedItems([makeItem("a")]);
    let calls = 0;
    const unsub = subscribeOutputLog(() => {
      calls += 1;
    });
    clearOutputLog();
    expect(calls).toBe(1);
    const { result } = renderHook(() => useUniOutputLog());
    expect(result.current).toEqual([]);
    unsub();
  });
});
