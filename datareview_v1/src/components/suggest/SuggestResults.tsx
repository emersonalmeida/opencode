/**
 * Suggest — resultados determinísticos: tabela de sugestões agregadas,
 * rendimento por grupo de expansão, gráficos (reuso dos charts da Uni) e
 * comparação de cobertura entre verticais/regiões.
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { UniTermsChart, UniTopScoredChart } from "@/components/uni/UniCharts";
import {
  groupStats, recurring, rowsToMarkdown, verticalOverlap,
  type GatherObservation, type SuggestRow,
} from "@/lib/suggest/suggestCore";
import type { UniItem } from "@/lib/uni/types";

const TABS = [
  { id: "tabela", label: "Tabela" },
  { id: "grupos", label: "Por grupo" },
  { id: "graficos", label: "Gráficos" },
  { id: "sobreposicao", label: "Sobreposição" },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface Props {
  term: string;
  rows: SuggestRow[];
  observations: GatherObservation[];
  uniItems: UniItem[];
}

const MAX_RELEVANCE_FALLBACK = 1000;

export function SuggestResults({ term, rows, observations, uniItems }: Props) {
  const [tab, setTab] = useState<TabId>("tabela");
  const [filter, setFilter] = useState("");
  const [minOcc, setMinOcc] = useState(1);

  const maxRelevance = Math.max(MAX_RELEVANCE_FALLBACK, ...rows.map((r) => r.relevance));
  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return rows.filter(
      (r) => (!f || r.text.toLowerCase().includes(f)) && r.occurrences >= minOcc,
    );
  }, [rows, filter, minOcc]);

  const stats = useMemo(() => groupStats(observations), [observations]);
  const overlap = useMemo(() => verticalOverlap(rows), [rows]);
  const recorrentes = useMemo(() => recurring(rows, 3), [rows]);
  const mdExport = useMemo(() => rowsToMarkdown(term, filtered), [term, filtered]);

  if (!rows.length) return null;

  return (
    <section aria-label="Resultados da coleta" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Visões dos resultados" className="flex rounded-lg border">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn("px-3 py-1.5 text-xs", tab === t.id ? "bg-primary/10 text-primary" : "hover:bg-muted")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p role="status" className="text-xs text-muted-foreground">
          {rows.length} únicas · {observations.length} observações · {recorrentes.length} recorrentes (≥3)
        </p>
        <div className="ml-auto">
          <CopyDownloadButtons content={mdExport} filename={`suggest-${term}`} />
        </div>
      </div>

      {tab === "tabela" && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar sugestões…"
              aria-label="Filtrar sugestões"
              className="h-8 w-56 rounded-md border bg-background px-2 text-sm"
            />
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Recorrência mín.
              <select
                value={minOcc}
                onChange={(e) => setMinOcc(Number(e.target.value))}
                aria-label="Recorrência mínima"
                className="h-8 rounded-md border bg-background px-1 text-xs"
              >
                {[1, 2, 3, 5, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
            <span role="status" className="text-xs text-muted-foreground">{filtered.length} de {rows.length}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-2 py-1.5">#</th>
                  <th className="px-2 py-1.5">Sugestão</th>
                  <th className="w-40 px-2 py-1.5">Relevância</th>
                  <th className="px-2 py-1.5">Recorrência</th>
                  <th className="px-2 py-1.5">Grupos</th>
                  <th className="px-2 py-1.5">Sondas</th>
                  <th className="px-2 py-1.5">Verticais</th>
                  <th className="px-2 py-1.5">Regiões</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 500).map((r, i) => (
                  <tr key={r.text} className="border-t hover:bg-muted/30">
                    <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-2 py-1.5 font-medium">{r.text}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 rounded bg-muted">
                          <div
                            className="h-full rounded bg-primary/70"
                            style={{ width: `${Math.min(100, (r.relevance / maxRelevance) * 100)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right tabular-nums">{r.relevance}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5">
                      <span className="rounded bg-secondary px-1.5 py-0.5 tabular-nums">{r.occurrences}</span>
                    </td>
                    <td className="px-2 py-1.5">{r.groups.join(", ")}</td>
                    <td className="max-w-40 truncate px-2 py-1.5 text-muted-foreground" title={r.seeds.join(" · ")}>
                      {r.seeds.slice(0, 2).join(" · ")}{r.seeds.length > 2 ? ` (+${r.seeds.length - 2})` : ""}
                    </td>
                    <td className="px-2 py-1.5">{r.verticals.join(", ")}</td>
                    <td className="px-2 py-1.5">{r.regions.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "grupos" && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-1.5">Grupo</th>
                <th className="px-2 py-1.5">Sondas</th>
                <th className="px-2 py-1.5">Observações</th>
                <th className="px-2 py-1.5">Únicas</th>
                <th className="px-2 py-1.5">Rendimento (únicas/sonda)</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.group} className="border-t hover:bg-muted/30">
                  <td className="px-2 py-1.5 font-medium">{s.label}</td>
                  <td className="px-2 py-1.5 tabular-nums">{s.seeds}</td>
                  <td className="px-2 py-1.5 tabular-nums">{s.observations}</td>
                  <td className="px-2 py-1.5 tabular-nums">{s.unique}</td>
                  <td className="px-2 py-1.5 tabular-nums">{(s.unique / (s.seeds || 1)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "graficos" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <UniTermsChart items={uniItems} />
          <UniTopScoredChart items={uniItems} />
        </div>
      )}

      {tab === "sobreposicao" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Cobertura por vertical: exclusivas só existem naquela vertical; compartilhadas
            aparecem em mais de uma — mede a sobreposição do espaço de descoberta.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {overlap.map((o) => (
              <div key={o.vertical} className="rounded-lg border p-3">
                <p className="text-xs font-medium capitalize">{o.vertical}</p>
                <p className="text-2xl font-semibold tabular-nums">{o.unique}</p>
                <p className="text-xs text-muted-foreground">
                  {o.exclusive} exclusivas · {o.shared} compartilhadas
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
