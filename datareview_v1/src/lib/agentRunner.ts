/**
 * Runner de agentes — executa as etapas do pipeline em sequência, com status
 * por etapa (pending → running → done/error) e rastreamento na activity store
 * (visível no Terminal do sistema + indicador do header).
 *
 * Reusa os mesmos endpoints de IA do resto do sistema (`experiment-analyze`),
 * respeitando seleção de apps e configuração de IA do usuário.
 */

import { streamExperiment } from "@/lib/experimentApi";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import { taskStart, taskEnd, logActivity } from "@/lib/activityStore";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { GeneratorAgent, AgentStep } from "@/lib/agents";
import type { AISettings } from "@/lib/aiSettings";

export type StepStatus = "pending" | "running" | "done" | "error";

export interface StepState {
  status: StepStatus;
  output: string;
}

export interface AgentRunHandlers {
  /** por etapa (idx): status atualizado; output é o markdown até agora. */
  onStep: (idx: number, state: StepState) => void;
  /** quando todo o pipeline terminou. */
  onDone: () => void;
  /** erro geral do pipeline. */
  onError: (msg: string) => void;
}

export interface AgentRunOptions {
  signal?: AbortSignal;
  ai?: AISettings;
}

async function runOneStep(
  step: AgentStep,
  entries: DatasetEntry[],
  onToken: (full: string) => void,
  options: AgentRunOptions,
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const handlers = {
      onToken,
      onDone: (full: string) => resolve(full),
      onError: (err: string) => reject(new Error(err)),
    };
    if (step.section === "custom") {
      streamExperimentChat(
        entries,
        [{ role: "user", content: step.prompt ?? "" }],
        handlers,
        options.signal,
        options.ai,
        "custom",
      ).catch(reject);
    } else {
      streamExperiment(step.section, entries, handlers, options.signal, options.ai).catch(reject);
    }
  });
}

/**
 * Executa as etapas do agente em sequência. Abortável via options.signal.
 */
export async function runAgent(
  agent: GeneratorAgent,
  entries: DatasetEntry[],
  handlers: AgentRunHandlers,
  options: AgentRunOptions = {},
): Promise<void> {
  const tid = taskStart(null, `Agente ${agent.label}`, "agente", agent.pipeline.map((s) => s.label).join(" → "));
  logActivity("agente", "plan", `Pipeline: ${agent.pipeline.map((s) => s.label).join(" → ")}`);

  try {
    for (let i = 0; i < agent.pipeline.length; i++) {
      const step = agent.pipeline[i];
      if (options.signal?.aborted) break;
      handlers.onStep(i, { status: "running", output: "" });
      logActivity("agente", "start", `Etapa ${i + 1}/${agent.pipeline.length}: ${step.label}`);
      try {
        let acc = "";
        const out = await runOneStep(step, entries, (full) => {
          acc = full;
          handlers.onStep(i, { status: "running", output: acc });
        }, options);
        handlers.onStep(i, { status: "done", output: out });
        logActivity("agente", "done", `Etapa concluída: ${step.label}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Falha";
        handlers.onStep(i, { status: "error", output: msg });
        logActivity("agente", "error", `Etapa falhou: ${step.label}`, msg);
        taskEnd(tid, "error", msg);
        handlers.onError(msg);
        return;
      }
    }
    taskEnd(tid, "done", `${agent.pipeline.length} etapas concluídas`);
    handlers.onDone();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha no pipeline do agente";
    taskEnd(tid, "error", msg);
    handlers.onError(msg);
  }
}
