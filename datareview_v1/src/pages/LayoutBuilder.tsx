/**
 * Layouts (`/layouts`) — construtor de templates de layout, telas
 * customizadas funcionais e PÁGINAS do usuário.
 *
 * Estrutura: linhas horizontais no topo/rodapé (entidades: adicionar/remover/
 * reordenar) + colunas responsivas ajustáveis (peso flex, handles drag/
 * teclado, recolhíveis, papel "sidebar") que podem ser divididas em blocos
 * expansíveis com 3 níveis padronizados (N1 altura fixa+scroll · N2 cresce
 * com o conteúdo · N3 só título+descrição). Cada bloco pode estar vazio ou
 * vinculado a um componente REAL do sistema (galeria com abas por grupo e
 * por página de origem) — o modo **Visualizar** renderiza a tela funcional
 * com o conteúdo real coletado (dataset/seleção global).
 *
 * MODOS DE VISUALIZAÇÃO: "página" (dentro do construtor), "sistema" (tela
 * cheia como as outras páginas) e "fullscreen" (overlay imersivo).
 *
 * Templates/telas são salvos localmente e reaplicáveis (export/import JSON);
 * telas também podem virar PÁGINAS CUSTOMIZADAS do sistema (rota `/p/:id`,
 * menu da sidebar esquerda).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Check, Copy, Download, Eye, FileUp, LayoutTemplate, Monitor, Pencil,
  PencilRuler, Plus, Save, Smartphone, Tablet, Trash2, Layers,
  ArrowDownToLine, ArrowUpToLine, PanelTop, Maximize2, Minimize2, ExternalLink,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { toastSuccess, toastError, toastInfo, toastDestructive, confirmDestructive } from "@/lib/ux";
import { downloadFile } from "@/lib/pageFeatures";
import {
  LayoutSpec, LayoutColumn, SavedTemplate,
  LAYOUT_PRESETS, addColumn, addRow,
  deserializeLayout, layoutSummary,
  useLayoutTemplates, saveTemplate, updateTemplate, deleteTemplate, renameTemplate,
  exportTemplateText, MAX_COLUMNS, MAX_ROWS_PER_REGION,
} from "@/lib/layoutTemplates";
import { LayoutSpecView } from "@/components/layoutBuilder/LayoutSpecView";
import {
  createCustomPage, updateCustomPageSpec, deleteCustomPage, renameCustomPage,
  getCustomPage, useCustomPages,
} from "@/lib/customPages";
import { cn } from "@/lib/utils";

type Device = "desktop" | "tablet" | "mobile";
const DEVICE_META: { id: Device; label: string; icon: typeof Monitor; maxWidth: string }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor, maxWidth: "max-w-none" },
  { id: "tablet", label: "Tablet", icon: Tablet, maxWidth: "max-w-[820px]" },
  { id: "mobile", label: "Mobile", icon: Smartphone, maxWidth: "max-w-[400px]" },
];

/** Modos de visualização do canvas. */
type ViewMode = "edit" | "page" | "system" | "fullscreen";
const VIEW_MODES: { id: ViewMode; label: string; icon: typeof Eye; hint: string }[] = [
  { id: "edit", label: "Editar", icon: PencilRuler, hint: "Montar a estrutura e vincular componentes" },
  { id: "page", label: "Página", icon: Eye, hint: "Visualizar a tela funcional dentro do construtor" },
  { id: "system", label: "Sistema", icon: PanelTop, hint: "Como uma página real do sistema (tela cheia)" },
  { id: "fullscreen", label: "Fullscreen", icon: Maximize2, hint: "Imersivo — só a tela, sem chrome" },
];

