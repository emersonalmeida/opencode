import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Database, Apple, ShoppingBag, Search, Star,
  Code2, FileJson, Trash2, MessageSquare, Globe,
  Calendar, ThumbsUp, User, Tag, ExternalLink, X, Filter,
  Sparkles, Send, Loader2, Wand2,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Panel } from "@/components/Panel";
import { useDataset } from "@/hooks/useDataset";
import { useDestructiveAction } from "@/hooks/useUx";
import { listDataset, upsertDataset, type DatasetEntry } from "@/lib/datasetStore";
import { useCompare } from "@/context/CompareContext";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OriginBadge } from "@/components/shared/OriginBadge";
import { FreshnessBadge } from "@/components/shared/FreshnessBadge";
import { exportToXLSX } from "@/lib/exportUtils";
import { toast } from "sonner";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { EmptyState } from "@/components/shared/EmptyState";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { isAIEnabled, useAISettings } from "@/lib/aiSettings";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";

type StoreFilter = "all" | "apple" | "google";
type SortKey = "name" | "reviews" | "rating" | "collected";

export default function DataExplorer({ embedded = false }: { embedded?: boolean }) {
  const { entries, remove } = useDataset();
  const destroy = useDestructiveAction();
  const navigate = useNavigate();
  const { setPickerOpen } = useCompare();

  const [storeFilter, setStoreFilter] = useState<StoreFilter>("all");
  const [sort, setSort] = useState<SortKey>("collected");
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  const totalReviews = useMemo(() => entries.reduce((n, e) => n + e.reviews.length, 0), [entries]);

  const filtered = useMemo(() => {
    let list = entries.slice();
    if (storeFilter !== "all") list = list.filter(e => e.app.store === storeFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(e =>
        e.app.name.toLowerCase().includes(q) ||
        e.app.developer.toLowerCase().includes(q) ||
        e.app.id.toLowerCase().includes(q)
      );
    }
    if (sort === "name") list.sort((a, b) => a.app.name.localeCompare(b.app.name, undefined, { sensitivity: "base" }));
    else if (sort === "reviews") list.sort((a, b) => b.reviews.length - a.reviews.length);
    else if (sort === "rating") list.sort((a, b) => (b.app.rating ?? 0) - (a.app.rating ?? 0));
    else list.sort((a, b) => (b.collectedAt ?? 0) - (a.collectedAt ?? 0));
    return list;
  }, [entries, storeFilter, query, sort]);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
    downloadBlob(blob, `appdata-dataset-${Date.now()}.json`);
    toast.success("Dataset exportado (JSON)");
  };

  const exportCSV = () => {
    const rows: string[] = [["store", "appId", "name", "developer", "rating", "ratingCount", "reviews", "collectedAt"].join(",")];
    for (const e of entries) {
      rows.push([
        e.app.store, csv(e.app.id), csv(e.app.name), csv(e.app.developer),
        e.app.rating ?? "", e.app.ratingCount ?? "", e.reviews.length, e.collectedAt ?? "",
      ].join(","));
    }
    downloadBlob(new Blob([rows.join("\n")], { type: "text/csv" }), `appdata-apps-${Date.now()}.csv`);
    toast.success("Apps exportados (CSV)");
  };

  const exportReviewsCSV = () => {
    const rows: string[] = [["store", "appId", "appName", "reviewId", "author", "rating", "date", "country", "version", "thumbsUp", "title", "text"].join(",")];
    for (const e of entries) {
      for (const r of e.reviews) {
        rows.push([
          r.store, csv(r.appId), csv(r.appName), csv(r.id), csv(r.author),
          r.rating, r.date, r.country ?? "", r.version ?? "", r.thumbsUp ?? 0, csv(r.title), csv(r.text),
        ].join(","));
      }
    }
    downloadBlob(new Blob([rows.join("\n")], { type: "text/csv" }), `appdata-reviews-${Date.now()}.csv`);
    toast.success("Reviews exportados (CSV)");
  };

  const exportXLSX = () => {
    const allReviews = entries.flatMap((e) => e.reviews);
    exportToXLSX(allReviews, `appdata-reviews-${Date.now()}.xls`);
    toast.success("Reviews exportados (XLSX)");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {!embedded && (
        <AppHeader
          title="Dados brutos"
          crumb={`${entries.length} app(s) · ${totalReviews.toLocaleString("pt-BR")} reviews`}
          compare={{ count: 0, onOpen: () => setPickerOpen(true) }}
          onExportJSON={entries.length ? exportJSON : undefined}
          onExportCSV={entries.length ? exportCSV : undefined}
          onExportMD={entries.length ? exportReviewsCSV : undefined}
          onExportXLSX={entries.length ? exportXLSX : undefined}
        />
      )}

      <div className="flex-1 overflow-auto">
        <div className="content-fluid py-6 space-y-5">
          {/* Intro */}
          <section className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Todos os dados coletados</h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Visualização bruta e completa de tudo que foi coletado: metadados integrais de cada app,
              todos os reviews (sem amostragem) e o payload original da loja. Sem edição, sem inferência —
              exatamente o que está armazenado localmente.
            </p>
          </section>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, dev ou ID…"
                aria-label="Buscar apps coletados"
                className="w-full text-sm pl-9 pr-8 py-2 rounded-lg bg-secondary/60 text-foreground border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Limpar busca" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(s => !s)} aria-expanded={showFilters} className="gap-1.5">
              <Filter className="h-3.5 w-3.5" /> Filtros
            </Button>
          </div>

          {showFilters && (
            <div className="rounded-xl border border-border/60 bg-card/60 p-3 flex flex-wrap items-end gap-4 animate-fade-in-up">
              <fieldset>
                <legend className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Loja</legend>
                <div className="flex gap-1" role="group">
                  {([["all", "Ambas"], ["apple", "Apple"], ["google", "Google"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setStoreFilter(k)} aria-pressed={storeFilter === k}
                      className={cn("text-[11px] px-2.5 py-1 rounded-md transition-colors", storeFilter === k ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70")}>
                      {l}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1">Ordenar por</legend>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}
                  className="text-[11px] px-2 py-1 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40">
                  <option value="collected">Coleta (recente)</option>
                  <option value="name">Nome (A–Z)</option>
                  <option value="reviews">Nº de reviews</option>
                  <option value="rating">Nota</option>
                </select>
              </fieldset>
            </div>
          )}

          {/* Empty state */}
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/30">
              <EmptyState
                icon={Database}
                title="Nenhum dado coletado"
                description="Colete apps aqui mesmo. Tudo que for coletado aparece na íntegra — metadados, reviews e payload bruto."
                collect
              />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Sem correspondências"
              description={`Nenhum app corresponde a "${query}".`}
              action={
                <Button variant="outline" size="sm" onClick={() => setQuery("")}>
                  Limpar busca
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary">{filtered.length} app(s)</Badge>
                <Badge variant="secondary">{filtered.reduce((n, e) => n + e.reviews.length, 0).toLocaleString("pt-BR")} reviews</Badge>
              </div>
              {filtered.map(entry => (
                <AppDataCard
                  key={`${entry.app.store}:${entry.app.id}`}
                  entry={entry}
                  onRemove={() => {
                    destroy({
                      toast: `${entry.app.name} removido`,
                      toastDescription: `${entry.reviews.length} reviews`,
                      action: () => {
                        const backup = entry;
                        remove(entry.app.store, entry.app.id);
                        return () => upsertDataset(backup);
                      },
                    });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AppDataCard({ entry, onRemove }: { entry: DatasetEntry; onRemove: () => void }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"fields" | "reviews" | "raw" | "ai">("fields");
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewRating, setReviewRating] = useState<number | "all">("all");
  const app = entry.app;
  const reviews = entry.reviews;

  const StoreIcon = app.store === "apple" ? Apple : ShoppingBag;

  const filteredReviews = useMemo(() => {
    let list = reviews;
    if (reviewRating !== "all") list = list.filter(r => r.rating === reviewRating);
    if (reviewSearch.trim()) {
      const q = reviewSearch.toLowerCase();
      list = list.filter(r => (r.text || "").toLowerCase().includes(q) || (r.author || "").toLowerCase().includes(q) || (r.title || "").toLowerCase().includes(q));
    }
    return list;
  }, [reviews, reviewSearch, reviewRating]);

  const metaEntries = useMemo(() => {
    const known = new Set(["id", "store", "name", "icon", "developer", "rating", "ratingCount", "price", "genre", "description", "screenshots", "url", "raw"]);
    return Object.entries(app)
      .filter(([k, v]) => !known.has(k) && v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v)] as [string, string]);
  }, [app]);

  return (
    <article className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 border-b border-border/40">
        {app.icon ? <img src={app.icon} alt="" className="w-12 h-12 rounded-xl flex-shrink-0" loading="lazy" /> : <div className="w-12 h-12 rounded-xl bg-secondary flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
              <StoreIcon className="h-3.5 w-3.5 text-muted-foreground" /> {app.name}
            </h3>
            {app.genre && <Badge variant="outline" className="text-[10px]">{app.genre}</Badge>}
            <OriginBadge origin="user" short />
          </div>
          <p className="text-xs text-muted-foreground truncate">{app.developer}</p>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
            {app.rating > 0 && <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-star text-star" />{app.rating.toFixed(1)}{app.ratingCount > 0 && ` (${app.ratingCount.toLocaleString("pt-BR")})`}</span>}
            <span className="font-mono text-[10px] truncate max-w-[200px]" title={app.id}>{app.id}</span>
            <FreshnessBadge collectedAt={entry.collectedAt ?? 0} />
            <span className="inline-flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{reviews.length} reviews</span>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/app/${app.store}/${app.id}`)} title="Ver detalhes" aria-label="Ver detalhes" className="h-8 w-8 text-muted-foreground hover:text-primary">
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onRemove} title="Remover" aria-label={`Remover ${app.name}`} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40" role="tablist" aria-label="Visualização dos dados">
        {([
          { key: "fields" as const, label: "Metadados", icon: Tag },
          { key: "reviews" as const, label: `Reviews (${reviews.length})`, icon: MessageSquare },
          { key: "raw" as const, label: "JSON bruto", icon: Code2 },
          { key: "ai" as const, label: "IA", icon: Sparkles },
        ]).map(t => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} aria-controls={`panel-${app.id}-${t.key}`} id={`tab-${app.id}-${t.key}`} onClick={() => setTab(t.key)}
            className={cn("flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-3.5 w-3.5" aria-hidden="true" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4" role="tabpanel" id={`panel-${app.id}-${tab}`} aria-labelledby={`tab-${app.id}-${tab}`}>
        {tab === "fields" && <FieldsTab app={app} metaEntries={metaEntries} />}
        {tab === "reviews" && (
          <ReviewsTab
            reviews={reviews}
            filtered={filteredReviews}
            reviewSearch={reviewSearch}
            setReviewSearch={setReviewSearch}
            reviewRating={reviewRating}
            setReviewRating={setReviewRating}
          />
        )}
        {tab === "raw" && <RawTab app={app} reviews={reviews} />}
        {tab === "ai" && <AITab entry={entry} />}
      </div>
    </article>
  );
}

/**
 * AI tab per app in the Data Explorer. Lets the user ask questions about the
 * RAW data of this specific app — all metadata fields + every review (no
 * sampling) are sent to the model via streamExperimentChat (section "custom").
 *
 * Conversation history is kept in-component (per app card). Quick suggestions
 * cover the most common questions over raw data. Output is rendered markdown.
 */
function AITab({ entry }: { entry: DatasetEntry }) {
  const ai = useAISettings();
  const enabled = isAIEnabled(ai);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading || !enabled) return;
    setError("");
    const next: ChatMessage[] = [...messages, { role: "user", content: q }, { role: "assistant", content: "" }];
    setMessages(next);
    setInput("");
    setLoading(true);
    await streamExperimentChat(
      [entry],
      // Send only up to (and including) the user message; the trailing empty
      // assistant placeholder is for local display only.
      next.slice(0, -1),
      {
        onToken: (full) => {
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: full };
            return copy;
          });
        },
        onDone: (full) => {
          setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: full };
            return copy;
          });
        },
        onError: (err) => setError(err),
      },
    );
    setLoading(false);
  };

  const suggestions = [
    "Resuma os principais pontos positivos e negativos",
    "Quais problemas mais recorrentes os usuários relatam?",
    "Há padrões por versão do app?",
    "Gere um relatório executivo com recomendações",
  ];

  if (!enabled) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-secondary/30 p-4 space-y-2">
        <p className="text-[11px] text-muted-foreground text-center">
          Pergunte à IA sobre os dados brutos deste app (metadados + todos os {entry.reviews.length} reviews).
        </p>
        <AIDisabledNotice />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-secondary/40 border border-border/40 p-2.5">
        <p className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
          <Wand2 className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
          A IA tem acesso aos <strong>dados brutos</strong> deste app: todos os metadados e os {entry.reviews.length} reviews completos (sem amostragem). Pergunte qualquer coisa.
        </p>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button key={s} onClick={() => send(s)}
              className="text-[11px] px-2.5 py-1.5 rounded-full bg-secondary hover:bg-primary/10 hover:text-primary text-secondary-foreground transition-colors border border-border/40">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[88%] rounded-lg px-3 py-2 text-xs leading-relaxed",
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground")}>
              {m.role === "assistant"
                ? <AIOutputCard bare content={m.content} filename={`dados-${i}`} storageKey={`dados-${i}`} />
                : m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-secondary text-secondary-foreground flex items-center gap-1.5 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" /> Analisando dados brutos…
            </div>
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            ⚠️ {error}
          </div>
        )}
      </div>

      <div className="flex items-end gap-1.5 border-t border-border/40 pt-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          placeholder="Pergunte sobre os dados brutos deste app…"
          rows={1}
          className="flex-1 min-h-[40px] max-h-28 text-xs px-2.5 py-2 rounded-lg bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
        />
        <Button size="icon" onClick={() => send(input)} disabled={!enabled || loading || !input.trim()} className="h-9 w-9 shrink-0" aria-label="Enviar pergunta">
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function FieldsTab({ app, metaEntries }: { app: AppInfo; metaEntries: [string, string][] }) {
  return (
    <div className="space-y-4">
      {app.description && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Descrição</p>
          <p className="text-xs text-foreground/90 whitespace-pre-line line-clamp-6">{app.description}</p>
        </div>
      )}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
        <Field label="Loja" value={app.store === "apple" ? "App Store" : "Google Play"} />
        <Field label="ID" value={app.id} mono />
        <Field label="Desenvolvedor" value={app.developer} />
        <Field label="Nota" value={app.rating > 0 ? `${app.rating.toFixed(1)} / 5` : "—"} />
        <Field label="Contagem de notas" value={app.ratingCount > 0 ? app.ratingCount.toLocaleString("pt-BR") : "—"} />
        <Field label="Preço" value={app.price || "—"} />
        <Field label="Gênero" value={app.genre || "—"} />
        <Field label="Versão" value={app.version || "—"} />
        <Field label="Lançamento" value={app.releaseDate ? new Date(app.releaseDate).toLocaleDateString("pt-BR") : "—"} />
        <Field label="Atualizado em" value={app.currentVersionReleaseDate ? new Date(app.currentVersionReleaseDate).toLocaleDateString("pt-BR") : "—"} />
        <Field label="Tamanho" value={app.size || "—"} />
        <Field label="SO mínimo" value={app.minimumOsVersion || "—"} />
        <Field label="Classificação" value={app.contentRating || "—"} />
        <Field label="Downloads" value={app.downloads || "—"} />
        <Field label="Vendedor" value={app.sellerName || "—"} />
        <Field label="Possui anúncios" value={app.containsAds ? "Sim" : app.containsAds === false ? "Não" : "—"} />
        <Field label="Oferece IAP" value={app.offersIAP ? "Sim" : app.offersIAP === false ? "Não" : "—"} />
        <Field label="Escolha dos editores" value={app.editorsChoice ? "Sim" : "—"} />
      </dl>

      {app.languages && app.languages.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Idiomas</p>
          <div className="flex flex-wrap gap-1">
            {app.languages.map(l => <Badge key={l} variant="secondary" className="text-[10px]">{l}</Badge>)}
          </div>
        </div>
      )}

      {app.screenshots && app.screenshots.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Screenshots ({app.screenshots.length})</p>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {app.screenshots.slice(0, 12).map((s, i) => (
              <img key={i} src={s} alt={`Screenshot ${i + 1}`} className="h-28 rounded-lg border border-border/40 flex-shrink-0" loading="lazy" />
            ))}
          </div>
        </div>
      )}

      {metaEntries.length > 0 && (
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Outros campos</p>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {metaEntries.map(([k, v]) => <Field key={k} label={k} value={v} mono />)}
          </dl>
        </div>
      )}

      {app.url && (
        <a href={app.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
          <ExternalLink className="h-3.5 w-3.5" /> Ver na loja
        </a>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</dt>
      <dd className={cn("text-xs text-foreground/90 truncate", mono && "font-mono text-[11px]")} title={value}>{value || "—"}</dd>
    </div>
  );
}

function ReviewsTab({
  reviews, filtered, reviewSearch, setReviewSearch, reviewRating, setReviewRating,
}: {
  reviews: ReviewEntry[];
  filtered: ReviewEntry[];
  reviewSearch: string;
  setReviewSearch: (v: string) => void;
  reviewRating: number | "all";
  setReviewRating: (v: number | "all") => void;
}) {
  const [limit, setLimit] = useState(25);
  if (reviews.length === 0) {
    return <p className="text-xs text-muted-foreground py-6 text-center">Nenhum review coletado para este app.</p>;
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={reviewSearch}
            onChange={(e) => setReviewSearch(e.target.value)}
            placeholder="Buscar nos reviews…"
            aria-label="Buscar nos reviews"
            className="w-full text-xs pl-8 pr-7 py-1.5 rounded-md bg-secondary text-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <div className="flex gap-1" role="group" aria-label="Filtrar por nota">
          <button onClick={() => setReviewRating("all")} aria-pressed={reviewRating === "all"}
            className={cn("text-[11px] px-2 py-1 rounded-md transition-colors", reviewRating === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70")}>
            Todas
          </button>
          {[5, 4, 3, 2, 1].map(n => (
            <button key={n} onClick={() => setReviewRating(n)} aria-pressed={reviewRating === n}
              className={cn("text-[11px] px-2 py-1 rounded-md inline-flex items-center gap-0.5 transition-colors", reviewRating === n ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70")}>
              <Star className="h-2.5 w-2.5" />{n}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">{filtered.length} de {reviews.length} reviews</p>

      <ol className="space-y-2">
        {filtered.slice(0, limit).map(r => <ReviewRow key={r.id} r={r} />)}
      </ol>

      {filtered.length > limit && (
        <Button variant="outline" size="sm" onClick={() => setLimit(l => l + 50)} className="w-full">
          Mostrar mais ({filtered.length - limit} restantes)
        </Button>
      )}
    </div>
  );
}

function ReviewRow({ r }: { r: ReviewEntry }) {
  return (
    <li className="rounded-lg border border-border/40 bg-background/40 p-3">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className="inline-flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={cn("h-3 w-3", i < r.rating ? "fill-star text-star" : "text-muted-foreground/30")} />
          ))}
        </span>
        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><User className="h-3 w-3" />{r.author || "Anônimo"}</span>
        {r.date && <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(r.date).toLocaleDateString("pt-BR")}</span>}
        {r.country && <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Globe className="h-3 w-3" />{r.country.toUpperCase()}</span>}
        {r.version && <Badge variant="outline" className="text-[10px]">v{r.version}</Badge>}
        {typeof r.thumbsUp === "number" && r.thumbsUp > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><ThumbsUp className="h-3 w-3" />{r.thumbsUp}</span>
        )}
      </div>
      {r.title && <p className="text-xs font-medium text-foreground mb-0.5">{r.title}</p>}
      <p className="text-xs text-foreground/80 whitespace-pre-line">{r.text || "(sem texto)"}</p>
      {r.developerReply && (
        <div className="mt-2 pl-3 border-l-2 border-primary/40 bg-primary/5 rounded-r-md py-1.5 px-2">
          <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">Resposta do desenvolvedor</p>
          <p className="text-xs text-foreground/80 whitespace-pre-line">{r.developerReply}</p>
        </div>
      )}
    </li>
  );
}

function RawTab({ app, reviews }: { app: AppInfo; reviews: ReviewEntry[] }) {
  const fullApp = useMemo(() => {
    const { raw, ...rest } = app;
    return rest;
  }, [app]);
  const appJson = useMemo(() => JSON.stringify(fullApp, null, 2), [fullApp]);
  const reviewsJson = useMemo(() => JSON.stringify(reviews, null, 2), [reviews]);
  return (
    <div className="space-y-3">
      <Panel
        title="App (JSON)"
        subtitle={`${Object.keys(fullApp).length} campos`}
        icon={<FileJson className="h-4 w-4" />}
        storageKey={`aso:rawapp-${app.store}-${app.id}`}
        defaultOpen
        actions={<CopyDownloadButtons content={appJson} filename={`app-${app.store}-${app.id}`} extension="json" />}
        contentClassName="p-3 font-mono"
      >
        <pre className="text-[10px] leading-relaxed text-foreground/80 overflow-x-auto">{appJson}</pre>
      </Panel>

      <Panel
        title="Reviews (JSON)"
        subtitle={`${reviews.length} reviews`}
        icon={<FileJson className="h-4 w-4" />}
        storageKey={`aso:rawreviews-${app.store}-${app.id}`}
        defaultOpen
        defaultHeight={360}
        actions={<CopyDownloadButtons content={reviewsJson} filename={`reviews-${app.store}-${app.id}`} extension="json" />}
        contentClassName="p-3 font-mono"
      >
        <pre className="text-[10px] leading-relaxed text-foreground/80 overflow-x-auto">{reviewsJson}</pre>
      </Panel>

      <p className="text-[11px] text-muted-foreground">
        O payload <code className="font-mono">raw</code> original da loja (se presente) está incluído no JSON do app acima quando expandido. Arraste a borda inferior para redimensionar a altura.
      </p>
    </div>
  );
}

// --- helpers ---
function csv(s: string): string {
  const v = s ?? "";
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
