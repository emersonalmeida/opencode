import { useState } from "react";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { COMPONENT_LIST, LAYER_LABEL, PALETTE_LAYERS } from "@/lib/designCanvas/registry";
import type { ComponentMeta } from "@/lib/designCanvas/types";
import { useDesignStore } from "@/lib/designCanvas/store";

/**
 * Left palette for the design canvas. Components are grouped by atomic layer
 * (atoms → molecules → layouts). Clicking a component drops it at the canvas
 * centre with default props. Mirrors Figma's left "Layers/Assets" panel.
 */
export function DesignCanvasPalette() {
  const addNode = useDesignStore((s) => s.addNode);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(PALETTE_LAYERS.map((l) => [l, true])),
  );

  const filtered = COMPONENT_LIST.filter((c) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return c.label.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.kind.includes(q);
  });

  const handleAdd = (meta: ComponentMeta) => {
    // Drop near top-left of the viewport with a little jitter so repeated
    // drops don't perfectly stack.
    addNode(meta.kind, { x: 120 + Math.random() * 60, y: 80 + Math.random() * 60 });
  };

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar componente…"
            className="w-full h-8 pl-7 pr-2 rounded-md bg-background border border-border text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="Buscar componente"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-1.5">
        {PALETTE_LAYERS.map((layer) => {
          const items = filtered.filter((c) => c.layer === layer);
          if (items.length === 0) return null;
          const isOpen = open[layer] ?? true;
          return (
            <div key={layer} className="mb-1.5">
              <button
                onClick={() => setOpen((o) => ({ ...o, [layer]: !o[layer] }))}
                className="flex items-center gap-1 w-full px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground rounded"
                aria-expanded={isOpen}
              >
                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                {LAYER_LABEL[layer]} <span className="text-muted-foreground/60">({items.length})</span>
              </button>
              {isOpen && (
                <div className="space-y-0.5 mt-0.5">
                  {items.map((meta) => {
                    const Icon = meta.icon;
                    return (
                      <button
                        key={meta.kind}
                        onClick={() => handleAdd(meta)}
                        title={meta.description}
                        className="flex items-start gap-2 w-full text-left px-1.5 py-1.5 rounded-md hover:bg-secondary/70 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 group"
                      >
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary">
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-medium truncate">{meta.label}</span>
                          <span className="block text-[10px] text-muted-foreground line-clamp-2">{meta.description}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-6 text-xs">Nenhum componente encontrado.</div>
        )}
      </div>

      <div className="p-2 border-t border-border/50 text-[10px] text-muted-foreground">
        Clique para adicionar ao canvas. Conecte nós pela borda (●) para criar fluxos de protótipo.
      </div>
    </div>
  );
}
