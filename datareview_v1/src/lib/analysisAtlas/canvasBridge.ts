/**
 * Canvas bridge â€” conecta um mĂłdulo do Atlas ao Canvas (pipeline visual).
 *
 * Cada mĂłdulo declara `canvas: { kind, section?, chartType?, promptSeed? }`.
 * Este mĂłdulo:
 *  - `moduleToNodeConfig`: converte o bridge num `config` pronto para o canvasStore.
 *  - `moduleToNode`: produz um CanvasNode completo (id, position, data).
 *  - `buildPipeline`: encadeia N mĂłdulos num fragmento {nodes, edges} que pode
 *    ser carregado no canvas via `loadGraph`/`loadTemplate`. Esta Ă© a parte
 *    "combinar mĂłdulos em pipelines" que o usuĂˇrio pediu â€” o Atlas gera o
 *    pipeline e o Canvas o executa.
 */
import type { CanvasNode, CanvasEdge } from "@/lib/canvasStore";
import type { NodeKind } from "@/components/canvas/nodeRegistry";
import { NODE_DEFAULT_LABEL } from "@/lib/canvasStore";
import type { AnalysisModule, CanvasBridge } from "./types";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { ChatMessage } from "@/lib/experimentChatApi";

/** Converte o bridge de um mĂłdulo no `config` do canvasStore. */
export function moduleToNodeConfig(bridge: CanvasBridge): Record<string, unknown> {
  const cfg: Record<string, unknown> = {};
  if (bridge.section) cfg.section = bridge.section;
  if (bridge.chartType) cfg.chartType = bridge.chartType;
  if (bridge.promptSeed) cfg.prompt = bridge.promptSeed;
  return cfg;
}

/** Label do nĂł no canvas â€” usa nodeLabel do bridge ou o default do kind. */
export function moduleNodeLabel(module: AnalysisModule): string {
  // Prefer explicit nodeLabel â†’ module display label â†’ kind default.
  return module.canvas.nodeLabel || module.label || NODE_DEFAULT_LABEL[module.canvas.kind];
}

