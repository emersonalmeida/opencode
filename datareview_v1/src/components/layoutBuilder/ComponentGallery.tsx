/**
 * ComponentGallery — galeria de componentes reais do sistema para vincular a
 * um bloco de layout. Organizada em ABAS:
 *
 *  - "Grupos"     — por categoria funcional (Dados / IA / Sistema / Conteúdo);
 *  - "Páginas"    — pela página do sistema de onde o componente é reaproveitado
 *                   (ex.: tudo do Dashboard, do Pipeline, do Chat…);
 *  - "Catálogo"   — TODO o inventário de componentes (agrupado por página)
 *                   com render genérico do ComponentLiveRender (prefixo cat:).
 *
 * Com busca textual. Substitui o <select> simples do modo de edição.
 */
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  LAYOUT_COMPONENTS, LAYOUT_COMPONENT_GROUPS, componentsByOriginPage,
  type LayoutComponentGroup, type LayoutComponentMeta,
} from "@/lib/layoutComponents";
import { groupComponentsByPage } from "@/lib/componentCatalog";
import { publicComponentId } from "@/lib/layoutComponents";
import { PAGES } from "@/lib/pages";
import { cn } from "@/lib/utils";

function pageLabel(path: string): string {
  return PAGES.find((p) => p.path === path)?.label ?? path;
}

function ComponentCard({
  meta, onPick,
}: { meta: LayoutComponentMeta; onPick: (id: string) => void }) {
  const Icon = meta.icon;
  return (
    <button
      onClick={() => onPick(meta.id)}
      className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-card p-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary/80" aria-hidden />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">{meta.label}</span>
        <span className="block text-[10px] leading-snug text-muted-foreground">{meta.desc}</span>
        {meta.originPage !== "—" && (
          <span className="mt-0.5 inline-block rounded bg-secondary px-1 py-px text-[9px] text-muted-foreground">
            {pageLabel(meta.originPage)}
          </span>
        )}
      </span>
    </button>
  );
}

export function ComponentGallery({
  open, onOpenChange, onPick, blockTitle,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Chamado com o id do componente escolhido (ou undefined = bloco vazio). */
  onPick: (id: string | undefined) => void;
  blockTitle: string;
}) {
  const [tab, setTab] = useState<"grupos" | "paginas" | "catalogo">("grupos");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LAYOUT_COMPONENTS;
    return LAYOUT_COMPONENTS.filter((c) =>
      c.label.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q) || c.id.includes(q));
  }, [query]);

  const catalogGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = groupComponentsByPage();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        components: g.components.filter((c) =>
          c.file.toLowerCase().includes(q) || c.exports.join(" ").toLowerCase().includes(q)),
      }))
      .filter((g) => g.components.length > 0);
  }, [query]);

  const pick = (id: string | undefined) => {
    onPick(id);
    onOpenChange(false);
    setQuery("");
  };

  const byPage = useMemo(() => {
    const allowed = new Set(filtered.map((c) => c.id));
    return componentsByOriginPage()
      .map((g) => ({ ...g, items: g.items.filter((c) => allowed.has(c.id)) }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col" aria-label={`Escolher componente para ${blockTitle}`}>
        <DialogHeader>
          <DialogTitle className="text-sm">Componente de “{blockTitle}”</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar componente…"
              aria-label="Buscar componente"
              autoFocus
              className="w-full rounded-lg border border-border/60 bg-secondary py-2 pl-8 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Limpar busca de componente"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          <div role="tablist" aria-label="Organização da galeria" className="flex shrink-0 rounded-lg border border-border/60 p-0.5">
            {([["grupos", "Grupos"], ["paginas", "Páginas"], ["catalogo", "Catálogo"]] as const).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  tab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pt-1">
          <button
            onClick={() => pick(undefined)}
            className="mb-3 w-full rounded-lg border border-dashed border-border/60 px-3 py-2 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            Vazio (bloco estrutural, sem componente)
          </button>

          {tab === "catalogo" ? (
            catalogGroups.length === 0 ? (
              <p role="status" className="py-6 text-center text-xs text-muted-foreground">
                Nenhum componente corresponde a “{query}”.
              </p>
            ) : (
              catalogGroups.map((g) => (
                <section key={g.pagePath} aria-label={`Componentes da página ${g.label}`} className="mb-4">
                  <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {g.label} · {g.components.length}
                  </h3>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {g.components.map((c) => (
                      <button
                        key={c.file}
                        onClick={() => pick(publicComponentId(c.file))}
                        title={c.file}
                        className="min-w-0 rounded-md border border-border/60 bg-card px-2 py-1.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <span className="block truncate text-xs font-medium text-foreground">
                          {c.exports.join(", ") || c.file.split("/").pop()}
                        </span>
                        <span className="block truncate text-[10px] text-muted-foreground">{c.file}</span>
                      </button>
                    ))}
                  </div>
                </section>
              ))
            )
          ) : filtered.length === 0 ? (
            <p role="status" className="py-6 text-center text-xs text-muted-foreground">
              Nenhum componente corresponde a “{query}”.
            </p>
          ) : tab === "grupos" ? (
            (Object.keys(LAYOUT_COMPONENT_GROUPS) as LayoutComponentGroup[]).map((g) => {
              const items = filtered.filter((c) => c.group === g);
              if (items.length === 0) return null;
              return (
                <section key={g} aria-label={LAYOUT_COMPONENT_GROUPS[g]} className="mb-4">
                  <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {LAYOUT_COMPONENT_GROUPS[g]} · {items.length}
                  </h3>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {items.map((c) => <ComponentCard key={c.id} meta={c} onPick={pick} />)}
                  </div>
                </section>
              );
            })
          ) : (
            byPage.map((g) => (
              <section key={g.page} aria-label={`Componentes da página ${pageLabel(g.page)}`} className="mb-4">
                <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.page === "—" ? "Estruturais" : pageLabel(g.page)} · {g.items.length}
                </h3>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {g.items.map((c) => <ComponentCard key={c.id} meta={c} onPick={pick} />)}
                </div>
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
