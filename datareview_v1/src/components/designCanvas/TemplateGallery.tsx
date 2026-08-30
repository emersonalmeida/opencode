import { X, Check } from "lucide-react";
import { PAGE_TEMPLATES as TPL } from "@/lib/designCanvas/pageTemplates";
import { useDesignStore } from "@/lib/designCanvas/store";

/**
 * Modal gallery of page templates (Dashboard, Comparativo, Detalhe de app,
 * Landing). Loading a template materializes a new structured page + its
 * component nodes into the store and switches to preview mode.
 */
export function TemplateGallery({ onClose }: { onClose: () => void }) {
  const loadTemplate = useDesignStore((s) => s.loadTemplate);
  const setViewMode = useDesignStore((s) => s.setViewMode);

  const handle = (id: string) => {
    loadTemplate(id);
    setViewMode("preview");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bg-card rounded-2xl border border-border/60 shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div>
            <h2 className="text-sm font-semibold">Galeria de templates</h2>
            <p className="text-[11px] text-muted-foreground">Páginas prontas que usam componentes e dados reais do sistema.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground" aria-label="Fechar"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TPL.map((t) => {
            return (
              <button key={t.id} onClick={() => handle(t.id)}
                className="group text-left rounded-xl border border-border/60 p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</div>
                  </div>
                  <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100" />
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground/70">{t.name === "Dashboard" ? "KPIs · gráficos · tabela" : t.name === "Comparativo" ? "Cards · word cloud · IA" : t.name === "Detalhe de app" ? "Hero · reviews · IA" : "Frame · CTAs · cards"}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export { PAGE_TEMPLATES } from "@/lib/designCanvas/pageTemplates";
