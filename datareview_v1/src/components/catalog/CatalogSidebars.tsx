/**
 * CatalogSidebars — sidebars internas da página `/componentes`.
 *
 * ESQUERDA (navegação do catálogo):
 *  - Páginas: todas as páginas do menu (numeradas) — clique abre a seção.
 *  - Componentes: componentes agrupados por página — clique seleciona
 *    (a sidebar direita mostra detalhes) e abre a seção da página.
 *  - Sistema: componentes compartilhados/globais.
 *  - Âncoras: todas as seções da coluna central (scroll direto).
 *
 * DIREITA (inspeção/edição):
 *  - Componente: detalhes do componente selecionado (arquivo, exports,
 *    consumidores, página de origem) + preview ao vivo quando disponível.
 *    Selecionar um componente em qualquer lugar troca para esta aba.
 *  - Tokens: editor global de design tokens (mudança reflete ao vivo em
 *    TODOS os frames de página renderizados na coluna central).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Atom, Boxes, Code, Copy, FileCode2, Layers, ListTree, MousePointerClick, Palette, Plus, Puzzle,
} from "lucide-react";
import { PageTabsSidebar } from "@/components/PageTabsSidebar";
import { DesignSystemSection } from "@/components/settings/DesignSystemSection";
import { PAGES, pageNumber, numberedLabel } from "@/lib/pages";
import { catalogSectionId, openCatalogSection } from "@/lib/pageFrames";
import {
  CATALOG_SELECT_EVENT, selectComponent, useSelectedComponent,
} from "@/lib/catalogSelection";
import { groupComponentsByPage } from "@/lib/componentCatalog";
import { ATOMIC_META, atomicLevelOf } from "@/lib/atomicDesign";
import { ComponentLiveRender } from "@/components/catalog/ComponentLiveRender";
import { LivePreview, PREVIEWABLE } from "@/components/catalog/LivePreview";
import { fetchComponentSource, saveComponentSource } from "@/lib/componentSource";
import { createCustomPage } from "@/lib/customPages";
import { newBlock, newColumn, type LayoutSpec } from "@/lib/layoutTemplates";
import { publicComponentId } from "@/lib/layoutComponents";
import { cn } from "@/lib/utils";

export function CatalogSidebars() {
  const groups = useMemo(() => groupComponentsByPage(), []);
  const groupsByPath = useMemo(() => new Map(groups.map((g) => [g.pagePath, g.components])), [groups]);
  const shared = groupsByPath.get("shared") ?? [];

  return (
    <>
      <PageTabsSidebar
        id="catalog-left"
        side="left"
        title="Componentes"
        subtitle="Navegação do catálogo"
        icon={<Boxes className="h-4 w-4" />}
        storageKey="aso:catalog-left-w"
        defaultWidth={280}
        defaultTab="paginas"
        tabs={[
          {
            id: "paginas", label: "Páginas", icon: <Layers className="h-3 w-3" />,
            content: <PagesNavTab />,
          },
          {
            id: "componentes", label: "Componentes", icon: <Puzzle className="h-3 w-3" />,
            content: <PageComponentsTab groupsByPath={groupsByPath} />,
          },
          {
            id: "sistema", label: "Sistema", icon: <Boxes className="h-3 w-3" />,
            content: <SystemComponentsTab shared={shared} />,
          },
          {
            id: "ancoras", label: "Âncoras", icon: <ListTree className="h-3 w-3" />,
            content: <AnchorsTab />,
          },
        ]}
      />
      <PageTabsSidebar
        id="catalog-right"
        side="right"
        title="Inspeção"
        subtitle="Componente e tokens"
        icon={<MousePointerClick className="h-4 w-4" />}
        storageKey="aso:catalog-right-w"
        defaultWidth={340}
        defaultTab="componente"
        activateOnEvent={{ event: CATALOG_SELECT_EVENT, tabId: "componente" }}
        tabs={[
          {
            id: "componente", label: "Componente", icon: <FileCode2 className="h-3 w-3" />,
            content: <SelectedComponentTab />,
          },
          {
            id: "tokens", label: "Tokens", icon: <Palette className="h-3 w-3" />,
            content: (
              <div className="p-2">
                <p className="mb-2 text-[10px] text-muted-foreground">
                  Tokens globais — editar aqui reflete imediatamente em todos os frames de página da coluna central.
                </p>
                <DesignSystemSection />
              </div>
            ),
          },
        ]}
      />
    </>
  );
}

/* ---------------------------------- esquerda --------------------------------- */

