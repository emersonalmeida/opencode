/**
 * AtlasTree — navegação em árvore da esquerda.
 *
 * Renderiza a árvore DATA LAB (ponto 72): 10 domínios → módulos. Cada domínio
 * é colapsável; clique num módulo seleciona-o (mostra o contrato no centro).
 * Inclui busca textual e filtro por status (disponível/planejado).
 */
import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Search, X, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GROUP_META, GROUP_ORDER } from "@/lib/analysisAtlas/groups";
import { searchModules, moduleStats } from "@/lib/analysisAtlas/registry";
import type { AnalysisModule, AtlasGroup } from "@/lib/analysisAtlas/types";

interface Props {
  selectedId: string | null;
  onSelect: (m: AnalysisModule) => void;
  /** Módulos atualmente no pipeline (direita) — destacados na árvore. */
  pipelineIds?: string[];
  /** Executa todos os módulos de um grupo (categoria). */
  onRunGroup?: (g: AtlasGroup) => void;
  /** Executa todos os módulos do Atlas (pipeline completo). */
  onRunAll?: () => void;
  running?: boolean;
}

export function AtlasTree({ selectedId, onSelect, pipelineIds = [], onRunGroup, onRunAll, running = false }: Props) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Record<AtlasGroup, boolean>>({
    app: false, review: false, temporal: false, geo: false, cross: false,
    intelligence: false, discovery: false, evidence: false, decision: false, output: false,
  });
  const stats = moduleStats();

  const filtered = useMemo(() => searchModules(query), [query]);
  const byGroup = useMemo(() => {
    const m: Record<AtlasGroup, AnalysisModule[]> = {
      app: [], review: [], temporal: [], geo: [], cross: [],
      intelligence: [], discovery: [], evidence: [], decision: [], output: [],
    };
    for (const mod of filtered) m[mod.group].push(mod);
    return m;
  }, [filtered]);

  const inPipeline = useMemo(() => new Set(pipelineIds), [pipelineIds]);

  return (
    <div className="flex flex-col h-full text-xs">
      {/* Header / brand */}
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
            <Search className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">Analysis Atlas</p>
            <p className="text-[10px] text-muted-foreground">
              {stats.total} módulos · todos disponíveis
            </p>
          </div>
        </div>
        {onRunAll && (
          <button
            onClick={onRunAll}
            disabled={running}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            title="Executa todos os módulos de IA do Atlas sequencialmente sobre o dataset selecionado"
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            {running ? "Executando…" : "Executar pipeline completo"}
          </button>
        )}
      </div>

      {/* Search */}
      <div className="p-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar análise…"
            className="w-full pl-7 pr-7 py-1.5 text-xs rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Buscar módulo de análise"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {GROUP_ORDER.map((g) => {
          const meta = GROUP_META[g];
          const mods = byGroup[g];
          if (mods.length === 0) return null;
          const isCol = collapsed[g];
          const GIcon = meta.icon;
          return (
            <div key={g}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [g]: !c[g] }))}
                className="w-full flex items-center gap-1.5 px-1.5 py-1.5 rounded-md hover:bg-secondary transition-colors text-left"
                aria-expanded={!isCol}
              >
                {isCol ? <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />}
                <GIcon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
                <span className="font-semibold text-foreground truncate">{meta.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{mods.length}</span>
              </button>
              {!isCol && onRunGroup && (
                <button
                  onClick={() => onRunGroup(g)}
                  disabled={running}
                  className="ml-6 mb-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary disabled:opacity-40 transition-colors"
                  title={`Executar todos os ${mods.length} módulos de ${meta.label}`}
                >
                  {running ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Play className="h-2.5 w-2.5" />}
                  Executar categoria
                </button>
              )}
              {!isCol && (
                <div className="ml-4 border-l border-border/40 pl-1.5 space-y-0.5 mt-0.5">
                  {mods.map((m) => {
                    const MIcon = m.icon;
                    const active = m.id === selectedId;
                    const inPipe = inPipeline.has(m.id);
                    return (
                      <button
                        key={m.id}
                        onClick={() => onSelect(m)}
                        className={cn(
                          "w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md transition-colors text-left group",
                          active ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground hover:text-foreground",
                        )}
                        title={m.tagline}
                      >
                        <MIcon className={cn("h-3 w-3 shrink-0", active ? "text-primary" : meta.color)} />
                        <span className="truncate flex-1">{m.label}</span>
                        {inPipe && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="No pipeline" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum módulo encontrado.</p>
        )}
      </div>

      {/* Footer hint */}
      <div className="p-2 border-t border-border/50 text-[10px] text-muted-foreground">
        Cada módulo declara input → output → evidência → score.
      </div>
    </div>
  );
}
