import { useEffect, useMemo, useRef, useState } from "react";
import { confirmDestructive } from "@/lib/ux";
import {
  Presentation, Plus, Trash2, Copy, ChevronUp, ChevronDown, Play,
  FileDown, Sparkles, X, Type, List, Table2,
  BarChart3, MessageSquareQuote, Gauge, LayoutTemplate, Loader2,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { SlideView } from "@/components/presentations/SlideView";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import {
  listDecks, saveDeck, deleteDeck, newDeck, subscribePresentations,
  addSlide, updateSlide, removeSlide, duplicateSlide, moveSlide,
  buildDatasetDeck, markdownToSlides, buildDeckPrompt,
  deckToMarkdown, deckToHTML, getTheme, DECK_THEMES,
  type Deck, type Slide, type SlideType, type DeckThemeId,
} from "@/lib/presentations";

const SLIDE_TYPES: { id: SlideType; label: string; icon: typeof Type }[] = [
  { id: "title", label: "Capa", icon: LayoutTemplate },
  { id: "section", label: "Seção", icon: Type },
  { id: "bullets", label: "Bullets", icon: List },
  { id: "text", label: "Texto", icon: Type },
  { id: "kpis", label: "KPIs", icon: Gauge },
  { id: "chart", label: "Gráfico", icon: BarChart3 },
  { id: "quotes", label: "Citações", icon: MessageSquareQuote },
  { id: "table", label: "Tabela", icon: Table2 },
];

const SLIDE_TYPE_LABEL: Record<SlideType, string> = Object.fromEntries(
  SLIDE_TYPES.map((t) => [t.id, t.label]),
) as Record<SlideType, string>;

export default function Presentations({ embedded = false }: { embedded?: boolean }) {
  const { entries } = useDataset();
  const { selected } = useSelection();
  const ai = useAISettings();
  const [decks, setDecks] = useState<Deck[]>(() => listDecks());
  const [deckId, setDeckId] = useState<string | null>(() => listDecks()[0]?.id ?? null);
  const [selSlideId, setSelSlideId] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [aiTopic, setAiTopic] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => subscribePresentations(() => setDecks(listDecks())), []);

  const deck = decks.find((d) => d.id === deckId) ?? null;
  const selSlide = deck?.slides.find((s) => s.id === selSlideId) ?? deck?.slides[0] ?? null;

  // Escopo: apps selecionados globalmente; vazio = dataset inteiro.
  const scopedEntries = useMemo(
    () => (selected.size > 0
      ? entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)))
      : entries),
    [entries, selected],
  );

  const theme = getTheme(deck?.theme ?? "midnight");

  const mutate = (fn: (d: Deck) => Deck) => {
    if (!deck) return;
    saveDeck(fn(deck));
  };

  const createDeck = () => {
    const d = newDeck(`Apresentação ${new Date().toLocaleDateString("pt-BR")}`);
    saveDeck(d);
    setDeckId(d.id);
    setSelSlideId(null);
  };

  const createFromDataset = () => {
    if (scopedEntries.length === 0) {
      setAiMsg("Colete apps primeiro (sidebar esquerda → Apps) para gerar um deck do dataset.");
      return;
    }
    const d = buildDatasetDeck(scopedEntries, "Análise de reviews");
    saveDeck(d);
    setDeckId(d.id);
    setSelSlideId(null);
    setAiMsg(null);
  };

  const generateWithAI = async () => {
    if (!isAIEnabled(ai)) {
      setAiMsg("Ative a IA em Configurações → Inteligência Artificial para gerar com IA.");
      return;
    }
    if (scopedEntries.length === 0) {
      setAiMsg("Colete apps primeiro para a IA ter dados para a apresentação.");
      return;
    }
    setAiBusy(true);
    setAiMsg("Gerando narrativa com IA…");
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    let acc = "";
    await streamExperimentChat(
      scopedEntries,
      [{ role: "user", content: buildDeckPrompt(scopedEntries, aiTopic.trim()) }],
      {
        onToken: (full) => { acc = full; setAiMsg(`Gerando… ${acc.length} chars`); },
        onDone: (full) => {
          const slides = markdownToSlides(full);
          if (slides.length === 0) {
            setAiMsg("A IA não retornou blocos de slide — tente novamente.");
          } else {
            const d = deck ?? newDeck(aiTopic.trim() || "Apresentação IA");
            if (aiTopic.trim() && d.title === "Apresentação sem título") d.title = aiTopic.trim();
            // Substitui: capa existente (se houver) + slides gerados.
            const cover = d.slides.find((s) => s.type === "title");
            const final: Deck = { ...d, slides: [...(cover ? [cover] : []), ...slides] };
            saveDeck(final);
            setDeckId(final.id);
            setAiMsg(`Deck gerado com ${slides.length} slides de IA.`);
          }
          setAiBusy(false);
        },
        onError: (err) => { setAiMsg(`Erro: ${err}`); setAiBusy(false); },
      },
      abortRef.current.signal,
      ai,
      "custom",
    );
  };

  const exportDeck = (format: "html" | "md") => {
    if (!deck) return;
    const content = format === "html" ? deckToHTML(deck, scopedEntries) : deckToMarkdown(deck);
    const blob = new Blob([content], { type: format === "html" ? "text/html" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "apresentacao"}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Navegação do modo apresentar.
  useEffect(() => {
    if (!presenting || !deck) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresenting(false);
      if (["ArrowRight", " ", "PageDown"].includes(e.key)) {
        e.preventDefault();
        setPresentIndex((i) => Math.min(deck.slides.length - 1, i + 1));
      }
      if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        setPresentIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "Home") setPresentIndex(0);
      if (e.key === "End") setPresentIndex(deck.slides.length - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, deck]);

  return (
    <div className="h-full flex flex-col">
      {!embedded && (
        <AppHeader
          title="Apresentações"
          crumb={deck ? `${deck.title} · ${deck.slides.length} slides` : "Gere decks profissionais do seu dataset"}
        />
      )}

      <div className="flex-1 min-h-0 flex">
        {/* Rail de decks + slides */}
        <div className="w-64 shrink-0 border-r border-border/60 flex flex-col min-h-0">
          <div className="p-3 border-b border-border/60 space-y-2">
            <div className="flex items-center gap-1.5">
              <Presentation className="h-4 w-4 text-primary" aria-hidden />
              <p className="text-xs font-semibold flex-1">Decks</p>
              <button onClick={createDeck} className="p-1.5 rounded-md hover:bg-secondary" aria-label="Novo deck em branco" title="Novo deck em branco">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={createFromDataset}
              className="w-full text-[11px] px-2 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Gerar deck do dataset ({scopedEntries.length} apps)
            </button>
            {decks.length > 1 && (
              <select
                value={deckId ?? ""}
                onChange={(e) => { setDeckId(e.target.value); setSelSlideId(null); }}
                aria-label="Selecionar deck"
                className="w-full text-[11px] px-2 py-1 rounded-md bg-secondary border border-border/50"
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1" role="listbox" aria-label="Slides do deck">
            {deck?.slides.map((s, i) => (
              <button
                key={s.id}
                role="option"
                aria-selected={selSlide?.id === s.id}
                onClick={() => setSelSlideId(s.id)}
                className={`w-full text-left rounded-md border px-2 py-1.5 transition-colors ${
                  selSlide?.id === s.id ? "border-primary bg-primary/5" : "border-border/60 hover:bg-secondary/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono text-muted-foreground w-5 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[10px] font-medium truncate flex-1">{s.title || "(sem título)"}</span>
                </div>
                <p className="text-[9px] text-muted-foreground ml-6">{SLIDE_TYPE_LABEL[s.type]}{s.chart ? ` · ${s.chart}` : ""}</p>
              </button>
            ))}
            {deck && deck.slides.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-4">Deck vazio — adicione slides abaixo.</p>
            )}
          </div>
        </div>

        {/* Centro: preview + editor */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          {deck && selSlide ? (
            <>
              {/* Toolbar do deck */}
              <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border/60">
                <input
                  value={deck.title}
                  onChange={(e) => mutate((d) => ({ ...d, title: e.target.value }))}
                  aria-label="Título do deck"
                  className="text-xs font-medium bg-transparent border-b border-transparent focus:border-primary/50 focus:outline-none px-1 py-0.5 min-w-[160px]"
                />
                <div className="flex items-center gap-1" role="group" aria-label="Tema do deck">
                  {DECK_THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => mutate((d) => ({ ...d, theme: t.id as DeckThemeId }))}
                      aria-label={`Tema ${t.label}`}
                      aria-pressed={deck.theme === t.id}
                      title={t.label}
                      className={`w-5 h-5 rounded-full border-2 transition-transform ${deck.theme === t.id ? "border-foreground scale-110" : "border-border/60"}`}
                      style={{ background: t.bg, boxShadow: `inset 0 0 0 6px ${t.bg}, inset 0 0 0 8px ${t.accent}` }}
                    />
                  ))}
                </div>
                <div className="flex-1" />
                <button
                  onClick={() => { setPresentIndex(Math.max(0, deck.slides.findIndex((s) => s.id === selSlide.id))); setPresenting(true); }}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                >
                  <Play className="h-3 w-3" aria-hidden /> Apresentar
                </button>
                <button onClick={() => exportDeck("html")} className="inline-flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-md bg-secondary hover:bg-secondary/80" title="Exporta HTML autocontido (apresentável offline)">
                  <FileDown className="h-3 w-3" aria-hidden /> HTML
                </button>
                <button onClick={() => exportDeck("md")} className="inline-flex items-center gap-1 text-[11px] px-2 py-1.5 rounded-md bg-secondary hover:bg-secondary/80" title="Exporta markdown">
                  <FileDown className="h-3 w-3" aria-hidden /> MD
                </button>
                <button
                  onClick={() => { if (confirmDestructive(`Excluir o deck "${deck.title}"?`, `${deck.slides.length} slide(s).`)) { deleteDeck(deck.id); setDeckId(listDecks().filter((d) => d.id !== deck.id)[0]?.id ?? null); } }}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"
                  aria-label="Excluir deck"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Preview 16:9 */}
              <div className="flex-1 min-h-0 p-4 flex items-center justify-center bg-secondary/20">
                <div className="w-full max-w-4xl rounded-lg overflow-hidden shadow-2xl border border-border/60" style={{ aspectRatio: "16/9" }}>
                  <SlideView slide={selSlide} theme={theme} entries={scopedEntries} index={deck.slides.findIndex((s) => s.id === selSlide.id)} total={deck.slides.length} />
                </div>
              </div>

              {/* Editor do slide */}
              <div className="border-t border-border/60 p-3 grid grid-cols-[1fr_1fr] gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={selSlide.type}
                      onChange={(e) => mutate((d) => updateSlide(d, selSlide.id, { type: e.target.value as SlideType }))}
                      aria-label="Tipo do slide"
                      className="text-[11px] px-2 py-1 rounded-md bg-secondary border border-border/50"
                    >
                      {SLIDE_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    {selSlide.type === "chart" && (
                      <select
                        value={selSlide.chart ?? "rating"}
                        onChange={(e) => mutate((d) => updateSlide(d, selSlide.id, { chart: e.target.value as Slide["chart"] }))}
                        aria-label="Tipo do gráfico"
                        className="text-[11px] px-2 py-1 rounded-md bg-secondary border border-border/50"
                      >
                        <option value="rating">Distribuição de notas</option>
                        <option value="sentiment">Sentimento</option>
                        <option value="store">Lojas</option>
                        <option value="wordcloud">Word cloud</option>
                      </select>
                    )}
                    <div className="flex-1" />
                    <button onClick={() => mutate((d) => duplicateSlide(d, selSlide.id))} className="p-1.5 rounded-md hover:bg-secondary" aria-label="Duplicar slide"><Copy className="h-3.5 w-3.5" /></button>
                    <button onClick={() => mutate((d) => moveSlide(d, selSlide.id, -1))} className="p-1.5 rounded-md hover:bg-secondary" aria-label="Mover slide para cima"><ChevronUp className="h-3.5 w-3.5" /></button>
                    <button onClick={() => mutate((d) => moveSlide(d, selSlide.id, 1))} className="p-1.5 rounded-md hover:bg-secondary" aria-label="Mover slide para baixo"><ChevronDown className="h-3.5 w-3.5" /></button>
                    <button onClick={() => mutate((d) => removeSlide(d, selSlide.id))} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" aria-label="Remover slide"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <input
                    value={selSlide.title}
                    onChange={(e) => mutate((d) => updateSlide(d, selSlide.id, { title: e.target.value }))}
                    placeholder="Título do slide"
                    aria-label="Título do slide"
                    className="w-full text-xs px-2 py-1.5 rounded-md bg-secondary border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                  <input
                    value={selSlide.subtitle ?? ""}
                    onChange={(e) => mutate((d) => updateSlide(d, selSlide.id, { subtitle: e.target.value }))}
                    placeholder="Subtítulo (capa/seção)"
                    aria-label="Subtítulo do slide"
                    className="w-full text-xs px-2 py-1.5 rounded-md bg-secondary border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
                  />
                </div>
                <div className="space-y-2">
                  <textarea
                    value={selSlide.body ?? ""}
                    onChange={(e) => mutate((d) => updateSlide(d, selSlide.id, { body: e.target.value }))}
                    placeholder={selSlide.type === "bullets" || selSlide.type === "quotes" ? "Um item por linha…" : "Conteúdo…"}
                    aria-label="Conteúdo do slide"
                    rows={3}
                    className="w-full text-xs px-2 py-1.5 rounded-md bg-secondary border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-y"
                  />
                  <div className="flex flex-wrap gap-1">
                    {SLIDE_TYPES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => mutate((d) => addSlide(d, { type: t.id, title: t.label }))}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80"
                        title={`Adicionar slide ${t.label}`}
                      >
                        <t.icon className="h-3 w-3" aria-hidden /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <EmptyState
                icon={Presentation}
                title="Crie sua primeira apresentação"
                description="Gere um deck pronto a partir do dataset coletado ou monte slide a slide. Exporte como HTML apresentável ou markdown."
                action={
                  <button
                    onClick={createDeck}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Novo deck
                  </button>
                }
              />
            </div>
          )}
        </div>

        {/* Coluna IA */}
        <div className="w-72 shrink-0 border-l border-border/60 p-3 flex flex-col gap-2 overflow-y-auto">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <p className="text-xs font-semibold">Gerar com IA</p>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            A IA escreve a narrativa dos slides a partir dos reviews dos apps
            selecionados (seleção vazia = todo o dataset). Gráficos/KPIs/tabelas
            continuam 100% determinísticos.
          </p>
          <input
            value={aiTopic}
            onChange={(e) => setAiTopic(e.target.value)}
            placeholder="Tema (opcional): ex. 'revisão trimestral do app'"
            aria-label="Tema da apresentação"
            className="text-[11px] px-2 py-1.5 rounded-md bg-secondary border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <button
            onClick={generateWithAI}
            disabled={aiBusy}
            className="inline-flex items-center justify-center gap-1.5 text-[11px] px-2 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            {aiBusy ? "Gerando…" : "Gerar narrativa com IA"}
          </button>
          {aiBusy && (
            <button onClick={() => { abortRef.current?.abort(); setAiBusy(false); setAiMsg("Geração interrompida."); }} className="text-[10px] text-muted-foreground hover:text-foreground">
              Interromper
            </button>
          )}
          {aiMsg && <p className="text-[10px] text-muted-foreground" role="status">{aiMsg}</p>}
          <div className="mt-auto text-[10px] text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
            <p className="font-medium text-foreground mb-1">Como apresentar</p>
            <p>Clique em <strong>Apresentar</strong>: ←/→/Espaço navega, Esc sai. O HTML exportado abre em qualquer navegador, sem conexão.</p>
          </div>
        </div>
      </div>

      {/* Modo apresentar (overlay fullscreen) */}
      {presenting && deck && (
        <div
          className="fixed inset-0 z-[90]"
          role="dialog"
          aria-modal="true"
          aria-label="Modo apresentação"
          onClick={() => setPresentIndex((i) => Math.min(deck.slides.length - 1, i + 1))}
        >
          {deck.slides.length > 0 && (
            <SlideView
              slide={deck.slides[Math.min(presentIndex, deck.slides.length - 1)]}
              theme={theme}
              entries={scopedEntries}
              index={Math.min(presentIndex, deck.slides.length - 1)}
              total={deck.slides.length}
            />
          )}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
            <div
              className="h-full transition-all"
              style={{ width: `${((presentIndex + 1) / Math.max(1, deck.slides.length)) * 100}%`, background: theme.accent }}
            />
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setPresenting(false); }}
            className="absolute top-3 right-4 p-2 rounded-full bg-black/40 text-white hover:bg-black/60"
            aria-label="Sair da apresentação"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
