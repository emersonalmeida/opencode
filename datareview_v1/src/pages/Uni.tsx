/**
 * Uni (/00) — workspace unificado de dados multi-fonte:
 * pesquisar → coletar → tratar → organizar → visualizar → analisar (IA) → salvar.
 */
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UniSourcePanel, CustomConnectorPanel, type UniRunOutcome } from "@/components/uni/UniSourcePanel";
import { CustomSourcesPanel } from "@/components/uni/CustomSourcesPanel";
import { useCustomSources, type CustomSourceDef } from "@/lib/uni/customSources";
import { UniAI } from "@/components/uni/UniAI";
import { UniTrendsChart, UniRegionsChart, UniTermsChart, UniSourceChart, UniTopScoredChart } from "@/components/uni/UniCharts";
import { fetchYoutubeComments, fetchRedditComments, fetchWikipediaArticle, fetchHnComments, fetchSeAnswers, type TrendsData, type SeSite } from "@/lib/uni/uniApi";
import { UNI_SOURCE_META, type UniItem, type UniSourceId } from "@/lib/uni/types";
import { SOURCE_FIELDS } from "@/lib/uni/sourceFields";
import { deleteCollection, restoreCollection, saveCollection, useUniCollections } from "@/lib/uni/uniStore";
import { logCollectedItems } from "@/lib/uni/uniOutputLog";
import { UniOutputPanel } from "@/components/uni/UniOutputPanel";
import { PageTabsSidebar } from "@/components/PageTabsSidebar";
import { useDestructiveAction } from "@/hooks/useUx";
import { toastError, toastSuccess } from "@/lib/ux";
import {
  Sparkles, TrendingUp, Globe, Youtube, MessageCircle, BookOpen, Newspaper, Rss, GraduationCap, Code2, Github, FlaskConical, Gamepad2, Globe2, Rss as RssIcon, ClipboardPaste, FileCode, MessageSquare, AtSign, Database, Library, BookMarked, Package, Gem, Apple, Archive, Tv, PenLine, MessageSquareWarning, Rocket,
  Save, Trash2, FolderOpen, MessagesSquare, ExternalLink, Loader2, TerminalSquare,
} from "lucide-react";

const SOURCE_ICONS: Record<UniSourceId, typeof Globe> = {
  suggest: Sparkles,
  trends: TrendingUp,
  serp: Globe,
  youtube: Youtube,
  reddit: MessageCircle,
  wikipedia: BookOpen,
  hackernews: Newspaper,
  gdelt: Rss,
  arxiv: GraduationCap,
  stackexchange: Code2,
  github: Github,
  semanticscholar: FlaskConical,
  steam: Gamepad2,
  web: Globe2,
  feed: RssIcon,
  paste: ClipboardPaste,
  devto: FileCode,
  lobsters: MessageSquare,
  mastodon: AtSign,
  bluesky: AtSign,
  wikidata: Database,
  openalex: Library,
  crossref: BookMarked,
  openlibrary: BookOpen,
  npm: Package,
  pypi: Package,
  itchio: Gamepad2,
  rubygems: Gem,
  cratesio: Package,
  doaj: Library,
  openfoodfacts: Apple,
  archive: Archive,
  tvmaze: Tv,
  reclameaqui: MessageSquareWarning,
  producthunt: Rocket,
  custom: PenLine,
};

const SOURCES: UniSourceId[] = ["suggest", "trends", "serp", "youtube", "reddit", "wikipedia", "hackernews", "gdelt", "arxiv", "stackexchange", "github", "semanticscholar", "steam", "reclameaqui", "producthunt", "web", "feed", "paste", "devto", "lobsters", "mastodon", "bluesky", "wikidata", "openalex", "crossref", "openlibrary", "npm", "pypi", "itchio", "rubygems", "cratesio", "doaj", "openfoodfacts", "archive", "tvmaze"];

const KIND_LABEL: Record<UniItem["kind"], string> = {
  suggestion: "Sugestão",
  "trend-point": "Ponto",
  "trend-region": "Região",
  "trend-query": "Query",
  "web-result": "Resultado",
  video: "Vídeo",
  comment: "Comentário",
  post: "Post",
  article: "Artigo",
  news: "Notícia",
  paper: "Paper",
  question: "Pergunta",
  answer: "Resposta",
  repo: "Repositório",
  issue: "Issue",
  game: "Jogo",
  review: "Review",
  complaint: "Reclamação",
  document: "Documento",
  book: "Livro",
  package: "Pacote",
};

