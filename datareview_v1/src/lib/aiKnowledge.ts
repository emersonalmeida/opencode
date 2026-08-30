/**
 * Retroalimentação de IA — digest do conhecimento gerado por análises
 * anteriores.
 *
 * Quando o usuário ativa a retroalimentação (Config → IA → Retroalimentação),
 * TODA chamada de IA do sistema recebe este digest como contexto extra:
 * análise nova parte do que já foi descoberto — menos tempo, menos esforço,
 * respostas acumulativamente melhores. Os dados brutos sempre prevalecem.
 *
 * Fontes: artefatos do Pipeline (`aso:pipeline-artifacts:v1`), gerações
 * (`aso:generations:v1`) e findings do Lab (`aso:lab:findings`). Tudo lido do
 * localStorage a cada chamada (barato; caps generosos).
 */

import { listArtifacts } from "@/lib/pipeline/artifactStore";
import type { PipelineArtifact } from "@/lib/pipeline/types";
import { listGenerations, type GenerationRecord } from "@/lib/sessionStore";
import { listFindings } from "@/lib/lab/repository";
import type { LabFinding } from "@/lib/lab/types";

const MAX_ITEMS = 20;
const MAX_CHARS = 6000;

function artifactLine(a: PipelineArtifact): string {
  const conf = a.confidence ? ` (conf ${a.confidence})` : "";
  return `- [${a.kind}] ${a.title}${conf}`;
}

function generationLine(g: GenerationRecord): string {
  const apps = g.appKeys?.length ? ` — ${g.appKeys.length} app(s)` : "";
  const snippet = g.markdown ? `: ${g.markdown.slice(0, 140).replace(/\n+/g, " ")}…` : "";
  return `- [${g.type}] ${g.title}${apps}${snippet}`;
}

function findingLine(f: LabFinding): string {
  const conf = typeof f.confidence === "number" ? ` (conf ${f.confidence.toFixed(2)})` : "";
  return `- ${f.title}${conf} [${f.evidence?.validation?.status ?? "unverified"}]`;
}

/**
 * Monta o digest compacto do conhecimento acumulado. Retorna "" se não há
 * nada (chamada segue sem contexto extra).
 */
export function buildKnowledgeDigest(maxChars = MAX_CHARS): string {
  const sections: string[] = [];

  try {
    const artifacts = listArtifacts().slice(0, 12);
    if (artifacts.length) {
      sections.push("ARTEFATOS DO PIPELINE:\n" + artifacts.map(artifactLine).join("\n"));
    }
  } catch { /* store indisponível */ }

  try {
    const findings = listFindings().slice(0, 10);
    if (findings.length) {
      sections.push("FINDINGS (LAB):\n" + findings.map(findingLine).join("\n"));
    }
  } catch { /* store indisponível */ }

  try {
    const gens = listGenerations().filter((g) => g.type !== "collect").slice(0, MAX_ITEMS);
    if (gens.length) {
      sections.push("ANÁLISES RECENTES:\n" + gens.map(generationLine).join("\n"));
    }
  } catch { /* store indisponível */ }

  const digest = sections.join("\n\n");
  return digest.slice(0, maxChars);
}
