/**
 * /componentes — catálogo VIVO do sistema: TODAS as páginas renderizadas de
 * verdade (iframe same-origin, dados reais coletados) dentro de PageFrames
 * expansíveis/redimensionáveis, seguidas dos componentes de cada página —
 * tudo na ordem numerada do menu, da primeira à última página.
 *
 * Serve para: validar visualmente componentes/comportamentos com dados
 * reais, identificar repetições e candidatos a consolidação, e editar o
 * design system vendo o reflexo em todas as páginas ao mesmo tempo.
 *
 * Estrutura:
 *  - Centro: KPIs → busca → repetições/reuso → 1 seção por página
 *    (PageFrame + componentes da página) → seção de compartilhados.
 *  - Sidebar interna esquerda: Páginas · Componentes · Sistema · Âncoras.
 *  - Sidebar interna direita: Componente (selecionado) · Tokens.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Boxes, Search, Copy, Layers, AlertTriangle, Users, Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { PageFrame } from "@/components/catalog/PageFrame";
import { CatalogSidebars } from "@/components/catalog/CatalogSidebars";
import { LivePreview, PREVIEWABLE } from "@/components/catalog/LivePreview";
import { PAGES, pageNumber } from "@/lib/pages";
import { PAGE_EMBEDS, catalogSectionId } from "@/lib/pageFrames";
import { selectComponent, useSelectedComponent } from "@/lib/catalogSelection";
import { ATOMIC_META } from "@/lib/atomicDesign";
import {
  groupComponentsByPage, catalogStats, findRepetitionCandidates,
  filterComponents, mostReused,
} from "@/lib/componentCatalog";
import type { ComponentInventoryEntry } from "@/lib/componentInventory.generated";
import { cn } from "@/lib/utils";

export default function ComponentsCatalog() {
  const [query, setQuery] = useState("");
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const groups = useMemo(() => groupComponentsByPage(), []);
  const stats = useMemo(() => catalogStats(), []);
  const repetitions = useMemo(() => findRepetitionCandidates(), []);
  const reused = useMemo(() => mostReused(10), []);

  const groupsByPath = useMemo(() => {
    return new Map(groups.map((g) => [g.pagePath, g.components]));
  }, [groups]);
  const shared = groupsByPath.get("shared") ?? [];

  const filtering = query.trim().length > 0 || onlyDuplicates;
  const visibleComponents = (pagePath: string) => {
    const comps = groupsByPath.get(pagePath) ?? [];
    return onlyDuplicates
      ? comps.filter((c) => repetitions.some((r) => r.files.includes(c.file)))
      : filterComponents(comps, query);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <CatalogSidebars />
      <AppHeader
        title="Componentes"
        crumb="Catálogo vivo do sistema"
        backTo="/"
        extraMenu={
          <Link
            to="/layouts"
            aria-label="Criar uma página com componentes do catálogo"
            className="flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-[11px] text-foreground transition-colors hover:bg-secondary/60"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova página
          </Link>
        }
      />
      <div className="content-fluid flex-1 py-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <Kpi icon={Boxes} label="Componentes" value={String(stats.totalFiles)} />
          <Kpi icon={Layers} label="Exports" value={String(stats.totalExports)} />
          <Kpi icon={Users} label="Compartilhados" value={String(stats.shared)} />
          <Kpi icon={Copy} label="Específicos" value={String(stats.pageSpecific)} />
          <Kpi icon={AlertTriangle} label="Sem consumidores" value={String(stats.unused)} />
          <Kpi icon={AlertTriangle} label="Nomes repetidos" value={String(stats.duplicateNames)} tone={stats.duplicateNames > 0 ? "warn" : "ok"} />
        </div>

        {/* Busca + filtro de duplicados */}
        <div className="flex flex-wrap items-center gap-2" role="search">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar componente (arquivo ou export)…"
              aria-label="Buscar componente"
              className="w-full h-9 pl-8 pr-2 rounded-md border border-border/60 bg-background text-sm"
            />
          </div>
          <button
            aria-pressed={onlyDuplicates}
            onClick={() => setOnlyDuplicates((v) => !v)}
            className={`rounded-md border px-3 py-1.5 text-xs ${onlyDuplicates ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Só repetições
          </button>
        </div>

        {/* Repetições */}
        {(onlyDuplicates || repetitions.length > 0) && (
          <ExpandableBlock
            id="cat-repeticoes"
            title={`Candidatos a consolidação (${repetitions.length})`}
            storageKey="catalog-repetitions"
            defaultLevel={onlyDuplicates ? "expanded" : "default"}
            exportData={() => repetitions}
          >
            {repetitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma repetição por nome detectada no inventário atual.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {repetitions.map((r) => (
                  <li key={`${r.kind}-${r.name}`} className="rounded border border-border/50 p-2">
                    <div className="font-medium">{r.name} <span className="text-muted-foreground">({r.kind === "same-name" ? "mesmo export" : "mesmo arquivo"})</span></div>
                    <div className="text-muted-foreground">{r.reason}</div>
                    <ul className="mt-1 ml-3 list-disc text-muted-foreground/80">
                      {r.files.map((f) => <li key={f}><code>{f}</code></li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </ExpandableBlock>
        )}

        {/* Mais reutilizados */}
        <ExpandableBlock id="cat-reuso" title="Mais reutilizados" storageKey="catalog-reused" exportData={() => reused}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {reused.map((c) => (
              <div key={c.file} className="flex items-center justify-between rounded border border-border/50 px-2 py-1.5 text-xs">
                <span className="truncate font-medium">{c.exports[0] ?? c.file}</span>
                <span className="text-muted-foreground shrink-0">{c.consumers} consumidores</span>
              </div>
            ))}
          </div>
        </ExpandableBlock>

        {/* TODAS as páginas (ordem do menu): página real + seus componentes */}
        {PAGES.map((page) => {
          const spec = PAGE_EMBEDS[page.path];
          if (!spec) return null;
          const visible = visibleComponents(page.path);
          if (filtering && visible.length === 0) return null;
          const Icon = page.icon;
          return (
            <PageFrame
              key={page.path}
              spec={spec}
              number={pageNumber(page.path)}
              label={page.label}
              description={page.desc}
              icon={<Icon className="h-4 w-4" />}
              anchorId={catalogSectionId(page.path)}
              componentCount={visible.length}
              components={
                <div className="pt-1">
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Componentes desta página ({visible.length})
                  </p>
                  {visible.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {filtering ? "Nenhum componente corresponde ao filtro." : "Nenhum componente direto — a página usa componentes compartilhados (seção Sistema)."}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {visible.map((c) => (
                        <ComponentCard key={c.file} entry={c} pagePath={page.path} pageLabel={page.label} />
                      ))}
                    </div>
                  )}
                </div>
              }
            />
          );
        })}

        {/* Componentes compartilhados / sistema */}
        {(!filtering || visibleComponents("shared").length > 0) && (
          <ExpandableBlock
            id="cat-shared"
            title={`Componentes do sistema / compartilhados (${shared.length})`}
            subtitle="Usados por 2+ consumidores ou globais (AppShell, sidebars, padrões)"
            storageKey="catalog-shared"
            icon={<Boxes className="h-4 w-4 text-primary" />}
            exportData={() => visibleComponents("shared")}
          >
            <div className="space-y-2 pt-1">
              {visibleComponents("shared").map((c) => (
                <ComponentCard key={c.file} entry={c} pagePath="shared" pageLabel="Sistema" />
              ))}
            </div>
          </ExpandableBlock>
        )}
      </div>
    </div>
  );
}

function ComponentCard({ entry, pagePath, pageLabel }: { entry: ComponentInventoryEntry; pagePath: string; pageLabel: string }) {
  const selected = useSelectedComponent();
  const hasPreview = PREVIEWABLE.has(entry.file);
  const isSelected = selected?.file === entry.file;
  const atomic = ATOMIC_META[entry.atomic];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`Selecionar componente ${entry.exports.join(", ") || entry.file}`}
      onClick={() => selectComponent(isSelected ? null : { file: entry.file, pagePath, pageLabel })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectComponent(isSelected ? null : { file: entry.file, pagePath, pageLabel });
        }
      }}
      className={cn(
        "rounded-md border p-2.5 cursor-pointer transition-colors",
        isSelected
          ? "border-primary/60 ring-1 ring-primary/30 bg-primary/5"
          : "border-border/50 hover:border-primary/30 hover:bg-secondary/30",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{entry.exports.join(", ") || entry.file}</span>
        <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-medium", atomic.badge)}>{atomic.label}</span>
        <code className="text-[10px] text-muted-foreground">{entry.file}</code>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {entry.lines} linhas · {entry.consumers} consumidor(es)
        </span>
      </div>
      {hasPreview && (
        <div
          className="mt-2 rounded-md border border-dashed border-border/60 p-3 bg-background/40"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-2 text-[9px] uppercase tracking-wider text-muted-foreground">Preview ao vivo</p>
          <LivePreview file={entry.file} />
        </div>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof Boxes; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border border-border/50 p-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[9px] uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-1 text-xl font-semibold ${tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-green-600" : ""}`}>{value}</p>
    </div>
  );
}
