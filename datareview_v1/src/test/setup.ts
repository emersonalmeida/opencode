import "@testing-library/jest-dom";

// Polyfills de DOM — só aplicados em ambiente jsdom. Testes marcados com
// `// @vitest-environment node` (ex.: rawStore server-side) pulam este bloco
// porque Element/window não existem no ambiente node.
const isDom = typeof Element !== "undefined";

if (isDom) {
  // jsdom não implementa scrollIntoView (usado pelo auto-follow do AIOutputCard).
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }

  // jsdom não implementa Element.scrollTo (auto-scroll do Chat).
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => {};
  }
}

// jsdom não implementa ResizeObserver (recharts/ResponsiveContainer).
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof globalThis.ResizeObserver;
}

if (isDom) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}
