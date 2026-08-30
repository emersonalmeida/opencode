import { useMemo, useState } from "react";
import { Workflow, Settings2, Play, Square, Trash2, X, Sparkles, FilePlus2, History, Plus, Undo2, Redo2 } from "lucide-react";
import { useCanvasStore, type CanvasNode } from "@/lib/canvasStore";
import { NODE_REGISTRY, ANALYSIS_SECTIONS, CHART_TYPE_OPTIONS, type NodeKind } from "./nodeRegistry";
import { SessionsPanel } from "@/components/SessionsPanel";

/**
 * Canvas options panel — embedded as the 5th tab ("Canvas") of the right
 * AIAssistantPanel sidebar.
 *
 * - No node selected → canvas-level options (run/clear/example, stats, AI
 *   mode reminder, node legend).
 * - Node selected → a full config editor for that node (label + per-kind
 *   fields), driven by the same NodeBody logic as the inline node card but in
 *   a roomier sidebar layout. Changes apply live to the canvas.
 */
export function CanvasOptionsPanel() {
  const { nodes, edges, selectedNodeId, selectNode, run, running, cancel, clearCanvas, newCanvas, loadExample } = useCanvasStore();
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  if (selectedNode) {
    return <NodeEditor node={selectedNode} onClose={() => selectNode(null)} />;
  }
  return <CanvasOverview run={run} running={running} cancel={cancel} clearCanvas={clearCanvas} newCanvas={newCanvas} loadExample={loadExample} nodes={nodes} edges={edges} canUndo={canUndo} canRedo={canRedo} undo={undo} redo={redo} />;
}

function CanvasOverview({
  run, running, cancel, clearCanvas, newCanvas, loadExample, nodes, edges, canUndo, canRedo, undo, redo,
}: {
  run: () => void; running: boolean; cancel: () => void; clearCanvas: () => void; newCanvas: () => void; loadExample: () => void;
  nodes: CanvasNode[]; edges: { id: string }[];
  canUndo: boolean; canRedo: boolean; undo: () => void; redo: () => void;
}) {
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Workflow className="h-3.5 w-3.5 text-primary" />
        <h3 className="text-xs font-semibold text-foreground">Canvas</h3>
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={undo} disabled={!canUndo} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40" title="Desfazer" aria-label="Desfazer alteração estrutural">
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={redo} disabled={!canRedo} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-40" title="Refazer" aria-label="Refazer alteração estrutural">
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="flex gap-1.5">
        {running ? (
          <button onClick={cancel} className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md bg-destructive/90 text-destructive-foreground hover:bg-destructive">
            <Square className="h-3 w-3" /> Parar
          </button>
        ) : (
          <button onClick={run} disabled={nodes.length === 0} className="flex-1 flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Play className="h-3 w-3" /> Executar
          </button>
        )}
        <button onClick={loadExample} className="flex items-center justify-center gap-1 text-[11px] px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80" title="Carregar pipeline de exemplo">
          <Sparkles className="h-3 w-3" /> Exemplo
        </button>
        <button onClick={newCanvas} className="flex items-center justify-center gap-1 text-[11px] px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80" title="Novo canvas em branco">
          <FilePlus2 className="h-3 w-3" /> Novo
        </button>
        <button onClick={() => { if (confirm("Limpar todo o canvas?")) clearCanvas(); }} className="flex items-center justify-center p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10" title="Limpar canvas" aria-label="Limpar canvas">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Stat label="Nós" value={nodes.length} />
        <Stat label="Conexões" value={edges.length} />
      </div>

      <div className="rounded-lg bg-secondary/40 p-2 text-[10px] text-muted-foreground leading-relaxed space-y-1">
        <p className="font-medium text-foreground text-[11px]">Como usar</p>
        <p>1. Adicione nós pela aba <strong>Canvas</strong> à esquerda.</p>
        <p>2. Conecte a saída (●) de um nó à entrada (●) do próximo.</p>
        <p>3. Clique num nó para editá-lo aqui neste painel.</p>
        <p>4. Clique em <strong>Executar</strong> para rodar o fluxo.</p>
      </div>

      <div>
        <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Tipos de nó</p>
        <div className="space-y-1">
          {Object.values(NODE_REGISTRY).map((m) => {
            const Icon = m.icon;
            return (
              <div key={m.kind} className="flex items-center gap-2 text-[10px]">
                <Icon className={`h-3 w-3 ${m.color} shrink-0`} />
                <span className="font-medium text-foreground">{m.label}</span>
                <span className="text-muted-foreground truncate">— {m.description}</span>
              </div>
            );
          })}
        </div>
      </div>

      <SessionsSection />
    </div>
  );
}

