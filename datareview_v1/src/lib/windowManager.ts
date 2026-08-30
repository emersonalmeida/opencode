/**
 * Window Manager — gerenciador de janelas flutuantes estilo desktop OS.
 *
 * Cada "janela" é um componente renderizado em camada (absolute positioned)
 * que o usuário pode:
 *  - arrastar pelo header (click + drag),
 *  - redimensionar pelos 8 handles (cantos + bordas),
 *  - minimizar (colapsa a header-only),
 *  - maximizar (preenche o workspace),
 *  - fechar,
 *  - trazer para frente (z-index no foco),
 *  - snap-to-grid (alinhamento a uma grade opcional).
 *
 * O estado (posição, tamanho, z, minimizado) é persistido em localStorage
 * (chave `aso:windows:v1`) para sobreviver a reloads — exatamente como o
 * usuário pediu: "deixar o sistema do seu jeito".
 *
 * Este módulo é GATEADO pela feature flag `ui.window-tiling`. Quando off, as
 * páginas continuam usando o layout de colunas padrão (CollapsibleColumn).
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isFeatureEnabled } from "@/lib/featureFlags";

export interface WinRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WindowState {
  id: string;
  /** Rótulo exibido no header. */
  title: string;
  /** Tipo/conteúdo — usado pelo renderizador para saber o que mostrar. */
  kind: string;
  rect: WinRect;
  /** z-index (maior = mais à frente). */
  z: number;
  /** Minimizado (header-only). */
  minimized: boolean;
  /** Maximizado (preenche o workspace). */
  maximized: boolean;
  /** Posição/tamanho antes de maximizar (para restaurar). */
  prevRect?: WinRect;
}

interface WMStore {
  windows: WindowState[];
  activeId: string | null;
  /** Grade de snap (px). 0 = desligado. */
  gridSize: number;

  open: (w: Omit<WindowState, "z" | "minimized" | "maximized">) => string;
  close: (id: string) => void;
  focus: (id: string) => void;
  move: (id: string, rect: Partial<WinRect>) => void;
  dragDelta: (id: string, dx: number, dy: number) => void;
  resize: (id: string, rect: Partial<WinRect>) => void;
  resizeDelta: (id: string, dx: number, dy: number, edge: string) => void;
  toggleMin: (id: string) => void;
  toggleMax: (id: string) => void;
  restore: (id: string) => void;
  setGridSize: (n: number) => void;
  closeAll: () => void;
  isOn: () => boolean;
}

const DEFAULT_GRID = 20;

function snap(v: number, grid: number): number {
  if (!grid || grid <= 0) return v;
  return Math.round(v / grid) * grid;
}

const nextZ = (wins: WindowState[]): number =>
  wins.length === 0 ? 10 : Math.max(...wins.map((w) => w.z)) + 1;

export const useWM = create<WMStore>()(
  persist(
    (set, get) => ({
      windows: [],
      activeId: null,
      gridSize: DEFAULT_GRID,

      open: (w) => {
        if (!isFeatureEnabled("ui.window-tiling")) return w.id;
        const wins = get().windows;
        if (wins.some((x) => x.id === w.id)) {
          get().focus(w.id);
          return w.id;
        }
        const z = nextZ(wins);
        set({
          windows: [...wins, { ...w, z, minimized: false, maximized: false }],
          activeId: w.id,
        });
        return w.id;
      },

      close: (id) =>
        set((s) => ({
          windows: s.windows.filter((w) => w.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),

      focus: (id) =>
        set((s) => {
          if (s.activeId === id) return {};
          const z = nextZ(s.windows);
          return {
            activeId: id,
            windows: s.windows.map((w) => (w.id === id ? { ...w, z } : w)),
          };
        }),

      move: (id, rect) =>
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === id ? { ...w, rect: { ...w.rect, ...rect } } : w,
          ),
        })),

      dragDelta: (id, dx, dy) =>
        set((s) => ({
          windows: s.windows.map((w) => {
            if (w.id !== id) return w;
            const g = s.gridSize;
            return {
              ...w,
              rect: {
                ...w.rect,
                x: snap(w.rect.x + dx, g),
                y: Math.max(0, snap(w.rect.y + dy, g)),
              },
            };
          }),
        })),

      resize: (id, rect) =>
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === id ? { ...w, rect: { ...w.rect, ...rect } } : w,
          ),
        })),

      resizeDelta: (id, dx, dy, edge) =>
        set((s) => ({
          windows: s.windows.map((w) => {
            if (w.id !== id) return w;
            const g = s.gridSize;
            let { x, y, w: ww, h: hh } = w.rect;
            if (edge.includes("e")) ww = snap(ww + dx, g);
            if (edge.includes("s")) hh = snap(hh + dy, g);
            if (edge.includes("w")) { x = snap(x + dx, g); ww = snap(ww - dx, g); }
            if (edge.includes("n")) { y = snap(y + dy, g); hh = snap(hh - dy, g); }
            ww = Math.max(220, ww);
            hh = Math.max(120, hh);
            return { ...w, rect: { x, y, w: ww, h: hh } };
          }),
        })),

      toggleMin: (id) =>
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === id ? { ...w, minimized: !w.minimized } : w,
          ),
        })),

      toggleMax: (id) =>
        set((s) => ({
          windows: s.windows.map((w) => {
            if (w.id !== id) return w;
            if (w.maximized) {
              return { ...w, maximized: false, rect: w.prevRect ?? w.rect };
            }
            return { ...w, maximized: true, prevRect: w.rect };
          }),
        })),

      restore: (id) =>
        set((s) => ({
          windows: s.windows.map((w) =>
            w.id === id
              ? { ...w, minimized: false, maximized: false, rect: w.prevRect ?? w.rect }
              : w,
          ),
        })),

      setGridSize: (n) => set({ gridSize: Math.max(0, Math.floor(n)) }),

      closeAll: () => set({ windows: [], activeId: null }),

      isOn: () => isFeatureEnabled("ui.window-tiling"),
    }),
    {
      name: "aso:windows:v1",
      partialize: (s) => ({ windows: s.windows, gridSize: s.gridSize }),
    },
  ),
);
