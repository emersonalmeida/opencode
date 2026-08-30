/**
 * Experimento de exemplo pré-configurado — ensina o conceito do Lab.
 * "Release Regression Detection": detectar regressões após releases via
 * mudanças abruptas nos temas negativos dos reviews.
 */

import { newExperiment, newFinding } from "./repository";
import type { LabExperiment, LabFinding } from "./types";

export const EXAMPLE_EXPERIMENT = (): {
  experiment: LabExperiment;
  findings: LabFinding[];
} => {
  const exp = newExperiment({
    name: "Release Regression Detection",
    description:
      "Testa se mudanças abruptas nos temas negativos dos reviews conseguem " +
      "revelar regressões introduzidas após uma nova versão do app.",
    type: "intelligence",
    hypothesis:
      "Mudanças abruptas nos temas negativos dos reviews podem revelar " +
      "regressões após uma nova versão do app.",
    question:
      "Conseguimos detectar regressões após releases analisando a variação " +
      "de temas negativos agrupados por versão?",
    status: "draft",
    aiConfig: { promptVersion: "lab-structured-v1" },
    metrics: {
      regressionSignalDetected: 0,
      versionsAnalyzed: 0,
      falsePositiveRate: 0,
    },
    conclusion:
      "Exemplo — execute o experimento sobre um dataset com versões para " +
      "validar a hipótese.",
  });
  // Findings de exemplo (estruturais, para ilustrar o pipeline)
  const f1 = newFinding({
    title: "Aumento de reclamações de login após v8.2",
    description:
      "Exemplo de finding: hipotético aumento de 37% nas menções de login " +
      "na versão 8.2 vs 8.1. (Valores ilustrativos — gere dados reais executando.)",
    experimentId: exp.id,
    type: "evidence",
    confidence: 0,
    evidence: { sources: ["Exemplo — execute para gerar evidências reais"] },
    status: "new",
  });
  const f2 = newFinding({
    title: "Tema 'crash' concentra-se nas primeiras 48h pós-release",
    description:
      "Exemplo de insight: janela temporal de regressão. Substitua por " +
      "findings reais após executar o experimento.",
    experimentId: exp.id,
    type: "insight",
    confidence: 0,
    status: "uncertain",
  });
  return { experiment: exp, findings: [f1, f2] };
};

/** Pipeline conceitual do exemplo (apenas descritivo, não executável). */
export const EXAMPLE_PIPELINE = [
  "Dataset",
  "Agrupamento por versão",
  "Agrupamento por tema",
  "Sentimento",
  "Comparação temporal",
  "Detecção de anomalias",
  "Resumo",
];
