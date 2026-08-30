/**
 * atomicDesign — classificação e metadados Atomic Design de TODOS os
 * componentes do sistema (átomo → molécula → organismo → template → página).
 *
 * A CLASSIFICAÇÃO em si roda no build-time (`scripts/build-component-catalog.mjs`)
 * e chega embutida no inventário gerado (`atomic` por entry). Aqui ficam os
 * tipos, os metadados visuais por nível e os helpers derivados (testáveis)
 * que o `/componentes` e o inspetor consomem.
 */
import type { ComponentInventoryEntry } from "@/lib/componentInventory.generated";

export type AtomicLevel = "atom" | "molecule" | "organism" | "template" | "page";

export const ATOMIC_ORDER: AtomicLevel[] = ["atom", "molecule", "organism", "template", "page"];

export interface AtomicMeta {
  label: string;
  /** Uma linha, PT-BR — o que o nível significa no nosso sistema. */
  description: string;
  /** Token tailwind do badge (bg + text). */
  badge: string;
}

export const ATOMIC_META: Record<AtomicLevel, AtomicMeta> = {
  atom: {
    label: "Átomo",
    description: "Menor unidade — não importa outros componentes do sistema.",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  molecule: {
    label: "Molécula",
    description: "Combina poucos componentes (≤2 deps) numa unidade de UI.",
    badge: "bg-teal-500/15 text-teal-700 dark:text-teal-300",
  },
  organism: {
    label: "Organismo",
    description: "Seção complexa — vários componentes e/ou dados do sistema.",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  template: {
    label: "Template",
    description: "Estrutura de página sem conteúdo final (layouts/shells).",
    badge: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  page: {
    label: "Página",
    description: "Destino de rota — compõe organismos em contexto específico.",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
};

/** Contagem por nível sobre o inventário (para KPIs e filtro do catálogo). */
export function atomicCounts(entries: ReadonlyArray<{ atomic?: AtomicLevel }>): Record<AtomicLevel, number> {
  const acc: Record<AtomicLevel, number> = { atom: 0, molecule: 0, organism: 0, template: 0, page: 0 };
  for (const e of entries) acc[e.atomic ?? "atom"]++;
  return acc;
}

/** Nível do componente com fallback defensivo para inventários antigos. */
export function atomicLevelOf(entry: { atomic?: AtomicLevel }): AtomicLevel {
  return entry.atomic && ATOMIC_ORDER.includes(entry.atomic) ? entry.atomic : "atom";
}

export type { ComponentInventoryEntry };
