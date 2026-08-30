import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BrainCircuit, Loader2, Play, Square, ArrowRight } from "lucide-react";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";
import { EmptyState } from "@/components/shared/EmptyState";
import type { DatasetEntry } from "@/lib/datasetStore";

const DECIDE_PROMPT = [
  "Você é um conselheiro de produto. Com base em TODOS os dados, produza um",
  "painel de decisão executivo com EXATAMENTE estas seções:",
  "## Veredito — a situação em 2 frases.",
  "## Decisões recomendadas — 3 a 5, cada uma com prioridade (ALTA/MÉDIA/BAIXA),",
  "evidência de review real (citação) e impacto esperado.",
  "## Riscos — o que pode dar errado se nada for feito.",
  "## Próximos passos — 3 ações concretas para as próximas 2 semanas.",
  "Seja direto. Cite reviews reais como evidência em cada decisão.",
].join("\n");

/**
 * Etapa 5 — Decidir: consolida os achados em um painel de decisão via IA,
 * com atalho para o Decision Center (análise por persona).
 */
export function StageDecide({ scoped }: { scoped: DatasetEntry[] }) {
  const ai = useAISettings();
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    setRunning(true);
    setError(null);
    setOutput("");
    abortRef.current = new AbortController();
    await streamExperimentChat(
      scoped,
      [{ role: "user", content: DECIDE_PROMPT }],
      {
        onToken: (full) => setOutput(full),
        onDone: (full) => { setOutput(full); setRunning(false); },
        onError: (err) => { setError(err); setRunning(false); },
      },
      abortRef.current.signal,
      ai,
      "custom",
    );
  };

  if (scoped.length === 0) {
    return (
      <EmptyState
        icon={BrainCircuit}
        title="Sem dados para decidir"
        description="Colete apps nas etapas anteriores."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Da análise à decisão</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Um painel executivo consolidado: veredito, decisões priorizadas com
          evidência, riscos e próximos passos.
        </p>
      </div>

      {!isAIEnabled(ai) && <AIDisabledNotice />}

      <div className="flex items-center gap-2">
        {!running ? (
          <button
            onClick={run}
            disabled={!isAIEnabled(ai)}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <Play className="h-4 w-4" aria-hidden /> Gerar painel de decisão
          </button>
        ) : (
          <button
            onClick={() => { abortRef.current?.abort(); setRunning(false); }}
            className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-destructive text-destructive-foreground"
          >
            <Square className="h-4 w-4" aria-hidden /> Parar
          </button>
        )}
        <Link
          to="/decision-center"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Aprofundar por persona no Decision Center <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {error && <p className="text-xs text-destructive" role="alert">{error}</p>}

      {output && (
        <div className="rounded-lg border border-border/60 bg-background p-4">
          <AIOutputCard bare content={output} filename="painel-decisao" streaming={running} storageKey="jornada-decidir" />
        </div>
      )}
      {running && !output && (
        <p className="text-xs text-muted-foreground inline-flex items-center gap-1.5" role="status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Consolidando decisões…
        </p>
      )}
    </div>
  );
}
