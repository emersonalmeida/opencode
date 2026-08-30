import { useMemo, useState, useCallback } from "react";
import { Search, FlaskConical, Brain, Package, Database, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FindingCard } from "./FindingCard";
import { LabEmptyState } from "./LabEmptyState";
import { describeDataset } from "@/lib/lab/datasets";
import { useLabExperiments, useLabFindings, useLabProductCandidates, useLabDatasets } from "@/lib/lab/hooks";
import type { LabExperiment, LabFinding, ProductCandidate, LabDataset } from "@/lib/lab/types";

interface Props {
  onOpenExperiment: (id: string) => void;
}

/**
 * Knowledge — biblioteca de conhecimento do Lab. Busca textual sobre
 * experimentos, findings, candidatos, datasets e prompts/pipelines referenciados.
 */
export function LabKnowledge({ onOpenExperiment }: Props) {
  const experiments = useLabExperiments();
  const findings = useLabFindings();
  const products = useLabProductCandidates();
  const datasets = useLabDatasets();
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const match = useCallback((s?: string) => !!s && s.toLowerCase().includes(query), [query]);

  const filtExps = useMemo(
    () =>
      !query
        ? experiments
        : experiments.filter(
            (e) => match(e.name) || match(e.hypothesis) || match(e.question) || match(e.description) || match(e.conclusion),
          ),
    [experiments, query, match],
  );
  const filtFindings = useMemo(
    () => (!query ? findings : findings.filter((f) => match(f.title) || match(f.description))),
    [findings, query, match],
  );
  const filtProducts = useMemo(
    () => (!query ? products : products.filter((p) => match(p.name) || match(p.problem) || match(p.vertical))),
    [products, query, match],
  );
  const filtDatasets = useMemo(
    () => (!query ? datasets : datasets.filter((d) => match(d.name) || match(d.description))),
    [datasets, query, match],
  );

  const isEmpty =
    experiments.length === 0 && findings.length === 0 && products.length === 0 && datasets.length === 0;

  if (isEmpty) {
    return (
      <LabEmptyState
        title="Biblioteca de conhecimento vazia"
        description="Aqui se acumula o conhecimento gerado nos experimentos: hipóteses, findings, prompts e pipelines. Execute um experimento para começar."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Buscar em experimentos, findings, produtos, datasets (ex.: "churn", "fintech")'
          className="h-8 text-xs pl-8"
        />
      </div>

      {filtExps.length > 0 && (
        <KnowledgeSection icon={FlaskConical} title="Experimentos" count={filtExps.length}>
          {filtExps.slice(0, 12).map((e) => (
            <KnowledgeRow key={e.id} title={e.name} sub={e.hypothesis} onClick={() => onOpenExperiment(e.id)} />
          ))}
        </KnowledgeSection>
      )}

      {filtFindings.length > 0 && (
        <KnowledgeSection icon={Brain} title="Findings" count={filtFindings.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {filtFindings.slice(0, 12).map((f) => (
              <FindingCard key={f.id} finding={f} onOpenExperiment={onOpenExperiment} />
            ))}
          </div>
        </KnowledgeSection>
      )}

      {filtProducts.length > 0 && (
        <KnowledgeSection icon={Package} title="Product Candidates" count={filtProducts.length}>
          {filtProducts.slice(0, 12).map((p) => (
            <KnowledgeRow key={p.id} title={p.name} sub={`${p.vertical || "Sem nicho"} · ${p.problem}`} />
          ))}
        </KnowledgeSection>
      )}

      {filtDatasets.length > 0 && (
        <KnowledgeSection icon={Database} title="Datasets" count={filtDatasets.length}>
          {filtDatasets.slice(0, 12).map((d) => (
            <KnowledgeRow key={d.id} title={d.name} sub={describeDataset(d)} />
          ))}
        </KnowledgeSection>
      )}

      {query && filtExps.length === 0 && filtFindings.length === 0 && filtProducts.length === 0 && filtDatasets.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          Nada encontrado para "{q}".
        </p>
      )}
    </div>
  );
}

function KnowledgeSection({ icon: Icon, title, count, children }: { icon: React.ElementType; title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {title}
        <span className="text-[10px] text-muted-foreground">({count})</span>
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function KnowledgeRow({ title, sub, onClick }: { title: string; sub?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border bg-card p-2.5 hover:border-primary/30 transition-colors"
    >
      <div className="text-xs font-medium text-foreground truncate">{title}</div>
      {sub && <div className="text-[10px] text-muted-foreground line-clamp-2">{sub}</div>}
    </button>
  );
}
