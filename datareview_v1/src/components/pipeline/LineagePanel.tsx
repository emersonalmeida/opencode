/**
 * LineagePanel — Data Lineage interativo.
 *
 * Do insight até o dado bruto: sobe a cadeia de artefatos (inputs → inputs
 * dos inputs → … → dataset) e desce até os REVIEWS ORIGINAIS que sustentam
 * anomalias (reviewIds vinculados). É a resposta para "de onde veio isso?".
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Database, GitBranch, ListTree, Network, Star } from "lucide-react";
import {
  buildLineage, getDescendants, type LineageNode,
} from "@/lib/pipeline/artifactStore";
import { KnowledgeGraphView } from "./KnowledgeGraphView";
import { KIND_LABEL, type PipelineArtifact } from "@/lib/pipeline/types";
import type { DatasetEntry } from "@/lib/datasetStore";
import { cn } from "@/lib/utils";

interface Props {
  artifact: PipelineArtifact | null;
  entries: DatasetEntry[];
  onSelect: (id: string) => void;
}

function TreeNode({ node, depth, onSelect }: { node: LineageNode; depth: number; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const hasInputs = node.inputs.length > 0;
  return (
    <div>
      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 14 }}>
        {hasInputs ? (
          <button
            onClick={() => setOpen(!open)}
            aria-label={open ? "Recolher" : "Expandir"}
            aria-expanded={open}
            className="p-0.5 text-muted-foreground hover:text-foreground"
          >
            {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <button
          onClick={() => onSelect(node.artifact.id)}
          className="text-[10px] text-foreground hover:text-primary truncate text-left"
          title={node.artifact.methodology}
        >
          {node.artifact.title}
          <span className="text-muted-foreground/70"> · {KIND_LABEL[node.artifact.kind]}</span>
        </button>
      </div>
      {open && node.inputs.map((inp) => (
        <TreeNode key={inp.artifact.id} node={inp} depth={depth + 1} onSelect={onSelect} />
      ))}
    </div>
  );
}

/** Coleta todos os reviewIds citados pelo artefato (anomalias) e resolve
 *  contra o dataset para exibir as evidências originais. */
function collectEvidenceReviews(artifact: PipelineArtifact, entries: DatasetEntry[]) {
  const ids = new Set<string>();
  for (const an of artifact.data?.anomalies ?? []) {
    an.reviewIds.forEach((id) => ids.add(id));
  }
  if (ids.size === 0) return [];
  const found: { id: string; appName: string; author: string; rating: number; date: string; text: string }[] = [];
  for (const e of entries) {
    for (const r of e.reviews) {
      if (ids.has(r.id)) {
        found.push({
          id: r.id,
          appName: e.app.name,
          author: r.author,
          rating: r.rating,
          date: r.date,
          text: (r.text || r.title || "").slice(0, 220),
        });
      }
    }
  }
  return found.slice(0, 6);
}

export function LineagePanel({ artifact, entries, onSelect }: Props) {
  const tree = useMemo(() => (artifact ? buildLineage(artifact.id) : null), [artifact]);
  const descendants = useMemo(() => (artifact ? getDescendants(artifact.id) : []), [artifact]);
  const evidence = useMemo(
    () => (artifact ? collectEvidenceReviews(artifact, entries) : []),
    [artifact, entries],
  );
  // Visão: árvore textual (default, densa) × grafo visual navegável (Onda 4.1).
  const [view, setView] = useState<"tree" | "graph">("tree");

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 flex-shrink-0">
        <GitBranch className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-bold text-foreground">Data lineage</h3>
        <div className="ml-auto flex items-center gap-0.5" role="group" aria-label="Visão do lineage">
          <button
            onClick={() => setView("tree")}
            aria-pressed={view === "tree"}
            title="Visão em árvore"
            className={cn("rounded p-1", view === "tree" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <ListTree className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setView("graph")}
            aria-pressed={view === "graph"}
            title="Visão em grafo (navegável)"
            className={cn("rounded p-1", view === "graph" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground")}
          >
            <Network className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="p-2 space-y-3">
        {!artifact || !tree ? (
          <p className="text-[10px] text-muted-foreground px-1 py-2">
            Selecione um artefato para rastrear sua origem: insight → análises → fatos → reviews originais.
          </p>
        ) : (
          <>
            {view === "graph" && (
              <KnowledgeGraphView root={tree} selectedId={artifact.id} onSelect={onSelect} />
            )}

            {/* Cadeia acima (de onde veio) */}
            <section className={view === "graph" ? "hidden" : undefined}>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">
                Origem (insight → análise → dados)
              </p>
              <TreeNode node={tree} depth={0} onSelect={onSelect} />
              <div className="flex items-center gap-1 mt-1" style={{ paddingLeft: 14 }}>
                <Database className="h-3 w-3 text-slate-500" />
                <span className="text-[9px] text-muted-foreground">
                  dataset bruto · {artifact.appKeys.length} app(s) em escopo
                </span>
              </div>
            </section>

            {/* Descendentes (o que este artefato alimentou) */}
            {descendants.length > 0 && (
              <section>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">
                  Alimentou ({descendants.length})
                </p>
                {descendants.slice(0, 8).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => onSelect(d.id)}
                    className="block w-full text-left text-[10px] text-foreground hover:text-primary truncate px-1 py-0.5"
                  >
                    ↳ {d.title}
                    <span className="text-muted-foreground/70"> · {KIND_LABEL[d.kind]}</span>
                  </button>
                ))}
              </section>
            )}

            {/* Evidência bruta (reviews originais) */}
            {evidence.length > 0 && (
              <section>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1">
                  Reviews originais vinculados ({evidence.length})
                </p>
                <div className="space-y-1.5">
                  {evidence.map((r) => (
                    <div key={r.id} className={cn("rounded-md border border-border/50 bg-secondary/20 px-2 py-1.5")}>
                      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                        <span className="flex items-center gap-0.5 text-amber-500">
                          <Star className="h-2.5 w-2.5 fill-current" />{r.rating}
                        </span>
                        <span className="truncate">{r.author}</span>
                        <span aria-hidden>·</span>
                        <span className="truncate">{r.appName}</span>
                        {r.date && <span className="ml-auto flex-shrink-0">{r.date.slice(0, 10)}</span>}
                      </div>
                      <p className="text-[10px] text-foreground mt-0.5 line-clamp-3">{r.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
