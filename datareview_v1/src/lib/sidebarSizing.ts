/**
 * Padronização de largura das sidebars do sistema (esquerda/direita).
 *
 * Fonte única de verdade para defaults/mínimos/rail e para ajuste
 * programático da largura (além do drag do ResizeHandle). As larguras
 * persistem nas mesmas chaves de localStorage do `useColumnSize`, e um
 * evento `COLUMN_SIZE_EVENT` notifica o hook para re-ler e re-clampear —
 * assim sliders/presets em Configurações aplicam ao vivo, sem reload.
 *
 * Contrato padronizado (igual nas duas sidebars):
 *  - default 280 (esquerda) / 400 (direita — chat IA pede mais espaço)
 *  - min 220/320 · max 25% do viewport (regra global do useColumnSize)
 *  - rail 56px quando colapsada
 *  - presets: Estreita (min) · Padrão (default) · Larga (min + 160)
 */
export const COLUMN_SIZE_EVENT = "aso:column-size-changed";

export type SidebarSide = "left" | "right";

export interface SidebarSpec {
  side: SidebarSide;
  label: string;
  storageKey: string;
  defaultWidth: number;
  minWidth: number;
  railWidth: number;
  presets: { id: string; label: string; width: number }[];
}

function makeSpec(
  side: SidebarSide,
  label: string,
  defaultWidth: number,
  minWidth: number,
  railWidth: number,
): SidebarSpec {
  return {
    side,
    label,
    storageKey: `aso:sidebar-${side}-w`,
    defaultWidth,
    minWidth,
    railWidth,
    presets: [
      { id: "narrow", label: "Estreita", width: minWidth },
      { id: "default", label: "Padrão", width: defaultWidth },
      { id: "wide", label: "Larga", width: defaultWidth + 160 },
    ],
  };
}

export const SIDEBARS: Record<SidebarSide, SidebarSpec> = {
  left: makeSpec("left", "Sidebar esquerda", 280, 220, 56),
  right: makeSpec("right", "Sidebar direita", 400, 320, 56),
};

export const MAX_VIEWPORT_RATIO = 0.25;

/** Maior largura permitida dadas as regras (25% do viewport, nunca abaixo do min). */
export function sidebarMax(side: SidebarSide, viewportW?: number): number {
  const spec = SIDEBARS[side];
  const vw = viewportW ?? (typeof window !== "undefined" ? window.innerWidth : 1280);
  return Math.max(spec.minWidth, Math.floor(vw * MAX_VIEWPORT_RATIO));
}

/** Clampa uma largura candidata nas regras padronizadas. */
export function clampSidebarWidth(side: SidebarSide, px: number, viewportW?: number): number {
  const spec = SIDEBARS[side];
  return Math.min(Math.max(Math.round(px), spec.minWidth), sidebarMax(side, viewportW));
}

/** Lê a largura persistida (ou default), já clampeada. */
export function getSidebarWidth(side: SidebarSide, viewportW?: number): number {
  const spec = SIDEBARS[side];
  let stored: number | null = null;
  try {
    const v = Number(localStorage.getItem(spec.storageKey));
    if (Number.isFinite(v) && v > 0) stored = v;
  } catch { /* ignore */ }
  return clampSidebarWidth(side, stored ?? spec.defaultWidth, viewportW);
}

/**
 * Ajusta a largura programaticamente (slider/preset/reset) e notifica todos
 * os `useColumnSize` montados para aplicar ao vivo.
 */
export function setSidebarWidth(side: SidebarSide, px: number, viewportW?: number): number {
  const spec = SIDEBARS[side];
  const next = clampSidebarWidth(side, px, viewportW);
  try {
    localStorage.setItem(spec.storageKey, String(next));
  } catch { /* ignore */ }
  try {
    window.dispatchEvent(
      new CustomEvent(COLUMN_SIZE_EVENT, { detail: { storageKey: spec.storageKey } }),
    );
  } catch { /* ignore */ }
  return next;
}

/** Volta a sidebar à largura padrão. */
export function resetSidebarWidth(side: SidebarSide, viewportW?: number): number {
  return setSidebarWidth(side, SIDEBARS[side].defaultWidth, viewportW);
}

/** Identifica qual preset (se algum) corresponde à largura atual. */
export function activePreset(side: SidebarSide, width: number): string | null {
  return SIDEBARS[side].presets.find((p) => p.width === width)?.id ?? null;
}
