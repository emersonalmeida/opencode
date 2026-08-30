/**
 * Resultados do extrator Trending: KPIs reais, busca instantânea, filtros
 * (tópico × status × janela), ordenação (volume/crescimento/recência/título),
 * agrupamento (ranking único ou por tópico), lista com "mostrar mais"
 * progressivo e exportação determinística (JSON/Markdown).
 */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { cn } from "@/lib/utils";
import { downloadFile } from "@/lib/pageFeatures";
import { TrendCard } from "./TrendCard";
import { Flame, ListFilter, Newspaper, Search, TrendingUp, X } from "lucide-react";
import {
  formatTraffic,
  hoursShort,
  relativeTime,
  topicLabel,
  trendingKpis,
  type TrendingItem,
} from "../../../server/lib/trendingCore";

type SortKey = "traffic" | "growth" | "recent" | "title";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "traffic", label: "Volume" },
  { id: "growth", label: "Crescimento" },
  { id: "recent", label: "Mais recentes" },
  { id: "title", label: "Título (A–Z)" },
];

const PAGE_SIZE = 60;

function normText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function sortItems(items: TrendingItem[], sort: SortKey): TrendingItem[] {
  const list = [...items];
  switch (sort) {
    case "growth":
      return list.sort((a, b) => b.growthPct - a.growthPct);
    case "recent":
      return list.sort((a, b) => (b.startedAt || "").localeCompare(a.startedAt || ""));
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
    default:
      return list.sort((a, b) => b.traffic - a.traffic);
  }
}

function buildMarkdown(items: TrendingItem[], geo: string): string {
  const lines = [
    `# Trends em alta — ${geo.toUpperCase()}`,
    "",
    `Fonte: https://trends.google.com/trending?geo=${geo.toUpperCase()} · extraído em ${new Date().toLocaleString("pt-BR")}`,
    "",
    `**${items.length} trends** · ${formatTraffic(items.reduce((n, t) => n + t.traffic, 0))} buscas somadas`,
    "",
  ];
  items.forEach((t, i) => {
    lines.push(`## ${i + 1}. ${t.title}`);
    lines.push(
      `- ${t.traffic.toLocaleString("pt-BR")} buscas · +${t.growthPct}% · ${t.active ? "em alta agora" : "encerrado"}${t.startedAt ? ` · iniciado ${relativeTime(t.startedAt)}` : ""}`,
    );
    if (t.topicIds.length) lines.push(`- Tópicos: ${t.topicIds.map(topicLabel).join(", ")}`);
    if (t.relatedQueries.length) lines.push(`- Consultas: ${t.relatedQueries.join(", ")}`);
    for (const n of t.news) lines.push(`- Notícia: [${n.title}](${n.url}) (${n.source})`);
    lines.push("");
  });
  return lines.join("\n");
}