/** Sessões: salvar/restaurar snapshots do canvas + histórico de gerações. */
function SessionsSection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border/50 bg-card/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 p-2 text-left"
        aria-expanded={open}
      >
        <History className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[11px] font-semibold text-foreground">Sessões & histórico</span>
        <span className="text-[10px] text-muted-foreground ml-auto">salvar / restaurar</span>
      </button>
      {open && (
        <div className="border-t border-border/40 p-2 max-h-[420px] overflow-y-auto">
          <SessionsPanel embedded />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/60 p-2 text-center">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function NodeEditor({ node, onClose }: { node: CanvasNode; onClose: () => void }) {
  const updateNodeConfig = useCanvasStore((s) => s.updateNodeConfig);
  const updateNodeLabel = useCanvasStore((s) => s.updateNodeLabel);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const meta = NODE_REGISTRY[(node.data.kind as NodeKind) ?? "note"] ?? NODE_REGISTRY.note;
  const Icon = meta.icon;
  const config = (node.data.config ?? {}) as Record<string, unknown>;
  const [addOpen, setAddOpen] = useState(true);

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className={`h-4 w-4 ${meta.color}`} />
        <h3 className="text-xs font-semibold text-foreground flex-1">Editar nó</h3>
        <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary" title="Voltar" aria-label="Voltar para visão do canvas">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider block mb-1">Rótulo</label>
        <input
          type="text"
          value={(node.data.label as string) ?? meta.label}
          onChange={(e) => updateNodeLabel(node.id, e.target.value)}
          className="w-full text-[11px] px-2 py-1.5 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </div>

      <NodeConfigFields kind={node.data.kind as NodeKind} config={config} onChange={(patch) => updateNodeConfig(node.id, patch)} />

      <div className="rounded-lg border border-border/50 bg-secondary/30">
        <button
          onClick={() => setAddOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 p-2 text-left"
          aria-expanded={addOpen}
        >
          <Plus className="h-3 w-3 text-primary shrink-0" />
          <span className="text-[11px] font-semibold text-foreground">Adicionar & conectar</span>
          <span className="text-[10px] text-muted-foreground ml-auto">um novo nó a partir deste</span>
        </button>
        {addOpen && (
          <div className="border-t border-border/40 p-1.5 space-y-1.5">
            {(["ai", "analysis", "viz", "util"] as const).map((group) => {
              const items = Object.values(NODE_REGISTRY).filter((m) => m.group === group);
              if (items.length === 0) return null;
              const labels: Record<string, string> = { ai: "IA", analysis: "Sem IA", viz: "Visualização", util: "Utilitário" };
              return (
                <div key={group}>
                  <p className="text-[8px] uppercase tracking-wider font-semibold text-muted-foreground px-1 pb-0.5">{labels[group]}</p>
                  <div className="flex flex-wrap gap-1">
                    {items.map((m) => {
                      const ItemIcon = m.icon;
                      return (
                        <button
                          key={m.kind}
                          onClick={() => { useCanvasStore.getState().addNodeAndConnect(node.id, m.kind); }}
                          title={m.description}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md bg-background border border-border/50 hover:border-primary/60 hover:bg-primary/5 transition-colors"
                        >
                          <ItemIcon className={`h-2.5 w-2.5 ${m.color}`} />
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button
        onClick={() => { removeNode(node.id); onClose(); }}
        className="w-full flex items-center justify-center gap-1.5 text-[11px] py-1.5 rounded-md text-destructive hover:bg-destructive/10 border border-border/50"
      >
        <Trash2 className="h-3 w-3" /> Remover nó
      </button>
    </div>
  );
}

function NodeConfigFields({ kind, config, onChange }: { kind: NodeKind; config: Record<string, unknown>; onChange: (patch: Record<string, unknown>) => void }) {
  const input = "w-full text-[11px] px-2 py-1.5 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40";
  const label = "text-[9px] font-medium text-muted-foreground uppercase tracking-wider block mb-1";
  switch (kind) {
    case "search":
      return (
        <div className="space-y-2">
          <div>
            <label className={label}>Termo de busca</label>
            <input className={input} placeholder="ex: nubank" value={(config.term as string) ?? ""} onChange={(e) => onChange({ term: e.target.value })} />
          </div>
          <div>
            <label className={label}>Loja</label>
            <div className="flex gap-1">
              {["both", "apple", "google"].map((s) => (
                <button key={s} onClick={() => onChange({ store: s })} className={`flex-1 text-[10px] py-1 rounded ${config.store === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{s === "both" ? "Ambas" : s === "apple" ? "Apple" : "Google"}</button>
              ))}
            </div>
          </div>
          <div>
            <label className={label}>Limite de resultados</label>
            <input type="number" className={input} value={(config.limit as number) ?? 10} onChange={(e) => onChange({ limit: Number(e.target.value) })} />
          </div>
        </div>
      );
    case "collect":
      return (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground leading-relaxed">Conecte a saída de um nó <strong>Buscar apps</strong> aqui, ou use <strong>Dataset</strong> para apps já coletados.</p>
          <div>
            <label className={label}>Limite de reviews</label>
            <input type="number" min={1} max={10000} className={input} value={(config.reviewLimit as number) ?? 500} onChange={(e) => onChange({ reviewLimit: Number(e.target.value) })} />
          </div>
        </div>
      );
    case "dataset":
      return <p className="text-[10px] text-muted-foreground leading-relaxed">Carrega apps do dataset local. Selecione quais na aba <strong>Apps</strong> da sidebar esquerda.</p>;
    case "analyze":
      return (
        <div className="space-y-2">
          <div>
            <label className={label}>Seção de análise</label>
            <select className={input} value={(config.section as string) ?? "summary"} onChange={(e) => onChange({ section: e.target.value })}>
              {ANALYSIS_SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">Conecte um nó de dataset/coleta OU a saída de outro nó IA. Quando conectado a um nó IA, refina a análise anterior (modo encadeado).</p>
        </div>
      );
    case "prompt":
      return (
        <div className="space-y-2">
          <div>
            <label className={label}>Prompt customizado</label>
            <textarea className={`${input} min-h-[120px]`} placeholder="Ex: Gere uma apresentação executiva com capa, métricas, pontos fortes e recomendações…" value={(config.prompt as string) ?? ""} onChange={(e) => onChange({ prompt: e.target.value })} />
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">Conecte coleta/dataset (dados reais) OU a saída de outro nó IA. O resultado é renderizado como uma apresentação.</p>
        </div>
      );
    case "chart":
      return (
        <div className="space-y-2">
          <div>
            <label className={label}>Tipo de gráfico</label>
            <select className={input} value={(config.chartType as string) ?? "rating"} onChange={(e) => onChange({ chartType: e.target.value })}>
              {CHART_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">Conecte coleta/dataset. Os dados derivam automaticamente do tipo escolhido.</p>
        </div>
      );
    case "note":
      return (
        <div>
          <label className={label}>Anotação</label>
          <textarea className={`${input} min-h-[80px]`} placeholder="Escreva uma nota…" value={(config.text as string) ?? ""} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      );
    case "code":
      return (
        <div>
          <label className={label}>Código JavaScript</label>
          <textarea className={`${input} font-mono text-[10px] min-h-[120px]`} placeholder="// receba `inputs`, retorne o resultado" value={(config.source as string) ?? ""} onChange={(e) => onChange({ source: e.target.value })} />
          <p className="text-[10px] text-muted-foreground mt-1">A variável <code>inputs</code> contém as saídas dos nós conectados.</p>
        </div>
      );
    case "display":
      return (
        <div>
          <label className={label}>Texto (opcional)</label>
          <textarea className={`${input} min-h-[60px]`} placeholder="Vazio = exibe o resultado bruto recebido" value={(config.text as string) ?? ""} onChange={(e) => onChange({ text: e.target.value })} />
        </div>
      );
    case "filter":
      return (
        <div className="space-y-2">
          <div>
            <label className={label}>Nota mínima</label>
            <input type="number" min={1} max={5} className={`${input} w-20`} value={(config.minRating as number) ?? 0} onChange={(e) => onChange({ minRating: Number(e.target.value) })} />
          </div>
          <div>
            <label className={label}>Loja</label>
            <select className={input} value={(config.store as string) ?? ""} onChange={(e) => onChange({ store: e.target.value })}>
              <option value="">Todas as lojas</option>
              <option value="apple">Apple</option>
              <option value="google">Google</option>
            </select>
          </div>
        </div>
      );
    case "report":
      return (
        <div>
          <label className={label}>Prompt do relatório</label>
          <textarea className={`${input} min-h-[120px]`} placeholder="Ex: Gere uma apresentação executiva com capa, métricas, pontos fortes, problemas e recomendações. Use ## como separador de slides." value={(config.prompt as string) ?? ""} onChange={(e) => onChange({ prompt: e.target.value })} />
          <p className="text-[10px] text-muted-foreground mt-1">Conecte um nó de coleta/dataset. A IA gera um relatório em markdown a partir do prompt + os dados recebidos, renderizado como uma apresentação.</p>
        </div>
      );
    case "action-plan":
      return (
        <div>
          <label className={label}>Foco do plano (opcional)</label>
          <textarea className={`${input} min-h-[80px]`} placeholder="Ex: priorize bugs de crash e perda de dados" value={(config.focus as string) ?? ""} onChange={(e) => onChange({ focus: e.target.value })} />
          <p className="text-[10px] text-muted-foreground mt-1">Gera um plano P0/P1/P2 com impacto, esforço, evidência e KPI. Conecte coleta/dataset OU a saída de outro nó IA.</p>
        </div>
      );
    case "validator":
      return (
        <div>
          <label className={label}>Ângulo adicional (opcional)</label>
          <textarea className={`${input} min-h-[80px]`} placeholder="Ex: foque nas causas de notas 1★" value={(config.extra as string) ?? ""} onChange={(e) => onChange({ extra: e.target.value })} />
          <p className="text-[10px] text-muted-foreground mt-1">Audita a análise anterior: afirmação por afirmação, marca evidência suportada ✓/✗ e sugere ajustes. Conecte a saída de um nó IA.</p>
        </div>
      );
    case "review-sampler":
      return (
        <div className="space-y-2">
          <div>
            <label className={label}>Critério da amostra</label>
            <select className={input} value={(config.mode as string) ?? "recent"} onChange={(e) => onChange({ mode: e.target.value })}>
              <option value="recent">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
              <option value="helpful">Mais úteis (👍)</option>
              <option value="top">Melhores (5★ →)</option>
              <option value="bottom">Piores (1★ →)</option>
            </select>
          </div>
          <div>
            <label className={label}>Tamanho da amostra</label>
            <input type="number" min={1} max={100} className={`${input} w-24`} value={(config.sampleSize as number) ?? 10} onChange={(e) => onChange({ sampleSize: Number(e.target.value) })} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Amostra N reviews determinística — útil para inspeção manual ou como contexto para nós IA.</p>
        </div>
      );
    case "sort":
      return (
        <div>
          <label className={label}>Ordem dos reviews</label>
          <select className={input} value={(config.order as string) ?? "recent"} onChange={(e) => onChange({ order: e.target.value })}>
            <option value="recent">Mais recentes primeiro</option>
            <option value="oldest">Mais antigos primeiro</option>
            <option value="helpful">Mais úteis (👍) primeiro</option>
            <option value="rating">Nota (5★ → 1★)</option>
            <option value="ratingAsc">Nota (1★ → 5★)</option>
          </select>
          <p className="text-[10px] text-muted-foreground mt-1">Reordena os reviews da entrada e repassa. Útil antes de Tabela, Gráfico ou nó IA.</p>
        </div>
      );
    case "competitive-gap":
      return (
        <div className="space-y-1.5">
          <label className={label}>App alvo (opcional — default: 1º do dataset)</label>
          <input className={input} placeholder="Ex: Nubank" value={(config.target as string) ?? ""} onChange={(e) => onChange({ target: e.target.value })} />
          <p className="text-[10px] text-muted-foreground">IA compara o alvo contra os concorrentes. Requer ≥2 apps conectados.</p>
        </div>
      );
    case "tag-cluster":
      return (
        <div className="space-y-1.5">
          <label className={label}>Máx. temas (3–15)</label>
          <input type="number" min={3} max={15} className={`${input} w-24`} value={(config.maxClusters as number) ?? 8} onChange={(e) => onChange({ maxClusters: Number(e.target.value) })} />
          <p className="text-[10px] text-muted-foreground">Cluster de temas recorrentes com IA + citação de cada.</p>
        </div>
      );
    case "bigram-cloud":
      return (
        <div className="space-y-1.5">
          <label className={label}>Máx. bigramas (10–60)</label>
          <input type="number" min={10} max={60} className={`${input} w-24`} value={(config.limit as number) ?? 30} onChange={(e) => onChange({ limit: Number(e.target.value) })} />
          <p className="text-[10px] text-muted-foreground">Pares de palavras mais frequentes (frases). Sem IA.</p>
        </div>
      );
    case "aggregate":
      return (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={label}>Campo</label>
            <select className={input} value={(config.field as string) ?? "rating"} onChange={(e) => onChange({ field: e.target.value })}>
              <option value="rating">Nota (★)</option>
              <option value="thumbsUp">👍 úteis</option>
              <option value="length">Tamanho do texto</option>
            </select>
          </div>
          <div>
            <label className={label}>Operação</label>
            <select className={input} value={(config.op as string) ?? "avg"} onChange={(e) => onChange({ op: e.target.value })}>
              <option value="avg">Média</option>
              <option value="count">Contar</option>
              <option value="sum">Somar</option>
            </select>
          </div>
        </div>
      );
    case "challenge":
      return <p className="text-[10px] text-muted-foreground leading-relaxed">Sem configuração. Ele desafia a análise do nó conectado (evidências contrárias, vieses, incertezas, confiança).</p>;
    case "statistics": case "sentiment": case "themes": case "version-analysis": case "reviews-analysis": case "country-analysis": case "rating-trend": case "version-compare": case "anomaly-detector": case "reply-rate": case "review-age":
      return <p className="text-[10px] text-muted-foreground leading-relaxed">{NODE_REGISTRY[kind].description} Conecte um nó de coleta/dataset à entrada.</p>;
    default:
      return <p className="text-[10px] text-muted-foreground italic">{NODE_REGISTRY[kind].description}</p>;
  }
}
