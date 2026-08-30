/**
 * Catálogo de fontes — a fonte de verdade MACHINE-READABLE de todas as
 * fontes de coleta do sistema v6.
 *
 * O catálogo documenta, por fonte: como coletar (método/auth/recurso),
 * quais parâmetros aceita, quais DADOS/meta ela devolve, o estado de
 * implementação, e se a fonte está **ativa por padrão** (default sem-auth).
 *
 * A ativação NUNCA é um campo mutável por fonte: é **estado derivável**
 * (`enabledByDefault` do catálogo + overrides de usuário — ver `activation.ts`).
 */
import type { SourceCapability } from "@v6/contracts";

export type SourceStatus = "implemented" | "bridge" | "planned";

export type SourceGroup =
  | "uni"         // rotas uni-* (coleta direta, front /00)
  | "connectors"  // conectores declarativos uniConnectors
  | "discover"    // sub-fontes de Descoberta (sem chave)
  | "stores"      // lojas de apps (Apple/Google Play) e reviews
  | "knowledge";  // enciclopédicas/conhecimento

export type SourceMethod = "api" | "json" | "scrape" | "feed" | "other";
export type SourceAuth = "none" | "byok" | "oauth";

export interface SourceCatalogEntry {
  /** id canônico da fonte (também o `source` do NormalizedItem). */
  id: string;
  /** nome de exibição. */
  label: string;
  /** grupo de catálogo (uni/connectors/discover/stores/knowledge). */
  group: SourceGroup;
  /** categoria de conteúdo para navegação. */
  category: string;
  /** método de coleta. */
  method: SourceMethod;
  /** autenticação (none público / byok traga sua chave / oauth server-side). */
  auth: SourceAuth;
  /** capacidades declaradas (SourceCapability). */
  capabilities: SourceCapability[];
  /** true = a query é um identificador/lookup (não busca livre). */
  lookup?: boolean;
  /** parâmetros aceitos pelo coletor. */
  params: string[];
  /** DADOS efetivamente retornados pelos itens (nomes de campo normalizados
   *  + campos específicos da fonte, preservados em `meta` (Bronze). */
  data: string[];
  /** recurso/endpoint oficial usado. */
  resource: string;
  /** variáveis de ambiente / chaves BYOK relacionadas. */
  keys?: string[];
  /** estado de implementação no v6. */
  status: SourceStatus;
  /** ativa por padrão? (estratégia: priorizar o que não precisa de auth. */
  enabledByDefault?: boolean;
  /** ids alternativos conhecidos (legado v1/audit/fallbacks) que apontam
   *   para esta fonte — mantém as referências históricas rastreáveis. */
  aliases?: string[];
/** nota de termos de serviço / rate-limit / ressalvas. */
  tosNote?: string;
/** observação de operação (quando aplicável. */
  notes?: string;
}

/** Descritores de uma fonte (que vai pro GET /sources e menus). */
export function toSourceDescriptor(entry: SourceCatalogEntry): {
  id: string;
  label: string;
  kind: string;
  description: string;
  capabilities: SourceCapability[];
  lookup?: boolean;
  method: "json" | "api" | "scrape" | "other";
  auth: "none" | "byok" | "oauth";
  tosNote?: string;
} {
  const method =
    entry.method === "feed"
      ? "json"
      : entry.method === "api" || entry.method === "json"
        ? "json"
        : entry.method === "scrape"
          ? "scrape"
          : "other";
  return {
    id: entry.id,
    label: entry.label,
    kind: entry.category,
    description: entry.tosNote ?? "Fonte de coleta multi-fonte.",
    capabilities: entry.capabilities,
    lookup: entry.lookup,
    method,
    auth: entry.auth,
    tosNote: entry.tosNote,
  };
}