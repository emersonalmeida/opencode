/**
 * LayoutComposerSection — visualiza e edita o arranjo dos widgets entre as
 * colunas (mesmo modelo do composer ao vivo no AppShell). Cada widget pode
 * ser movido por botões (acessível) — na interface, também por arrastar.
 */
import { ArrowDown, ArrowUp, LayoutGrid, MoveRight, RotateCcw } from "lucide-react";
import {
  useLayout, isDefaultLayout, move, resetLayout,
  SLOT_ORDER, SLOT_LABEL, WIDGETS, type WidgetId,
} from "@/lib/layoutComposer";
import { setLayout, sanitizeLayout, type LayoutState } from "@/lib/layoutComposer";

export function LayoutComposerSection() {
  const layout = useLayout();
  const isDefault = isDefaultLayout(layout);

  const reorder = (slot: (typeof SLOT_ORDER)[number], id: WidgetId, dir: -1 | 1) => {
    const list = [...layout[slot]];
    const i = list.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    list.splice(i, 1);
    list.splice(j, 0, id);
    const next: LayoutState = sanitizeLayout({ ...layout, [slot]: list });
    setLayout(next);
  };

  return (
    <div className="px-4 pb-4 space-y-3">
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Cada coluna aceita vários widgets empilhados (split vertical) — cada um com
        conteúdo, colapso e altura próprios. Na interface, arraste pelo ícone ⠿ no
        topo do widget; aqui, mova pelos botões. Centro sempre permanece fluido.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {SLOT_ORDER.map((slot) => (
          <div key={slot} className="rounded-lg border border-border/50 bg-background p-2 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{SLOT_LABEL[slot]}</p>
            {layout[slot].length === 0 ? (
              <p className="text-[10px] text-muted-foreground/70 italic px-1 py-2">vazia</p>
            ) : (
              layout[slot].map((id, idx) => {
                const meta = WIDGETS.find((w) => w.id === id)!;
                return (
                  <div key={id} className="rounded-md border border-border/50 bg-card px-2 py-1.5">
                    <p className="text-[11px] font-medium text-foreground truncate">{meta.label}</p>
                    <p className="text-[9px] text-muted-foreground leading-snug mb-1">{meta.description}</p>
                    <div className="flex items-center gap-0.5 flex-wrap">
                      <button
                        onClick={() => reorder(slot, id, -1)}
                        disabled={idx === 0}
                        title="Subir"
                        aria-label={`Subir ${meta.label}`}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => reorder(slot, id, 1)}
                        disabled={idx === layout[slot].length - 1}
                        title="Descer"
                        aria-label={`Descer ${meta.label}`}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      {SLOT_ORDER.filter((s) => s !== slot).map((s) => (
                        <button
                          key={s}
                          onClick={() => move(id, s)}
                          title={`Mover para ${SLOT_LABEL[s]}`}
                          aria-label={`Mover ${meta.label} para ${SLOT_LABEL[s]}`}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground inline-flex items-center gap-0.5"
                        >
                          <MoveRight className="h-3 w-3" />
                          <span className="text-[8px]">{SLOT_LABEL[s].split(" ")[0][0]}{SLOT_LABEL[s].endsWith("interna") ? "i" : "e"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground" role="status">
          <LayoutGrid className="h-3 w-3" />
          {isDefault ? "Layout padrão (5 colunas)" : "Layout personalizado ativo"}
        </span>
        {!isDefault && (
          <button
            onClick={() => { if (confirm("Voltar ao layout padrão de 5 colunas?")) resetLayout(); }}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            <RotateCcw className="h-3 w-3" /> Restaurar padrão
          </button>
        )}
      </div>
    </div>
  );
}
