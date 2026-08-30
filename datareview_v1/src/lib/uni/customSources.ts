/**
 * Fontes customizadas do usuário — conectores JSON declarativos definidos
 * pelo usuário (URL template + listPath + mapa de campos) para qualquer API
 * pública/gratuita. Solução para "adicionar e pesquisar fontes públicas,
 * grátis, com/sem API" sem tocar no código.
 *
 * Lib pura/testável. Persistida em `aso:uni-custom-sources:v1` (pub/sub).
 */

import { useEffect, useState } from "react";
import { deleteSourceSecret } from "./sourceSecrets";
import type { UniItemKind } from "./types";

/** Classificação de acesso da fonte (exibida na UI como badge honesto). */
export type SourceAccess = "gratuita" | "gratuita-limitada" | "com-cadastro" | "com-chave";
/** Natureza do método da fonte. */
export type SourceApiKind = "api-oficial" | "api-nao-oficial" | "scraping";

export const ACCESS_META: Record<SourceAccess, { label: string; description: string }> = {
  gratuita: { label: "Gratuita", description: "Acesso livre, sem cadastro nem chave." },
  "gratuita-limitada": { label: "Gratuita (limitada)", description: "Gratuita com rate-limit/cota visível." },
  "com-cadastro": { label: "Requer cadastro", description: "Precisa de conta na fonte (mesmo gratuita)." },
  "com-chave": { label: "Requer chave de API", description: "A URL deve conter sua chave no template." },
};

export const API_KIND_META: Record<SourceApiKind, { label: string }> = {
  "api-oficial": { label: "API oficial" },
  "api-nao-oficial": { label: "API não-oficial" },
  scraping: { label: "Scraping/Web" },
};

/** Mapa de campos: dot-path no item JSON até cada campo do UniItem. */
export interface CustomSourceFields {
  title: string; // obrigatório
  text?: string;
  url?: string;
  author?: string;
  date?: string;
  score?: string; // caminho para número
}

export interface CustomSourceDef {
  /** Slug único (slugify). */
  id: string;
  label: string;
  description?: string;
  kind: UniItemKind;
  /** Template com {q} (termo) e opcional {limit}. Ex.: https://api.x/search?q={q}&n={limit} */
  urlTemplate: string;
  /** Dot-path até o array de itens (vazio = resposta já é array). */
  listPath?: string;
  fields: CustomSourceFields;
  /** Autenticação opcional (Onda 4.3): só tipo + nome da chave ficam na def;
   *  o VALOR vive no vault local (sourceSecrets.ts) e nunca é exportado. */
  auth?: import("./sourceSecrets").SourceAuth;
  access: SourceAccess;
  apiKind: SourceApiKind;
  createdAt: number;
}

const KEY = "aso:uni-custom-sources:v1";
const CAP = 30;
let defs: CustomSourceDef[] = loadCustomSources();
const listeners = new Set<() => void>();

export function slugify(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "fonte";
}

/** Erros de validação (string[]) — def incompleto nunca é salvo. */
export function validateCustomSource(input: Partial<CustomSourceDef>): string[] {
  const errors: string[] = [];
  if (!input.label?.trim()) errors.push("Dê um nome à fonte.");
  if (!/^https?:\/\//i.test(input.urlTemplate ?? "")) errors.push("A URL deve começar com http(s)://.");
  if (input.urlTemplate && !input.urlTemplate.includes("{q}")) errors.push("A URL deve conter o placeholder {q} para o termo de busca.");
  if (!input.fields?.title?.trim()) errors.push("Mapeie pelo menos o campo de título (ex.: results.title).");
  return errors;
}

/** Monta a URL final substituindo placeholders (encodeURIComponent). */
export function buildCustomUrl(def: CustomSourceDef, query: string, limit: number): string {
  return def.urlTemplate
    .replace(/\{q\}/g, encodeURIComponent(query))
    .replace(/\{limit\}/g, String(Math.max(1, Math.min(limit, 100))));
}

export function listCustomSources(): CustomSourceDef[] {
  return defs;
}

export function saveCustomSource(input: Omit<CustomSourceDef, "id" | "createdAt">, id?: string): CustomSourceDef | { errors: string[] } {
  const errors = validateCustomSource(input);
  if (errors.length) return { errors };
  const next: CustomSourceDef = {
    ...input,
    id: id ?? slugify(input.label),
    createdAt: Date.now(),
  } as CustomSourceDef;
  const existing = defs.findIndex((d) => d.id === next.id);
  if (existing >= 0) defs[existing] = next;
  else defs = [...defs, next];
  if (defs.length > CAP) defs = defs.slice(-CAP);
  persist();
  return next;
}

export function deleteCustomSource(id: string): void {
  defs = defs.filter((d) => d.id !== id);
  // Fonte excluída leva o segredo junto (não sobra credencial órfã no vault).
  deleteSourceSecret(id);
  persist();
}

export function getCustomSource(id: string): CustomSourceDef | undefined {
  return defs.find((d) => d.id === id);
}

export function subscribeCustomSources(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(defs));
  } catch { /* quota */ }
  for (const cb of listeners) cb();
}

function loadCustomSources(): CustomSourceDef[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CustomSourceDef[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d) => d && typeof d.id === "string" && typeof d.urlTemplate === "string");
  } catch {
    return [];
  }
}

/** Hook reativo (padrão useDataset — useState+subscribe, sem loop). */
export function useCustomSources(): CustomSourceDef[] {
  const [list, setList] = useState<CustomSourceDef[]>(() => listCustomSources());
  useEffect(() => subscribeCustomSources(() => setList(listCustomSources())), []);
  return list;
}

/** Sugestões de fontes públicas gratuitas para inspiração do usuário. */
export const CUSTOM_SOURCE_EXAMPLES: Omit<CustomSourceDef, "id" | "createdAt">[] = [
  {
    label: "Product Hunt (via RSS)",
    description: "Lançamentos de produtos por tag/tema.",
    kind: "post",
    urlTemplate: "https://www.producthunt.com/search?q={q}",
    fields: { title: "title", url: "url" },
    access: "gratuita",
    apiKind: "scraping",
    listPath: "",
  },
  {
    label: "DuckDuckGo Instant Answers",
    description: "Respostas instantâneas (tópicos, definições).",
    kind: "article",
    urlTemplate: "https://api.duckduckgo.com/?q={q}&format=json&no_html=1",
    listPath: "RelatedTopics",
    fields: { title: "Text", url: "FirstURL", text: "Text" },
    access: "gratuita",
    apiKind: "api-oficial",
  },
];
