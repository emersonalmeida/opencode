/**
 * ChatToolsMenu — menu de ferramentas do chat (botão no composer). Torna
 * TODAS as capacidades do chat descobríveis sem decorar frases: exibir
 * componentes reais, coletar, executar pipeline, gerar relatório, ajuda.
 *
 * Agrupado em: Ações rápidas (comandos prontos) + Componentes (registry de
 * superfícies embutíveis). Selecionar um item dispara a frase equivalente
 * no chat — funciona COM e SEM IA (o detectChatIntent resolve).
 */
import { useState } from "react";
import {
  CircleHelp, LayoutGrid, LineChart, Package, Plus, Workflow, FileText,
  Search, Settings2, Compass,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { EMBEDDABLE_SURFACES } from "@/lib/embeddableSurfaces";
import { PAGES } from "@/lib/pages";
import { isFeatureEnabled, pagePathToFlag } from "@/lib/featureFlags";

/** Páginas habilitadas (respeita as feature flags, como o menu da sidebar). */
function visiblePages() {
  return PAGES.filter((p) => {
    const flag = pagePathToFlag(p.path);
    return !flag || isFeatureEnabled(flag);
  });
}

export interface ChatToolsMenuProps {
  /** Dispara uma frase de comando no chat (como se o usuário tivesse digitado). */
  onCommand: (phrase: string) => void;
  disabled?: boolean;
}

const QUICK_ACTIONS: Array<{ icon: typeof Plus; label: string; phrase: string; hint: string }> = [
  { icon: Package, label: "Coletar um app", phrase: "colete ", hint: "Digite o nome depois de 'colete'" },
  { icon: Search, label: "Pesquisar em todas as fontes", phrase: "pesquise ", hint: "Digite o termo depois de 'pesquise'" },
  { icon: Workflow, label: "Executar pipeline", phrase: "execute o pipeline", hint: "Fatos + anomalias (sem IA)" },
  { icon: FileText, label: "Gerar relatório", phrase: "gere um relatório", hint: "Consolidado determinístico" },
  { icon: Settings2, label: "Selecionar fontes Uni", phrase: "selecione as fontes", hint: "Abre o seletor interativo" },
  { icon: CircleHelp, label: "Ajuda (o que posso fazer)", phrase: "ajuda", hint: "Lista todas as capacidades" },
];

const SURFACE_ICONS: Record<string, typeof LayoutGrid> = {
  charts: LineChart,
  "uni-picker": Search,
};

export function ChatToolsMenu({ onCommand, disabled = false }: ChatToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const pick = (phrase: string) => {
    setOpen(false);
    onCommand(phrase);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button" variant="ghost" size="icon" disabled={disabled}
          title="Ferramentas do chat — ações e componentes (funciona sem IA)"
          aria-label="Abrir ferramentas do chat"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top" align="start"
        className="w-80 max-h-[70vh] overflow-y-auto p-0"
        aria-label="Ferramentas do chat"
      >
        <div className="px-3 py-2 border-b border-border/50">
          <p className="text-xs font-semibold">Ferramentas</p>
          <p className="text-[10px] text-muted-foreground">
            Tudo funciona sem IA — selecionar dispara a ação no chat.
          </p>
        </div>

        <div className="px-1.5 py-1.5">
          <p className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Ações rápidas
          </p>
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => pick(a.phrase)}
              className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-secondary/70 transition-colors"
            >
              <a.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{a.label}</span>
                <span className="block truncate text-[10px] text-muted-foreground">{a.hint}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="border-t border-border/50 px-1.5 py-1.5">
          <p className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Exibir componente
          </p>
          <div className="grid grid-cols-2 gap-0.5">
            {EMBEDDABLE_SURFACES.map((s) => {
              const Icon = SURFACE_ICONS[s.id] ?? LayoutGrid;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(`exiba ${s.label}`)}
                  title={s.description}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[11px] hover:bg-secondary/70 transition-colors"
                >
                  <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="truncate">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border/50 px-1.5 py-1.5">
          <p className="px-1.5 pb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Abrir página no chat
          </p>
          <div className="grid grid-cols-2 gap-0.5">
            {visiblePages().map((p, i) => (
              <button
                key={p.path}
                type="button"
                onClick={() => pick(`vá para ${p.path}`)}
                title={`${String(i + 1).padStart(2, "0")}. ${p.label} — ${p.desc ?? ""}`}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-left text-[11px] hover:bg-secondary/70 transition-colors"
              >
                <Compass className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
