import { useCallback, useEffect, useState } from "react";
import { COLUMN_SIZE_EVENT } from "@/lib/sidebarSizing";

/**
 * Lógica compartilhada de dimensionamento de colunas para TODA sidebar/coluna
 * do app — externas (sistema) e internas (página). Impõe um único contrato de UX:
 *
 *  - Cada coluna tem uma largura expandida, persistida no localStorage para a
 *    preferência do usuário sobreviver a reloads.
 *  - A largura é clampada em `[min, max]`, onde `max` é por padrão 25% do
 *    viewport — nenhuma sidebar pode engolir a coluna central.
 *  - A coluna pode recolher para um rail estreito (ou esconder de vez) —
 *    `collapsed` também é persistido.
 *  - `reset` devolve a largura ao padrão.
 *
 * Todas as sidebars e colunas internas usam este hook para que recolher/
 * expandir/redimensionar funcionem igual em todo lugar (sidebar do sistema e
 * coluna interna de Concept/DecisionCenter).
 */
export interface ColumnSizeOptions {
  /** localStorage key for the expanded width. */
  storageKey: string;
  /** Preferred (default) expanded width in px. */
  defaultWidth: number;
  /** Minimum expanded width in px. */
  minWidth?: number;
  /** Maximum expanded width in px. If omitted, defaults to 25% of viewport. */
  maxWidth?: number;
  /** localStorage key for the collapsed flag (defaults to `${storageKey}-collapsed`). */
  collapsedKey?: string;
  /** Initial collapsed state. */
  defaultCollapsed?: boolean;
}

function loadNum(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

function viewportMax(fallback: number): number {
  if (typeof window === "undefined") return fallback;
  return Math.floor(window.innerWidth * 0.25);
}

export interface ColumnSize {
  /** Expanded width in px (already clamped). */
  width: number;
  /** Whether the column is collapsed to a rail. */
  collapsed: boolean;
  /** Effective rendered width: rail width when collapsed, else `width`. */
  effectiveWidth: (railWidth: number) => number;
  /** Clamp a candidate width to [min, max]. */
  clamp: (w: number) => number;
  /** Set the expanded width (clamped + persisted). */
  setWidth: (w: number) => void;
  /** Apply a pixel delta to the width (clamped + persisted). */
  resize: (deltaPx: number) => void;
  /** Reset to default width. */
  reset: () => void;
  /** Toggle collapse on/off (persisted). */
  toggleCollapsed: () => void;
  /** Explicitly set collapsed state. */
  setCollapsed: (c: boolean) => void;
  /** Absolute min/max in effect (for ResizeHandle ranges). */
  min: number;
  max: number;
}

export function useColumnSize(opts: ColumnSizeOptions): ColumnSize {
  const { storageKey, defaultWidth, collapsedKey } = opts;
  const minWidth = opts.minWidth ?? 220;
  // Padrão global: TODAS as colunas/sidebars iniciam RECOLHIDAS — o centro
  // é o protagonista; laterais são auxiliares (o usuário expande quando
  // precisa). Preferência persistida (chave no localStorage) sempre vence.
  const defaultCollapsed = opts.defaultCollapsed ?? true;
  const maxOverride = opts.maxWidth;
  const cKey = collapsedKey ?? `${storageKey}-collapsed`;

  // max depends on viewport; recompute on resize so 25% stays true.
  const [max, setMax] = useState<number>(() =>
    maxOverride != null ? maxOverride : Math.max(minWidth, viewportMax(defaultWidth)),
  );

  const [width, setWidthState] = useState<number>(() => {
    const stored = loadNum(storageKey, defaultWidth);
    const m = maxOverride != null ? maxOverride : Math.max(minWidth, viewportMax(defaultWidth));
    return Math.min(Math.max(stored, minWidth), m);
  });

  const [collapsed, setCollapsedState] = useState<boolean>(() => loadBool(cKey, defaultCollapsed));

  // Mantém o máximo em sincronia com o viewport (regra dos 25%), salvo se fixado explicitamente.
  useEffect(() => {
    if (maxOverride != null) {
      setMax(maxOverride);
      return;
    }
    const compute = () => setMax(Math.max(minWidth, viewportMax(defaultWidth)));
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [maxOverride, minWidth, defaultWidth]);

  // Re-clamp stored width if the viewport shrank (e.g. window resize).
  useEffect(() => {
    setWidthState((w) => (w > max ? max : w));
  }, [max]);

  // Ajuste programático (sliders/presets em Configurações): re-lê o
  // localStorage quando outra superfície muda esta coluna via setSidebarWidth.
  useEffect(() => {
    const onExternal = (e: Event) => {
      const detail = (e as CustomEvent<{ storageKey?: string }>).detail;
      if (detail?.storageKey && detail.storageKey !== storageKey) return;
      const stored = loadNum(storageKey, defaultWidth);
      setWidthState((w) => {
        const next = Math.min(Math.max(stored, minWidth), max);
        return next === w ? w : next;
      });
    };
    window.addEventListener(COLUMN_SIZE_EVENT, onExternal);
    return () => window.removeEventListener(COLUMN_SIZE_EVENT, onExternal);
  }, [storageKey, defaultWidth, minWidth, max]);

  const clamp = useCallback(
    (w: number) => Math.min(Math.max(w, minWidth), max),
    [minWidth, max],
  );

  const setWidth = useCallback(
    (w: number) => {
      const next = clamp(w);
      setWidthState(next);
      try { localStorage.setItem(storageKey, String(next)); } catch { /* ignore */ }
    },
    [clamp, storageKey],
  );

  const resize = useCallback(
    (deltaPx: number) => setWidthState((w) => {
      const next = clamp(w + deltaPx);
      try { localStorage.setItem(storageKey, String(next)); } catch { /* ignore */ }
      return next;
    }),
    [clamp, storageKey],
  );

  const reset = useCallback(() => setWidth(defaultWidth), [setWidth, defaultWidth]);

  const setCollapsed = useCallback(
    (c: boolean) => {
      setCollapsedState(c);
      try { localStorage.setItem(cKey, c ? "1" : "0"); } catch { /* ignore */ }
    },
    [cKey],
  );

  const toggleCollapsed = useCallback(() => setCollapsedState((c) => {
    const next = !c;
    try { localStorage.setItem(cKey, next ? "1" : "0"); } catch { /* ignore */ }
    return next;
  }), [cKey]);

  const effectiveWidth = useCallback(
    (railWidth: number) => (collapsed ? railWidth : width),
    [collapsed, width],
  );

  return {
    width,
    collapsed,
    effectiveWidth,
    clamp,
    setWidth,
    resize,
    reset,
    toggleCollapsed,
    setCollapsed,
    min: minWidth,
    max,
  };
}