export default function LayoutBuilder({ embedded = false }: { embedded?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const editingPageId = searchParams.get("page");

  const [spec, setSpec] = useState<LayoutSpec>(() => {
    if (editingPageId) {
      const page = getCustomPage(editingPageId);
      if (page) return JSON.parse(JSON.stringify(page.spec)) as LayoutSpec;
    }
    return LAYOUT_PRESETS[0].build();
  });
  const [mode, setMode] = useState<ViewMode>("edit");
  const [device, setDevice] = useState<Device>("desktop");
  const [selBlock, setSelBlock] = useState<{ columnId: string; blockId: string } | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [busyPreset, setBusyPreset] = useState<string | null>(null);
  const templates = useLayoutTemplates();
  const customPages = useCustomPages();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Quando o canvas muda e estamos editando uma página customizada, sincroniza.
  const isEditingPage = Boolean(editingPageId && getCustomPage(editingPageId));
  const onSpecChange = useCallback((next: LayoutSpec) => {
    setSpec(next);
    if (editingPageId && getCustomPage(editingPageId)) {
      updateCustomPageSpec(editingPageId, next);
    }
  }, [editingPageId]);

  useEffect(() => {
    if (mode === "fullscreen") {
      const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMode("page"); };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
  }, [mode]);

  const summary = useMemo(() => layoutSummary(spec), [spec]);
  const empty = spec.columns.length === 0 && spec.top.length === 0 && spec.bottom.length === 0;

  // ---------- Ações de alto nível ----------
  const applyPreset = (presetId: string) => {
    const preset = LAYOUT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setBusyPreset(presetId);
    onSpecChange(preset.build());
    setSelBlock(null);
    toastInfo(`Preset "${preset.name}" aplicado.`);
    setTimeout(() => setBusyPreset(null), 400);
  };

  const clearAll = () => {
    if (!confirmDestructive("Limpar o canvas inteiro?", `Isso remove ${summary.columns} colunas, ${summary.blocks} blocos e ${summary.rows} linhas.`)) return;
    const before = spec;
    onSpecChange({ top: [], columns: [], bottom: [] });
    setSelBlock(null);
    toastDestructive("Canvas limpo.", { onUndo: () => onSpecChange(before) });
  };

  const applyTemplate = (tpl: SavedTemplate, preview = false) => {
    // Deep-copy para não compartilhar referências com o storage.
    onSpecChange(JSON.parse(JSON.stringify(tpl.spec)) as LayoutSpec);
    setSelBlock(null);
    setMode(preview ? "page" : "edit");
    toastSuccess(`Tela "${tpl.name}" ${preview ? "aberta em Visualizar" : "aplicada ao canvas"}.`);
  };

  const saveCurrent = () => {
    const name = templateName.trim();
    if (!name) { toastError("Dê um nome ao template antes de salvar."); return; }
    if (empty) { toastError("O canvas está vazio — adicione pelo menos uma coluna ou linha."); return; }
    saveTemplate(name, spec);
    setTemplateName("");
    toastSuccess(`Tela "${name}" salva.`);
  };

  const saveAsPage = () => {
    const name = templateName.trim() || `Página ${customPages.length + 1}`;
    if (empty) { toastError("O canvas está vazio — adicione pelo menos uma coluna ou linha."); return; }
    if (isEditingPage && editingPageId) {
      renameCustomPage(editingPageId, name);
      updateCustomPageSpec(editingPageId, spec);
      toastSuccess(`Página "${name}" atualizada.`);
      navigate(`/p/${editingPageId}`);
      return;
    }
    const page = createCustomPage(name, spec);
    toastSuccess(`Página "${name}" criada — disponível no menu de páginas.`);
    navigate(`/p/${page.id}`);
  };

  const exportCurrent = () => {
    const name = templateName.trim() || "layout";
    downloadFile(`${name}.json`, exportTemplateText(name, spec), "application/json");
  };

  const importFromFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const next = deserializeLayout(String(reader.result ?? ""));
      if (!next) { toastError("Arquivo inválido — não foi possível ler o template."); return; }
      onSpecChange(next);
      setSelBlock(null);
      toastSuccess("Template importado para o canvas.");
    };
    reader.readAsText(file);
  };

  const mutateCols = useCallback((fn: (cols: LayoutColumn[]) => LayoutColumn[]) => {
    onSpecChange({ ...spec, columns: fn(spec.columns) });
  }, [spec, onSpecChange]);

  // ---------- Modo FULLSCREEN (overlay imersivo) ----------
  if (mode === "fullscreen") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-label="Visualização em tela cheia">
        <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-1.5">
          <LayoutTemplate className="h-4 w-4 text-primary" />
          <p className="text-xs font-medium text-foreground">{templateName.trim() || "Tela customizada"}</p>
          <span className="text-[10px] text-muted-foreground">{summary.columns} col · {summary.blocks + summary.rows} blocos</span>
          <span className="flex-1" />
          <button
            onClick={() => setMode("page")}
            aria-label="Sair do modo fullscreen"
            title="Sair do fullscreen (Esc)"
            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Minimize2 className="h-3.5 w-3.5" /> Sair (Esc)
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <LayoutSpecView spec={spec} mode="preview" onSpecChange={onSpecChange} fillHeight />
        </div>
      </div>
    );
  }

  // ---------- Render ----------
  const editingPage = editingPageId ? getCustomPage(editingPageId) : undefined;
  return (
    <div className={cn(embedded ? "flex h-full min-h-0 flex-col" : mode === "system" ? "flex h-screen flex-col" : "min-h-screen")}>
      {!embedded && (
        <AppHeader
          title={editingPage ? `Layouts — ${editingPage.name}` : "Layouts"}
          crumb={`${summary.columns} colunas · ${summary.blocks + summary.rows} blocos · ${summary.bound} com componente`}
        />
      )}
      <main id={embedded ? undefined : "content"} className={cn(embedded || mode === "system" ? "min-h-0 flex-1 overflow-y-auto p-2 sm:p-3" : "content-fluid py-4 space-y-4")}>
        {/* Barra de ferramentas (some no modo sistema para a tela ocupar tudo) */}
        {mode !== "system" && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/50 p-3">
            <button
              onClick={() => mutateCols((cols) => addColumn(cols))}
              disabled={summary.columns >= MAX_COLUMNS}
              aria-label="Adicionar coluna"
              title="Adicionar coluna (com 1 componente expansível)"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Plus className="h-3.5 w-3.5" /> Coluna
            </button>
            <button
              onClick={() => onSpecChange({ ...spec, top: addRow(spec.top) })}
              disabled={spec.top.length >= MAX_ROWS_PER_REGION}
              aria-label="Adicionar linha no topo"
              title="Adicionar linha no topo (ex.: header)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <ArrowUpToLine className="h-3.5 w-3.5" /> Linha topo
            </button>
            <button
              onClick={() => onSpecChange({ ...spec, bottom: addRow(spec.bottom) })}
              disabled={spec.bottom.length >= MAX_ROWS_PER_REGION}
              aria-label="Adicionar linha no rodapé"
              title="Adicionar linha no rodapé (ex.: status/progresso)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground hover:border-primary/40 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <ArrowDownToLine className="h-3.5 w-3.5" /> Linha rodapé
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Presets:</span>
              <div role="group" aria-label="Presets de layout" className="flex flex-wrap gap-1">
                {LAYOUT_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p.id)}
                    aria-label={`Aplicar preset ${p.name}`}
                    title={p.description}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] hover:border-primary/50 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60",
                      busyPreset === p.id ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground",
                    )}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <span className="flex-1" />

            {/* Modos de visualização: Editar / Página / Sistema / Fullscreen */}
            <div role="group" aria-label="Modo de visualização" className="flex gap-1">
              {VIEW_MODES.map(({ id, label, icon: Icon, hint }) => (
                <button
                  key={id}
                  onClick={() => setMode(id)}
                  aria-pressed={mode === id}
                  aria-label={`Modo ${label}`}
                  title={`Modo ${label} — ${hint}`}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] border focus-visible:ring-2 focus-visible:ring-primary/60",
                    mode === id ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/40",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Preview de responsividade (só no modo página) */}
            {mode === "page" && (
              <div role="group" aria-label="Preview de responsividade" className="flex gap-1">
                {DEVICE_META.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setDevice(id)}
                    aria-pressed={device === id}
                    aria-label={`Preview ${label}`}
                    title={`Preview ${label}`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] border focus-visible:ring-2 focus-visible:ring-primary/60",
                      device === id
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/40",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={exportCurrent}
              aria-label="Exportar canvas"
              title="Exportar canvas atual como JSON"
              className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Importar template"
              title="Importar template de um arquivo JSON"
              className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <FileUp className="h-3.5 w-3.5" /> Importar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-hidden
              onChange={(e) => importFromFile(e.target.files?.[0])}
            />
            <button
              onClick={clearAll}
              disabled={empty}
              aria-label="Limpar canvas"
              title="Limpar todas as colunas, linhas e blocos"
              className="inline-flex items-center gap-1 rounded-lg border border-destructive/50 px-2 py-1.5 text-[11px] text-destructive hover:bg-destructive/10 disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Trash2 className="h-3.5 w-3.5" /> Limpar
            </button>
          </div>
        )}

        {/* Canvas / Tela */}
        <section id="canvas" aria-label={mode === "edit" ? "Canvas do layout" : "Tela funcional"} className={cn(mode === "system" ? "h-full min-h-0" : "scroll-mt-4")}>
          {mode === "page" && templates.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label htmlFor="screen-switcher" className="text-[11px] text-muted-foreground">
                Telas salvas:
              </label>
              <select
                id="screen-switcher"
                defaultValue=""
                onChange={(e) => {
                  const tpl = templates.find((t) => t.id === e.target.value);
                  if (tpl) applyTemplate(tpl, true);
                }}
                aria-label="Trocar de tela customizada"
                className="rounded-lg border border-border/60 bg-background px-2 py-1 text-xs text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <option value="" disabled>Canvas atual — trocar para…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          )}
          {!empty ? (
            <div
              ref={containerRef}
              className={cn(
                "transition-all",
                mode === "edit" && "mx-auto rounded-2xl border border-border/60 bg-muted/20 p-3",
                mode === "page" && cn("mx-auto rounded-2xl border border-border/60 bg-muted/20 p-3 min-h-[70vh]", DEVICE_META.find((d) => d.id === device)?.maxWidth),
                mode === "system" && "h-full min-h-0",
              )}
            >
              <LayoutSpecView
                spec={spec}
                mode={mode === "edit" ? "edit" : "preview"}
                onSpecChange={onSpecChange}
                selBlock={selBlock}
                onSelectBlock={setSelBlock}
                fillHeight={mode === "system"}
              />
            </div>
          ) : (
            <EmptyState
              icon={LayoutTemplate}
              title="Canvas vazio"
              description="Adicione uma coluna ou linha para começar, ou aplique um preset pronto com componentes reais."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => mutateCols((cols) => addColumn(cols))}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <Plus className="h-4 w-4" /> Adicionar coluna
                  </button>
                  <button
                    onClick={() => applyPreset("full-screen")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-4 py-2 text-sm font-medium text-foreground hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <LayoutTemplate className="h-4 w-4" /> Tela completa (com componentes)
                  </button>
                </div>
              }
            />
          )}
        </section>

        {mode === "edit" && (
          <>
            {/* Salvar como template / página */}
            <section id="salvar" aria-label="Salvar template ou página" className="scroll-mt-4">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/50 p-3">
                <Layers className="h-4 w-4 text-primary" />
                <label htmlFor="tpl-name" className="text-xs font-medium text-foreground">
                  Salvar o canvas atual como:
                </label>
                <input
                  id="tpl-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveCurrent()}
                  placeholder="Nome (ex.: Tela de análise 360º)"
                  className="min-w-0 flex-1 sm:flex-none sm:w-72 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs focus-visible:ring-2 focus-visible:ring-primary/60 outline-none"
                />
                <button
                  onClick={saveCurrent}
                  disabled={empty}
                  aria-label="Salvar template"
                  className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Save className="h-3.5 w-3.5" /> Salvar template
                </button>
                <button
                  onClick={saveAsPage}
                  disabled={empty}
                  aria-label={isEditingPage ? "Atualizar página" : "Salvar como página do sistema"}
                  title={isEditingPage ? "Atualizar a página customizada e abri-la" : "Cria uma página real do sistema (rota /p/:id) a partir do canvas"}
                  className="inline-flex items-center gap-1 rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {isEditingPage ? "Atualizar página" : "Salvar como página"}
                </button>
              </div>
            </section>

            {/* Páginas customizadas do usuário */}
            <section id="paginas" aria-label="Minhas páginas" className="scroll-mt-4">
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                Minhas páginas <span className="text-muted-foreground font-normal">({customPages.length})</span>
              </h2>
              {customPages.length === 0 ? (
                <EmptyState
                  icon={PanelTop}
                  compact
                  title="Nenhuma página criada"
                  description="Monte um layout com componentes reais e salve como página — ela vira uma rota do sistema (/p/:id) e aparece no menu da sidebar."
                />
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list">
                  {customPages.map((page) => {
                    const s = layoutSummary(page.spec);
                    return (
                      <li key={page.id} className="rounded-xl border border-border/60 bg-card/50 p-3">
                        <div className="flex items-start gap-2">
                          <PanelTop className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{page.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {s.columns} coluna{s.columns !== 1 ? "s" : ""} · {s.blocks + s.rows} bloco{s.blocks + s.rows !== 1 ? "s" : ""} · {s.bound} com componente
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Link
                            to={`/p/${page.id}`}
                            aria-label={`Abrir página ${page.name}`}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <Eye className="h-3 w-3" /> Abrir
                          </Link>
                          <button
                            onClick={() => setSearchParams({ page: page.id })}
                            aria-label={`Editar página ${page.name}`}
                            title="Carregar no canvas para editar"
                            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <Check className="h-3 w-3" /> Editar
                          </button>
                          <button
                            onClick={() => renameCustomPage(page.id, prompt("Novo nome da página:", page.name) ?? page.name)}
                            aria-label={`Renomear página ${page.name}`}
                            title="Renomear"
                            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <Pencil className="h-3 w-3" /> Renomear
                          </button>
                          <button
                            onClick={() => {
                              if (!confirmDestructive(`Excluir a página "${page.name}"?`)) return;
                              deleteCustomPage(page.id);
                              toastDestructive(`Página "${page.name}" excluída.`, {
                                onUndo: () => createCustomPage(page.name, page.spec),
                              });
                            }}
                            aria-label={`Excluir página ${page.name}`}
                            title="Excluir"
                            className="inline-flex items-center gap-1 rounded-lg border border-destructive/50 px-2.5 py-1 text-[11px] text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <Trash2 className="h-3 w-3" /> Excluir
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Biblioteca de templates/telas salvos */}
            <section id="templates" aria-label="Templates salvos" className="scroll-mt-4">
              <h2 className="mb-2 text-sm font-semibold text-foreground">
                Telas & templates salvos <span className="text-muted-foreground font-normal">({templates.length})</span>
              </h2>
              {templates.length === 0 ? (
                <EmptyState
                  icon={LayoutTemplate}
                  compact
                  title="Nenhuma tela salva"
                  description="Monte um layout no canvas, vincule componentes reais e salve para reaplicar depois — ou comece de um preset."
                />
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="list">
                  {templates.map((tpl) => {
                    const s = layoutSummary(tpl.spec);
                    return (
                      <li key={tpl.id} className="rounded-xl border border-border/60 bg-card/50 p-3">
                        <div className="flex items-start gap-2">
                          <LayoutTemplate className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{tpl.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {s.columns} coluna{s.columns !== 1 ? "s" : ""} · {s.blocks + s.rows} bloco{s.blocks + s.rows !== 1 ? "s" : ""} · {s.bound} com componente ·{" "}
                              {new Date(tpl.updatedAt).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <button
                            onClick={() => applyTemplate(tpl, true)}
                            aria-label={`Visualizar tela ${tpl.name}`}
                            title="Abrir em Visualizar (funcional, com dados reais)"
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <Eye className="h-3 w-3" /> Visualizar
                          </button>
                          <button
                            onClick={() => applyTemplate(tpl)}
                            aria-label={`Editar template ${tpl.name}`}
                            title="Carregar no canvas para editar"
                            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <Check className="h-3 w-3" /> Editar
                          </button>
                          <button
                            onClick={() => updateTemplate(tpl.id, spec)}
                            disabled={empty}
                            aria-label={`Substituir template ${tpl.name} pelo canvas atual`}
                            title="Substituir pelo canvas atual"
                            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <Copy className="h-3 w-3" /> Substituir
                          </button>
                          <button
                            onClick={() => renameTemplate(tpl.id, prompt("Novo nome do template:", tpl.name) ?? tpl.name)}
                            aria-label={`Renomear template ${tpl.name}`}
                            title="Renomear"
                            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <Pencil className="h-3 w-3" /> Renomear
                          </button>
                          <button
                            onClick={() => {
                              if (!confirmDestructive(`Excluir a tela "${tpl.name}"?`)) return;
                              deleteTemplate(tpl.id);
                              toastDestructive(`Tela "${tpl.name}" excluída.`, {
                                onUndo: () => saveTemplate(tpl.name, tpl.spec),
                              });
                            }}
                            aria-label={`Excluir template ${tpl.name}`}
                            title="Excluir"
                            className="inline-flex items-center gap-1 rounded-lg border border-destructive/50 px-2.5 py-1 text-[11px] text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <Trash2 className="h-3 w-3" /> Excluir
                          </button>
                          <button
                            onClick={() => downloadFile(`${tpl.name}.json`, exportTemplateText(tpl.name, tpl.spec), "application/json")}
                            aria-label={`Exportar template ${tpl.name}`}
                            title="Exportar como JSON"
                            className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
                          >
                            <Download className="h-3 w-3" /> Exportar
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
