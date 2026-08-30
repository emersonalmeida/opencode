/**
 * ModuleContract — centro da página.
 *
 * Mostra o CONTRATO completo do módulo selecionado (ponto 73): INPUT →
 * PROCESSING → OUTPUT → EVIDENCE → CONFIDENCE → SCORE → VISUALIZATION, num
 * card estilo "Analysis OS". Ações:
 *  - "Enviar ao Canvas": adiciona o nó correspondente ao canvas (appendGraph).
 *  - "Executar análise": roda a seção de IA (experiment-analyze) ou o
 *    determinístico sobre o dataset selecionado, streaming markdown.
 *  - "Ver no Canvas": navega para /canvas.
 *
 * Se a IA estiver desativada, mostra empty-state honesto (como AutoAIAnalysis).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, ArrowDown, Workflow, Play, Loader2, Sparkles, Database,
  Cpu, CloudOff, ShieldCheck, Scale, BarChart3, FileText, Layers3, StopCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { cn } from "@/lib/utils";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useDataset } from "@/hooks/useDataset";
import { streamExperiment } from "@/lib/experimentApi";
import { recordGeneration } from "@/lib/sessionStore";
import { useCanvasStore } from "@/lib/canvasStore";
import {
  DATASOURCE_LABELS, DISCOVERY_LABELS, CONFIDENCE_LABELS, VIZ_LABELS,
} from "@/lib/analysisAtlas/groups";
import type { AnalysisModule } from "@/lib/analysisAtlas/types";
import { moduleToNode } from "@/lib/analysisAtlas/canvasBridge";

interface Props {
  module: AnalysisModule | null;
  onAddToPipeline?: (m: AnalysisModule) => void;
  inPipeline?: boolean;
  /** Estado de execução multi-módulo (pipeline/categoria/completo), vindo da página. */
  runTitle?: string | null;
  runResult?: string;
  running?: boolean;
  progress?: { idx: number; total: number; label: string } | null;
  runErr?: string | null;
  runNote?: string | null;
  onCancelRun?: () => void;
  onRunPipeline?: () => void;
  hasPipeline?: boolean;
}

/* --------------------------------------------------------- layout helpers -- */
function ContractRow({
  label, icon: Icon, children, accent,
}: { label: string; icon: LucideIcon; children: React.ReactNode; accent?: string }) {
  return (
    <div className="flex gap-3 py-3 border-b border-border/40 last:border-0">
      <div className="flex items-center gap-1.5 w-36 shrink-0 pt-0.5">
        <Icon className={cn("h-3.5 w-3.5", accent ?? "text-muted-foreground")} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      </div>
      <div className="flex-1 min-w-0 text-xs space-y-1">{children}</div>
    </div>
  );
}

function Chips({ items, colorFn }: { items: string[]; colorFn?: (i: string) => string }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <span key={it} className={cn(
          "text-[10px] px-1.5 py-0.5 rounded border border-border/60 bg-card/60",
          colorFn?.(it),
        )}>{it}</span>
      ))}
    </div>
  );
}

const PIPE_STEPS = ["input", "processing", "output", "evidence", "confidence"] as const;

