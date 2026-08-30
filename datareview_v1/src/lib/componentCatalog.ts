/**
 * Catálogo de componentes do sistema (página `/componentes`) — camada pura e
 * testável sobre o inventário gerado (`componentInventory.generated.ts`).
 * Agrupa componentes por página de origem (ordem do menu PAGES), detecta
 * duplicados por nome e classifica compartilhados vs. específicos.
 */
import { PAGES } from "@/lib/pages";
import {
  COMPONENT_INVENTORY, PAGE_USAGE, DUPLICATE_EXPORTS,
  type ComponentInventoryEntry,
} from "@/lib/componentInventory.generated";

export interface PageComponentGroup {
  /** Path da página (ou "shared" para não associados a páginas). */
  pagePath: string;
  label: string;
  components: ComponentInventoryEntry[];
}

export interface CatalogStats {
  totalFiles: number;
  totalExports: number;
  shared: number; // consumidos por 2+ consumidores (páginas/componentes)
  pageSpecific: number; // exatamente 1 consumidor
  unused: number; // 0 consumidores diretos
  duplicateNames: number;
}

/** Estatísticas globais do inventário. */
export function catalogStats(): CatalogStats {
  let shared = 0, pageSpecific = 0, unused = 0, totalExports = 0;
  for (const c of COMPONENT_INVENTORY) {
    totalExports += c.exports.length;
    if (c.consumers >= 2) shared++;
    else if (c.consumers === 1) pageSpecific++;
    else unused++;
  }
  return {
    totalFiles: COMPONENT_INVENTORY.length,
    totalExports,
    shared,
    pageSpecific,
    unused,
    duplicateNames: DUPLICATE_EXPORTS.length,
  };
}

/**
 * Mapa explícito arquivo→rota para páginas cujo NOME difere do slug do menu
 * (renomes semânticos). Chave = base do arquivo em minúsculas sem extensão.
 * Páginas sem rota no registry (detalhe/parametrizadas) mapeiam para a
 * página-mãe que as hospeda; páginas sem dono real caem em "shared".
 */
const PAGE_FILE_ALIASES: Record<string, string> = {
  index: "/",
  page01: "/01",
  searchresults: "/search",
  flow: "/fluxo",
  journey: "/jornada",
  dataexplorer: "/dados",
  datapipeline: "/pipeline-dados",
  compareredirect: "/compare",
  chatvoz: "/chat-voz",
  filechat: "/chat-arquivos",
  aicentral: "/ia",
  methodologies: "/metodologias",
  analysisatlas: "/atlas",
  gitcanvas: "/git",
  designcanvas: "/design",
  layoutbuilder: "/layouts",
  testcenter: "/teste",
  presentations: "/apresentacoes",
  sessionspage: "/sessions",
  designsystempage: "/design-system",
  componentscatalog: "/componentes",
  settingspage: "/configuracoes",
  // Páginas-mãe de rotas parametrizadas (não existem no registry PAGES)
  experimentdetailpage: "/lab",
  custompageview: "/layouts",
};

/** Normaliza para comparação: minúsculas, sem acentos, sem `-`/`_`/espaços. */
function normKey(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[\s\-_]/g, "");
}

/** Normaliza "pages/Chat.tsx" → "/chat" para casar com o registry PAGES. */
export function pageFileToPath(pageFile: string): string | null {
  const base = pageFile.replace(/^pages\//, "").replace(/\.tsx$/, "");
  const key = normKey(base);
  const aliased = PAGE_FILE_ALIASES[key];
  if (aliased) return aliased;
  const byLabel = PAGES.find((p) =>
    key === normKey(p.path.replace(/^\//, "")) ||
    key === normKey(p.label) ||
    // variação comum: arquivo "SettingsPage" → label "Configurações" não casa,
    // mas "DesignSystemPage" → path "/design-system" casa sem o sufixo "page"
    key === normKey(p.path.replace(/^\//, "")) + "page" ||
    key === normKey(p.label) + "page");
  if (byLabel) return byLabel.path;
  return null;
}

/**
 * Agrupa o inventário por página de origem, seguindo a ORDEM DO MENU (PAGES).
 * Componentes sem página associada vão para o grupo "shared" (sistema).
 */
export function groupComponentsByPage(): PageComponentGroup[] {
  const byComponent = new Map<string, Set<string>>(); // component file -> page paths
  for (const usage of PAGE_USAGE) {
    const path = pageFileToPath(usage.page);
    if (!path) continue;
    for (const comp of usage.components) {
      if (!byComponent.has(comp)) byComponent.set(comp, new Set());
      byComponent.get(comp)!.add(path);
    }
  }

  const assigned = new Set<string>();
  const groups: PageComponentGroup[] = [];
  for (const page of PAGES) {
    const comps = COMPONENT_INVENTORY.filter((c) => byComponent.get(c.file)?.has(page.path));
    for (const c of comps) assigned.add(c.file);
    if (comps.length > 0) {
      groups.push({ pagePath: page.path, label: page.label, components: comps });
    }
  }
  const shared = COMPONENT_INVENTORY.filter((c) => !assigned.has(c.file));
  groups.push({ pagePath: "shared", label: "Compartilhados / sistema", components: shared });
  return groups;
}

/**
 * Candidatos a consolidação: exports com o MESMO nome em arquivos diferentes
 * (duplicados exatos do gerador) + nomes quase iguais (prefixo/sufixo
 * comum, ex.: "XxxPanel" em pastas distintas).
 */
export interface RepetitionCandidate {
  kind: "same-name" | "similar-name";
  name: string;
  files: string[];
  reason: string;
}

export function findRepetitionCandidates(): RepetitionCandidate[] {
  const out: RepetitionCandidate[] = DUPLICATE_EXPORTS.map((d) => ({
    kind: "same-name" as const,
    name: d.name,
    files: d.files,
    reason: `Export "${d.name}" declarado em ${d.files.length} arquivos`,
  }));

  // Nomes de ARQUIVO similares (mesmo nome base em pastas diferentes).
  const byBase = new Map<string, string[]>();
  for (const c of COMPONENT_INVENTORY) {
    const base = c.file.split("/").pop()!;
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base)!.push(c.file);
  }
  for (const [base, files] of byBase) {
    if (files.length > 1) {
      out.push({
        kind: "similar-name",
        name: base,
        files: files.sort(),
        reason: `Arquivo "${base}" existe em ${files.length} pastas`,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Filtra componentes por texto (arquivo/exports). */
export function filterComponents(
  comps: ComponentInventoryEntry[],
  query: string,
): ComponentInventoryEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return comps;
  return comps.filter((c) =>
    c.file.toLowerCase().includes(q) || c.exports.some((e) => e.toLowerCase().includes(q)));
}

/** Os N componentes mais reutilizados (para a seção "mais compartilhados"). */
export function mostReused(limit = 12): ComponentInventoryEntry[] {
  return [...COMPONENT_INVENTORY]
    .filter((c) => c.consumers > 0)
    .sort((a, b) => b.consumers - a.consumers)
    .slice(0, limit);
}
