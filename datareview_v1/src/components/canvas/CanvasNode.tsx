import { memo, useState } from "react";
import { Handle, Position, type NodeProps, NodeResizer } from "@xyflow/react";
import {
  X, Loader2, CheckCircle2, AlertCircle, Play, Copy, Settings2,
  ChevronDown, ChevronRight, PanelTopOpen, PanelTopClose, Power, SkipForward,
} from "lucide-react";
import { NODE_REGISTRY, ANALYSIS_SECTIONS, CHART_TYPE_OPTIONS, type NodeKind } from "./nodeRegistry";
import { useCanvasStore } from "@/lib/canvasStore";
import { NodeOutput } from "./NodeOutput";
import { ScrollableArea } from "./ScrollableArea";
import { ContextMenuOverlay, type ContextMenuItem } from "@/components/shared/ContextMenu";

const STATUS_BADGE: Record<string, { icon: typeof Loader2; cls: string }> = {
  running: { icon: Loader2, cls: "text-sky-500" },
  done: { icon: CheckCircle2, cls: "text-emerald-500" },
  error: { icon: AlertCircle, cls: "text-destructive" },
  skipped: { icon: SkipForward, cls: "text-status-warning" },
};

const RUNNABLE: NodeKind[] = [
  "search", "collect", "analyze", "prompt", "report", "action-plan", "validator", "challenge", "competitive-gap", "tag-cluster",
  "statistics", "sentiment", "themes", "version-analysis", "reviews-analysis", "country-analysis",
  "rating-trend", "version-compare", "review-sampler", "anomaly-detector", "reply-rate", "bigram-cloud", "aggregate", "review-age",
  "chart", "dashboard", "table", "code", "sort", "filter",
];

/** Kinds that render their output inline (full NodeOutput inside the node).
 *  Processing nodes keep only a compact summary; rendering happens in a
 *  dedicated connected `output` node. `output` itself renders the upstream. */
const RENDERS_OUTPUT: NodeKind[] = ["output", "note"];

/**
 * Single unified node renderer.
 *
 * Architecture: processing nodes (analyze, prompt, chart, statistics, …) only
 * compute and store their output — they show config + status + a compact
 * summary, NOT the full rendered output. The full rendered output lives in a
 * dedicated `output` node connected downstream: it reactively reads the
 * upstream node's output (via edges) and renders it (markdown, charts, table,
 * dashboard), with live streaming when the upstream AI node is running.
 *
 * Connection handles live on the header row. Nodes can be enabled/disabled
 * (Power button) — disabled nodes are skipped on run. Resize persists width and
 * height; the body scrolls internally when content exceeds the height.
 */
