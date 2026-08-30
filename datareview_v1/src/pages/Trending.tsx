/**
 * Página Trending (/trending) — extrator da página "Em alta" do Google
 * Trends (https://trends.google.com/trending?geo=BR).
 *
 * O usuário escolhe região × janela(s), coleta, e explora a lista completa
 * de trends (volume, crescimento, atividade, tópicos, consultas
 * relacionadas, notícias vinculadas) com KPIs, busca, filtros, ordenação,
 * agrupamento e exportação. Resultados podem virar coleção da Uni (/00) e
 * ser analisados pela IA embutida (mesmo UniAI da /00). Tudo com
 * proveniência: cada trend diz em quais janelas apareceu.
 */
import { useMemo, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import {
  DEFAULT_TRENDING_PARAMS,
  TrendingParams,
  type TrendingParamsValue,
} from "@/components/trending/TrendingParams";
import { TrendingResults } from "@/components/trending/TrendingResults";
import { UniAI } from "@/components/uni/UniAI";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/lib/ux";
import { fetchTrending, gatherTrending, toUniItems } from "@/lib/trending/trendingApi";
import { saveCollection } from "@/lib/uni/uniStore";
import type { UniItem } from "@/lib/uni/types";
import type { TrendingItem, TrendingObservation } from "../../server/lib/trendingCore";
import { hoursLabel, hoursShort } from "../../server/lib/trendingCore";
import { Flame, Save } from "lucide-react";

export default function Trending() {
  const [params, setParams] = useState<TrendingParamsValue>(DEFAULT_TRENDING_PARAMS);
  const [items, setItems] = useState<TrendingItem[]>([]);
  const [observations, setObservations] = useState<TrendingObservation[]>([]);
  const [uniItems, setUniItems] = useState<UniItem[]>([]);
  const [collectedAt, setCollectedAt] = useState<number | null>(null);
  const [cached, setCached] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const geo = params.geo || "br";

  const run = async () => {
    if (running) return;
    abortRef.current?.abort();
    const ab = new AbortController();
    abortRef.current = ab;
    setRunning(true);
    setError("");
    setCached(false);
    const res =
      params.mode === "gather"
        ? await gatherTrending(geo, params.hoursList, ab.signal)
        : await fetchTrending(geo, params.hours, ab.signal);
    if (res.ok) {
      setItems(res.items);
      setObservations(res.observations);
      setUniItems(toUniItems(res.items));
      setCollectedAt(Date.now());
      setCached(res.cached);
      if (!res.items.length) {
        setError("O Google Trends não retornou trends para essa região/janela — tente outra combinação.");
      }
    } else if (res.error !== "cancelado" && !ab.signal.aborted) {
      setError(res.error ?? "Falha na coleta");
    }
    setRunning(false);
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  const scopeLabel = useMemo(() => {
    const windows =
      params.mode === "gather" ? params.hoursList.map(hoursShort).join("+") : hoursLabel(params.hours);
    return `${geo.toUpperCase()} · ${windows}`;
  }, [params, geo]);

  const saveToUni = () => {
    if (!uniItems.length) return;
    saveCollection({
      label: `Trending — ${scopeLabel}`,
      source: "trends",
      query: `trending:${geo}`,
      items: uniItems,
      params: { geo, mode: params.mode, hours: params.hours, hoursList: params.hoursList },
    });
    toastSuccess("Coleção salva na Uni (/00)");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AppHeader title="Trending" crumb="Extrator do Google Trends “Em alta”" />
      <main className="content-fluid flex min-h-0 flex-1 flex-col gap-4 py-4">
        <ExpandableBlock
          id="trending-params"
          storageKey="trending:params"
          title="Fonte e parâmetros"
          subtitle="Extrai a página “Em alta” do Google Trends via as mesmas fontes dela (RPC interno + RSS de notícias)"
          exportData={() => ({
            fonte: `https://trends.google.com/trending?geo=${geo.toUpperCase()}`,
            params,
            janelas: params.mode === "gather" ? params.hoursList : [params.hours],
          })}
        >
          <TrendingParams
            value={params}
            onChange={(next) => setParams((p) => ({ ...p, ...next }))}
            running={running}
            onRun={run}
            onStop={stop}
          />
          {observations.length > 1 && (
            <p role="status" className="mt-2 text-xs text-muted-foreground">
              Rendimento por janela:{" "}
              {observations
                .map((o) => `${hoursShort(o.hours)} → ${o.count}${o.error ? ` (${o.error})` : ""}`)
                .join(" · ")}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </ExpandableBlock>

        {items.length === 0 ? (
          <EmptyState
            icon={Flame}
            title="Nenhuma coleta ainda"
            description="Escolha a região e a janela e colete — o extrator traz a lista completa de trends com volume de buscas, crescimento, consultas relacionadas e notícias, tudo organizado com proveniência."
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium">
                {items.length.toLocaleString("pt-BR")} trends — {scopeLabel}
                {cached && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(cache do servidor)</span>
                )}
              </h2>
              {collectedAt && (
                <span className="text-xs text-muted-foreground">
                  coletado {new Date(collectedAt).toLocaleTimeString("pt-BR")}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={saveToUni}
                aria-label="Salvar como coleção da Uni"
                className="ml-auto"
              >
                <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Salvar na Uni
              </Button>
            </div>
            <TrendingResults items={items} geo={geo} />
            <ExpandableBlock
              id="trending-ia"
              storageKey="trending:ia"
              title="Análise com IA"
              subtitle="Analisa os trends coletados (mesmo assistente da Uni)"
            >
              <UniAI items={uniItems} source="trends" />
            </ExpandableBlock>
          </>
        )}
      </main>
    </div>
  );
}
