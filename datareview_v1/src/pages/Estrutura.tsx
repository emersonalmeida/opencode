/**
 * Estrutura (/estrutura) — DESENHO ESTRUTURAL de páginas: monte colunas,
 * blocos expansíveis e linhas topo/rodapé começando de um preset
 * estrutural (grid, 1/3/5 colunas, laterais divididas…) — SEM conteúdo.
 *
 * Modos:
 *  - ESTRUTURAL (editar): só a forma — colunas, blocos expansíveis, níveis,
 *    redimensionamento, título/descrição e vínculo de componente (por bloco,
 *    via galeria completa do sistema). Nada de dados.
 *  - DINÂMICO (visualizar): o mesmo spec renderizado com os componentes
 *    REAIS ligados aos dados do sistema (LayoutSpecView preview).
 *
 * "Salvar como página" publica em Minhas páginas (rota /p/:id).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, ArrowUpToLine, ArrowDownToLine, Trash2, Download, Upload,
  LayoutGrid, Eye, PencilRuler, Save, Component,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { LayoutSpecView } from "@/components/layoutBuilder/LayoutSpecView";
import { ComponentGallery } from "@/components/layoutBuilder/ComponentGallery";
import {
  addColumn, addRow, removeColumn, splitColumn, moveColumn, toggleColumnRole,
  setBlockComponent, setBlockTitle, setBlockDesc,
  MAX_COLUMNS, MAX_ROWS_PER_REGION,
  type LayoutSpec,
} from "@/lib/layoutTemplates";
import { STRUCTURE_PRESETS, specStats, type StructurePreset } from "@/lib/structurePresets";
import { createCustomPage, useCustomPages } from "@/lib/customPages";
import { layoutComponentMeta } from "@/lib/layoutComponents";
import { downloadFile } from "@/lib/pageFeatures";
import { serializeLayout, deserializeLayout } from "@/lib/layoutTemplates";
import { toastSuccess, toastError, toastInfo, toastDestructive, confirmDestructive } from "@/lib/ux";
import { cn } from "@/lib/utils";

type ViewMode = "estrutural" | "dinamico";

export default function Estrutura() {
  const navigate = useNavigate();
  const customPages = useCustomPages();
  const [spec, setSpec] = useState<LayoutSpec>(() => STRUCTURE_PRESETS.find((p) => p.id === "five-columns")!.build());
  const [mode, setMode] = useState<ViewMode>("estrutural");
  const [selBlock, setSelBlock] = useState<{ columnId: string; blockId: string } | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [pageName, setPageName] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const stats = useMemo(() => specStats(spec), [spec]);
  const bound = useMemo(
    () =>
      spec.columns.flatMap((c) => c.blocks).filter((b) => b.component).length +
      [...spec.top, ...spec.bottom].flatMap((r) => r.blocks).filter((b) => b.component).length,
    [spec],
  );
  const empty = stats.columns === 0 && stats.rows === 0;

  const onSpecChange = useCallback((next: LayoutSpec) => setSpec(next), []);

  const applyPreset = (preset: StructurePreset) => {
    onSpecChange(preset.build());
    setSelBlock(null);
    toastInfo(`Estrutura "${preset.name}" aplicada.`);
  };

  const clearAll = () => {
    if (!confirmDestructive("Limpar a estrutura inteira?", `${stats.columns} colunas, ${stats.blocks} blocos e ${stats.rows} linhas serão removidos.`)) return;
    const before = spec;
    onSpecChange({ top: [], columns: [], bottom: [] });
    setSelBlock(null);
    toastDestructive("Estrutura limpa.", { onUndo: () => onSpecChange(before) });
  };

  const saveAsPage = () => {
    if (empty) { toastError("Estrutura vazia — adicione ao menos uma coluna ou linha."); return; }
    const name = pageName.trim() || `Estrutura ${customPages.length + 1}`;
    const page = createCustomPage(name, spec);
    toastSuccess(`Página "${name}" criada em Minhas páginas.`);
    navigate(`/p/${page.id}`);
  };

  const exportJson = () => {
    const name = pageName.trim() || "estrutura";
    downloadFile(`${name}.json`, JSON.stringify(serializeLayout(spec), null, 2), "application/json");
  };

  const importJson = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = deserializeLayout(String(reader.result ?? ""));
      if (!next) { toastError("Arquivo inválido — não foi possível ler a estrutura."); return; }
      onSpecChange(next);
      setSelBlock(null);
      toastSuccess("Estrutura importada.");
    };
    reader.readAsText(file);
  };

  const sel = useMemo(() => {
    if (!selBlock) return null;
    const column = spec.columns.find((c) => c.id === selBlock.columnId);
    const block = column?.blocks.find((b) => b.id === selBlock.blockId);
    return column && block ? { column, block } : null;
  }, [spec, selBlock]);

  return (
    <ErrorBoundary title="Erro ao renderizar a Estrutura">
      <div className="flex h-full min-h-0 flex-col">
        <AppHeader
          title="Estrutura"
          crumb={`${stats.columns} colunas · ${stats.blocks} blocos · ${stats.rows} linhas · ${bound} componentes vinculados`}
          showSearch={false}
        />
        <main id="content" className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
          {/* Toolbar: presets estruturais + ações */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/50 p-3">
            <button
              onClick={() => onSpecChange({ ...spec, columns: addColumn(spec.columns) })}
              disabled={stats.columns >= MAX_COLUMNS}
              aria-label="Adicionar coluna"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> Coluna
            </button>
            <button
              onClick={() => onSpecChange({ ...spec, top: addRow(spec.top, "Linha topo") })}
              disabled={spec.top.length >= MAX_ROWS_PER_REGION}
              aria-label="Adicionar linha no topo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 disabled:opacity-50"
            >
              <ArrowUpToLine className="h-3.5 w-3.5" /> Linha topo
            </button>
            <button
              onClick={() => onSpecChange({ ...spec, bottom: addRow(spec.bottom, "Linha rodapé") })}
              disabled={spec.bottom.length >= MAX_ROWS_PER_REGION}
              aria-label="Adicionar linha no rodapé"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 disabled:opacity-50"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" /> Linha rodapé
            </button>

            {/* Modo estrutural (edição sem conteúdo) × dinâmico (preview c/ dados) */}
            <div role="group" aria-label="Modo de visualização" className="flex gap-1">
              {([
                { id: "estrutural" as const, label: "Estrutural", icon: PencilRuler, hint: "edição — só a forma, sem dados" },
                { id: "dinamico" as const, label: "Dinâmico", icon: Eye, hint: "preview — componentes reais com dados" },
              ]).map(({ id, label, icon: Icon, hint }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  aria-pressed={mode === id}
                  title={`Modo ${label} — ${hint}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px]",
                    mode === id ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            <span className="flex-1" />

            <button onClick={exportJson} aria-label="Exportar estrutura em JSON" title="Exportar JSON"
              className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary">
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
            <button onClick={() => fileRef.current?.click()} aria-label="Importar estrutura de JSON" title="Importar JSON"
              className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary">
              <Upload className="h-3.5 w-3.5" /> Importar
            </button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden"
              onChange={(e) => { importJson(e.target.files?.[0]); e.target.value = ""; }} />
            <button onClick={clearAll} aria-label="Limpar estrutura" title="Limpar (com desfazer)"
              className="inline-flex items-center gap-1 rounded-lg border border-destructive/40 px-2.5 py-1.5 text-[11px] text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5" /> Limpar
            </button>
          </div>

          {/* Presets estruturais */}
          <section aria-label="Presets de estrutura" className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <LayoutGrid className="h-3.5 w-3.5 text-primary" /> Estruturas predefinidas — comece de um esqueleto pronto (sem conteúdo)
            </p>
            <div className="flex flex-wrap gap-1.5" role="group">
              {STRUCTURE_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => applyPreset(p)}
                  title={p.description}
                  className="rounded-full border border-border/60 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </section>

          {/* Canvas + inspector do bloco selecionado */}
          <div className={cn("grid gap-3", mode === "estrutural" && sel ? "lg:grid-cols-[minmax(0,1fr)_280px]" : "")}>
            <div className="min-w-0">
              {empty ? (
                <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
                  Estrutura vazia — adicione uma coluna ou aplique um preset acima.
                </div>
              ) : (
                <LayoutSpecView
                  spec={spec}
                  mode={mode === "estrutural" ? "edit" : "preview"}
                  onSpecChange={onSpecChange}
                  selBlock={mode === "estrutural" ? selBlock : null}
                  onSelectBlock={mode === "estrutural" ? setSelBlock : undefined}
                  fillHeight={mode === "dinamico"}
                />
              )}
            </div>

            {/* Inspector do bloco selecionado (modo estrutural) */}
            {mode === "estrutural" && sel && (
              <aside className="space-y-2.5 rounded-xl border border-border/60 bg-card/60 p-3" aria-label="Propriedades do bloco selecionado">
                <p className="text-[11px] font-semibold text-foreground">Bloco selecionado</p>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground" htmlFor="blk-title">Título</label>
                  <input
                    id="blk-title"
                    value={sel.block.title}
                    onChange={(e) =>
                      onSpecChange({ ...spec, columns: setBlockTitle(spec.columns, sel.column.id, sel.block.id, e.target.value) })
                    }
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground" htmlFor="blk-desc">Descrição</label>
                  <input
                    id="blk-desc"
                    value={sel.block.desc ?? ""}
                    onChange={(e) =>
                      onSpecChange({ ...spec, columns: setBlockDesc(spec.columns, sel.column.id, sel.block.id, e.target.value) })
                    }
                    className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">Componente vinculado</p>
                  <button
                    onClick={() => setGalleryOpen(true)}
                    className="flex w-full items-center gap-1.5 rounded-md border border-border/60 px-2 py-1.5 text-left text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  >
                    <Component className="h-3.5 w-3.5 text-primary" />
                    {sel.block.component
                      ? (layoutComponentMeta(sel.block.component)?.label ?? sel.block.component)
                      : "Escolher componente… (busca em todo o sistema)"}
                  </button>
                  {sel.block.component && (
                    <button
                      onClick={() =>
                        onSpecChange({ ...spec, columns: setBlockComponent(spec.columns, sel.column.id, sel.block.id, undefined) })
                      }
                      className="text-[10px] text-destructive hover:underline"
                    >
                      Remover vínculo (volta a ser bloco vazio)
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 pt-1">
                  <button
                    onClick={() => onSpecChange({ ...spec, columns: splitColumn(spec.columns, sel.column.id) })}
                    className="rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-primary/40"
                  >
                    Dividir coluna
                  </button>
                  <button
                    onClick={() => onSpecChange({ ...spec, columns: moveColumn(spec.columns, sel.column.id, -1) })}
                    aria-label="Mover coluna para a esquerda"
                    className="rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-primary/40"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => onSpecChange({ ...spec, columns: moveColumn(spec.columns, sel.column.id, 1) })}
                    aria-label="Mover coluna para a direita"
                    className="rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-primary/40"
                  >
                    →
                  </button>
                  <button
                    onClick={() => onSpecChange({ ...spec, columns: toggleColumnRole(spec.columns, sel.column.id) })}
                    title="Alterna entre coluna de conteúdo e sidebar (estreita)"
                    className="rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-primary/40"
                  >
                    {sel.column.role === "sidebar" ? "sidebar" : "conteúdo"}
                  </button>
                  <button
                    onClick={() => {
                      onSpecChange({ ...spec, columns: removeColumn(spec.columns, sel.column.id) });
                      setSelBlock(null);
                    }}
                    aria-label="Remover coluna"
                    className="rounded-md border border-destructive/40 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/10"
                  >
                    Excluir
                  </button>
                </div>
              </aside>
            )}
          </div>

          {/* Salvar como página (Minhas páginas) */}
          <footer className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/50 p-3">
            <input
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              placeholder={`Nome da página (ex.: Estrutura ${customPages.length + 1})`}
              aria-label="Nome da nova página"
              className="h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 text-xs sm:max-w-xs"
            />
            <button
              onClick={saveAsPage}
              disabled={empty}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" /> Salvar como página
            </button>
            <p className="text-[10px] text-muted-foreground">
              Vai para <b>Minhas páginas</b> (menu lateral) — editável depois em /layouts e visível no modo dinâmico.
            </p>
          </footer>
        </main>

        <ComponentGallery
          open={galleryOpen}
          onOpenChange={setGalleryOpen}
          blockTitle={sel?.block.title ?? ""}
          onPick={(id) => {
            if (sel) onSpecChange({ ...spec, columns: setBlockComponent(spec.columns, sel.column.id, sel.block.id, id) });
          }}
        />
      </div>
    </ErrorBoundary>
  );
}
