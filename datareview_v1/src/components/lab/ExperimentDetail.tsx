import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Play, RefreshCw, XCircle, Archive, ArrowUpCircle, Workflow,
  Loader2, ShieldCheck, ShieldAlert, Database, Cpu, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { AppHeader } from "@/components/AppHeader";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { EXPERIMENT_TYPES, EXPERIMENT_STATUS, FINDING_TYPES, FINDING_STATUS } from "@/lib/lab/constants";
import { useLabExperiments, useLabFindings, useLabDatasets } from "@/lib/lab/hooks";
import {
  getExperiment, saveExperiment, deleteExperiment,
  listFindingsByExperiment, saveFinding,
} from "@/lib/lab/repository";
import { runExperiment, promoteExperiment } from "@/lib/lab/runner";
import { annotateFinding } from "@/lib/lab/validation";
import { describeDataset } from "@/lib/lab/datasets";
import { useDataset } from "@/hooks/useDataset";
import type { DatasetEntry } from "@/lib/datasetStore";
import { ProductCandidateDialog } from "./ProductCandidateDialog";
import type { ExperimentStatus, LabFinding } from "@/lib/lab/types";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";

interface Props {
  experimentId: string;
}

export function ExperimentDetail({ experimentId }: Props) {
  const navigate = useNavigate();
  const experiments = useLabExperiments();
  const allFindings = useLabFindings();
  const datasets = useLabDatasets();
  const { entries } = useDataset();
  const ai = useAISettings();
  const [running, setRunning] = useState(false);
  const [streamPreview, setStreamPreview] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const exp = getExperiment(experimentId) || experiments.find((e) => e.id === experimentId);
  if (!exp) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Experimento não encontrado.</p>
        <Button onClick={() => navigate("/lab")} className="mt-3">Voltar ao Lab</Button>
      </div>
    );
  }

  const typeMeta = EXPERIMENT_TYPES[exp.type];
  const statusMeta = EXPERIMENT_STATUS[exp.status];
  const findings = listFindingsByExperiment(experimentId);
  const ds = datasets.filter((d) => exp.datasetIds.includes(d.id));
  const datasetSummary = ds.length > 0 ? ds.map(describeDataset).join(", ") : "Dataset do Lab (todos os apps)";

  const setStatus = (status: ExperimentStatus) => {
    saveExperiment({ ...exp, status });
  };

  const handleRun = async () => {
    setError(null);
    setRunning(true);
    setStreamPreview("");
    try {
      await runExperiment(experimentId, entries, {
        ai,
        onToken: (full) => setStreamPreview(full),
      });
      setStreamPreview("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao executar experimento.");
    } finally {
      setRunning(false);
    }
  };

  const handlePromote = () => {
    promoteExperiment(experimentId, { name: exp.name, problem: exp.conclusion || exp.hypothesis });
    setPromoteOpen(true);
  };

  const validateFinding = (finding: LabFinding) => {
    const annotated = annotateFinding(finding, entries);
    saveFinding(annotated);
  };

  return (
    <div className="h-full flex flex-col">
      <AppHeader
        backTo="/lab"
        title={exp.name}
        crumb={`${typeMeta.label} · ${statusMeta.label}`}
      />
      <div className="flex-1 overflow-y-auto p-4 max-w-5xl w-full mx-auto">
        {/* Status + actions */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge variant="outline" className={`gap-1 ${typeMeta.color}`}>
            <typeMeta.icon className="h-3 w-3" /> {typeMeta.label}
          </Badge>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`h-2 w-2 rounded-full ${statusMeta.dot}`} /> {statusMeta.label}
          </span>
          <div className="flex-1" />
          <Button size="sm" onClick={handleRun} disabled={running || !isAIEnabled(ai)}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? "Executando…" : "Executar experimento"}
          </Button>
        </div>

