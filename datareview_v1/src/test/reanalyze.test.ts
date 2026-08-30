/**
 * Reanálise de artefato (o "reanalisar/regenerar" do ciclo de uso): o
 * pipeline fecha o ciclo — qualquer artefato pode ser reexecutado sobre os
 * dados atuais, com a lineage preservada. Determinístico: sem IA.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { reanalyzeArtifact } from "@/lib/pipeline/runner";
import { clearArtifacts, listArtifacts } from "@/lib/pipeline/artifactStore";
import type { PipelineArtifact } from "@/lib/pipeline/types";
import type { DatasetEntry } from "@/lib/datasetStore";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";

function mkEntries(ratings: number[]): DatasetEntry[] {
  const app = { store: "apple", id: "1", name: "App" } as AppInfo;
  const reviews = ratings.map((rating, i) => ({
    id: `r${i}`, rating, title: "", text: "texto", author: "u", date: "2026-08-01",
  })) as ReviewEntry[];
  return [{ app, reviews, collectedAt: Date.now() }];
}

function mkArtifact(methodology: string): PipelineArtifact {
  return {
    id: "art-1",
    kind: "facts",
    stage: "compute",
    title: "Fatos computados",
    methodology,
    engine: methodology.startsWith("ai") ? "ai" : "deterministic",
    inputIds: [],
    appKeys: ["apple:1"],
    createdAt: Date.now(),
  };
}

describe("reanalyzeArtifact — reexecutar sobre dados atuais (ciclo de uso)", () => {
  beforeEach(() => {
    localStorage.clear();
    clearArtifacts();
  });

  it("reexecuta análise determinística sobre os dados atuais", async () => {
    const original = mkArtifact("deterministic:facts-overview");
    const novo = await reanalyzeArtifact(original, mkEntries([5, 5, 1]));
    expect(novo).not.toBeNull();
    expect(novo!.methodology).toBe("deterministic:facts-overview");
    expect(novo!.id).not.toBe(original.id); // novo artefato (não sobrescreve)
    expect(listArtifacts().some((a) => a.id === novo!.id)).toBe(true);
  });

  it("reflete mudança nos dados (o re-run vê o dataset novo)", async () => {
    const original = mkArtifact("deterministic:facts-overview");
    const a = await reanalyzeArtifact(original, mkEntries([5, 5, 5]));
    const b = await reanalyzeArtifact(original, mkEntries([1, 1, 1]));
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // A segunda reexecução (só notas 1) produz artefato diferente da primeira
    expect(JSON.stringify(b!.data)).not.toBe(JSON.stringify(a!.data));
  });

  it("retorna null honesto quando a análise de origem não existe mais", async () => {
    const orphan = mkArtifact("deterministic:nao-existe-mais");
    expect(await reanalyzeArtifact(orphan, mkEntries([5]))).toBeNull();
    expect(listArtifacts()).toHaveLength(0);
  });

  it("rejeita análise de IA quando a IA está desativada (sem dados falsos)", async () => {
    // Com storage limpo, modo é "auto" sem Ollama — runAIAnalysis falha
    // honestamente (null), nunca fabrica resultado.
    const aiArtifact = mkArtifact("ai:topic-extraction");
    const result = await reanalyzeArtifact(aiArtifact, mkEntries([5]));
    expect(result).toBeNull();
  });
});