/* ============================================================== main ------ */
export function ModuleContract({
  module: mod, onAddToPipeline, inPipeline,
  runTitle, runResult = "", running = false, progress = null, runErr = null,
  runNote = null, onCancelRun, onRunPipeline, hasPipeline = false,
}: Props) {
  const navigate = useNavigate();
  const ai = useAISettings();
  const aiOn = isAIEnabled(ai);
  const { selected } = useSelection();
  const dataset = useDataset();
  const appendGraph = useCanvasStore((s) => s.appendGraph);

  const [singleRunning, setSingleRunning] = useState(false);
  const [singleResult, setSingleResult] = useState("");
  const [err, setErr] = useState<string | null>(null);

  // Effective apps: honra a seleção global (igual AIAssistantPanel). Vazio = todos.
  const effectiveEntries = useMemo(() => {
    if (selected.size === 0) return dataset.entries;
    return dataset.entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)));
  }, [dataset.entries, selected]);

  if (!mod) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <Database className="h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-foreground">Selecione um módulo</p>
        <p className="text-xs text-muted-foreground max-w-sm mt-1">
          Cada análise declara um contrato: input → processamento → output → evidência →
          confiança → score → visualização. Escolha um na árvore à esquerda.
        </p>
      </div>
    );
  }

  const MIcon = mod.icon;

  const isAIRunnable = mod.canvas.kind === "analyze" || mod.canvas.kind === "report" || mod.canvas.kind === "prompt";
  const needsAI = isAIRunnable;
  const canRun = mod.status === "available" && (!needsAI || aiOn) && effectiveEntries.length > 0;

  const run = async () => {
    if (singleRunning || running) return;
    if (needsAI && !aiOn) {
      setErr("Ative a IA em Configurações para rodar esta análise.");
      return;
    }
    if (effectiveEntries.length === 0) {
      setErr("Colete ou selecione apps para rodar a análise.");
      return;
    }
    setSingleRunning(true);
    setErr(null);
    setSingleResult("");
    let finalMd = "";
    try {
      if (isAIRunnable) {
        const section = mod.canvas.section ?? "custom";
        await streamExperiment(section, effectiveEntries, {
          onToken: (full) => { finalMd = full; setSingleResult(full); },
          onDone: (full) => { finalMd = full; setSingleResult(full); },
          onError: (e) => setErr(e),
        });
        try {
          recordGeneration({
            type: "ai-section",
            title: `${mod.label} · ${section}`,
            appKeys: effectiveEntries.map((e) => `${e.app.store}:${e.app.id}`),
            markdown: finalMd,
            source: "atlas",
          });
        } catch { /* logging never breaks */ }
      } else {
        // Deterministic modules — explain they run in the Canvas node.
        setErr("Este módulo é determinístico (sem IA). Use \"Enviar ao Canvas\" e execute o nó no Canvas para ver o resultado renderizado.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha ao executar.");
    } finally {
      setSingleRunning(false);
    }
  };

  const sendToCanvas = () => {
    const node = moduleToNode(mod, { x: 80, y: 120 });
    appendGraph([node], []);
  };

  const aiBadge = ai.mode === "none"
    ? { icon: CloudOff, label: "IA desativada", cls: "text-muted-foreground bg-muted/50" }
    : ai.mode === "auto"
      ? { icon: Sparkles, label: "IA auto", cls: "text-violet-600 dark:text-violet-400 bg-violet-500/10" }
      : ai.mode === "local"
        ? { icon: Cpu, label: "IA local", cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" }
        : { icon: CloudOff, label: "IA cloud", cls: "text-sky-600 dark:text-sky-400 bg-sky-500/10" };
  const AiIcon = aiBadge.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Module header */}
      <div className="px-4 py-3 border-b border-border/50 bg-card/40">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-background shrink-0", "text-foreground")}>
            <MIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-foreground">{mod.label}</h2>
              <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">disponível</Badge>
              <span className="text-[10px] text-muted-foreground">{mod.id}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{mod.tagline}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <Button size="sm" variant="default" onClick={run} disabled={!canRun || singleRunning || running} className="h-7 text-xs">
            {singleRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Executar análise
          </Button>
          {onRunPipeline && (
            <Button size="sm" variant="default" onClick={onRunPipeline} disabled={!hasPipeline || running} className="h-7 text-xs" title="Executa todos os módulos do pipeline sequencialmente">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Workflow className="h-3.5 w-3.5" />}
              Executar pipeline
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={sendToCanvas} className="h-7 text-xs">
            <Workflow className="h-3.5 w-3.5" /> Enviar ao Canvas
          </Button>
          <Button size="sm" variant="ghost" onClick={() => navigate("/canvas")} className="h-7 text-xs">
            Ver Canvas
          </Button>
          {onAddToPipeline && (
            <Button size="sm" variant={inPipeline ? "secondary" : "outline"} onClick={() => onAddToPipeline(mod)} className="h-7 text-xs">
              {inPipeline ? "No pipeline ✓" : "+ Pipeline"}
            </Button>
          )}
          <span className={cn("ml-auto inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded", aiBadge.cls)}>
            <AiIcon className="h-3 w-3" /> {aiBadge.label}
          </span>
        </div>
      </div>

      {/* Body: contract + result */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-4">
          {/* Pipeline visual (ponto 73) */}
          <div className="rounded-lg border border-border/60 bg-card/40 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Pipeline do módulo</p>
            <div className="flex items-center gap-1 flex-wrap text-[10px]">
              {PIPE_STEPS.map((s, i) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded border border-border/60 bg-background font-medium",
                    s === "output" ? "text-primary" : "text-muted-foreground",
                  )}>{s}</span>
                  {i < PIPE_STEPS.length - 1 && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/60" />}
                </span>
              ))}
              <ArrowDown className="h-2.5 w-2.5 text-muted-foreground/60 rotate-[-90deg] mx-1" />
              <span className="px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary font-medium">score</span>
              <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/60" />
              <span className="px-1.5 py-0.5 rounded border border-border/60 bg-background font-medium">visualização</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs text-foreground/90 leading-relaxed">{mod.description}</p>

          {/* Contract rows */}
          <div className="rounded-lg border border-border/60 bg-card/40 divide-y divide-border/40">
            <ContractRow label="Input" icon={Database}>
              <Chips items={mod.input.map((d) => DATASOURCE_LABELS[d])} />
            </ContractRow>
            <ContractRow label="Processing" icon={Cpu}>
              <Chips items={mod.processing} />
              {mod.parameters && mod.parameters.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">Parâmetros: {mod.parameters.join(" · ")}</p>
              )}
            </ContractRow>
            <ContractRow label="Output" icon={Sparkles} accent="text-primary">
              <Chips items={mod.outputs.map((o) => DISCOVERY_LABELS[o])}
                colorFn={(it) => it === "Oportunidade" ? "text-primary" : ""} />
            </ContractRow>
            <ContractRow label="Evidence" icon={ShieldCheck} accent="text-teal-500">
              <p className="text-[11px] text-foreground/80 italic">"{mod.evidence.claimExample}"</p>
              <p className="text-[10px] text-muted-foreground">Fonte: {mod.evidence.sourceType}</p>
              {mod.evidence.calculationExample && (
                <p className="text-[10px] text-muted-foreground font-mono">cálculo: {mod.evidence.calculationExample}</p>
              )}
            </ContractRow>
            <ContractRow label="Confidence" icon={Scale} accent="text-indigo-500">
              <Badge variant="outline" className="text-[10px]">{CONFIDENCE_LABELS[mod.confidence]}</Badge>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {mod.confidence === "observation" && "Dado medido diretamente dos reviews."}
                {mod.confidence === "inference" && "Conclusão derivada dos dados."}
                {mod.confidence === "hypothesis" && "Hipótese — validar antes de agir."}
                {mod.confidence === "prediction" && "Estimativa/modelo — distinguir evidence-backed de estimate."}
              </p>
            </ContractRow>
            {mod.score && (
              <ContractRow label="Score" icon={BarChart3} accent="text-fuchsia-500">
                <p className="text-xs font-semibold text-foreground">{mod.score.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">{mod.score.formula}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {mod.score.components.map((c) => (
                    <span key={c.key} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground border border-border/40">
                      {c.label}{c.weight != null ? ` · ${Math.round(c.weight * 100)}%` : ""}
                    </span>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Cada componente guardado separadamente — nunca só o score final.</p>
              </ContractRow>
            )}
            <ContractRow label="Visualização" icon={Layers3}>
              <Chips items={mod.visualization.map((v) => VIZ_LABELS[v])} />
            </ContractRow>
            <ContractRow label="Canvas" icon={Workflow} accent="text-emerald-500">
              <p className="text-[11px]">
                Nó: <span className="font-mono">{mod.canvas.kind}</span>
                {mod.canvas.section && <> · seção <span className="font-mono">{mod.canvas.section}</span></>}
                {mod.canvas.chartType && <> · chart <span className="font-mono">{mod.canvas.chartType}</span></>}
              </p>
              <p className="text-[10px] text-muted-foreground">"Enviar ao Canvas" materializa este nó no pipeline visual.</p>
            </ContractRow>
          </div>

          {/* Tags */}
          {mod.tags && mod.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mod.tags.map((t) => (
                <span key={t} className="text-[10px] text-muted-foreground">#{t}</span>
              ))}
            </div>
          )}

          {/* Multi-module run result (pipeline / category / completo) */}
          {(runTitle || running) && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-primary flex-1">{runTitle ?? "Executando…"}</span>
                {running && onCancelRun && (
                  <button onClick={onCancelRun} className="text-[10px] inline-flex items-center gap-1 text-destructive hover:underline">
                    <StopCircle className="h-3 w-3" /> Parar
                  </button>
                )}
              </div>
              {progress && (
                <div className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Módulo {progress.idx}/{progress.total}: {progress.label}
                </div>
              )}
              {runErr ? (
                <p className="text-xs text-destructive">{runErr}</p>
              ) : runResult ? (
                <AIOutputCard bare content={runResult} filename={`atlas-${runTitle ?? "pipeline"}`} storageKey="atlas-pipeline" />
              ) : !running ? (
                <p className="text-xs text-muted-foreground">Nenhum resultado.</p>
              ) : null}
              {runNote && <p className="text-[10px] text-muted-foreground mt-2">{runNote}</p>}
            </div>
          )}

          {/* Single-module result */}
          {(singleResult || err) && (
            <div className="rounded-lg border border-border/60 bg-card/40 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Resultado</span>
              </div>
              {err ? (
                <p className="text-xs text-destructive">{err}</p>
              ) : (
                <AIOutputCard
                  bare
                  content={singleResult}
                  filename={`atlas-${mod?.id ?? "modulo"}`}
                  storageKey={`atlas-${mod?.id ?? "modulo"}`}
                  onRegenerate={singleRunning || running ? undefined : () => void run()}
                />
              )}
            </div>
          )}

          {/* Scope hint */}
          <p className="text-[10px] text-muted-foreground text-center pb-4">
            Escopo: {selected.size > 0 ? `${selected.size} app(s) selecionado(s)` : "todo o dataset"}
            {" · "}{effectiveEntries.reduce((s, e) => s + e.reviews.length, 0)} reviews
          </p>
        </div>
      </div>
    </div>
  );
}