let _counter = 0;
function uniqueId(prefix: string): string {
  _counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${_counter}`;
}

/**
 * Cria um CanvasNode a partir de um mĂłdulo do Atlas, posicionado em (x, y).
 * Ăštil para "enviar mĂłdulo para o canvas" (single node) e para montar pipelines.
 */
export function moduleToNode(module: AnalysisModule, position: { x: number; y: number }, id?: string): CanvasNode {
  const kind = module.canvas.kind as NodeKind;
  return {
    id: id ?? uniqueId(`atlas_${module.id}`),
    type: kind,
    position,
    data: {
      kind,
      label: moduleNodeLabel(module),
      config: moduleToNodeConfig(module.canvas),
    },
  };
}

function mkEdge(source: string, target: string): CanvasEdge {
  return { id: `e_${source}_${target}`, source, target, animated: true };
}

/**
 * Monta um pipeline a partir de uma lista ordenada de mĂłdulos.
 * Cada mĂłdulo vira um nĂł; nĂłs consecutivos sĂŁo conectados (source â†’ target).
 * Os nĂłs ficam em coluna vertical (cada um 160px abaixo do anterior) â€” um
 * pipeline linear simples. O usuĂˇrio pode reorganizar no canvas depois.
 *
 * Para encadeamento IAâ†’IA (analyze/prompt/report), o Canvas jĂˇ detecta
 * upstream text e refina a saĂ­da anterior automaticamente (asUpstreamText).
 */
export function buildPipeline(
  modules: AnalysisModule[],
  origin: { x: number; y: number } = { x: 80, y: 120 },
): { nodes: CanvasNode[]; edges: CanvasEdge[] } {
  const nodes: CanvasNode[] = [];
  const edges: CanvasEdge[] = [];
  const DY = 200;
  modules.forEach((m, i) => {
    const id = `atlas_${m.id}_${i}`;
    nodes.push(moduleToNode(m, { x: origin.x, y: origin.y + i * DY }, id));
    if (i > 0) {
      edges.push(mkEdge(`atlas_${modules[i - 1].id}_${i - 1}`, id));
    }
  });
  return { nodes, edges };
}

/**
 * Adiciona um único nó de módulo ao canvas existente (sem quebrar o grafo).
 * Retorna o id do novo nó. Posiciona à direita do último nó existente.
 */
export function appendModuleNode(
  module: AnalysisModule,
  existingNodes: CanvasNode[],
): { node: CanvasNode } {
  const last = existingNodes[existingNodes.length - 1];
  const pos = last
    ? { x: last.position.x + 320, y: last.position.y }
    : { x: 80, y: 120 };
  const node = moduleToNode(module, pos);
  return { node };
}

/* ----------------------------------------------------- multi-module run -- */

/**
 * Um módulo é "executável por IA direto" quando seu nó do canvas produz
 * markdown via streamExperiment (analyze/report) ou streamExperimentChat
 * (prompt). Módulos determinísticos (chart/dashboard/table/code/analysis-não-IA)
 * rodam no Canvas — não têm uma seção de IA para rodar inline no Atlas.
 */
export function isAIModule(m: AnalysisModule): boolean {
  return m.canvas.kind === "analyze" || m.canvas.kind === "report" || m.canvas.kind === "prompt";
}

export interface RunModulesHandlers {
  /** Chamado a cada token de qualquer módulo, com o markdown acumulado total. */
  onToken: (full: string) => void;
  /** Chamado quando todos os módulos terminam, com o markdown completo. */
  onDone: (full: string) => void;
  /** Chamado em caso de erro fatal (interrompe a execução). */
  onError: (err: string) => void;
  /** Progresso: (índice do módulo atual, total, módulo). */
  onProgress?: (index: number, total: number, module: AnalysisModule) => void;
}

/**
 * Executa uma lista de módulos de IA sequencialmente sobre o dataset,
 * acumulando o markdown de cada um sob um cabeçalho por módulo. É a base do
 * "executar pipeline completo / por categoria / individualmente" — o usuário
 * escolhe o conjunto de módulos e roda tudo de uma vez.
 *
 * Módulos não-IA são pulados (rodam no Canvas). Retorna a lista de módulos
 * efetivamente executados (para a UI informar quais ficaram de fora).
 */
export async function runModules(
  modules: AnalysisModule[],
  entries: DatasetEntry[],
  handlers: RunModulesHandlers,
  signal?: AbortSignal,
): Promise<{ executed: AnalysisModule[]; skipped: AnalysisModule[] }> {
  const { streamExperiment } = await import("@/lib/experimentApi");
  const { streamExperimentChat } = await import("@/lib/experimentChatApi");

  const aiMods = modules.filter(isAIModule);
  const skipped = modules.filter((m) => !isAIModule(m));
  let acc = "";

  for (let i = 0; i < aiMods.length; i++) {
    if (signal?.aborted) { handlers.onDone(acc); return { executed: aiMods.slice(0, i), skipped }; }
    const mod = aiMods[i];
    handlers.onProgress?.(i, aiMods.length, mod);
    const header = `## ${i + 1}. ${mod.label}\n\n`;
    acc += header;
    handlers.onToken(acc);

    try {
      if (mod.canvas.kind === "prompt" || mod.canvas.kind === "report") {
        const prompt = mod.canvas.promptSeed ?? `Gere uma análise de "${mod.label}" com base nos dados coletados.`;
        const messages: ChatMessage[] = [{ role: "user", content: prompt }];
        let partial = "";
        await streamExperimentChat(entries, messages, {
          onToken: (full) => { partial = full; handlers.onToken(acc + partial); },
          onDone: (full) => { partial = full; },
          onError: (e) => { throw new Error(e); },
        }, signal);
        acc += `${partial}\n\n`;
      } else {
        const section = mod.canvas.section ?? "custom";
        let partial = "";
        await streamExperiment(section, entries, {
          onToken: (full) => { partial = full; handlers.onToken(acc + partial); },
          onDone: (full) => { partial = full; },
          onError: (e) => { throw new Error(e); },
        }, signal);
        acc += `${partial}\n\n`;
      }
    } catch (e) {
      acc += `> ⚠️ Erro ao executar **${mod.label}**: ${e instanceof Error ? e.message : "falha"}\n\n`;
      handlers.onToken(acc);
    }
    if (signal?.aborted) { handlers.onDone(acc); return { executed: aiMods.slice(0, i + 1), skipped }; }
  }

  handlers.onDone(acc);
  return { executed: aiMods, skipped };
}

