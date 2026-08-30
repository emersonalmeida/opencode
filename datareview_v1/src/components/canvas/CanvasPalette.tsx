import { useState } from "react";
import { Workflow, MousePointerClick, LayoutGrid, Search, X } from "lucide-react";
import { NODE_PALETTE, type NodeKind } from "@/components/canvas/nodeRegistry";
import { useCanvasStore } from "@/lib/canvasStore";

interface Props {
  onOpenGallery?: () => void;
}

/** Palette of draggable/clickable node kinds, shown in the left sidebar "Canvas" tab. */
export function CanvasPalette({ onOpenGallery }: Props) {
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? NODE_PALETTE.filter((m) => m.label.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || m.kind.includes(q))
    : NODE_PALETTE;

  return (
    <div className="flex-1 min-h-0 flex flex-col p-2 space-y-2">
      <div className="rounded-lg border border-border/50 bg-secondary/30 p-2.5">
        <p className="text-[10px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
          <MousePointerClick className="h-3 w-3 mt-0.5 shrink-0" />
          Clique num nó para adicioná-lo ao canvas. Conecte a saída (direita) de um nó à entrada (esquerda) de outro.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/60 pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrar nós (nome ou descrição)…"
          aria-label="Filtrar tipos de nó"
          className="w-full text-[11px] pl-7 pr-6 py-1.5 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        {query && (
          <button onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground" aria-label="Limpar filtro">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {onOpenGallery && (
        <button
          onClick={onOpenGallery}
          className="flex items-center gap-2 p-2 rounded-lg border border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
        >
          <LayoutGrid className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-foreground">Galeria de templates</p>
            <p className="text-[9px] text-muted-foreground truncate">Pipelines prontos para começar rápido</p>
          </div>
        </button>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {q && filtered.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic px-1">Nenhum nó corresponde a "{query}".</p>
        )}
        {(["sources", "ai", "analysis", "viz", "util"] as const).map((group) => {
          const items = filtered.filter((m) => m.group === group);
          if (items.length === 0) return null;
          const groupLabel: Record<string, string> = {
            sources: "Fontes & dados", ai: "IA (encadeável)", analysis: "Análises (sem IA)", viz: "Visualizações", util: "Utilitários",
          };
          return (
            <div key={group} className="space-y-1">
              <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground px-1">{groupLabel[group]}</p>
              {items.map((meta) => {
                const Icon = meta.icon;
                const count = nodes.filter((n) => n.data.kind === meta.kind).length;
                return (
                  <button
                    key={meta.kind}
                    onClick={() => addNode(meta.kind as NodeKind)}
                    className="w-full group flex items-center gap-2 p-2 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                  >
                    <Icon className={`h-4 w-4 ${meta.color} shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium truncate">{meta.label}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{meta.description}</p>
                    </div>
                    {count > 0 && <span className="text-[9px] bg-primary/15 text-primary px-1.5 rounded-full">{count}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border/50 bg-secondary/30 p-2 flex items-center gap-1.5">
        <Workflow className="h-3.5 w-3.5 text-primary shrink-0" />
        <p className="text-[9px] text-muted-foreground leading-tight">A execução segue a topologia: raízes primeiro, depois os conectados.</p>
      </div>
    </div>
  );
}