export const CanvasNode = memo(function CanvasNode({ id, data, selected }: NodeProps) {
  const meta = NODE_REGISTRY[(data.kind as NodeKind) ?? "note"] ?? NODE_REGISTRY.note;
  const kind = (data.kind as NodeKind) ?? "note";
  const status = useCanvasStore((s) => s.status[id]);
  const output = useCanvasStore((s) => s.output[id]);
  const edges = useCanvasStore((s) => s.edges);
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig);
  const updateNodeSize = useCanvasStore((s) => s.updateNodeSize);
  const toggleCollapse = useCanvasStore((s) => s.toggleCollapse);
  const toggleEnabled = useCanvasStore((s) => s.toggleEnabled);
  const toggleOutputExpanded = useCanvasStore((s) => s.toggleOutputExpanded);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const runSingleNode = useCanvasStore((s) => s.runSingleNode);
  const running = useCanvasStore((s) => s.running);
  const [open, setOpen] = useState(false);
  const Icon = meta.icon;
  const badge = status ? STATUS_BADGE[status] : null;
  const width = (data.width as number) ?? 280;
  const height = (data.height as number) ?? undefined;
  const collapsed = (data.collapsed as boolean) ?? false;
  const enabled = (data.enabled as boolean | undefined) !== false;
  const outputExpanded = (data.outputExpanded as boolean) ?? false;

  // Para nós `output`: encontra o nó upstream cuja saída será renderizada.
  const upstreamId = kind === "output"
    ? edges.find((e) => e.target === id)?.source
    : undefined;
  const upstreamOutput = useCanvasStore((s) => (upstreamId ? s.output[upstreamId] : undefined));
  const upstreamStatus = useCanvasStore((s) => (upstreamId ? s.status[upstreamId] : undefined));

  const isAI = kind === "analyze" || kind === "report" || kind === "prompt";
  const rendersInline = RENDERS_OUTPUT.includes(kind);
  const renderValue = kind === "output" ? upstreamOutput : output;
  const renderStreaming = kind === "output" ? upstreamStatus === "running" : (status === "running" && isAI);
  const renderPresentation = kind === "output"
    ? (edges.find((e) => e.target === id)?.source && true)
    : (kind === "report" || kind === "prompt");
  const hasRender = rendersInline && renderValue != null;
  const upstreamRunning = kind === "output" && upstreamStatus === "running";

  // Per-node context menu (right-click on the node card).
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const nodeMenu = (): ContextMenuItem[] => [
    ...(RUNNABLE.includes(kind) ? [{
      label: "Executar só este nó",
      icon: <Play className="h-3 w-3" />,
      onClick: () => runSingleNode(id),
      disabled: running,
    }] : []),
    {
      label: collapsed ? "Expandir nó" : "Recolher nó",
      icon: collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />,
      onClick: () => toggleCollapse(id),
    },
    {
      label: enabled ? "Desativar nó (pular na execução)" : "Ativar nó",
      icon: <Power className="h-3.5 w-3.5" />,
      onClick: () => toggleEnabled(id),
    },
    { type: "separator" as const },
    {
      label: "Duplicar nó",
      icon: <Copy className="h-3 w-3" />,
      onClick: () => duplicateNode(id),
    },
    {
      label: "Remover nó",
      icon: <X className="h-3 w-3" />,
      danger: true,
      onClick: () => removeNode(id),
    },
  ];

  return (
    <div
      style={{ width, ...(height && !collapsed ? { minHeight: height } : {}) }}
      className={`relative rounded-xl border bg-card shadow-sm transition-shadow ${
        selected ? "border-primary ring-2 ring-primary/30" : "border-border/70"
      } ${status === "running" || upstreamRunning ? "ring-2 ring-sky-400/40" : ""} ${!enabled ? "opacity-50" : ""}`}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
    >
      {selected && !collapsed && (
        <NodeResizer
          minWidth={240}
          minHeight={120}
          isVisible={selected}
          onResize={(_, dims) => updateNodeSize(id, dims.width, dims.height)}
          lineClassName="!border-primary/40"
          handleClassName="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background !rounded-full"
        />
      )}
      <Handle type="target" position={Position.Left} style={{ top: 24 }} className="!w-2.5 !h-2.5 !bg-muted-foreground/60 !border-2 !border-card" />

      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/50">
        <button
          onClick={() => toggleCollapse(id)}
          className="text-muted-foreground hover:text-foreground rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          title={collapsed ? "Expandir nó" : "Recolher nó"}
          aria-label={collapsed ? "Expandir nó" : "Recolher nó"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <Icon className={`h-4 w-4 ${meta.color} shrink-0`} />
        <span className="text-xs font-medium flex-1 truncate">{(data.label as string) || meta.label}</span>
        {badge && <badge.icon className={`h-3.5 w-3.5 ${badge.cls} ${status === "running" ? "animate-spin" : ""}`} />}
        <button
          onClick={() => toggleEnabled(id)}
          className={`p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 ${enabled ? "text-emerald-500 hover:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
          title={enabled ? "Desativar nó (pula na execução)" : "Ativar nó"}
          aria-label={enabled ? "Desativar nó" : "Ativar nó"}
          aria-pressed={enabled}
        ><Power className="h-3.5 w-3.5" /></button>
        {kind !== "output" && (
          <button
            onClick={() => setOpen((v) => !v)}
            className={`text-muted-foreground hover:text-foreground p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 ${open ? "text-primary bg-primary/10" : ""}`}
            title="Configurar"
            aria-label={`Configurar nó ${data.label ?? meta.label}`}
            aria-pressed={open}
          ><Settings2 className="h-3.5 w-3.5" /></button>
        )}
        <button
          onClick={() => duplicateNode(id)}
          className="text-muted-foreground hover:text-primary p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          title="Duplicar nó"
          aria-label={`Duplicar nó ${data.label ?? meta.label}`}
        ><Copy className="h-3 w-3" /></button>
        {RUNNABLE.includes(kind) ? (
          <button
            onClick={() => runSingleNode(id)}
            disabled={running}
            className="text-muted-foreground hover:text-primary disabled:opacity-40 p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
            title="Executar só este nó"
            aria-label="Executar só este nó"
          ><Play className="h-3 w-3" /></button>
        ) : null}
        <button
          onClick={() => removeNode(id)}
          className="text-muted-foreground hover:text-destructive p-0.5 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          title="Remover"
          aria-label={`Remover nó ${data.label ?? meta.label}`}
        ><X className="h-3 w-3" /></button>
      </div>

      {!collapsed && (
        <div className="px-3 py-2 text-[11px] text-muted-foreground">
          {kind === "output" ? (
            <OutputNodeBody
              nodeId={id}
              upstreamId={upstreamId}
              hasRender={hasRender}
              renderValue={renderValue}
              renderStreaming={renderStreaming}
              presentation={renderPresentation}
              outputExpanded={outputExpanded}
              onToggleExpand={() => toggleOutputExpanded(id)}
            />
          ) : (
            <>
              {open ? (
                <NodeBody kind={kind} config={data.config as Record<string, unknown>} onChange={(patch) => updateNodeConfig(id, patch)} />
              ) : (
                <NodeSummary kind={kind} config={data.config as Record<string, unknown>} />
              )}
              {!status && !open && (
                <p className="mt-1.5 pt-1.5 border-t border-border/40 text-muted-foreground text-[10px]">
                  <span className="font-medium">Vai fazer:</span> {meta.description}
                </p>
              )}
              {status === "running" && isAI && (
                <p className="mt-1.5 pt-1.5 border-t border-border/40 text-status-info flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Gerando agora…
                </p>
              )}
              {status === "running" && !isAI && (
                <p className="mt-1.5 pt-1.5 border-t border-border/40 text-status-running flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Executando…
                </p>
              )}
              {status === "done" && (
                <p className="mt-1.5 pt-1.5 border-t border-border/40 text-status-success text-[10px]">
                  ✓ Concluído — conecte um nó <b>Saída renderizada</b> para ver o resultado.
                </p>
              )}
              {status === "error" && (
                <p className="mt-1.5 pt-1.5 border-t border-border/40 text-status-error text-[10px]">Erro na execução — veja o terminal.</p>
              )}
              {status === "skipped" && (
                <p className="mt-1.5 pt-1.5 border-t border-border/40 text-status-warning text-[10px]">⤼ Pulado — uma dependência falhou.</p>
              )}
            </>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ top: 24 }} className="!w-2.5 !h-2.5 !bg-muted-foreground/60 !border-2 !border-card" />

      {ctxMenu && (
        <ContextMenuOverlay state={{ x: ctxMenu.x, y: ctxMenu.y, items: nodeMenu() }} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
});

function OutputNodeBody({ nodeId, upstreamId, hasRender, renderValue, renderStreaming, presentation, outputExpanded, onToggleExpand }: {
  nodeId: string;
  upstreamId?: string;
  hasRender: boolean;
  renderValue: unknown;
  renderStreaming: boolean;
  presentation: boolean;
  outputExpanded: boolean;
  onToggleExpand: () => void;
}) {
  if (!upstreamId) {
    return (
      <p className="text-[10px] italic text-muted-foreground leading-relaxed">
        Conecte a saída (direita) de um nó de processamento aqui para renderizar seu resultado (markdown, gráficos, tabela, dashboard). Selecione trechos do texto gerado para aprofundá-los com IA.
      </p>
    );
  }
  if (!hasRender && !renderStreaming) {
    return <p className="text-[10px] italic text-muted-foreground">Aguardando o nó conectado produzir saída…</p>;
  }
  return (
    <div className="mt-0.5">
      <button
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between text-[9px] font-medium text-muted-foreground hover:text-foreground mb-1"
        aria-expanded={outputExpanded}
        aria-label={outputExpanded ? "Limitar saída com scroll interno" : "Expandir saída — mostrar conteúdo completo"}
        title={outputExpanded ? "Limitar com scroll interno" : "Expandir: conteúdo completo, sem limite de altura"}
      >
        <span>{renderStreaming ? "Gerando…" : outputExpanded ? "Conteúdo completo (sem limite)" : "Preview limitado — clique para expandir"}</span>
        {outputExpanded
          ? <PanelTopClose className="h-3 w-3" />
          : <PanelTopOpen className="h-3 w-3" />}
      </button>
      {outputExpanded ? (
        // Expanded: show ALL content — no max-height, no scroll. The node
        // grows to fit its content (auto-height). Scroll only when the node
        // is explicitly size-limited (below) — there it is scrollable.
        <div className="rounded-md bg-background/40">
          <NodeOutput value={renderValue} streaming={renderStreaming} presentation={presentation} nodeId={nodeId} />
        </div>
      ) : (
        // Limited/preview: scroll internally; wheel scrolls content when there
        // is something to scroll, otherwise zooms the canvas (ScrollableArea).
        <ScrollableArea maxHeight="max-h-40" className="rounded-md bg-background/40">
          <NodeOutput value={renderValue} streaming={renderStreaming} presentation={presentation} nodeId={nodeId} />
        </ScrollableArea>
      )}
    </div>
  );
}

function NodeSummary({ kind, config }: { kind: NodeKind; config: Record<string, unknown> }) {
  const s = (v: unknown, d = "") => (typeof v === "string" ? v : d);
  const n = (v: unknown, d = 0) => (typeof v === "number" ? v : d);
  switch (kind) {
    case "search": return <p className="truncate">{s(config.term, "— termo")} · {s(config.store, "both")}</p>;
    case "collect": return <p className="truncate">{(config.app as { name?: string } | undefined)?.name ?? "— app"} · {n(config.reviewLimit, 500)} reviews</p>;
    case "dataset": return <p>{Array.isArray(config.keys) ? (config.keys as string[]).length : "todos"} selecionado(s)</p>;
    case "analyze": return <p className="truncate">{s(config.section, "summary")}</p>;
    case "prompt": return <p className="truncate">{s(config.prompt, "— prompt customizado")}</p>;
    case "note": return <p className="whitespace-pre-wrap">{s(config.text, "Anotação…")}</p>;
    case "code": return <p className="truncate font-mono text-[10px]">{s(config.source, "— código")}</p>;
    case "chart": {
      const t = CHART_TYPE_OPTIONS.find((o) => o.value === s(config.chartType, "rating"));
      return <p className="truncate">{t?.label ?? "Distribuição de notas"}</p>;
    }
    case "display": return <p className="truncate">{s(config.text, "resultado bruto")}</p>;
    case "filter": return <p>≥ {n(config.minRating, 0)}★ · {s(config.store, "todas")}</p>;
    case "report": return <p className="truncate">{s(config.prompt, "— prompt do relatório")}</p>;
    case "action-plan": return <p className="truncate">{s(config.focus, "plano P0/P1/P2")}</p>;
    case "validator": return <p className="truncate">{s(config.extra, "auditar evidências")}</p>;
    case "review-sampler": return <p className="truncate">{s(config.mode, "recent")} · {n(config.sampleSize, 10)}</p>;
    case "sort": return <p className="truncate">{s(config.order, "recent")}</p>;
    case "statistics": case "sentiment": case "themes": case "version-analysis": case "reviews-analysis": case "country-analysis": case "rating-trend": case "version-compare": case "anomaly-detector": case "reply-rate": case "dashboard":
      return <p className="italic">{NODE_REGISTRY[kind].description}</p>;
    case "output": return <p className="italic">Renderiza a saída do nó conectado</p>;
    default: return <p className="italic">{NODE_REGISTRY[kind].description}</p>;
  }
}

const fieldCls = "w-full text-[11px] px-2 py-1.5 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40";
const labelCls = "text-[9px] font-medium text-muted-foreground uppercase tracking-wider block mb-1";

function NodeBody({ kind, config, onChange }: { kind: NodeKind; config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  const input = fieldCls;
  switch (kind) {
    case "search":
      return (
        <div className="space-y-1.5">
          <input className={input} placeholder="Termo (ex: nubank)" value={(config.term as string) ?? ""} onChange={(e) => onChange({ term: e.target.value })} />
          <div className="flex gap-1">
            {["both", "apple", "google"].map((s) => (
              <button key={s} onClick={() => onChange({ store: s })} className={`flex-1 text-[10px] py-0.5 rounded ${config.store === s ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{s}</button>
            ))}
          </div>
          <input type="number" className={input} placeholder="Limite" value={(config.limit as number) ?? 10} onChange={(e) => onChange({ limit: Number(e.target.value) })} />
        </div>
      );
    case "collect":
      return (
        <div className="space-y-1.5">
          <p className="text-[10px]">Conecte a saída de um nó <b>Buscar apps</b> aqui, ou use <b>Dataset</b> para apps já coletados.</p>
          <label className={labelCls}>Limite de reviews</label>
          <input type="number" min={1} max={10000} className={input} value={(config.reviewLimit as number) ?? 500} onChange={(e) => onChange({ reviewLimit: Number(e.target.value) })} />
        </div>
      );
    case "dataset":
      return <p className="text-[10px]">Carrega apps do dataset local (todas as lojas). Selecione quais na aba <b>Apps</b> da sidebar esquerda, ou conecte a saída de um nó de busca.</p>;
    case "analyze":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Seção de análise</label>
          <select className={input} value={(config.section as string) ?? "summary"} onChange={(e) => onChange({ section: e.target.value })}>
            {ANALYSIS_SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <p className="text-[10px] text-muted-foreground">Se conectado à saída de outro nó IA, refina essa análise anterior (modo encadeado).</p>
        </div>
      );
    case "prompt":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Prompt customizado</label>
          <textarea className={`${input} min-h-[90px]`} placeholder="Ex: Gere uma apresentação executiva com capa, métricas, pontos fortes e recomendações…" value={(config.prompt as string) ?? ""} onChange={(e) => onChange({ prompt: e.target.value })} />
          <p className="text-[10px] text-muted-foreground">Conecte coleta/dataset (dados reais) OU a saída de outro nó IA (análise anterior). O resultado é renderizado como apresentação.</p>
        </div>
      );
    case "chart":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Tipo de gráfico</label>
          <select className={input} value={(config.chartType as string) ?? "rating"} onChange={(e) => onChange({ chartType: e.target.value })}>
            {CHART_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="text-[10px] text-muted-foreground">Conecte coleta/dataset OU a saída de um nó de análise (sentimento/temas/versão). Se houver gráfico pronto na saída anterior, ele é repassado.</p>
        </div>
      );
    case "note":
      return <textarea className={`${input} min-h-[60px]`} placeholder="Anotação…" value={(config.text as string) ?? ""} onChange={(e) => onChange({ text: e.target.value })} />;
    case "code":
      return <textarea className={`${input} font-mono text-[10px] min-h-[80px]`} placeholder="// return inputs.map(...)" value={(config.source as string) ?? ""} onChange={(e) => onChange({ source: e.target.value })} />;
    case "display":
      return <textarea className={`${input} min-h-[50px]`} placeholder="Texto (ou vazio = resultado bruto)" value={(config.text as string) ?? ""} onChange={(e) => onChange({ text: e.target.value })} />;
    case "filter":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Nota mínima</label>
          <input type="number" min={1} max={5} className={`${input} w-20`} value={(config.minRating as number) ?? 0} onChange={(e) => onChange({ minRating: Number(e.target.value) })} />
          <label className={labelCls}>Loja</label>
          <select className={input} value={(config.store as string) ?? ""} onChange={(e) => onChange({ store: e.target.value })}>
            <option value="">Todas as lojas</option>
            <option value="apple">Apple</option>
            <option value="google">Google</option>
          </select>
        </div>
      );
    case "report":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Prompt do relatório</label>
          <textarea className={`${input} min-h-[80px]`} placeholder="Ex: Gere um relatório executivo com pontos fortes, fracos e recomendações…" value={(config.prompt as string) ?? ""} onChange={(e) => onChange({ prompt: e.target.value })} />
          <p className="text-[10px] text-muted-foreground">Conecte coleta/dataset OU a saída de outro nó IA.</p>
        </div>
      );
    case "action-plan":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Foco do plano (opcional)</label>
          <textarea className={`${input} min-h-[60px]`} placeholder="Ex: priorize bugs de crash e perda de dados" value={(config.focus as string) ?? ""} onChange={(e) => onChange({ focus: e.target.value })} />
          <p className="text-[10px] text-muted-foreground">Gera um plano P0/P1/P2 com impacto, esforço, evidência e KPI. Conecte coleta/dataset OU a saída de outro nó IA.</p>
        </div>
      );
    case "validator":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Ângulo adicional (opcional)</label>
          <textarea className={`${input} min-h-[60px]`} placeholder="Ex: foque especialmente nas causas de notas 1★" value={(config.extra as string) ?? ""} onChange={(e) => onChange({ extra: e.target.value })} />
          <p className="text-[10px] text-muted-foreground">Audita a análise anterior: afirmação por afirmação, marca evidência suportada ✓/✗ e sugere ajustes.</p>
        </div>
      );
    case "review-sampler":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Critério da amostra</label>
          <select className={input} value={(config.mode as string) ?? "recent"} onChange={(e) => onChange({ mode: e.target.value })}>
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigos</option>
            <option value="helpful">Mais úteis (👍)</option>
            <option value="top">Melhores (5★ →)</option>
            <option value="bottom">Piores (1★ →)</option>
          </select>
          <label className={labelCls}>Tamanho da amostra</label>
          <input type="number" min={1} max={100} className={`${input} w-20`} value={(config.sampleSize as number) ?? 10} onChange={(e) => onChange({ sampleSize: Number(e.target.value) })} />
          <p className="text-[10px] text-muted-foreground">Amostra N reviews determinística por critério — útil para inspeção manual ou como contexto para nós IA.</p>
        </div>
      );
    case "sort":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Ordem dos reviews</label>
          <select className={input} value={(config.order as string) ?? "recent"} onChange={(e) => onChange({ order: e.target.value })}>
            <option value="recent">Mais recentes primeiro</option>
            <option value="oldest">Mais antigos primeiro</option>
            <option value="helpful">Mais úteis (👍) primeiro</option>
            <option value="rating">Nota (5★ → 1★)</option>
            <option value="ratingAsc">Nota (1★ → 5★)</option>
          </select>
          <p className="text-[10px] text-muted-foreground">Reordena os reviews da entrada e repassa. Útil antes de Tabela, Gráfico ou nó IA.</p>
        </div>
      );
    case "competitive-gap":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>App alvo (opcional — default: 1º do dataset)</label>
          <input className={input} placeholder="Ex: Nubank" value={(config.target as string) ?? ""} onChange={(e) => onChange({ target: e.target.value })} />
          <p className="text-[10px] text-muted-foreground">IA compara o alvo contra os concorrentes e acha gaps com evidência de review. Requer ≥2 apps conectados.</p>
        </div>
      );
    case "tag-cluster":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Máx. temas (3–15)</label>
          <input type="number" min={3} max={15} className={`${input} w-20`} value={(config.maxClusters as number) ?? 8} onChange={(e) => onChange({ maxClusters: Number(e.target.value) })} />
          <p className="text-[10px] text-muted-foreground">Clusteriza reviews em temas recorrentes com IA, com citação real de cada tema.</p>
        </div>
      );
    case "bigram-cloud":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Máx. bigramas (10–60)</label>
          <input type="number" min={10} max={60} className={`${input} w-20`} value={(config.limit as number) ?? 30} onChange={(e) => onChange({ limit: Number(e.target.value) })} />
          <p className="text-[10px] text-muted-foreground">Pares de palavras mais frequentes (frases). Sem IA.</p>
        </div>
      );
    case "aggregate":
      return (
        <div className="space-y-1.5">
          <label className={labelCls}>Campo</label>
          <select className={input} value={(config.field as string) ?? "rating"} onChange={(e) => onChange({ field: e.target.value })}>
            <option value="rating">Nota (★)</option>
            <option value="thumbsUp">👍 úteis</option>
            <option value="length">Tamanho do texto</option>
          </select>
          <label className={labelCls}>Operação</label>
          <select className={input} value={(config.op as string) ?? "avg"} onChange={(e) => onChange({ op: e.target.value })}>
            <option value="avg">Média</option>
            <option value="count">Contar</option>
            <option value="sum">Somar</option>
          </select>
          <p className="text-[10px] text-muted-foreground">Agrega o campo por app e também do conjunto inteiro. Sem IA.</p>
        </div>
      );
    case "challenge":
      return <p className="text-[10px] text-muted-foreground leading-relaxed">Desafia a análise anterior: evidências contrárias, vieses, incertezas e confiança final. Conecte a saída de um nó IA.</p>;
    case "statistics": case "sentiment": case "themes": case "version-analysis": case "reviews-analysis": case "country-analysis": case "rating-trend": case "version-compare": case "anomaly-detector": case "reply-rate": case "dashboard": case "review-age":
      return <p className="text-[10px] text-muted-foreground leading-relaxed">{NODE_REGISTRY[kind].description} Conecte um nó de coleta/dataset à entrada.</p>;
    case "output":
      return <p className="text-[10px] text-muted-foreground leading-relaxed">Nó passivo: renderiza a saída do nó conectado. Conecte a saída (direita) de qualquer nó de processamento aqui.</p>;
    default:
      return <p className="text-[10px] italic">{NODE_REGISTRY[kind].description}</p>;
  }
}
