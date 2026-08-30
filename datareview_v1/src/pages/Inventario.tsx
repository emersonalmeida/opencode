/**
 * Inventário (/inventario) — TODOS os componentes do sistema de forma
 * VISUAL e FUNCIONAL: cada arquivo componente do inventário gerado
 * (repetidos ou não, padronizados ou não) renderizado ao vivo via
 * ComponentLiveRender (lazy + boundary honesta), agrupado por
 * similaridade em blocos expansíveis.
 *
 * Cada card: nome, arquivo, exports, badge de padronização (reuso/especifico/
 * sem-consumidores), botão "Renderizar ao vivo" (lazy sob demanda —
 * componentes com props/contexto específico mostram o erro real).
 * Busca global filtra as listas mantendo a agrupação; semelhantes e
 * duplicados confirmados são marcados.
 */
import { useMemo, useState } from "react";
import { Search, Boxes, ChevronDown, ChevronUp, Play, AlertTriangle } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { ComponentLiveRender } from "@/components/catalog/ComponentLiveRender";
import {
  groupBySimilarity, componentName, standardizationBadge, inventoryStats,
} from "@/lib/inventoryPage";
import { filterComponents, findRepetitionCandidates } from "@/lib/componentCatalog";
import { cn } from "@/lib/utils";

function ComponentCard({ file, exports, consumers, lines }: {
  file: string; exports: string[]; consumers: number; lines: number;
}) {
  const [live, setLive] = useState(false);
  const badge = standardizationBadge({ consumers } as never);
  return (
    <article className="min-w-0 rounded-lg border border-border/50 bg-card/60 text-left">
      <header className="flex items-center gap-1.5 px-2 py-1.5">
        <Boxes className="h-3 w-3 shrink-0 text-primary" aria-hidden />
        <h4 className="min-w-0 flex-1 truncate text-[11px] font-medium" title={file}>
          {componentName(file)}
          <span className="ml-1 text-[9px] font-normal text-muted-foreground">
            ({exports.length} export{exports.length !== 1 ? "s" : ""} · {lines} ln)
          </span>
        </h4>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[8px] font-medium",
            badge.tone === "success" && "bg-success/15 text-success",
            badge.tone === "info" && "bg-status-info/15 text-status-info",
            badge.tone === "warning" && "bg-warning/15 text-warning",
          )}
          title={
            badge.tone === "success" ? "Padronizado — reutilizado em vários pontos"
            : badge.tone === "info" ? "Específico de um consumidor"
            : "Possível componente morto (sem consumidores diretos)"
          }
        >
          {badge.label}
        </span>
        <button
          type="button"
          onClick={() => setLive((v) => !v)}
          aria-expanded={live}
          aria-label={live ? `Ocultar render de ${componentName(file)}` : `Renderizar ${componentName(file)} ao vivo`}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[9px] text-muted-foreground hover:border-primary/50 hover:text-primary"
        >
          <Play className="h-2.5 w-2.5" aria-hidden />
          {live ? "Ocultar" : "Ao vivo"}
        </button>
      </header>
      {live && (
        <div className="border-t border-border/40 px-2 pb-2 pt-1.5">
          <ComponentLiveRender file={file} />
        </div>
      )}
    </article>
  );
}

export default function Inventario() {
  const [query, setQuery] = useState("");
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const groups = useMemo(() => groupBySimilarity(), []);
  const stats = useMemo(() => inventoryStats(), []);
  const duplicates = useMemo(() => findRepetitionCandidates(), []);
  const q = query.trim().toLowerCase();

  const filteredGroups = useMemo(
    () =>
      groups
        .map((g) => ({ ...g, components: filterComponents(g.components, q) }))
        .filter((g) => g.components.length > 0),
    [groups, q],
  );

  return (
    <ErrorBoundary title="Erro ao renderizar o Inventário">
      <div className="flex h-full min-h-0 flex-col">
        <AppHeader
          title="Inventário"
          crumb={`${stats.total} componentes · ${stats.groups} grupos · ${stats.sharedCount} padronizados · ${stats.duplicates} duplicados`}
          showSearch={false}
        />
        <main id="content" className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-6xl space-y-4">
            {/* Busca global (mantém a agrupação) */}
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar componente por nome ou arquivo…"
                aria-label="Buscar componentes"
                className="h-9 w-full rounded-lg border border-border/60 bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {q && (
                <p className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground" role="status">
                  {filteredGroups.reduce((s, g) => s + g.components.length, 0)} encontrados
                </p>
              )}
            </div>

            {/* Semelhantes/duplicados (marcados honestamente, não filtrados) */}
            {duplicates.length > 0 && !q && (
              <div className="rounded-xl border border-warning/40 bg-warning/5">
                <button
                  type="button"
                  onClick={() => setDuplicatesOpen((v) => !v)}
                  aria-expanded={duplicatesOpen}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px]"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden />
                  <span className="font-medium">{duplicates.length} componentes com nome repetido ou semelhante</span>
                  <span className="flex-1" />
                  {duplicatesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>
                {duplicatesOpen && (
                  <ul className="max-h-40 overflow-y-auto border-t border-warning/30 px-3 py-2 text-[10px] text-muted-foreground">
                    {duplicates.map((d) => (
                      <li key={d.name}>
                        <b>{d.name}</b> — {d.reason} ({d.files.join(", ")})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Grupos por similaridade (blocos expansíveis com render ao vivo) */}
            {filteredGroups.map((g) => (
              <ExpandableBlock
                key={g.id}
                id={`inv-${g.id}`}
                storageKey={`inv-${g.id}`}
                title={`${g.label} · ${g.components.length}`}
                subtitle={g.hint}
                exportName={`inventario-${g.id}`}
                exportData={() => g.components.map((c) => ({ arquivo: c.file, exports: c.exports }))}
              >
                <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                  {g.components.map((c) => (
                    <ComponentCard
                      key={c.file}
                      file={c.file}
                      exports={c.exports}
                      consumers={c.consumers}
                      lines={c.lines}
                    />
                  ))}
                </div>
              </ExpandableBlock>
            ))}

            {filteredGroups.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhum componente corresponde à busca “{q}”.
              </p>
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
