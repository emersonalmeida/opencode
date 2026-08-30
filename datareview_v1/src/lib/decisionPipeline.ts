import { PERSONAS, type Persona, type DecisionModule } from "@/lib/decisionCenter";

/**
 * Pure helpers for the Decision Center "run all" pipeline: build the ordered
 * step list (personas × modules), the aggregated markdown compendium, and the
 * IA prompt that consolidates all personas into an executive summary.
 */

export interface PipelineStep {
  persona: Persona;
  module: DecisionModule;
}

/** Ordered steps for ALL personas (respects PERSONAS order, modules in order). */
export function buildRunSteps(personas: Persona[] = PERSONAS): PipelineStep[] {
  return personas.flatMap((persona) => persona.modules.map((module) => ({ persona, module })));
}

/** Ordered steps for ONE persona. */
export function buildRunStepsFor(persona: Persona): PipelineStep[] {
  return persona.modules.map((module) => ({ persona, module }));
}

/** Total output count: personas × modules (default: 7 × 10 = 70). */
export function totalOutputs(personas: Persona[] = PERSONAS): number {
  return buildRunSteps(personas).length;
}

/** Count completed outputs = entries in the keyed map minus the synthesis key. */
export function countCompleted(outputs: Record<string, string>): number {
  return Object.entries(outputs).filter(([k, v]) => k !== SYNTHESIS_KEY && v.trim().length > 0).length;
}

/** Key used for the keyed output map (persona.id:module.id). */
export function outputKey(personaId: string, moduleId: string): string {
  return `${personaId}:${moduleId}`;
}

export const SYNTHESIS_KEY = "synthesis";

/** Human progress label, e.g. "CEO · Executive Briefing (3/10)". */
export function stepProgress(step: PipelineStep, done: number, total: number): string {
  return `${step.persona.label} · ${step.module.label} (${done + 1}/${total})`;
}

/** Aggregate markdown: per persona a header + modules in order; pending
 *  modules marked. Ends with a footer listing generated vs total. */
export function buildCompendiumMarkdown(personas: Persona[], outputs: Record<string, string>): string {
  const done = countCompleted(outputs);
  const total = totalOutputs(personas);
  let md = `# Compêndio Executivo — Decision Center\n\n`;
  md += `_${personas.length} personas · ${totalOutputs(personas) === 0 ? 0 : totalOutputs(personas)} decisões possíveis · ${done} geradas _\n\n`;
  for (const persona of personas) {
    md += `## Persona: ${persona.label}\n\n`;
    md += `> **Pergunta central:** ${persona.centralQuestion}\n\n`;
    for (const module of persona.modules) {
      const key = outputKey(persona.id, module.id);
      const out = outputs[key];
      md += `### ${module.label}\n\n_${module.question}_\n\n`;
      md += out?.trim() ? `${out.trim()}\n\n` : `> _Pendente: módulo não gerado._\n\n`;
    }
  }
  return md;
}

/** Prompt for the cross-persona executive synthesis. Includes the completed
 *  outputs stitched with headers (capped to keep realism). Honesto quando
 *  incompleto: menciona o que faltava. */
export function buildSynthesisPrompt(personas: Persona[], outputs: Record<string, string>): string {
  const stitched = buildCompendiumMarkdown(personas, outputs);
  const done = countCompleted(outputs);
  const total = totalOutputs(personas);
  return (
    `Você é o escritório executivo do board. Consolide o Compêndio de ${done}/${total} decisões abaixo (de ${personas.length} personas) em uma SÍNTESE EXECUTIVA DE CONSELHO.\n` +
    `Estruture EXATAMENTE:\n` +
    `## Veredito executivo (um parágrafo, a realidade brutal).\n` +
    `## Riscos consensuais (o que as personas concordam).\n` +
    `## Conflitos de decisão (onde personas divergem — útil).\n` +
    `## Top 5 ações priorizadas (P0/P1 com persona responsável).\n` +
    `## Dados incompletos (honesto: o que faltou gerar).` +
    `\n\n===== COMPÊNDIO (recorte) =====\n\n${stitched.slice(0, 60000)}`
  );
}

/** Download-friendly filename slug for the compendium (for CopyDownloadButtons). */
export function compendiumFilename(): string {
  return "compendio-decisao";
}
