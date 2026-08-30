import { describe, it, expect, beforeEach } from "vitest";
import { useWM } from "@/lib/windowManager";
import { setFeatureFlag } from "@/lib/featureFlags";

describe("Window Manager store", () => {
  beforeEach(() => {
    useWM.setState({ windows: [], activeId: null, gridSize: 20 });
    setFeatureFlag("ui.window-tiling", true);
  });

  it("opens a window with next z-index", () => {
    const id = useWM.getState().open({
      id: "w1", title: "Janela 1", kind: "test",
      rect: { x: 10, y: 10, w: 320, h: 240 },
    });
    expect(id).toBe("w1");
    const w = useWM.getState().windows;
    expect(w).toHaveLength(1);
    expect(w[0].z).toBe(10);
    expect(w[0].minimized).toBe(false);
    expect(useWM.getState().activeId).toBe("w1");
  });

  it("focuses brings to front and sets active", () => {
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 0, y: 0, w: 100, h: 100 } });
    useWM.getState().open({ id: "w2", title: "B", kind: "k", rect: { x: 0, y: 0, w: 100, h: 100 } });
    useWM.getState().focus("w1");
    const w = useWM.getState().windows;
    expect(useWM.getState().activeId).toBe("w1");
    expect(w.find((x) => x.id === "w1")!.z).toBeGreaterThan(w.find((x) => x.id === "w2")!.z);
  });

  it("open re-focuses existing window instead of duplicating", () => {
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 0, y: 0, w: 100, h: 100 } });
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 0, y: 0, w: 100, h: 100 } });
    expect(useWM.getState().windows).toHaveLength(1);
  });

  it("dragDelta moves position with snap", () => {
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 15, y: 15, w: 100, h: 100 } });
    useWM.getState().dragDelta("w1", 8, 8); // 15+8=23, snap(23,20)=20
    const r = useWM.getState().windows[0].rect;
    expect(r.x).toBe(20);
    expect(r.y).toBe(20);
  });

  it("resizeDelta grows east/south with snap", () => {
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 0, y: 0, w: 200, h: 160 } });
    useWM.getState().resizeDelta("w1", 40, 40, "se"); // 200+40=240 -> snap 240; 160+40=200 -> snap 200
    const r = useWM.getState().windows[0].rect;
    expect(r.w).toBe(240);
    expect(r.h).toBe(200);
  });

  it("resizeDelta clamps west/north without going below min", () => {
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 100, y: 100, w: 250, h: 200 } });
    useWM.getState().resizeDelta("w1", 300, 300, "nw");
    const r = useWM.getState().windows[0].rect;
    expect(r.w).toBeGreaterThanOrEqual(220);
    expect(r.h).toBeGreaterThanOrEqual(120);
  });

  it("toggleMin flips minimized", () => {
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 0, y: 0, w: 100, h: 100 } });
    useWM.getState().toggleMin("w1");
    expect(useWM.getState().windows[0].minimized).toBe(true);
    useWM.getState().toggleMin("w1");
    expect(useWM.getState().windows[0].minimized).toBe(false);
  });

  it("toggleMax maximizes then restores prevRect", () => {
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 30, y: 30, w: 300, h: 220 } });
    useWM.getState().toggleMax("w1");
    expect(useWM.getState().windows[0].maximized).toBe(true);
    expect(useWM.getState().windows[0].prevRect).toEqual({ x: 30, y: 30, w: 300, h: 220 });
    useWM.getState().toggleMax("w1");
    const w = useWM.getState().windows[0];
    expect(w.maximized).toBe(false);
    expect(w.rect).toEqual({ x: 30, y: 30, w: 300, h: 220 });
  });

  it("close removes the window and clears activeId if it was active", () => {
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 0, y: 0, w: 100, h: 100 } });
    useWM.getState().close("w1");
    expect(useWM.getState().windows).toHaveLength(0);
    expect(useWM.getState().activeId).toBeNull();
  });

  it("closeAll clears everything", () => {
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 0, y: 0, w: 100, h: 100 } });
    useWM.getState().open({ id: "w2", title: "B", kind: "k", rect: { x: 0, y: 0, w: 100, h: 100 } });
    useWM.getState().closeAll();
    expect(useWM.getState().windows).toHaveLength(0);
    expect(useWM.getState().activeId).toBeNull();
  });

  it("setGridSize clamps to >=0", () => {
    useWM.getState().setGridSize(-5);
    expect(useWM.getState().gridSize).toBe(0);
    useWM.getState().setGridSize(32);
    expect(useWM.getState().gridSize).toBe(32);
  });

  it("gridSize 0 disables snapping (identity)", () => {
    useWM.setState({ gridSize: 0 });
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 15, y: 15, w: 100, h: 100 } });
    useWM.getState().dragDelta("w1", 8, 8);
    const r = useWM.getState().windows[0].rect;
    expect(r.x).toBe(23); // no snap
    expect(r.y).toBe(23);
  });

  it("open is a no-op when window-tiling flag is off", () => {
    setFeatureFlag("ui.window-tiling", false);
    useWM.getState().open({ id: "w1", title: "A", kind: "k", rect: { x: 0, y: 0, w: 100, h: 100 } });
    expect(useWM.getState().windows).toHaveLength(0);
  });
});
