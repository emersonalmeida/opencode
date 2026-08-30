import { useState } from "react";
import { Workflow, X, Check, Sparkles } from "lucide-react";
import { PIPELINE_TEMPLATES } from "@/components/canvas/pipelineTemplates";
import { useCanvasStore } from "@/lib/canvasStore";
import { useReactFlow } from "@xyflow/react";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal gallery of ready-made pipeline templates. Each template is a
 * self-contained, editable graph covering a common workflow. Loading one
 * replaces the current canvas (with a confirm if the canvas is non-empty).
 */
export function TemplateGallery({ open, onClose }: Props) {
  const { nodes, loadTemplate } = useCanvasStore();
  const { fitView } = useReactFlow();
  const [selected, setSelected] = useState<string | null>(null);

  if (!open) return null;

  const handleLoad = (id: string) => {
    const tpl = PIPELINE_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    if (nodes.length > 0 && !confirm("Substituir o canvas atual por este template?")) return;
    const { nodes: tn, edges: te } = tpl.build();
    loadTemplate({ nodes: tn, edges: te });
    setSelected(id);
    setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 80);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="Galeria de templates de pipeline">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-card shadow-xl">
        <header className="flex items-center gap-2 px-5 py-4 border-b border-border/60">
          <Workflow className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground">Galeria de templates</h2>
            <p className="text-[11px] text-muted-foreground">Pipelines prontos para começar rápido. Edite cada nó depois de carregar.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="Fechar galeria">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PIPELINE_TEMPLATES.map((tpl) => {
            const Icon = tpl.icon;
            const isSel = selected === tpl.id;
            return (
              <button
                key={tpl.id}
                onClick={() => handleLoad(tpl.id)}
                className="group text-left rounded-xl border border-border/60 bg-background/60 hover:border-primary/50 hover:bg-primary/5 transition-all p-4 flex flex-col gap-2"
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      {tpl.name}
                      {isSel && <Check className="h-3 w-3 text-emerald-500" />}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{tpl.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {tpl.tags.map((t) => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{t}</span>
                  ))}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  <Sparkles className="h-3 w-3" /> Carregar template
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