function NavRow({ label, sub, icon, onClick, active }: {
  label: string; sub?: string; icon?: React.ReactNode; onClick: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
        active ? "bg-primary/10 text-primary" : "hover:bg-secondary/60",
      )}
    >
      {icon}
      <span className="min-w-0">
        <span className="block truncate font-medium">{label}</span>
        {sub && <span className="block truncate text-[10px] text-muted-foreground">{sub}</span>}
      </span>
    </button>
  );
}

function PagesNavTab() {
  return (
    <div className="p-2 space-y-0.5">
      <p className="px-2 pb-1 text-[10px] text-muted-foreground">
        Todas as páginas na ordem do menu. Clique para abrir a seção correspondente na coluna central.
      </p>
      {PAGES.map((p) => {
        const Icon = p.icon;
        return (
          <NavRow
            key={p.path}
            label={numberedLabel(p.path, p.label)}
            sub={p.desc}
            icon={<Icon className="h-3.5 w-3.5 shrink-0 text-primary" />}
            onClick={() => openCatalogSection(catalogSectionId(p.path))}
          />
        );
      })}
    </div>
  );
}

function PageComponentsTab({ groupsByPath }: { groupsByPath: Map<string, import("@/lib/componentInventory.generated").ComponentInventoryEntry[]> }) {
  const selected = useSelectedComponent();
  return (
    <div className="p-2 space-y-2">
      {PAGES.map((p) => {
        const comps = groupsByPath.get(p.path) ?? [];
        if (comps.length === 0) return null;
        return (
          <div key={p.path}>
            <p className="px-2 pt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {pageNumber(p.path)}. {p.label} ({comps.length})
            </p>
            {comps.map((c) => (
              <NavRow
                key={c.file}
                label={c.exports.join(", ") || c.file}
                sub={c.file}
                active={selected?.file === c.file}
                onClick={() => {
                  selectComponent({ file: c.file, pagePath: p.path, pageLabel: p.label });
                  openCatalogSection(catalogSectionId(p.path), { tab: "componentes" });
                }}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function SystemComponentsTab({ shared }: { shared: import("@/lib/componentInventory.generated").ComponentInventoryEntry[] }) {
  const selected = useSelectedComponent();
  return (
    <div className="p-2 space-y-0.5">
      <p className="px-2 pb-1 text-[10px] text-muted-foreground">
        Componentes compartilhados e de sistema ({shared.length}) — usados por várias páginas.
      </p>
      {shared.map((c) => (
        <NavRow
          key={c.file}
          label={c.exports.join(", ") || c.file}
          sub={c.file}
          active={selected?.file === c.file}
          onClick={() => {
            selectComponent({ file: c.file, pagePath: "shared", pageLabel: "Sistema" });
            openCatalogSection("cat-shared");
          }}
        />
      ))}
    </div>
  );
}

function AnchorsTab() {
  const anchors = [
    { id: "cat-repeticoes", label: "Candidatos a consolidação" },
    { id: "cat-reuso", label: "Mais reutilizados" },
    ...PAGES.map((p) => ({ id: catalogSectionId(p.path), label: numberedLabel(p.path, p.label) })),
    { id: "cat-shared", label: "Componentes do sistema" },
  ];
  return (
    <div className="p-2 space-y-0.5">
      {anchors.map((a) => (
        <NavRow key={a.id} label={a.label} sub={`#${a.id}`} onClick={() => openCatalogSection(a.id)} />
      ))}
    </div>
  );
}

/* ---------------------------------- direita ---------------------------------- */

function SelectedComponentTab() {
  const selected = useSelectedComponent();
  const navigate = useNavigate();
  const groups = useMemo(() => groupComponentsByPage(), []);
  const entry = selected
    ? groups.flatMap((g) => g.components).find((c) => c.file === selected.file) ?? null
    : null;

  if (!selected || !entry) {
    return (
      <div className="p-3 text-xs text-muted-foreground space-y-2">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <MousePointerClick className="h-3.5 w-3.5" /> Nenhum componente selecionado
        </p>
        <p>
          Clique num componente na coluna central (ou nas abas Componentes/Sistema da sidebar
          esquerda) para ver detalhes, estrutura Atomic Design, render e código aqui.
        </p>
      </div>
    );
  }

  const atomic = ATOMIC_META[atomicLevelOf(entry)];
  const componentName = entry.exports[0] ?? entry.file.split("/").pop()?.replace(/\.tsx$/, "") ?? entry.file;

  /** Materializa: cria uma página customizada real com o componente vinculado
   * (render ao vivo via cat:<arquivo>) e abre a página pronta em /p/:id. */
  const createPageWithComponent = () => {
    const col = newColumn(componentName);
    col.blocks = [{
      ...newBlock(componentName, publicComponentId(entry.file)),
      desc: `src/${entry.file}`,
      height: 420,
    }];
    const spec: LayoutSpec = { top: [], columns: [col], bottom: [] };
    const page = createCustomPage(componentName, spec);
    toast.success(`Página "${page.name}" criada`, { description: "Editável em Layouts · visível no menu lateral." });
    navigate(`/p/${page.id}`);
  };

  return (
    <div className="p-3 space-y-3 text-xs">
      <div>
        <p className="text-sm font-semibold text-foreground">{entry.exports.join(", ") || entry.file}</p>
        <code className="text-[10px] text-muted-foreground break-all">src/{entry.file}</code>
      </div>

      {/* Visualização Atomic Design */}
      <div className="rounded-md border border-border/50 p-2.5 space-y-2">
        <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
          <Atom className="h-3 w-3" /> Atomic Design
        </p>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", atomic.badge)}>{atomic.label}</span>
          <span className="text-[10px] text-muted-foreground">{atomic.description}</span>
        </div>
        {entry.deps.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">Do que é feito ({entry.deps.length})</p>
            <ul className="ml-2 mt-0.5 space-y-0.5">
              {entry.deps.map((d) => (
                <li key={d}>
                  <button
                    className="text-[10px] text-primary hover:underline text-left"
                    onClick={() => {
                      selectComponent({ file: d, pagePath: selected.pagePath, pageLabel: selected.pageLabel });
                    }}
                  >
                    {d.split("/").pop()}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {entry.deps.length === 0 && (
          <p className="text-[10px] text-muted-foreground">Sem dependências locais — é um bloco fundamental.</p>
        )}
        {entry.hooks.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1">Comportamento ({entry.hooks.length} hooks)</p>
            <p className="text-[10px] text-muted-foreground ml-2 font-mono">{entry.hooks.join(", ")}</p>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-1.5">
        <div className="rounded border border-border/50 p-2">
          <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">Página</dt>
          <dd className="font-medium">{selected.pageLabel}</dd>
        </div>
        <div className="rounded border border-border/50 p-2">
          <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">Consumidores</dt>
          <dd className="font-medium">{entry.consumers}</dd>
        </div>
        <div className="rounded border border-border/50 p-2">
          <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">Linhas</dt>
          <dd className="font-medium">{entry.lines}</dd>
        </div>
        <div className="rounded border border-border/50 p-2">
          <dt className="text-[9px] uppercase tracking-wider text-muted-foreground">Exports</dt>
          <dd className="font-medium">{entry.exports.length}</dd>
        </div>
      </dl>
      <div className="flex gap-1.5">
        <button
          onClick={() => { void navigator.clipboard?.writeText(entry.file).catch(() => {}); }}
          className="flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-secondary/60"
        >
          <Copy className="h-3 w-3" /> Copiar path
        </button>
        <button
          onClick={() => selectComponent(null)}
          className="rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:bg-secondary/60"
        >
          Limpar seleção
        </button>
      </div>

      {/* Materializar: transforma o componente inspecionado numa página real
          do sistema (custom page /p/:id) — resultado concreto, editável. */}
      <button
        onClick={createPageWithComponent}
        aria-label={`Criar página com o componente ${componentName}`}
        className="flex w-full items-center gap-1.5 rounded-md border border-primary/50 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20"
      >
        <Plus className="h-3.5 w-3.5" /> Criar página com este componente
      </button>
      <p className="text-[9px] text-muted-foreground -mt-1.5">
        Cria uma página real em "Minhas páginas" com o componente renderizando ao vivo
        (dados do sistema) — edite a estrutura em Layouts.
      </p>

      {/* Render ao vivo: preview curado quando existe, senão render genérico */}
      <div className="rounded-md border border-dashed border-border/60 p-3 bg-background/40">
        <p className="mb-2 text-[9px] uppercase tracking-wider text-muted-foreground">Render ao vivo</p>
        {PREVIEWABLE.has(entry.file) ? <LivePreview file={entry.file} /> : <ComponentLiveRender file={entry.file} />}
      </div>

      {/* Código: ver e editar o componente real (save reflete em todo o sistema) */}
      <ComponentEditor file={entry.file} />
    </div>
  );
}

/** Editor embutido: carrega o código real, permite salvar (válido via HMR em
 * dev; em build de produção exige rebuild — aviso honesto). */
function ComponentEditor({ file }: { file: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "ready">("idle");
  const [source, setSource] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStatus("loading");
    setError(null);
    setDirty(false);
    let cancelled = false;
    void fetchComponentSource(file).then((r) => {
      if (cancelled) return;
      if (r.ok === true) {
        setSource(r.source);
        setStatus("ready");
      } else {
        setError(r.error);
        setStatus("error");
      }
    });
    return () => { cancelled = true; };
  }, [open, file]);

  const save = async () => {
    setSaving(true);
    setToast(null);
    const r = await saveComponentSource(file, source);
    setSaving(false);
    if (r.ok) {
      setDirty(false);
      setToast("Salvo — refletido em todo o sistema (HMR em dev; rebuild em produção).");
    } else {
      setToast(`Falha ao salvar: ${r.error}`);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-[11px] text-foreground hover:bg-secondary/60"
      >
        <Code className="h-3.5 w-3.5" /> Ver e editar código do componente
      </button>
    );
  }

  return (
    <div className="rounded-md border border-border/60 overflow-hidden">
      <div className="flex items-center gap-1 border-b border-border/50 px-2 py-1.5">
        <Code className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[10px] font-medium text-foreground truncate">{file}</span>
        <span className="ml-auto flex items-center gap-1">
          {dirty && <span className="text-[9px] text-amber-600">não salvo</span>}
          <button
            onClick={() => { void save(); }}
            disabled={!dirty || saving || status !== "ready"}
            className="rounded px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            {saving ? "…" : "Salvar"}
          </button>
          <button onClick={() => setOpen(false)} className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary/60">
            Fechar
          </button>
        </span>
      </div>
      {status === "loading" && <p className="p-3 text-[11px] text-muted-foreground">Carregando código…</p>}
      {status === "error" && <p className="p-3 text-[11px] text-destructive" role="alert">{error}</p>}
      {status === "ready" && (
        <textarea
          value={source}
          onChange={(e) => { setSource(e.target.value); setDirty(true); }}
          spellCheck={false}
          aria-label={`Código-fonte de ${file}`}
          className="h-72 w-full resize-y bg-zinc-950 p-2.5 font-mono text-[10.5px] leading-relaxed text-zinc-100 outline-none"
        />
      )}
      {toast && <p className={`px-2 py-1.5 text-[10px] ${toast.startsWith("Falha") ? "text-destructive" : "text-emerald-600"}`}>{toast}</p>}
      <p className="border-t border-border/50 px-2 py-1 text-[9px] text-muted-foreground">
        Editar salva o arquivo real em disco — qualquer página que use o componente reflete a mudança
        (HMR em dev; rebuild em produção). Use com cautela.
      </p>
    </div>
  );
}