{!isAIEnabled(ai) && <AIDisabledNotice className="mb-3" />}
        {error && (
          <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="overview">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="dataset">Dataset</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="results">Resultados</TabsTrigger>
            <TabsTrigger value="evidence">Evidências</TabsTrigger>
            <TabsTrigger value="conclusion">Conclusão</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-3 mt-3">
            <Section title="Hipótese" icon={<FileText className="h-4 w-4" />}>
              {exp.hypothesis ? (
                <p className="text-sm text-foreground">{exp.hypothesis}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma hipótese registrada.</p>
              )}
            </Section>
            {exp.question && (
              <Section title="Pergunta">
                <p className="text-sm text-foreground">{exp.question}</p>
              </Section>
            )}
            {exp.description && (
              <Section title="Contexto">
                <p className="text-sm text-muted-foreground">{exp.description}</p>
              </Section>
            )}
            <Section title="Status">
              <div className="flex flex-wrap gap-1.5">
                {(["draft", "iterate", "rejected", "archived"] as ExperimentStatus[]).map((s) => (
                  <Button key={s} size="sm" variant={exp.status === s ? "default" : "outline"}
                    onClick={() => setStatus(s)} className="h-7 text-xs">
                    {EXPERIMENT_STATUS[s].label}
                  </Button>
                ))}
              </div>
            </Section>
          </TabsContent>

          {/* Dataset */}
          <TabsContent value="dataset" className="space-y-3 mt-3">
            <Section title="Dataset utilizado" icon={<Database className="h-4 w-4" />}>
              <p className="text-sm text-foreground">{datasetSummary}</p>
              {ds.length > 0 && (
                <div className="mt-2 space-y-1">
                  {ds.map((d) => (
                    <div key={d.id} className="text-xs text-muted-foreground flex justify-between">
                      <span>{d.name}</span>
                      <span>{d.appKeys.length} apps · {d.reviewCount.toLocaleString("pt-BR")} reviews</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </TabsContent>

          {/* Pipeline */}
          <TabsContent value="pipeline" className="space-y-3 mt-3">
            <Section title="Pipeline / Canvas" icon={<Workflow className="h-4 w-4" />}>
              {exp.pipeline?.canvasId ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground">Pipeline associado: {exp.pipeline.canvasId}</p>
                  <Button size="sm" variant="outline" onClick={() => navigate("/canvas")}>
                    Abrir no Canvas
                  </Button>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    Nenhum pipeline associado. Crie um no Canvas e vincule ao experimento.
                  </p>
                  <Button size="sm" variant="outline" onClick={() => navigate("/canvas")}>
                    Criar pipeline no Canvas
                  </Button>
                </div>
              )}
            </Section>
          </TabsContent>

          {/* Results */}
          <TabsContent value="results" className="space-y-3 mt-3">
            {running && streamPreview && (
              <Section title="Stream ao vivo">
                <pre className="text-[10px] font-mono whitespace-pre-wrap bg-secondary/50 p-2 rounded max-h-48 overflow-auto">
                  {streamPreview}
                </pre>
              </Section>
            )}
            {exp.structuredResult ? (
              <>
                <Section title="Observado">
                  <ListItems items={exp.structuredResult.observed} badge="OBSERVED" />
                </Section>
                <Section title="Inferido">
                  <ListItems items={exp.structuredResult.inferred} badge="INFERRED" />
                </Section>
                <Section title="Estimado">
                  <ListItems items={exp.structuredResult.estimated} badge="ESTIMATE" />
                </Section>
                {exp.structuredResult.metrics && Object.keys(exp.structuredResult.metrics).length > 0 && (
                  <Section title="Métricas">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(exp.structuredResult.metrics).map(([k, v]) => (
                        <div key={k} className="rounded border border-border bg-secondary/30 p-2">
                          <div className="text-[10px] text-muted-foreground">{k}</div>
                          <div className="text-sm font-semibold tabular-nums">{String(v)}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            ) : exp.result ? (
              <Section title="Resultado (markdown)">
                <AIOutputCard
                  bare
                  content={exp.result}
                  filename={`lab-${exp.id}`}
                  storageKey={`lab-${exp.id}`}
                  onRegenerate={running || !isAIEnabled(ai) ? undefined : handleRun}
                />
              </Section>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum resultado ainda. Execute o experimento para gerar resultados estruturados.
              </p>
            )}
          </TabsContent>

          {/* Evidence */}
          <TabsContent value="evidence" className="space-y-3 mt-3">
            <Section title="Findings" icon={<FileText className="h-4 w-4" />}>
              {findings.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum finding registrado. Execute o experimento para gerar findings com evidências.
                </p>
              ) : (
                <div className="space-y-2">
                  {findings.map((f) => {
                    const fType = FINDING_TYPES[f.type];
                    const fStatus = FINDING_STATUS[f.status];
                    const validation = f.evidence?.validation;
                    return (
                      <div key={f.id} className="rounded-lg border border-border p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded border ${fType.color}`}>
                            {fType.label}
                          </span>
                          <span className={`text-[9px] uppercase font-medium px-1.5 py-0.5 rounded border ${fStatus.color}`}>
                            {fStatus.label}
                          </span>
                          {typeof f.confidence === "number" && (
                            <span className="text-[10px] text-muted-foreground">
                              confiança {Math.round(f.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">{f.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                        {validation && (
                          <div className={`mt-2 flex items-center gap-1.5 text-[10px] ${
                            validation.status === "valid"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : validation.status === "failed"
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}>
                            {validation.status === "valid" ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                            {validation.status === "valid"
                              ? "Evidência validada"
                              : validation.status === "failed"
                              ? "Evidência validation failed"
                              : "Evidência não verificada"}
                            {validation.issues && validation.issues.length > 0 && (
                              <span>· {validation.issues.join("; ")}</span>
                            )}
                          </div>
                        )}
                        <div className="mt-2 flex gap-1.5">
                          <Button size="sm" variant="outline" className="h-6 text-[10px]"
                            onClick={() => validateFinding(f)}>
                            Validar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </TabsContent>

          {/* Conclusion + decision */}
          <TabsContent value="conclusion" className="space-y-3 mt-3">
            <Section title="Conclusão">
              {exp.conclusion ? (
                <p className="text-sm text-foreground">{exp.conclusion}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhuma conclusão registrada.</p>
              )}
            </Section>
            <Section title="Provenance" icon={<Cpu className="h-4 w-4" />}>
              {exp.provenance ? (
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <Detail label="Provider" value={exp.provenance.ai.provider || "—"} />
                  <Detail label="Modelo" value={exp.provenance.ai.model || "—"} />
                  <Detail label="Prompt version" value={exp.provenance.ai.promptVersion || "—"} />
                  <Detail label="Apps no escopo" value={String(exp.provenance.appKeys.length)} />
                  <Detail label="Executado em" value={exp.provenance.executedAt ? new Date(exp.provenance.executedAt).toLocaleString("pt-BR") : "—"} />
                </dl>
              ) : (
                <p className="text-xs text-muted-foreground">Sem registro de provenance (experimento não executado).</p>
              )}
            </Section>
            <Section title="Decisão">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setStatus("iterate")}>
                  <RefreshCw className="h-3.5 w-3.5" /> Iterar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus("rejected")}>
                  <XCircle className="h-3.5 w-3.5" /> Rejeitar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setStatus("archived")}>
                  <Archive className="h-3.5 w-3.5" /> Arquivar
                </Button>
                <Button size="sm" onClick={handlePromote} disabled={exp.status !== "completed" && exp.status !== "promote"}>
                  <ArrowUpCircle className="h-3.5 w-3.5" /> Promover para Product Candidate
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive"
                  onClick={() => { if (confirm("Excluir experimento e seus findings?")) { deleteExperiment(experimentId); navigate("/lab"); } }}>
                  Excluir
                </Button>
              </div>
            </Section>
          </TabsContent>
        </Tabs>
      </div>
      <ProductCandidateDialog open={promoteOpen} onOpenChange={setPromoteOpen} fromExperimentId={experimentId} />
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-2">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function ListItems({ items, badge }: { items: string[]; badge: string }) {
  if (!items?.length) return <p className="text-xs text-muted-foreground">—</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="text-sm text-foreground flex gap-2">
          <span className="text-[8px] font-mono mt-1 px-1 py-0.5 rounded bg-muted text-muted-foreground flex-shrink-0">
            {badge}
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
