/**
 * Seção 04 — Dados: auditoria + validação + exportação do dataset.
 * Reusa o pipeline de validação determinístico (8 checks) e as
 * exportações JSON/CSV/Markdown e o backup completo (dataPortability).
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, AlertTriangle, XCircle, FileDown, Loader2, Database } from "lucide-react";
import { runValidation, type ValidationReport } from "@/lib/dataPipeline";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";
import { useFlowScope } from "@/components/flow/useFlowScope";
import { exportToJSON, exportToCSV, exportToMarkdown, exportAppMetaCSV } from "@/lib/exportUtils";
import { downloadExport } from "@/lib/dataPortability";
import { EmptyState } from "@/components/shared/EmptyState";

const OVERALL_ICON = {
  pass: <CheckCircle2 className="h-4 w-4 text-status-success" aria-hidden />,
  warn: <AlertTriangle className="h-4 w-4 text-status-warning" aria-hidden />,
  fail: <XCircle className="h-4 w-4 text-status-error" aria-hidden />,
};

export function SectionData() {
  const { entries, totalReviews } = useFlowScope();
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [running, setRunning] = useState(false);

  const allReviews = useMemo(() => entries.flatMap((e) => e.reviews), [entries]);

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="Dataset vazio"
        description="Colete apps para explorar, validar e exportar os dados aqui."
      />
    );
  }

  const validate = () => {
    setRunning(true);
    // deferido p/ não travar a UI em datasets grandes
    setTimeout(() => {
      setReport(runValidation(entries));
      setRunning(false);
    }, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={validate}
          disabled={running}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          Validar dataset
        </button>
        <button
          onClick={() => exportToCSV(allReviews, "reviews.csv")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary"
        >
          <FileDown className="h-3.5 w-3.5" aria-hidden /> CSV reviews
        </button>
        <button
          onClick={() => exportToJSON(entries[0].app, allReviews, "dataset.json")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary"
        >
          <FileDown className="h-3.5 w-3.5" aria-hidden /> JSON
        </button>
        <button
          onClick={() => exportAppMetaCSV(entries.map((e) => e.app), "apps.csv")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary"
        >
          <FileDown className="h-3.5 w-3.5" aria-hidden /> Metadados CSV
        </button>
        {entries.length === 1 && (
          <button
            onClick={() => exportToMarkdown(entries[0].app, allReviews, "relatorio.md")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary"
          >
            <FileDown className="h-3.5 w-3.5" aria-hidden /> Markdown
          </button>
        )}
        <button
          onClick={downloadExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 px-3 py-1.5 text-xs text-primary hover:bg-primary/5"
        >
          <FileDown className="h-3.5 w-3.5" aria-hidden /> Backup completo
        </button>
      </div>

      {report ? (
        <div className="space-y-2" role="status">
          <div className="flex items-center gap-2 text-sm">
            {OVERALL_ICON[report.overall]}
            <span className="font-medium">
              {report.overall === "pass"
                ? "Dataset saudável"
                : report.overall === "warn"
                  ? "Dataset com avisos"
                  : "Dataset com problemas"}
            </span>
            <span className="text-xs text-muted-foreground">
              ({report.totalIssues} issue(s) em {report.checks.length} verificações)
            </span>
          </div>
          <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {report.checks.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-md border border-border/40 bg-background/60 px-2.5 py-1.5 text-xs"
              >
                {c.status === "pass" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-success" aria-hidden />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-status-warning" aria-hidden />
                )}
                {c.label}
                {c.issues.length > 0 && (
                  <span className="text-muted-foreground">({c.issues.length})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {entries.length} app(s) · {totalReviews.toLocaleString("pt-BR")} reviews.
          A validação executa 8 verificações determinísticas (duplicatas, ratings, conteúdo, datas,
          essenciais, cobertura ≥60%, exclusivos por loja, enriquecimento).{" "}
          <Link to="/pipeline-dados" className="text-primary hover:underline">
            Auditoria completa →
          </Link>
        </p>
      )}

      <Panel
        title="Explorador de dados brutos"
        subtitle="A página Dados brutos inteira: metadados completos por app, reviews filtráveis, JSON bruto e chat de IA sobre os dados — sem sair do Fluxo."
        icon={<Database className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-dataexplorer"
      >
        <FlowEmbed page="dados" />
        <Link to="/dados" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
