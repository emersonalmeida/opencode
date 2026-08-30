/**
 * inventoryPage — agrupamento por SIMILARIDADE de todos os componentes do
 * sistema (página /inventario): "repetidos ou não, padronizados ou não" —
 * tudo que existe de fato no código, organizado para navegação visual.
 *
 * Camada pura/testável sobre o inventário gerado. Grupos por diretório de
 * domínio (shared, chat, canvas, layout, configurações, dados, git, Uni,
 * design, páginas…); duplicados/similares vêm de findRepetitionCandidates
 * (componentCatalog).
 */
import {
  COMPONENT_INVENTORY, DUPLICATE_EXPORTS,
  type ComponentInventoryEntry,
} from "@/lib/componentInventory.generated";

export interface SimilarityGroup {
  id: string;
  label: string;
  hint: string;
  /** Diretórios (prefixos de `dir`) que compõem o grupo. */
  dirs: string[];
  components: ComponentInventoryEntry[];
}

/** Eixo de agrupamento = domínio (dir), com rótulos amigáveis. */
const GROUP_DEFS: Array<Omit<SimilarityGroup, "components">> = [
  { id: "chat", label: "Chat & IA", hint: "conversa, composer, saída de IA, voz", dirs: ["components/shared", "components/assistant"] },
  { id: "layout", label: "Layout & blocos", hint: "colunas, blocos expansíveis, sidebars", dirs: ["components/layoutBuilder", "components/layoutComposer", "components/pageSidebars", "components/page01"] },
  { id: "data", label: "Dados & coleta", hint: "busca, coleta, dataset, validação", dirs: ["components/search", "components/dashboard"] },
  { id: "canvas", label: "Canvas & pipelines", hint: "nós, canvas, pipeline, fluxo, jornada", dirs: ["components/canvas", "components/pipeline", "components/flow", "components/journey"] },
  { id: "design", label: "Design & apresentação", hint: "design canvas, apresentações, tema", dirs: ["components/designCanvas", "components/presentations", "components/catalog"] },
  { id: "settings", label: "Configurações", hint: "seções e controles de config", dirs: ["components/settings"] },
  { id: "uni", label: "Uni & fontes", hint: "coleta multifonte", dirs: ["components/uni"] },
  { id: "git", label: "Git", hint: "visual git canvas", dirs: ["components/gitCanvas"] },
  { id: "lab", label: "Lab & metodologias", hint: "descoberta e experimentos", dirs: ["components/lab", "components/analysisAtlas"] },
  { id: "os", label: "OS & terminal", hint: "núcleo, terminal, case", dirs: ["components/os", "components/terminal", "components/case"] },
  { id: "root", label: "Núcleo do app", hint: "shell, sidebars e painéis raiz", dirs: ["components"] },
  { id: "ux", label: "UX & acessibilidade", hint: "atalhos, estados, ajuda", dirs: ["components/ux"] },
];

/** Índice de arquivos que pertencem a um grupo (primeiro grupo que casa). */
function groupOf(file: string): string {
  const dir = file.slice(0, file.lastIndexOf("/"));
  for (const g of GROUP_DEFS) {
    if (g.dirs.includes(dir)) return g.id;
  }
  // subpastas desconhecidas → grupo do primeiro nível
  const top = dir.split("/").slice(0, 2).join("/");
  const fallback = GROUP_DEFS.find((g) => g.dirs.includes(top));
  return fallback?.id ?? "root";
}

/** Todos os componentes agrupados por similaridade (grupos vazios omitidos). */
export function groupBySimilarity(): SimilarityGroup[] {
  const out = GROUP_DEFS.map((g) => ({ ...g, components: [] as ComponentInventoryEntry[] }));
  for (const c of COMPONENT_INVENTORY) {
    const id = groupOf(c.file);
    out.find((g) => g.id === id)?.components.push(c);
  }
  return out
    .map((g) => ({ ...g, components: [...g.components].sort((a, b) => a.file.localeCompare(b.file)) }))
    .filter((g) => g.components.length > 0);
}

/** Nome de exibição do componente (arquivo sem extensão). */
export function componentName(file: string): string {
  return file.split("/").pop()?.replace(/\.tsx$/, "") ?? file;
}

/** Badge de padronização: compartilhado (2+ consumidores), específico (1),
 *  ou sem consumidores diretos (0). */
export function standardizationBadge(c: ComponentInventoryEntry): {
  label: string; tone: "success" | "info" | "warning";
} {
  if (c.consumers >= 2) return { label: `reuso ×${c.consumers}`, tone: "success" };
  if (c.consumers === 1) return { label: "específico", tone: "info" };
  return { label: "sem consumidores", tone: "warning" };
}

/** Estatísticas do inventário para o cabeçalho da página. */
export function inventoryStats(): {
  total: number; groups: number; duplicates: number; sharedCount: number;
} {
  return {
    total: COMPONENT_INVENTORY.length,
    groups: groupBySimilarity().length,
    duplicates: DUPLICATE_EXPORTS.length,
    sharedCount: COMPONENT_INVENTORY.filter((c) => c.consumers >= 2).length,
  };
}
