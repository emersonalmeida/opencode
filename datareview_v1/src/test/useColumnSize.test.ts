import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useColumnSize } from "@/lib/useColumnSize";

beforeEach(() => {
  localStorage.clear();
  // jsdom default innerWidth is 1024; 25% = 256.
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
});

describe("useColumnSize", () => {
  it("starts at the default width and expanded state", () => {
    const { result } = renderHook(() =>
      useColumnSize({ storageKey: "col", defaultWidth: 240, defaultCollapsed: false }),
    );
    expect(result.current.width).toBe(240);
    expect(result.current.collapsed).toBe(false);
    expect(result.current.effectiveWidth(56)).toBe(240);
  });

  it("clamps the stored width to max 25% of the viewport", () => {
    // Persist an absurdly large width; it must be clamped down to 256 (25% of 1024).
    localStorage.setItem("col", "9999");
    const { result } = renderHook(() =>
      useColumnSize({ storageKey: "col", defaultWidth: 240 }),
    );
    expect(result.current.width).toBeLessThanOrEqual(256);
    expect(result.current.max).toBe(256);
  });

  it("respects the min width", () => {
    const { result } = renderHook(() =>
      useColumnSize({ storageKey: "col2", defaultWidth: 240, minWidth: 200 }),
    );
    act(() => result.current.resize(-1000));
    expect(result.current.width).toBe(200);
  });

  it("starts COLLAPSED by default when nothing is stored (global rule)", () => {
    const { result } = renderHook(() =>
      useColumnSize({ storageKey: "col-fresh", defaultWidth: 240 }),
    );
    expect(result.current.collapsed).toBe(true);
    expect(result.current.effectiveWidth(56)).toBe(56);
  });

  it("stored collapsed preference wins over the default", () => {
    localStorage.setItem("col-pref-collapsed", "0");
    const { result } = renderHook(() =>
      useColumnSize({ storageKey: "col-pref", defaultWidth: 240 }),
    );
    expect(result.current.collapsed).toBe(false);
  });

  it("toggleCollapsed flips state and persists", () => {
    const { result } = renderHook(() =>
      useColumnSize({ storageKey: "col3", defaultWidth: 240, defaultCollapsed: false }),
    );
    expect(result.current.collapsed).toBe(false);
    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem("col3-collapsed")).toBe("1");
    // effective width falls back to the rail width when collapsed.
    expect(result.current.effectiveWidth(56)).toBe(56);
  });

  it("reset returns to the default width", () => {
    const { result } = renderHook(() =>
      useColumnSize({ storageKey: "col4", defaultWidth: 240 }),
    );
    act(() => result.current.setWidth(220));
    act(() => result.current.reset());
    expect(result.current.width).toBe(240);
  });

  it("respects an explicit maxWidth when provided (overrides 25% rule)", () => {
    const { result } = renderHook(() =>
      useColumnSize({ storageKey: "col5", defaultWidth: 240, maxWidth: 600 }),
    );
    expect(result.current.max).toBe(600);
    act(() => result.current.setWidth(550));
    expect(result.current.width).toBe(550);
  });
});
