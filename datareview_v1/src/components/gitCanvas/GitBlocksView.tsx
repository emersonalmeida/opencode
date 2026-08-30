/**
 * GitBlocksView — visão "Blocos": alternativa ao canvas infinito.
 *
 * O mesmo ProjectMap vira seções de cards expansíveis (ExpandableBlock)
 * dispostos em colunas. O usuário alterna Grade (2+ col) / Lista (1 col).
 * Cada card lista itens reais (branches, commits, tags, reflog, stash,
 * gaps) com busca case-insensitive dentro do card.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Columns3, LayoutGrid, List, ListTree, Search, X } from "lucide-react";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { buildBlocksData, buildBlocksTreeData, type BlockSection, type TreeNode } from "@/lib/gitCanvas/blocksData";
import type { ProjectMap } from "@/lib/gitCanvas/types";

export interface GitBlocksViewProps {
  map: ProjectMap;
}

type BlocksLayout = "grid" | "list" | "columns" | "tree";

const LAYOUTS: { id: BlocksLayout; label: string; icon: typeof LayoutGrid }[] = [
  { id: "grid", label: "Grade", icon: LayoutGrid },
  { id: "list", label: "Lista", icon: List },
  { id: "columns", label: "Colunas", icon: Columns3 },
  { id: "tree", label: "Árvore", icon: ListTree },
];

function SectionBody({ section, query }: { section: BlockSection; query: string }) {
  const items = query
    ? section.items.filter((i) => `${i.label} ${i.sub ?? ""}`.toLowerCase().includes(query.toLowerCase()))
    : section.items;
  if (items.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">Nada corresponde à busca.</p>;
  }
  return (
    <ul className="max-h-80 overflow-y-auto px-1 py-1" role="list">
      {items.map((item) => (
        <li key={item.id} className="border-b border-border/40 py-1.5 last:border-b-0">
          <div className="text-xs font-medium text-foreground break-words">{item.label}</div>
          {item.sub && <div className="text-[11px] text-muted-foreground">{item.sub}</div>}
          {item.badges && item.badges.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {item.badges.map((b) => (
                <span key={b} className="rounded bg-secondary px-1 py-0.5 text-[10px] text-secondary-foreground">{b}</span>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function TreeNodeRow({ node, depth, query }: { node: TreeNode; depth: number; query: string }) {
  const [open, setOpen] = useState(depth < 2);
  const matches = !query || `${node.label} ${node.sub ?? ""}`.toLowerCase().includes(query.toLowerCase());
  const visibleChildren = query
    ? node.children.filter((c) => `${c.label} ${c.sub ?? ""}`.toLowerCase().includes(query.toLowerCase()) || c.children.length > 0)
    : node.children;
  if (!matches && visibleChildren.length === 0) return null;
  const hasChildren = visibleChildren.length > 0;
  return (
    <li>
      <div className="flex items-start gap-1.5 py-1" style={{ paddingLeft: depth * 16 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`${open ? "Recolher" : "Expandir"} ${node.label}`}
            className="mt-0.5 shrink-0 rounded p-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="mt-0.5 inline-block w-4" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-foreground break-words">{node.label}</div>
          {node.sub && <div className="text-[11px] text-muted-foreground">{node.sub}</div>}
          {node.badges && node.badges.length > 0 && (
            <div className="mt-0.5 flex flex-wrap gap-1">
              {node.badges.map((b) => (
                <span key={b} className="rounded bg-secondary px-1 py-0.5 text-[10px] text-secondary-foreground">{b}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      {hasChildren && open && (
        <ul role="group">
          {visibleChildren.map((c) => (
            <TreeNodeRow key={c.id} node={c} depth={depth + 1} query={query} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function GitBlocksView({ map }: GitBlocksViewProps) {
  const sections = useMemo(() => buildBlocksData(map), [map]);
  const tree = useMemo(() => buildBlocksTreeData(map), [map]);
  const [layout, setLayout] = useState<BlocksLayout>(() => {
    try {
      const v = localStorage.getItem("aso:git-blocks-layout") as BlocksLayout | null;
      return v && LAYOUTS.some((l) => l.id === v) ? v : "grid";
    } catch { return "grid"; }
  });
  const [query, setQuery] = useState("");

  function setLayoutPersist(next: BlocksLayout) {
    setLayout(next);
    try { localStorage.setItem("aso:git-blocks-layout", next); } catch { /* quota */ }
  }

  if (sections.length === 0) {
    return (
      <div className="absolute inset-0 z-10 overflow-auto p-4">
        <p className="rounded-lg border border-border/60 bg-card p-4 text-sm text-muted-foreground">
          Nenhum dado real disponível para exibir em blocos. Seções vazias são omitidas (o sistema nunca finge dados).
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col overflow-hidden bg-background/60">
      {/* barra de ferramentas da visão */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-card/80 px-3 py-2 backdrop-blur">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar dentro dos blocos…"
            aria-label="Buscar dentro dos blocos"
            className="w-full rounded-md border border-border/60 bg-background py-1.5 pl-7 pr-7 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 hover:bg-muted">
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label="Layout dos blocos">
          {LAYOUTS.map((l) => {
            const Icon = l.icon;
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => setLayoutPersist(l.id)}
                aria-pressed={layout === l.id}
                aria-label={`Layout ${l.label}`}
                className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs ${layout === l.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Icon className="h-3.5 w-3.5" /> <span className="hidden md:inline">{l.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {layout === "tree" ? (
          <div className="mx-auto max-w-3xl rounded-lg border border-border/60 bg-card p-3">
            <ul role="tree" aria-label="Árvore do repositório">
              {tree.map((node) => (
                <TreeNodeRow key={node.id} node={node} depth={0} query={query} />
              ))}
            </ul>
          </div>
        ) : (
          <div
            className={
              layout === "grid"
                ? "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
                : layout === "columns"
                  ? "columns-1 gap-3 space-y-3 sm:columns-2 xl:columns-3 [&>*]:break-inside-avoid"
                  : "mx-auto max-w-3xl space-y-3"
            }
          >
            {sections.map((section) => (
              <ExpandableBlock
                key={section.id}
                id={section.id}
                storageKey={`git-blocks:${section.id}`}
                title={section.title}
                subtitle={`${section.items.length} itens`}
                headerRight={
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                    {query ? `${section.items.filter((i) => `${i.label} ${i.sub ?? ""}`.toLowerCase().includes(query.toLowerCase())).length}/${section.items.length}` : section.items.length}
                  </span>
                }
              >
                <SectionBody section={section} query={query} />
              </ExpandableBlock>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