export function TrendingResults({ items, geo }: { items: TrendingItem[]; geo: string }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<number | null>(null);
  const [status, setStatus] = useState<"all" | "active" | "ended">("all");
  const [sort, setSort] = useState<SortKey>("traffic");
  const [groupByTopic, setGroupByTopic] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const kpis = useMemo(() => trendingKpis(items), [items]);
  const topicOptions = useMemo(
    () =>
      Object.entries(kpis.perTopic)
        .map(([id, n]) => ({ id: Number(id), n }))
        .sort((a, b) => b.n - a.n),
    [kpis],
  );

  const filtered = useMemo(() => {
    const q = normText(query.trim());
    return items.filter((t) => {
      if (topic !== null && !t.topicIds.includes(topic)) return false;
      if (status === "active" && !t.active) return false;
      if (status === "ended" && t.active) return false;
      if (q && !normText(t.title).includes(q) && !t.relatedQueries.some((r) => normText(r).includes(q))) {
        return false;
      }
      return true;
    });
  }, [items, query, topic, status]);

  const sorted = useMemo(() => sortItems(filtered, sort), [filtered, sort]);
  const shown = sorted.slice(0, visible);

  const groups = useMemo(() => {
    if (!groupByTopic) return null;
    const map = new Map<number, TrendingItem[]>();
    for (const t of shown) {
      const key = t.topicIds[0] ?? -1;
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [shown, groupByTopic]);

  const exportJson = () => {
    downloadFile(
      `trending-${geo}.json`,
      JSON.stringify({ geo, exportedAt: new Date().toISOString(), count: items.length, items }, null, 2),
      "application/json",
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* KPIs — números reais da coleta, com texto (nunca só cor). */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Resumo da coleta">
        {[
          { icon: TrendingUp, label: "Trends", value: kpis.total.toLocaleString("pt-BR") },
          { icon: Flame, label: "Em alta agora", value: kpis.active.toLocaleString("pt-BR") },
          { icon: Search, label: "Buscas somadas", value: formatTraffic(kpis.totalTraffic) },
          { icon: Newspaper, label: "Notícias", value: kpis.newsCount.toLocaleString("pt-BR") },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <k.icon className="h-3.5 w-3.5" aria-hidden /> {k.label}
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Barra de ferramentas: busca + ordenação + agrupamento + exportação. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Buscar nos trends…"
            aria-label="Buscar nos trends"
            className="h-8 pl-8 pr-7 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
        <div role="group" aria-label="Ordenar por" className="flex gap-1">
          {SORTS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSort(s.id)}
              aria-pressed={sort === s.id}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                sort === s.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setGroupByTopic((g) => !g)}
          aria-pressed={groupByTopic}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
            groupByTopic ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          <ListFilter className="h-3 w-3" aria-hidden /> Por tópico
        </button>
        <div className="ml-auto flex items-center gap-1">
          <CopyDownloadButtons content={buildMarkdown(sorted, geo)} filename={`trending-${geo}`} />
          <Button variant="outline" size="sm" onClick={exportJson} aria-label="Exportar JSON completo" className="h-7 text-xs">
            JSON
          </Button>
        </div>
      </div>

      {/* Filtros: tópico × status — contagem real por opção. */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por tópico">
        <button
          type="button"
          onClick={() => setTopic(null)}
          aria-pressed={topic === null}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs transition-colors",
            topic === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          Todos os tópicos
        </button>
        {topicOptions.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTopic((cur) => (cur === t.id ? null : t.id))}
            aria-pressed={topic === t.id}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              topic === t.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {topicLabel(t.id)} <span className="opacity-70">({t.n})</span>
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {(
          [
            { id: "all", label: "Todos" },
            { id: "active", label: "Em alta agora" },
            { id: "ended", label: "Encerrados" },
          ] as const
        ).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatus(s.id)}
            aria-pressed={status === s.id}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs transition-colors",
              status === s.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p role="status" className="text-xs text-muted-foreground">
        {filtered.length === items.length
          ? `${items.length.toLocaleString("pt-BR")} trends`
          : `${filtered.length.toLocaleString("pt-BR")} de ${items.length.toLocaleString("pt-BR")} trends`}
        {query && ` · busca “${query}”`}
      </p>

      {filtered.length === 0 ? (
        <div role="status" className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum trend corresponde aos filtros.{" "}
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => {
              setQuery("");
              setTopic(null);
              setStatus("all");
            }}
          >
            Limpar filtros
          </button>
        </div>
      ) : groups ? (
        groups.map(([topicId, list]) => (
          <section key={topicId} aria-label={`Tópico ${topicId === -1 ? "sem classificação" : topicLabel(topicId)}`}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
              {topicId === -1 ? "Sem classificação" : topicLabel(topicId)}
              <Badge variant="secondary">{list.length}</Badge>
            </h3>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {list.map((item) => (
                <TrendCard key={item.title} item={item} geo={geo} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((item) => (
            <TrendCard key={item.title} item={item} geo={geo} />
          ))}
        </div>
      )}

      {sorted.length > visible && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Mostrar mais {Math.min(PAGE_SIZE, sorted.length - visible)} de {sorted.length - visible} restantes
          </Button>
        </div>
      )}
    </div>
  );
}
