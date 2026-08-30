import { useCallback, useMemo, useRef, useState } from "react";
import {
  Sparkles, Lightbulb, Reply, Trophy, Search, ChevronDown, ChevronRight,
  Loader2, Copy, Check, AlertCircle, Star, Download,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { downloadFile, useCopy } from "@/lib/pageFeatures";
import type { DatasetEntry } from "@/lib/datasetStore";
import { useCompare } from "@/context/CompareContext";
import { useSelection } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { computePerAppStats, computeWordCloud } from "@/lib/dashboardAnalytics";
import { useDataset as useDatasetEntries } from "@/hooks/useDataset";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ------------------------------------------- dataset subscription hook --- */
function useDataset(): DatasetEntry[] {
  return useDatasetEntries().entries;
}

// useCopy vem de @/lib/pageFeatures (copiedKey/copy com fallback de clipboard).

function IdeaCard({
  id, icon: Icon, title, tagline, badge, defaultOpen, children,
}: {
  id: string;
  icon: typeof Sparkles;
  title: string;
  tagline: string;
  badge?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-secondary/40 transition-colors"
        aria-expanded={open}
        aria-controls={`idea-${id}`}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
          <Icon className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
            {badge && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">{badge}</span>}
          </div>
          <p className="text-xs text-muted-foreground truncate">{tagline}</p>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && (
        <div id={`idea-${id}`} className="px-4 pb-4 pt-1 border-t border-border/40 anim-fade-in">
          {children}
        </div>
      )}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <AlertCircle className="h-5 w-5 text-muted-foreground" />
      <p className="text-xs text-muted-foreground max-w-sm">{children}</p>
    </div>
  );
}

/* ============================================================= PROTÓTIPO 1 */
/* Gerador de Resposta a Review — IA escreve resposta profissional a um review. */
function ReviewReplyGenerator() {
  const dataset = useDataset();
  const { copy, copiedKey: copied } = useCopy();
  const [appId, setAppId] = useState<string>("");
  const [reviewIdx, setReviewIdx] = useState(0);
  const [tone, setTone] = useState<"profissional" | "empatico" | "leve" | "tecnico">("profissional");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const ai = useAISettings();

  const entries = useMemo(() => dataset.filter((e) => e.reviews.length > 0), [dataset]);
  const selected = useMemo(() => entries.find((e) => `${e.app.store}:${e.app.id}` === appId), [entries, appId]);
  const reviews = selected?.reviews ?? [];
  const review = reviews[reviewIdx];

  const generate = useCallback(async () => {
    if (!review || !selected) return;
    if (!isAIEnabled(ai)) { setError("Ative a IA em Configurações → Inteligência Artificial para gerar respostas."); return; }
    setLoading(true); setError(""); setReply("");
    const ac = new AbortController(); abortRef.current = ac;
    const sys = `Você é especialista em atendimento e resposta a reviews de apps. Escreva uma resposta ${tone} do desenvolvedor ao review abaixo. Seja específico ao problema relatado, agradeça o feedback, e quando aplicável mencione uma ação concreta. Máx. 120 palavras. Não invente fatos não presentes no review.`;
    const user = `App: ${selected.app.name} (${selected.app.store}).\nReview ★${review.rating} de ${review.author || "anônimo"}:\n"${review.title || ""} ${review.text || ""}"`;
    const messages: ChatMessage[] = [
      { role: "user", content: `${sys}\n\n${user}` },
    ];
    await streamExperimentChat(
      [{ app: selected.app, reviews: [review], collectedAt: selected.collectedAt }],
      messages,
      { onToken: setReply, onDone: setReply, onError: setError },
      ac.signal, ai,
    );
    setLoading(false);
  }, [review, selected, tone, ai]);

  if (entries.length === 0)
    return <EmptyHint>Colete ao menos um app com reviews (aba “Apps” → buscar e coletar) para testar o gerador de respostas.</EmptyHint>;

  return (
    <div className="grid gap-4 md:grid-cols-2 pt-3">
      <div className="space-y-3">
        <label className="block text-xs font-medium text-muted-foreground">App</label>
        <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={appId} onChange={(e) => { setAppId(e.target.value); setReviewIdx(0); setReply(""); }}>
          <option value="">Selecione um app…</option>
          {entries.map((e) => <option key={`${e.app.store}:${e.app.id}`} value={`${e.app.store}:${e.app.id}`}>{e.app.name} · {e.app.store} · {e.reviews.length} reviews</option>)}
        </select>

        {selected && reviews.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Review ({reviewIdx + 1}/{reviews.length})</label>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={reviewIdx === 0} onClick={() => { setReviewIdx((i) => Math.max(0, i - 1)); setReply(""); }}>←</Button>
                <Button size="sm" variant="ghost" disabled={reviewIdx >= reviews.length - 1} onClick={() => { setReviewIdx((i) => Math.min(reviews.length - 1, i + 1)); setReply(""); }}>→</Button>
              </div>
            </div>
            {review && (
              <div className="rounded-lg border border-border/60 bg-muted/40 p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5 text-amber-500">{Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("h-3 w-3", i < review.rating ? "fill-current" : "opacity-30")} />)}</span>
                  <span className="text-[11px] text-muted-foreground">{review.author || "anônimo"}</span>
                </div>
                {review.title && <p className="text-xs font-semibold">{review.title}</p>}
                <p className="text-xs text-muted-foreground line-clamp-4">{review.text}</p>
              </div>
            )}
            <label className="block text-xs font-medium text-muted-foreground">Tom da resposta</label>
            <div className="flex flex-wrap gap-1.5">
              {(["profissional", "empatico", "leve", "tecnico"] as const).map((t) => (
                <button key={t} onClick={() => setTone(t)} className={cn("px-2.5 py-1 rounded-full text-[11px] border transition-colors", tone === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary")}>{t}</button>
              ))}
            </div>
            <Button onClick={generate} disabled={loading || !review} className="w-full gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Gerando…" : "Gerar resposta"}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Resposta sugerida</label>
        <div className="min-h-[180px] rounded-lg border border-border/60 bg-background p-3">
          {reply ? (
            <AIOutputCard
              bare
              content={reply}
              filename="resposta-review"
              storageKey="playground-reply"
              onRegenerate={loading || !review ? undefined : () => void generate()}
            />
          ) : loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Gerando resposta…</div>
          ) : (
            <p className="text-xs text-muted-foreground italic">A resposta aparecerá aqui. Use o botão acima para gerar.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================= PROTÓTIPO 2 */
/* Score Competitivo (Benchmark) — ranking comparativo de apps do dataset. */
function CompetitiveBenchmark() {
  const dataset = useDataset();
  const stats = useMemo(() => computePerAppStats(dataset), [dataset]);
  const [metric, setMetric] = useState<"avgCollected" | "positivePct" | "reviewCount" | "negativePct">("positivePct");

  if (stats.length < 1)
    return <EmptyHint>Colete ao menos um app para montar o ranking competitivo. Quanto mais apps (próprios + concorrentes), mais útil o benchmark.</EmptyHint>;

  const sorted = [...stats].sort((a, b) => {
    const va = a[metric] as number, vb = b[metric] as number;
    return metric === "negativePct" ? va - vb : vb - va;
  });
  const max = Math.max(...sorted.map((s) => s[metric] as number)) || 1;
  const medal = ["🥇", "🥈", "🥉"];

  const fmt = (v: number) => metric === "reviewCount" ? `${v}` : metric.endsWith("Pct") ? `${v}%` : v.toFixed(2);

  return (
    <div className="pt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">Ordenar por:</span>
        {([
          ["positivePct", "% positivos"], ["negativePct", "% negativos"], ["avgCollected", "Nota coletada"], ["reviewCount", "Volume"],
        ] as const).map(([k, label]) => (
          <button key={k} onClick={() => setMetric(k)} className={cn("px-2.5 py-1 rounded-full text-[11px] border transition-colors", metric === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary")}>{label}</button>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map((s, i) => (
          <div key={s.key} className="flex items-center gap-3 rounded-lg border border-border/60 bg-card p-3">
            <span className="w-6 text-center text-base shrink-0">{medal[i] ?? `#${i + 1}`}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {s.icon && <img src={s.icon} alt="" className="h-4 w-4 rounded" />}
                <span className="text-sm font-medium truncate">{s.name}</span>
                <span className="text-[10px] text-muted-foreground uppercase">{s.store}</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((s[metric] as number) / max) * 100}%` }} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-semibold">{fmt(s[metric] as number)}</div>
              <div className="text-[10px] text-muted-foreground">{s.reviewCount} reviews</div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground italic">
        Ranking instantâneo dos apps no seu dataset. Colete concorrentes para benchmark de mercado.
      </p>
    </div>
  );
}

/* ============================================================= PROTÓTIPO 3 */
/* Extrator de Temas & Keywords ASO — nuvem + keywords sugeridas. */
function ASOKeywordExtractor() {
  const dataset = useDataset();
  const { selected } = useSelection();
  const { copy, copiedKey: copied } = useCopy();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const ai = useAISettings();

  const effective = useMemo(() => {
    if (dataset.length === 0) return [];
    if (selected.size === 0) return dataset;
    return dataset.filter((e) => selected.has(`${e.app.store}:${e.app.id}`));
  }, [dataset, selected]);

  const allReviews = useMemo(() => effective.flatMap((e) => e.reviews), [effective]);
  const cloud = useMemo(() => computeWordCloud(allReviews, 30), [allReviews]);
  const maxFreq = cloud[0]?.[1] || 1;

  const suggest = useCallback(async () => {
    if (effective.length === 0) return;
    if (!isAIEnabled(ai)) { setError("Ative a IA em Configurações para sugerir keywords."); return; }
    setLoading(true); setError(""); setKeywords([]);
    const ac = new AbortController(); abortRef.current = ac;
    const topTerms = cloud.slice(0, 20).map(([w, n]) => `${w}(${n})`).join(", ");
    const msgs: ChatMessage[] = [{
      role: "user",
      content: `Com base nestes termos frequentes dos reviews coletados de ${effective.length} app(s): ${topTerms}. Sugira 15 keywords de ASO (App Store Optimization) em português que poderiam ser usadas no título/subtítulo/lista de keywords. Retorne apenas uma lista numerada, uma keyword por linha, sem comentários.`,
    }];
    let raw = "";
    const clean = (t: string) => t.split("\n").map((l) => l.replace(/^\d+[.)]\s*/, "").trim()).filter((l) => l.length > 1 && !l.startsWith("```"));
    await streamExperimentChat(effective, msgs, {
      onToken: (t) => { raw = t; setKeywords(clean(raw)); },
      onDone: (t) => setKeywords(clean(t)),
      onError: setError,
    }, ac.signal, ai);
    setLoading(false);
  }, [effective, cloud, ai]);

  if (dataset.length === 0)
    return <EmptyHint>Colete ao menos um app com reviews para extrair temas e keywords de ASO.</EmptyHint>;

  return (
    <div className="pt-3 grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Nuvem de termos ({effective.length} app{effective.length !== 1 ? "s" : ""} selecionado{effective.length !== 1 ? "s" : ""})</label>
        <div className="rounded-lg border border-border/60 bg-card p-4 flex flex-wrap gap-2 items-center justify-center min-h-[160px]">
          {cloud.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem termos suficientes.</p>
          ) : cloud.map(([word, freq]) => (
            <span key={word} className="font-medium text-foreground/80" style={{ fontSize: `${0.7 + (freq / maxFreq) * 0.9}rem`, opacity: 0.5 + (freq / maxFreq) * 0.5 }}>
              {word}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Keywords de ASO sugeridas (IA)</label>
          <div className="flex items-center gap-0.5">
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" disabled={keywords.length === 0 || loading} onClick={() => copy("kw", keywords.join("\n"))}>
              {copied === "kw" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Copiar
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px]" disabled={keywords.length === 0 || loading}
              onClick={() => {
                const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "");
                downloadFile(`keywords-aso_${stamp}.md`, keywords.map((k, i) => `${i + 1}. ${k}`).join("\n"), "text/markdown");
              }}
              title="Baixar keywords (.md)"
              aria-label="Baixar keywords markdown"
            >
              <Download className="h-3 w-3" /> Baixar
            </Button>
          </div>
        </div>
        <Button onClick={suggest} disabled={loading} className="w-full gap-1.5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? "Analisando…" : "Sugerir keywords com IA"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="rounded-lg border border-border/60 bg-background p-3 min-h-[120px]">
          {keywords.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {keywords.map((k, i) => (
                <li key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{k}</li>
              ))}
            </ul>
          ) : loading ? (
            <p className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Gerando…</p>
          ) : (
            <p className="text-xs text-muted-foreground italic">Clique em “Sugerir keywords” para a IA propor 15 keywords de ASO com base nos termos frequentes.</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* =================================================================== PAGE */
export default function Playground({ embedded = false }: { embedded?: boolean }) {
  const { setPickerOpen } = useCompare();
  const ideas = [
    { id: "reply", icon: Reply, title: "Gerador de resposta a review", tagline: "IA escreve uma resposta profissional a qualquer review coletado — útil para gestão de comunidade e agências.", badge: "IA", defaultOpen: true },
    { id: "benchmark", icon: Trophy, title: "Score competitivo (Benchmark)", tagline: "Ranking instantâneo dos apps do dataset por nota, % positivos, volume ou % negativos — compare-se aos concorrentes.", badge: "novo" },
    { id: "aso", icon: Search, title: "Extrator de temas & keywords ASO", tagline: "Nuvem de termos dos reviews + keywords de ASO sugeridas pela IA — para otimização de loja e marketing.", badge: "IA" },
  ];

  return (
    <div className="h-full flex flex-col bg-background">
      {!embedded && (
        <AppHeader
          title="Playground"
          crumb="laboratório de ideias"
          compare={{ count: 0, onOpen: () => setPickerOpen(true) }}
        />
      )}
      <div className="flex-1 overflow-y-auto content-fluid py-6 w-full">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-bold">Playground de ideias</h2>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium">{ideas.length} protótipos</span>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Protótipos funcionais de funcionalidades em teste. Cada um usa os dados coletados no
            seu dataset local (e a IA quando preciso). Teste, refine e nos diga quais viram produto.
          </p>
        </div>

        <div className="space-y-3">
          {ideas.map((idea) => (
            <IdeaCard key={idea.id} id={idea.id} icon={idea.icon} title={idea.title} tagline={idea.tagline} badge={idea.badge} defaultOpen={idea.defaultOpen}>
              {idea.id === "reply" && <ReviewReplyGenerator />}
              {idea.id === "benchmark" && <CompetitiveBenchmark />}
              {idea.id === "aso" && <ASOKeywordExtractor />}
            </IdeaCard>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Sua ideia não está aqui? Use a aba “Chat” e descreva o que gostaria de testar.
        </p>
      </div>
    </div>
  );
}
