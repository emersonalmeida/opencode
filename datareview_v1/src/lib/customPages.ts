/**
 * Custom Pages — páginas criadas pelo usuário a partir de telas/templates do
 * construtor `/layouts`. Cada página tem nome + `LayoutSpec` e vira uma rota
 * real do sistema (`/p/:id`) renderizada como tela funcional (modo sistema).
 *
 * Persistência: `aso:custom-pages:v1` (cap 20) com pub/sub e snapshot
 * memoizado (anti-loop do useSyncExternalStore, padrão pageGroups).
 */
import { useSyncExternalStore } from "react";
import {
  LayoutSpec, sanitizeSpec, LAYOUT_PRESETS,
} from "@/lib/layoutTemplates";

export interface CustomPage {
  id: string;
  name: string;
  spec: LayoutSpec;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "aso:custom-pages:v1";
const MAX_PAGES = 20;
const MAX_NAME = 48;

let seq = 0;
function genId(): string {
  seq += 1;
  return `p_${Date.now().toString(36)}_${seq}`;
}

function sanitizePages(raw: unknown): CustomPage[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomPage[] = [];
  for (const p of raw as Partial<CustomPage>[]) {
    if (typeof p?.id !== "string" || !p.id) continue;
    if (typeof p?.name !== "string" || !p.name.trim()) continue;
    const spec = sanitizeSpec(p.spec);
    if (spec.columns.length === 0 && spec.top.length === 0 && spec.bottom.length === 0) continue;
    out.push({
      id: p.id,
      name: p.name.trim().slice(0, MAX_NAME),
      spec,
      createdAt: typeof p.createdAt === "number" ? p.createdAt : Date.now(),
      updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : Date.now(),
    });
    if (out.length >= MAX_PAGES) break;
  }
  return out;
}

function load(): CustomPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitizePages(JSON.parse(raw));
  } catch {
    return [];
  }
}

let pages: CustomPage[] = load();
let fingerprint = computeFingerprint();
let cached: CustomPage[] = pages.map((p) => ({ ...p }));
const listeners = new Set<() => void>();

function computeFingerprint(): string {
  return pages.map((p) => `${p.id}:${p.name}:${p.updatedAt}`).join("|");
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pages)); } catch { /* quota */ }
  const fp = computeFingerprint();
  if (fp !== fingerprint) {
    fingerprint = fp;
    cached = pages.map((p) => ({ ...p }));
  }
  listeners.forEach((l) => l());
}

export function subscribeCustomPages(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function listCustomPages(): CustomPage[] {
  return [...pages].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getCustomPage(id: string): CustomPage | undefined {
  return pages.find((p) => p.id === id);
}

/** Cria uma página customizada. Sem spec, nasce do preset "Tela completa". */
export function createCustomPage(name: string, spec?: LayoutSpec): CustomPage {
  const finalSpec = sanitizeSpec(spec ?? LAYOUT_PRESETS.find((p) => p.id === "full-screen")!.build());
  const page: CustomPage = {
    id: genId(),
    name: name.trim().slice(0, MAX_NAME) || "Minha página",
    spec: finalSpec,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  pages = [page, ...pages].slice(0, MAX_PAGES);
  persist();
  return page;
}

export function updateCustomPageSpec(id: string, spec: LayoutSpec): void {
  pages = pages.map((p) => (p.id === id ? { ...p, spec: sanitizeSpec(spec), updatedAt: Date.now() } : p));
  persist();
}

export function renameCustomPage(id: string, name: string): void {
  pages = pages.map((p) => (p.id === id ? { ...p, name: name.trim().slice(0, MAX_NAME) || p.name, updatedAt: Date.now() } : p));
  persist();
}

export function deleteCustomPage(id: string): void {
  pages = pages.filter((p) => p.id !== id);
  persist();
}

/** Hook reativo das páginas customizadas (referência estável). */
export function useCustomPages(): CustomPage[] {
  useSyncExternalStore(subscribeCustomPages, () => fingerprint);
  return cached;
}
