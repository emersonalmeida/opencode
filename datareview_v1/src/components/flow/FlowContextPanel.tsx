/**
 * FlowContextPanel — a "direita contextual" do System Flow (`/fluxo`).
 *
 * Modelo mental da página: esquerda = "onde estou?" (navegador), centro =
 * "no que estou trabalhando?" (seções), direita = "o que posso fazer com o
 * que estou vendo?" (este painel). Mostra a seção focada (ou a próxima
 * sugerida), o estado canônico, ações e — quando aplicável — templates do
 * Canvas que carregam direto para `/canvas`.
 *
 * Registrada como aba dinâmica "Contexto" da sidebar direita enquanto a
 * página `/fluxo` está montada.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SlidersHorizontal, ArrowRight, Workflow, Loader } from "lucide-react";
import {
  FLOW_SECTIONS, FLOW_STATUS_META, sectionForTask,
  type FlowSectionDef,
  type FlowSectionId,
  type FlowSectionState,
} from "@/lib/flow/flowModel";
import { getFocusedSection, subscribeFlowFocus } from "@/lib/flow/flowFocus";
import { useTrackedTasks, useActiveTaskCount } from "@/lib/activityStore";
import { useCanvasStore } from "@/lib/canvasStore";
import { PIPELINE_TEMPLATES } from "@/components/canvas/pipelineTemplates";

// --- foco vivo (pub/sub com useState — sem useSyncExternalStore com getter
// mutável, que causa "Maximum update depth exceeded"; gotcha catalogado) ---
function useFocused(): FlowSectionId | null {
  const [focus, setFocus] = useState<FlowSectionId | null>(getFocusedSection());
  useEffect(() => subscribeFlowFocus(() => setFocus(getFocusedSection())), []);
  return focus;
}

/** Templates sugeridos por seção (integração Canvas). */
const CANVAS_TEMPLATES: Partial<Record<FlowSectionId, string[]>> = {
  visualizar: ["sentiment-dashboard", "full-dashboard"],
  sinais: ["geo-temporal"],
  investigar: ["chained-refinement", "market-gap-discovery", "complete-atlas"],
  experimentar: ["complete-atlas"],
};

/** Seções com quick link para o workspace completo do Canvas. */
const CANVAS_LINKS: FlowSectionId[] = ["experimentar", "investigar", "visualizar", "sinais"];

interface Props {
  fallback: FlowSectionId | null;
  states: Record<FlowSectionId, FlowSectionState>;
  io?: Partial<Record<FlowSectionId, { input: string; processing: string; output: string }>>;
}

export function FlowContextPanel({ fallback, states, io }: Props) {
  const navigate = useNavigate();
  const focused = useFocused();
  const tasks = useTrackedTasks();
  const activeCount = useActiveTaskCount();

  const id = (focused ?? fallback) as FlowSectionId | null;
  const def = (id ? FLOW_SECTIONS.find((s) => s.id === id) : undefined) as FlowSectionDef | undefined;
  const state = def ? states[def.id] : undefined;
  const runningTasks = tasks.filter((t) => t.status === "running" || t.status === "streaming");
  const sectionTasks = def ? runningTasks.filter((t) => sectionForTask(t) === def.id) : [];

  const loadTemplate = (tid: string) => {
    const tpl = PIPELINE_TEMPLATES.find((t) => t.id === tid);
    if (!tpl) return;
    useCanvasStore.getState().loadTemplate(tpl.build());
    navigate("/canvas");
  };


  const content = (
    <div className="flex h-full flex-col overflow-y-auto p-3">
      {!def || !state ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-secondary/40 p-3 text-xs text-muted-foreground">
          Navegue pelas seções da jornada — aqui aparecerão o contexto e as
          ações da etapa ativa.
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              {(() => { const Icon = def.icon; return <Icon className="h-4 w-4" aria-hidden />; })()}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold">{def.num} · {def.title}</p>
              <p className="text-[11px] text-muted-foreground">{def.subtitle}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${FLOW_STATUS_META[state.status].chip}`}
            >
              {(() => { const MetaIcon = FLOW_STATUS_META[state.status].icon; return <MetaIcon className="h-3 w-3" aria-hidden />; })()}
              {FLOW_STATUS_META[state.status].label}
            </span>
            {sectionTasks.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                <Loader className="h-3 w-3 animate-spin" aria-hidden />
                {sectionTasks.length} tarefa(s)
              </span>
            )}
          </div>

          {io?.[def.id] ? (
            <div className="mt-3 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
              <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-foreground/80">Entrada:</span> {io[def.id]!.input}
                <ArrowRight className="h-3 w-3" aria-hidden />
                <span className="font-medium text-foreground/80">Processamento:</span> {io[def.id]!.processing}
                <ArrowRight className="h-3 w-3" aria-hidden />
                <span className="font-medium text-foreground/80">Saída:</span> {io[def.id]!.output}
              </p>
            </div>
          ) : null}

          <div className="mt-3 border-t border-border/40 pt-3">
            <p className="text-[11px] font-semibold text-foreground">Ações</p>
            <div className="mt-1.5 grid gap-1">
              {def.deepLinks.map((l) => (
                <button
                  key={l.path + l.label}
                  onClick={() => navigate(l.path)}
                  className="inline-flex items-center justify-between rounded-md border border-border/60 bg-secondary/60 px-2 py-1.5 text-left text-xs hover:bg-secondary"
                >
                  Abrir {l.label}
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              ))}
              {CANVAS_LINKS.includes(def.id) ? (
                <button
                  onClick={() => navigate("/canvas")}
                  className="inline-flex items-center justify-between rounded-md border border-border/60 bg-secondary/60 px-2 py-1.5 text-left text-xs hover:bg-secondary"
                >
                  Abrir no Canvas
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          {CANVAS_TEMPLATES[def.id]?.length ? (
            <div className="mt-3 border-t border-border/40 pt-3">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <Workflow className="h-3.5 w-3.5" aria-hidden /> Criar pipeline no Canvas
              </p>
              <div className="mt-1.5 grid gap-1">
                {CANVAS_TEMPLATES[def.id]!.map((tid) => {
                  const tpl = PIPELINE_TEMPLATES.find((t) => t.id === tid);
                  if (!tpl) return null;
                  const Icon = tpl.icon;
                  return (
                    <button
                      key={tid}
                      onClick={() => loadTemplate(tid)}
                      title={tpl.description}
                      className="inline-flex items-center justify-between rounded-md border border-primary/30 bg-primary/10 px-2 py-1.5 text-left text-xs text-primary hover:bg-primary/20"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" aria-hidden /> {tpl.name}
                      </span>
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-3 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
            {activeCount > 0
              ? `${activeCount} tarefa(s) ativa(s) no sistema no momento.`
              : "Nenhuma tarefa ativa no sistema agora."}
          </div>
        </>
      )}
    </div>
  );

  return content;
}
