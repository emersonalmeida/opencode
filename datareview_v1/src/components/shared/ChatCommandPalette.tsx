/**
 * ChatCommandPalette — catálogo unificado "/" (atalho de teclado) que abre
 * TUDO que o chat pode fazer, em abas com busca:
 *
 *   - **Páginas**: todas as rotas do registry PAGES (filtradas por feature
 *     flags) — embute a página real na conversa (goto).
 *   - **Componentes**: as 15 superfícies embutíveis (EmbeddedSurface) —
 *     renderiza o componente real na conversa (show).
 *   - **Comandos**: as ações do chat (coletar, pesquisar, executar, relatar,
 *     ajuda) — preenche o input ou executa direto.
 *
 * Abre com `/` no composer (ou Ctrl+K global). Busca filtra em tempo real
 * por label/descrição/keywords (case/acento-insensível). Sem IA.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, Search, SquareTerminal, ArrowRight } from "lucide-react";
import { FeatureModal } from "@/components/shared/FeatureModal";
import { PAGES } from "@/lib/pages";
import { isFeatureEnabled, pagePathToFlag } from "@/lib/featureFlags";
import { EMBEDDABLE_SURFACES } from "@/lib/embeddableSurfaces";
import { cn } from "@/lib/utils";

export interface ChatCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recebe a frase pronta (goto/show/ação) — o caller decide enviar ou preencher. */
  onCommand: (phrase: string) => void;
}

type Tab = "pages" | "components" | "commands";

const COMMANDS: { label: string; desc: string; phrase: string }[] = [
  { label: "Ajuda", desc: "Lista tudo que o chat faz sem IA", phrase: "ajuda" },
  { label: "Coletar app", desc: "Busca e coleta reviews de um app (Apple/Google)", phrase: "colete " },
  { label: "Pesquisar em todas as fontes", desc: "Coleta multifonte Uni (web, notícias, acadêmico…)", phrase: "pesquise " },
  { label: "Coleta máxima", desc: "Pesquisa multifonte com limite máximo", phrase: "pesquise com coleta máxima " },
  { label: "Executar pipeline", desc: "Computa fatos e detecta anomalias (sem IA)", phrase: "execute o pipeline" },
  { label: "Gerar relatório", desc: "Relatório determinístico do dataset", phrase: "gere um relatório" },
  { label: "Análise de problemas", desc: "Roda a seção de IA 'problemas'", phrase: "rode a análise de problemas" },
  { label: "Resumo executivo", desc: "Roda a seção de IA 'resumo'", phrase: "rode a análise de resumo" },
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function ChatCommandPalette({ open, onOpenChange, onCommand }: ChatCommandPaletteProps) {
  const [tab, setTab] = useState<Tab>("pages");
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTab("pages");
      // Foca a busca ao abrir (rAF para o modal montar).
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const pages = useMemo(
    () => PAGES.filter((p) => { const f = pagePathToFlag(p.path); return !f || isFeatureEnabled(f); }),
    [],
  );

  const q = norm(query.trim());
  const filteredPages = q
    ? pages.filter((p) => norm(`${p.label} ${p.desc} ${p.path}`).includes(q))
    : pages;
  const filteredSurfaces = q
    ? EMBEDDABLE_SURFACES.filter((s) => norm(`${s.label} ${s.description} ${s.keywords.join(" ")}`).includes(q))
    : EMBEDDABLE_SURFACES;
  const filteredCommands = q
    ? COMMANDS.filter((c) => norm(`${c.label} ${c.desc} ${c.phrase}`).includes(q))
    : COMMANDS;

  const pick = (phrase: string) => {
    onOpenChange(false);
    onCommand(phrase);
  };

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "pages", label: "Páginas", count: filteredPages.length },
    { id: "components", label: "Componentes", count: filteredSurfaces.length },
    { id: "commands", label: "Comandos", count: filteredCommands.length },
  ];

  return (
    <FeatureModal open={open} onOpenChange={onOpenChange} title="Tudo do sistema via chat" size="lg">
      <div className="flex flex-col gap-3">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar página, componente ou comando…"
            aria-label="Buscar no catálogo do chat"
            className="w-full rounded-md border border-border/60 bg-card/60 py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Abas */}
        <div role="tablist" aria-label="Categorias" className="flex gap-1 border-b border-border/40">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.id
                  ? "border-b-2 border-primary text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="rounded-full bg-secondary px-1.5 text-[10px] tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="max-h-[50vh] overflow-y-auto" role="tabpanel">
          {tab === "pages" && (
            <ul className="space-y-0.5">
              {filteredPages.map((p) => (
                <li key={p.path}>
                  <button
                    type="button"
                    onClick={() => pick(`abra a página ${p.path}`)}
                    className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-secondary/60"
                  >
                    <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{p.desc}</span>
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {filteredPages.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma página encontrada.</p>}
            </ul>
          )}
          {tab === "components" && (
            <ul className="space-y-0.5">
              {filteredSurfaces.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => pick(`exiba ${s.label.toLowerCase()}`)}
                    className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-secondary/60"
                  >
                    <SquareTerminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{s.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{s.description}</span>
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {filteredSurfaces.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nenhum componente encontrado.</p>}
            </ul>
          )}
          {tab === "commands" && (
            <ul className="space-y-0.5">
              {filteredCommands.map((c) => (
                <li key={c.label}>
                  <button
                    type="button"
                    onClick={() => pick(c.phrase)}
                    className="group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-secondary/60"
                  >
                    <SquareTerminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{c.desc}</span>
                    </span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {filteredCommands.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nenhum comando encontrado.</p>}
            </ul>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground">
          Dica: digite <kbd className="rounded border border-border/60 bg-secondary/60 px-1">/</kbd> no campo de texto para abrir este catálogo.
        </p>
      </div>
    </FeatureModal>
  );
}