function ItemRow({ item, index, onFetchComments, loadingComments }: {
  item: UniItem;
  index: number;
  onFetchComments?: (item: UniItem) => void;
  loadingComments?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 border-b px-4 py-2.5 last:border-b-0">
      <span className="text-muted-foreground mt-0.5 w-6 shrink-0 text-right font-mono text-xs">{index + 1}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.title}</span>
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir link"
              className="text-muted-foreground hover:text-primary shrink-0">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {item.text && item.text !== item.title && (
          <p className="text-muted-foreground mt-0.5 line-clamp-2 text-xs">{item.text}</p>
        )}
        <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
          <span className="rounded bg-muted px-1.5 py-0.5">{KIND_LABEL[item.kind]}</span>
          {item.author && <span>{item.author}</span>}
          {item.date && <span>{item.date.slice(0, 10)}</span>}
          {item.score != null && item.score > 0 && <span className="font-mono">▲ {item.score}</span>}
          {item.meta?.engine != null && <span>via {String(item.meta.engine)}</span>}
          {item.meta?.seed != null && <span>via “{String(item.meta.seed)}”</span>}
          {item.meta?.subreddit != null && <span>r/{String(item.meta.subreddit)}</span>}
          {item.meta?.views != null && <span>{String(item.meta.views)}</span>}
          {(item.kind === "video" || item.kind === "post" || item.kind === "question" || (item.kind === "article" && item.source === "wikipedia" && !item.meta?.full)) && onFetchComments && (
            <button
              onClick={() => onFetchComments(item)}
              disabled={loadingComments === item.id}
              className="text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
            >
              {loadingComments === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessagesSquare className="h-3 w-3" />}
              {item.kind === "article" ? "Artigo completo" : item.kind === "question" ? "Respostas" : "Comentários"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Uni() {
  const [source, setSource] = useState<UniSourceId>("suggest");
  const [customDef, setCustomDef] = useState<CustomSourceDef | null>(null);
  const [manageSources, setManageSources] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("");
  const customDefs = useCustomSources();
  const [view, setView] = useState<"collect" | "saved">("collect");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<UniItem[]>([]);
  const [lastParams, setLastParams] = useState<Record<string, unknown>>({});
  const [trends, setTrends] = useState<TrendsData | undefined>();
  const [trendsList, setTrendsList] = useState<{ label: string; data?: TrendsData }[]>([]);
  const [loadingComments, setLoadingComments] = useState<string | null>(null);
  const collections = useUniCollections();
  const destroy = useDestructiveAction();

  const handleResult = (outcome: UniRunOutcome) => {
    setError(null);
    setItems(outcome.items);
    setLastParams(outcome.params);
    setTrends(outcome.trends);
    setTrendsList(outcome.trendsList ?? (outcome.trends ? [{ label: "Trends", data: outcome.trends }] : []));
    // Imprime os itens no terminal da aba Output (estilo _uni.py).
    logCollectedItems(outcome.items);
    if (!outcome.items.length && !outcome.trends?.timeline.length) {
      setError("A coleta retornou vazia.");
    }
  };

  const saveCurrent = () => {
    if (!items.length) return;
    saveCollection({
      label: `${customDef?.label ?? UNI_SOURCE_META[source].label} · ${query}`,
      source,
      query,
      items,
      params: lastParams,
    });
    toastSuccess(`Coleção salva (${items.length} itens)`);
  };

  const fetchComments = async (item: UniItem) => {
    setLoadingComments(item.id);
    try {
      if (item.kind === "video") {
        const videoId = String(item.meta?.videoId ?? "");
        const res = await fetchYoutubeComments(videoId, 20);
        if (!res.ok) throw new Error(res.error);
        if (!res.items.length) {
          toastError("Comentários indisponíveis (desativados?)");
        } else {
          setItems((prev) => [...res.items, ...prev]);
          toastSuccess(`${res.items.length} comentários adicionados à coleta`);
        }
      } else if (item.kind === "article") {
        const res = await fetchWikipediaArticle(Number(item.meta?.pageid ?? 0), String(item.meta?.lang ?? "pt"));
        if (!res.ok) throw new Error(res.error);
        setItems((prev) => [...res.items, ...prev]);
        toastSuccess("Artigo completo adicionado à coleta");
      } else if (item.kind === "question") {
        const res = await fetchSeAnswers(Number(item.meta?.questionId ?? 0), String(item.meta?.site ?? "stackoverflow") as SeSite, 10);
        if (!res.ok) throw new Error(res.error);
        if (!res.items.length) {
          toastError("Esta pergunta não tem respostas.");
        } else {
          setItems((prev) => [...res.items, ...prev]);
          toastSuccess(`${res.items.length} respostas adicionadas à coleta`);
        }
      } else if (item.kind === "post" && item.source === "hackernews") {
        const res = await fetchHnComments(String(item.meta?.hnId ?? ""), 20);
        if (!res.ok) throw new Error(res.error);
        if (!res.items.length) {
          toastError("Esta story não tem comentários.");
        } else {
          setItems((prev) => [...res.items, ...prev]);
          toastSuccess(`${res.items.length} comentários adicionados à coleta`);
        }
      } else if (item.kind === "post") {
        const res = await fetchRedditComments(item.id.split(":")[1] ?? "", String(item.meta?.subreddit ?? "all"), 20);
        if (!res.ok) throw new Error(res.error);
        setItems((prev) => [...res.items, ...prev]);
        toastSuccess(`${res.items.length} comentários adicionados à coleta`);
      }
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Falha ao buscar comentários");
    } finally {
      setLoadingComments(null);
    }
  };

  const savedItems = useMemo(() => collections.flatMap((c) => c.items), [collections]);

  // Pesquisa nas fontes: filtra builtin + customizadas por label/descrição.
  const nf = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filteredBuiltin = sourceFilter
    ? SOURCES.filter((s) => nf(UNI_SOURCE_META[s].label + UNI_SOURCE_META[s].description).includes(nf(sourceFilter)))
    : SOURCES;
  const filteredCustom = sourceFilter
    ? customDefs.filter((d) => nf(d.label + (d.description ?? "")).includes(nf(sourceFilter)))
    : customDefs;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader title="Uni" crumb="Dados multi-fonte" />
      <PageTabsSidebar
        id="uni:right"
        side="right"
        title="Uni"
        subtitle="saída da coleta"
        icon={<TerminalSquare className="h-4 w-4" />}
        storageKey="aso:uni-right-w"
        defaultWidth={340}
        defaultTab="output"
        helpTab={{
          description: "O Uni pesquisa e coleta dados de 26 fontes (suggest, trends, SERP, YouTube, Reddit, acadêmicas, lojas, sociais, web livre) — tudo normalizado em itens que viram coleções para visualizar e analisar com IA.",
          tips: [
            "A aba Output é um terminal ao vivo: cada execução, progresso e item coletado aparece lá em tempo real.",
            "Salve resultados como coleções — elas alimentam os gráficos e a IA.",
          ],
        }}
        tabs={[
          {
            id: "output",
            label: "Output",
            icon: <TerminalSquare className="h-4 w-4" />,
            content: <UniOutputPanel />,
          },
        ]}
      />
      <div className="content-fluid flex min-h-0 flex-1 flex-col gap-4 py-4">
        {/* Seletor de fonte com pesquisa (builtin + customizadas) */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            placeholder="Pesquisar fontes…"
            aria-label="Pesquisar fontes de dados"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          />
          {filteredBuiltin.length === 0 && filteredCustom.length === 0 && (
            <span className="text-muted-foreground text-xs" role="status">Nenhuma fonte corresponde à busca.</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Fontes de dados">
          {filteredBuiltin.map((s) => {
            const Icon = SOURCE_ICONS[s];
            const active = source === s && !customDef && !manageSources;
            return (
              <button
                key={s}
                role="tab"
                aria-selected={active}
                onClick={() => { setSource(s); setCustomDef(null); setManageSources(false); setItems([]); setError(null); setTrends(undefined); }}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {UNI_SOURCE_META[s].label}
              </button>
            );
          })}
          {filteredCustom.map((d) => {
            const active = customDef?.id === d.id;
            return (
              <button
                key={d.id}
                role="tab"
                aria-selected={active}
                title={d.urlTemplate}
                onClick={() => { setSource("custom"); setCustomDef(d); setManageSources(false); setItems([]); setError(null); setTrends(undefined); }}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
                )}
              >
                <PenLine className="h-4 w-4" />
                {d.label}
              </button>
            );
          })}
          <button
            onClick={() => { setManageSources(true); setCustomDef(null); setItems([]); setError(null); }}
            className={cn(
              "flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm transition-colors",
              manageSources ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            <PenLine className="h-4 w-4" /> Fontes customizadas
          </button>
          <div className="ml-auto flex gap-2" role="tablist" aria-label="Visão">
            <button role="tab" aria-selected={view === "collect"} onClick={() => setView("collect")}
              className={cn("rounded-lg border px-3 py-2 text-sm", view === "collect" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
              Coletar
            </button>
            <button role="tab" aria-selected={view === "saved"} onClick={() => setView("saved")}
              className={cn("rounded-lg border px-3 py-2 text-sm", view === "saved" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>
              <FolderOpen className="mr-1.5 inline h-4 w-4" /> Salvas ({collections.length})
            </button>
          </div>
        </div>

        {view === "collect" ? (
          <>
            {manageSources ? (
              <CustomSourcesPanel />
            ) : (
            <>
            <p className="text-muted-foreground text-sm">{customDef ? (customDef.description || UNI_SOURCE_META.custom.description) : UNI_SOURCE_META[source].description}</p>

            {/* Mapeamento maximalista: tudo que a fonte oferece (dados/meta/limites). */}
            <details className="rounded-lg border text-sm" data-testid="source-fields">
              <summary className="cursor-pointer px-3 py-2 font-medium select-none">
                O que esta fonte oferece — {customDef ? customDef.label : UNI_SOURCE_META[source].label}
              </summary>
              <div className="flex flex-col gap-2 border-t px-3 py-2">
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Dados coletados</p>
                  <div className="flex flex-wrap gap-1">
                    {SOURCE_FIELDS[source].dataFields.map((f) => (
                      <span key={f} className="rounded bg-muted px-1.5 py-0.5 text-xs">{f}</span>
                    ))}
                  </div>
                </div>
                {SOURCE_FIELDS[source].metaFields.length > 0 && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">Metadados (meta.*)</p>
                    <div className="flex flex-wrap gap-1">
                      {SOURCE_FIELDS[source].metaFields.map((f) => (
                        <span key={f} className="rounded border px-1.5 py-0.5 font-mono text-xs">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground mb-1 text-xs font-medium">Recursos</p>
                  <ul className="text-muted-foreground list-disc pl-4 text-xs">
                    {SOURCE_FIELDS[source].resources.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>
                <p className="text-muted-foreground text-xs"><span className="font-medium">Limites:</span> {SOURCE_FIELDS[source].limits}</p>
              </div>
            </details>

            {customDef ? (
              <CustomConnectorPanel
                def={customDef}
                query={query}
                onQueryChange={setQuery}
                onResult={handleResult}
                onError={(msg) => { setError(msg); setItems([]); }}
              />
            ) : (
              <UniSourcePanel
                source={source}
                query={query}
                onQueryChange={setQuery}
                onResult={handleResult}
                onError={(msg) => { setError(msg); setItems([]); }}
              />
            )}

            <div className="flex items-center gap-2">
              {items.length > 0 && (
                <Button variant="outline" onClick={saveCurrent}>
                  <Save className="mr-1.5 h-4 w-4" /> Salvar ({items.length})
                </Button>
              )}
            </div>

            {error && <p role="alert" className="text-destructive text-sm">{error}</p>}

            {/* Visualização determinística */}
            {(items.length > 0 || (trends && trends.timeline.length > 0)) && (
              <div className="grid gap-3 md:grid-cols-2" role="region" aria-label="Visualizações">
                {trendsList.map((t) =>
                  t.data ? (
                    <div key={t.label} className="flex flex-col gap-1">
                      {trendsList.length > 1 && (
                        <p className="text-muted-foreground text-xs font-medium">{t.label}</p>
                      )}
                      {t.data.timeline.length > 0 && <UniTrendsChart trends={t.data} />}
                      {t.data.regions.length > 0 && <UniRegionsChart trends={t.data} />}
                    </div>
                  ) : null,
                )}
                <UniTermsChart items={items} />
                <UniSourceChart items={items} />
                <UniTopScoredChart items={items} />
              </div>
            )}

            {/* IA: análise + chat sobre os itens */}
            {items.length > 0 && (
              <div role="region" aria-label="Análise com IA">
                <UniAI items={items} source={source} />
              </div>
            )}

            {/* Resultados */}
            {items.length > 0 ? (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border" role="region" aria-label="Resultados">
                {items.map((item, i) => (
                  <ItemRow key={item.id} item={item} index={i} onFetchComments={fetchComments} loadingComments={loadingComments} />
                ))}
              </div>
            ) : (
              !error && (
                <EmptyState
                  icon={Sparkles}
                  title="Pesquise para coletar"
                  description="Escolha uma fonte acima, digite um termo e colete. Resultados podem ser salvos como coleções para visualizar e analisar com IA."
                />
              )
            )}
            </>
            )}
          </>
        ) : (
          /* Coleções salvas */
          <div className="min-h-0 flex-1 overflow-y-auto" role="region" aria-label="Coleções salvas">
            {collections.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="Nenhuma coleção salva"
                description="Colete dados de qualquer fonte e clique em Salvar — as coleções ficam persistidas localmente."
              />
            ) : (
              <div className="grid gap-3">
                {collections.map((c) => {
                  const Icon = SOURCE_ICONS[c.source];
                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg border p-4">
                      <Icon className="text-muted-foreground h-5 w-5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.label}</p>
                        <p className="text-muted-foreground text-xs">
                          {c.items.length} itens · {new Date(c.collectedAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Excluir coleção ${c.label}`}
                        onClick={() =>
                          destroy({
                            confirm: "Excluir esta coleção?",
                            detail: `${c.label} · ${c.items.length} itens`,
                            action: () => { deleteCollection(c.id); },
                            toast: "Coleção excluída",
                            undo: () => restoreCollection(c),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <p className="text-muted-foreground text-xs" role="status">
          {savedItems.length} itens salvos no total · dados coletados ficam no seu navegador (aso:uni:v1)
        </p>
      </div>
    </div>
  );
}
