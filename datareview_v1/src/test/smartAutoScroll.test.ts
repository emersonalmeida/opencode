/**
 * useSmartAutoScroll — contrato de scroll livre durante gerações:
 * só segue o fim quando o usuário JÁ está perto dele; rolar para cima
 * pausa o follow; `resumeFollow` retoma. (DOM real via jsdom, sem mocks.)
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";

function makeEl(scrollHeight = 1000, clientHeight = 200) {
  const el = document.createElement("div");
  let sh = scrollHeight;
  Object.defineProperty(el, "scrollHeight", { get: () => sh, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: clientHeight, configurable: true });
  let top = 0;
  Object.defineProperty(el, "scrollTop", {
    get: () => top,
    set: (v) => { top = v; },
    configurable: true,
  });
  el.scrollTo = (opts?: ScrollToOptions | number) => {
    if (typeof opts === "object" && opts && typeof opts.top === "number") top = opts.top;
  };
  return Object.assign(el, { grow: (h: number) => { sh = h; } });
}

describe("useSmartAutoScroll", () => {
  let el: HTMLElement & { grow: (h: number) => void };

  beforeEach(() => {
    el = makeEl();
  });

  it("segue o fim por padrão quando o usuário já está no fim", () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useSmartAutoScroll<HTMLDivElement>(deps),
      { initialProps: { deps: [1] as readonly unknown[] } },
    );
    act(() => {
      (result.current.ref as { current: HTMLElement | null }).current = el;
      el.scrollTop = 800; // no fim (1000-200-800=0 < 60)
      result.current.onScroll();
    });
    expect(result.current.atBottom).toBe(true);
    act(() => {
      el.grow(2000); // conteúdo cresceu (stream)
      rerender({ deps: [2] as readonly unknown[] });
    });
    expect(el.scrollTop).toBe(2000); // seguiu o fim
  });

  it("rolar para cima pausa o follow (scroll livre durante a geração)", () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useSmartAutoScroll<HTMLDivElement>(deps),
      { initialProps: { deps: [1] as readonly unknown[] } },
    );
    act(() => {
      (result.current.ref as { current: HTMLElement | null }).current = el;
      el.scrollTop = 100; // usuário subiu — longe do fim (1000-200-100=700 > 60)
      result.current.onScroll();
    });
    expect(result.current.atBottom).toBe(false);
    expect(result.current.showJump).toBe(true);
    act(() => rerender({ deps: [2] as readonly unknown[] }));
    expect(el.scrollTop).toBe(100); // NÃO foi puxado ao fim
  });

  it("resumeFollow retoma o acompanhamento do fim", () => {
    const { result, rerender } = renderHook(
      ({ deps }) => useSmartAutoScroll<HTMLDivElement>(deps),
      { initialProps: { deps: [1] as readonly unknown[] } },
    );
    act(() => {
      (result.current.ref as { current: HTMLElement | null }).current = el;
      el.scrollTop = 100;
      result.current.onScroll();
    });
    act(() => result.current.resumeFollow());
    expect(el.scrollTop).toBe(1000);
    expect(result.current.atBottom).toBe(true);
    act(() => rerender({ deps: [2] as readonly unknown[] }));
    expect(el.scrollTop).toBe(1000);
  });
});
