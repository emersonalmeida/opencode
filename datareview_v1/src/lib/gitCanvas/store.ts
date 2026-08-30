/**
 * Git Canvas — store da página (zustand).
 *
 * Separa estado da UI dos providers remotos (spec §27/§40): o store guarda o
 * `ProjectMap` normalizado + a projeção derivada (nodes/edges) + seleção +
 * visão. Providers só escrevem via `loadMap`. O modo demo é explícito e
 * persistente — o badge DEMO MODE depende só de `map.demo`.
 */
import { create } from "zustand";
import type { Edge } from "@xyflow/react";
import { buildCanvasGraph, type GitCanvasNode } from "./graph";
import { buildDemoProjectMap } from "./demoData";
import { GIT_CANVAS_VIEWS, type GitCanvasView, type ProjectMap } from "./types";

const STORAGE_KEY = "aso:git-canvas:v1";
const UPLOAD_MAP_KEY = "aso:git-canvas-upload:v1";

export type GitCanvasMode = "demo" | "github" | "upload" | null;

interface PersistedState {
  onboarded: boolean;
  mode: "demo" | "github" | "upload" | null;
  /** última visão usada (project/git/…/blocks) — o usuário volta onde parou. */
  view?: GitCanvasView;
}

function loadUploadMaps(): Record<string, ProjectMap> {
  try {
    const raw = localStorage.getItem(UPLOAD_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ProjectMap> | ProjectMap;
    // migração: se for um mapa único (shape antigo), converte para Record
    if (!parsed || typeof parsed !== "object") return {};
    if ("project" in parsed && "commits" in parsed) {
      const single = parsed as ProjectMap;
      const name = single.project.name;
      return { [name]: single };
    }
    return parsed as Record<string, ProjectMap>;
  } catch {
    return {};
  }
}

function persistUploadMaps(maps: Record<string, ProjectMap>) {
  try {
    localStorage.setItem(UPLOAD_MAP_KEY, JSON.stringify(maps));
  } catch { /* storage cheio/bloqueado */ }
}

function loadPersisted(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PersistedState>;
      const mode = p.mode === "github" ? "github" : p.mode === "demo" ? "demo" : p.mode === "upload" ? "upload" : null;
      const view = p.view && GIT_CANVAS_VIEWS.some((v) => v.id === p.view) ? p.view : undefined;
      return { onboarded: p.onboarded === true, mode, view };
    }
  } catch { /* storage corrompido → estado inicial */ }
  return { onboarded: false, mode: null };
}

function persist(s: PersistedState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* cheio/bloqueado */ }
}

export interface GitCanvasState {
  map: ProjectMap | null;
  view: GitCanvasView;
  nodes: GitCanvasNode[];
  edges: Edge[];
  selectedId: string | null;
  /** onboarding concluído (§36) — false mostra a primeira experiência. */
  onboarded: boolean;
  mode: GitCanvasMode;
  /** metadados do último upload (nome do repo, arquivos lidos, gaps). */
  uploadMeta: {
    name: string;
    filesRead: number;
    gaps: string[];
    source?: "upload" | "local-snapshot" | "local-folder";
  } | null;
  /** mapas de upload persistidos (multi-repositório). Chave: nome do repo. */
  uploadMaps: Record<string, ProjectMap>;
  /** nome do mapa de upload ativo (quando mode === "upload"). */
  activeUploadName: string | null;

  setView(view: GitCanvasView): void;
  loadMap(map: ProjectMap, mode: "demo" | "github"): void;
  loadUpload(map: ProjectMap, meta: GitCanvasState["uploadMeta"]): void;
  loadDemo(): void;
  unload(): void;
  setNodes(nodes: GitCanvasNode[]): void;
  select(nodeId: string | null): void;
  /** troca para outro repo enviado (sem re-upload). */
  switchUpload(name: string): void;
  /** remove um repo da lista de uploads. */
  removeUpload(name: string): void;
}

function project(map: ProjectMap | null, view: GitCanvasView): { nodes: GitCanvasNode[]; edges: Edge[] } {
  if (!map) return { nodes: [], edges: [] };
  return buildCanvasGraph(map, view);
}

export const useGitCanvas = create<GitCanvasState>((set, get) => {
  const persisted = loadPersisted();
  const uploadMaps = persisted.mode === "upload" ? loadUploadMaps() : {};
  const uploadMapNames = Object.keys(uploadMaps);
  const activeUploadName = uploadMapNames.length > 0 ? uploadMapNames[0] : null;
  const uploadMap = activeUploadName ? uploadMaps[activeUploadName] : null;
  const initialMap = persisted.onboarded && persisted.mode === "demo" ? buildDemoProjectMap() : uploadMap;
  const initialView = persisted.view ?? "project";
  return {
    map: initialMap,
    view: initialView,
    ...project(initialMap, initialView),
    selectedId: null,
    onboarded: persisted.onboarded && (persisted.mode !== "upload" || !!uploadMap),
    mode: persisted.mode,
    uploadMeta: uploadMap?.uploadMeta ?? null,
    uploadMaps,
    activeUploadName,

    setView(view) {
      const { map } = get();
      persist({ onboarded: get().onboarded, mode: get().mode, view });
      set({ view, ...project(map, view), selectedId: null });
    },
    loadMap(map, mode) {
      persist({ onboarded: true, mode, view: get().view });
      // ao sair do upload, mantém os mapas salvos mas marca como inativo
      set({ map, mode, onboarded: true, uploadMeta: null, activeUploadName: null, ...project(map, get().view), selectedId: null });
    },
    loadUpload(map, meta) {
      const name = map.project.name;
      const maps = { ...get().uploadMaps, [name]: map };
      persist({ onboarded: true, mode: "upload", view: get().view });
      persistUploadMaps(maps);
      set({ map, mode: "upload", onboarded: true, uploadMeta: meta, uploadMaps: maps, activeUploadName: name, ...project(map, get().view), selectedId: null });
    },
    loadDemo() {
      get().loadMap(buildDemoProjectMap(), "demo");
    },
    unload() {
      persist({ onboarded: false, mode: null, view: get().view });
      set({ map: null, mode: null, onboarded: false, uploadMeta: null, activeUploadName: null, nodes: [], edges: [], selectedId: null });
    },
    switchUpload(name) {
      const maps = get().uploadMaps;
      const map = maps[name];
      if (!map) return;
      persist({ onboarded: true, mode: "upload", view: get().view });
      set({ map, mode: "upload", onboarded: true, uploadMeta: map.uploadMeta ?? null, activeUploadName: name, ...project(map, get().view), selectedId: null });
    },
    removeUpload(name) {
      const maps = { ...get().uploadMaps };
      delete maps[name];
      persistUploadMaps(maps);
      const { activeUploadName } = get();
      if (activeUploadName === name) {
        // removeu o ativo: volta ao onboarding (ou pro próximo)
        const next = Object.keys(maps)[0];
        if (next) {
          const map = maps[next];
          set({ uploadMaps: maps, map, activeUploadName: next, uploadMeta: map.uploadMeta ?? null, ...project(map, get().view), selectedId: null });
        } else {
          persist({ onboarded: false, mode: null, view: get().view });
          set({ uploadMaps: {}, map: null, mode: null, onboarded: false, uploadMeta: null, activeUploadName: null, nodes: [], edges: [], selectedId: null });
        }
      } else {
        set({ uploadMaps: maps });
      }
    },
    setNodes(nodes) {
      set({ nodes });
    },
    select(nodeId) {
      if (get().selectedId !== nodeId) set({ selectedId: nodeId });
    },
  };
});
