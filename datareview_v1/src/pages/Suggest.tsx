/**
 * Página Suggest (/suggest) — extrator maximalista do Google Suggest.
 *
 * O usuário configura termo × regiões × verticais × grupos de expansão do
 * briefing ("todos os suggests de todos os tipos de variações"), coleta em
 * lotes via ação gather do servidor, e explora: tabela com proveniência
 * completa, rendimento por grupo, gráficos, sobreposição entre verticais e
 * análise de IA (mesmo UniAI da página /00). Resultados podem virar uma
 * coleção da Uni (apos:uni-collections) para reaproveitar em /00.
 */
import { useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { SuggestParams, computeCombos, type SuggestParamsValue } from "@/components/suggest/SuggestParams";
import { SuggestResults } from "@/components/suggest/SuggestResults";
import { UniAI } from "@/components/uni/UniAI";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/lib/ux";
import {
  buildSeeds, EXPANSION_GROUPS,
  type GatherObservation, type SuggestRow, type SuggestVertical,
} from "@/lib/suggest/suggestCore";
import { runGather, type GatherProgress } from "@/lib/suggest/suggestApi";
import { saveCollection } from "@/lib/uni/uniStore";
import type { UniItem } from "@/lib/uni/types";
import { Sparkles, Save } from "lucide-react";

const DEFAULT_PARAMS: SuggestParamsValue = {
  regions: ["br"],
  lang: "pt",
  client: "chrome",
  verticals: ["web"],
  groupIds: EXPANSION_GROUPS.map((g) => g.id),
  limit: 10,
};

export default function Suggest() {
  const [term, setTerm] = useState("");
  const [params, setParams] = useState<SuggestParamsValue>(DEFAULT_PARAMS);
  const [rows, setRows] = useState<SuggestRow[]>([]);
  const [observations, setObservations] = useState<GatherObservation[]>([]);
  const [uniItems, setUniItems] = useState<UniItem[]>([]);
  const [progress, setProgress] = useState<GatherProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const seeds = useMemo(
    () => buildSeeds(term, EXPANSION_GROUPS.filter((g) => params.groupIds.includes(g.id))),
    [term, params.groupIds],
  );

  const run = async () => {
    const q = term.trim();
    if (!q || running) return;
    abortRef.current?.abort();
    const ab = new AbortController();
    abortRef.current = ab;
    setRunning(true);
    setError("");
    setProgress(null);
    const combos = computeCombos(params);
    const res = await runGather(
      q,
      seeds,
      combos,
      { lang: params.lang, client: params.client, limit: params.limit },
      ab.signal,
      setProgress,
    );
    if (res.ok) {
      setRows(res.rows);
      setObservations(res.observations);
      setUniItems(res.uniItems);
    } else if (res.error !== "cancelado") {
      setError(res.error ?? "Falha na coleta");
    }
    setRunning(false);
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const saveToUni = () => {
    if (!uniItems.length) return;
    saveCollection({
      label: `Suggest — ${term.trim()}`,
      source: "suggest",
      query: term.trim(),
      items: uniItems,
      params: {
        regions: params.regions,
        lang: params.lang,
        client: params.client,
        verticals: params.verticals,
        groupIds: params.groupIds,
        limit: params.limit,
      },
    });
    toastSuccess("Coleção salva na Uni (/00)");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppHeader
        title="Suggest"
        crumb="Extrator maximalista de autocomplete (Google Suggest)"
      />
      <main className="content-fluid flex min-h-0 flex-1 flex-col gap-4 py-4">
        <ExpandableBlock
          id="suggest-params"
          storageKey="suggest:params"
          title="Parâmetros e expansões"
          exportData={() => ({
            term,
            regions: params.regions,
            lang: params.lang,
            client: params.client,
            verticals: params.verticals,
            groupIds: params.groupIds,
            limit: params.limit,
            seeds: seeds.map((s) => `${s.seed}·${s.group}`),
          })}
        >
          <SuggestParams
            term={term}
            onTermChange={setTerm}
            value={params}
            onChange={(next) => setParams((p) => ({ ...p, ...next }))}
            running={running}
            onRun={run}
            onStop={stop}
          />
          {progress && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              Combo {progress.done}/{progress.total} · {progress.combo.vertical}s@{
                progress.combo.region
              } · +{progress.added} sugestões
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </ExpandableBlock>

        {rows.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Nenhuma coleta ainda"
            description="Configure o termo, regiões, verticais e grupos de expansão acima e execute — o Suggest agrega todas as variações num só resultado com proveniência completa."
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium">
                {rows.length} sugestões únicas de “{term.trim()}”
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={saveToUni}
                aria-label="Salvar como coleção da Uni"
                className="ml-auto"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar na Uni
              </Button>
            </div>
            <SuggestResults term={term.trim()} rows={rows} observations={observations} uniItems={uniItems} />
            <ExpandableBlock
              id="suggest-ia"
              storageKey="suggest:ia"
              title="Análise com IA"
              subtitle="Analisa o espaço de descoberta coletado (mesmo assistente da Uni)"
            >
              <UniAI items={uniItems} source="suggest" />
            </ExpandableBlock>
          </>
        )}
      </main>
    </div>
  );
}
