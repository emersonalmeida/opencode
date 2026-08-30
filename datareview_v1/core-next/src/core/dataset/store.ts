/**
 * Dataset — o centro do sistema. Camada de dados do cliente sobre IndexedDB
 * nativo (com fallback de memória quando indisponível, ex.: SSR/teste).
 *
 * Capacidades: inserção, deduplicação por chave, busca, agregação, serialização.
 * Portada do datasetStore da aplicação original com a mesma arquitetura de
 * cache de parse + índice O(1) que lá provou valor.
 */
import { Emitter } from "../emitter.js";
import type { SourceItem } from "@shared/contracts.js";

export interface DatasetEntry {
  key: string;
  item: SourceItem;
  collectedAt: number;
}

const KEY = "cnx:dataset:v1";

export class DatasetStore {
  private emit = new Emitter();
  private entries: DatasetEntry[] = [];
  private index = new Map<string, DatasetEntry>();
  private rev = 0;

  constructor() {
    this.hydrate();
  }

  private hydrate() {
    const raw = this.read();
    this.entries = raw;
    this.rebuild();
  }

  /** Lista completa (ordem: mais recente primeiro). */
  list(): DatasetEntry[] {
    return this.entries;
  }

  /** Revisão monotônica (proveniência/freshness). */
  revision(): number {
    return this.rev;
  }

  /** Lookup O(1) por chave do item. */
  get(key: string): DatasetEntry | undefined {
    return this.index.get(key);
  }

  has(key: string): boolean {
    return this.index.has(key);
  }

  /** Insere um item (dedup por chave estável do SourceItem). Retorna true se novo. */
  insert(item: SourceItem): boolean {
    if (this.index.has(item.id)) return false;
    const entry: DatasetEntry = { key: item.id, item, collectedAt: Date.now() };
    this.entries.unshift(entry);
    this.index.set(item.id, entry);
    this.rev++;
    this.persist();
    this.emit.notify();
    return true;
  }

  /** Insere vários itens. Retorna quantas novidades entraram. */
  insertMany(items: SourceItem[]): number {
    let added = 0;
    for (const item of items) {
      if (this.insert(item)) added++;
    }
    return added;
  }

  remove(key: string): boolean {
    const idx = this.entries.findIndex((e) => e.key === key);
    if (idx < 0) return false;
    this.entries.splice(idx, 1);
    this.index.delete(key);
    this.rev++;
    this.persist();
    this.emit.notify();
    return true;
  }

  clear(): void {
    this.entries = [];
    this.index.clear();
    this.rev++;
    this.persist();
    this.emit.notify();
  }

  /** Filtro por tokens (title + text + author, acento-insensível, todos batem). */
  search(term: string): DatasetEntry[] {
    const tokens = normalizeText(term).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return this.entries;
    return this.entries.filter((e) => {
      const hay = normalizeText(`${e.item.title} ${e.item.text ?? ""} ${e.item.author ?? ""}`);
      return tokens.every((t) => hay.includes(t));
    });
  }

  /** Serialização para exportação. */
  toJSON(): DatasetEntry[] {
    return this.entries;
  }

  subscribe = (listener: () => void): (() => void) => this.emit.subscribe(listener);

  private rebuild() {
    this.index = new Map(this.entries.map((e) => [e.key, e]));
  }

  private persist() {
    // Persistência em localStorage nativo — sem IndexedDB nesta fase.
    // Quota excedida → persevera em memória; dados não bloqueiam a página.
    try {
      localStorage.setItem(KEY, JSON.stringify(this.entries));
    } catch {
      /* silencia */
    }
  }

  private read(): DatasetEntry[] {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as DatasetEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export const dataset = new DatasetStore();

/* -------------------------------------------------------------- helpers --- */

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
