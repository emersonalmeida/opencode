import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Presentation, FileDown, CheckCircle2, RotateCcw, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { buildDatasetDeck, saveDeck, deckToHTML, deckToMarkdown, getDeck, type Deck } from "@/lib/presentations";
import { EmptyState } from "@/components/shared/EmptyState";
import type { DatasetEntry } from "@/lib/datasetStore";

/**
 * Etapa 6 — Apresentar: gera um deck profissional do resultado da jornada
 * (determinístico; editável depois em /apresentacoes) e exporta.
 */
export function StagePresent({ scoped, onRestart }: { scoped: DatasetEntry[]; onRestart: () => void }) {
  const navigate = useNavigate();
  const [deckId, setDeckId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const generate = (): Deck => {
    const deck = buildDatasetDeck(scoped, "Jornada de análise de reviews");
    saveDeck(deck);
    setDeckId(deck.id);
    setMsg(`Deck com ${deck.slides.length} slides criado.`);
    return deck;
  };

  const exportDeck = (format: "html" | "md") => {
    const deck = (deckId && getDeck(deckId)) || generate();
    const content = format === "html" ? deckToHTML(deck, scoped) : deckToMarkdown(deck);
    const blob = new Blob([content], { type: format === "html" ? "text/html" : "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jornada-analise.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (scoped.length === 0) {
    return (
      <EmptyState
        icon={Presentation}
        title="Nada para apresentar ainda"
        description="Colete apps nas etapas anteriores para gerar a apresentação."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Compartilhe o resultado</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gere um deck de slides profissional com os números, gráficos e a voz
          do usuário — editável no editor de Apresentações, apresentável em
          tela cheia e exportável em HTML/Markdown.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={generate}
          className="inline-flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
        >
          <Presentation className="h-4 w-4" aria-hidden />
          {deckId ? "Regerar deck" : "Gerar apresentação"}
        </button>
        <button
          onClick={() => exportDeck("html")}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80"
        >
          <FileDown className="h-4 w-4" aria-hidden /> HTML
        </button>
        <button
          onClick={() => exportDeck("md")}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80"
        >
          <FileDown className="h-4 w-4" aria-hidden /> Markdown
        </button>
      </div>

      {msg && (
        <p className="text-xs inline-flex items-center gap-1.5 text-success" role="status">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> {msg}
        </p>
      )}

      {deckId && (
        <button
          onClick={() => navigate("/apresentacoes")}
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Abrir no editor de Apresentações <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}

      <div className="rounded-lg border border-border/60 bg-secondary/20 p-4 space-y-2">
        <p className="text-sm font-medium">Jornada concluída 🎉</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Você percorreu o sistema de ponta a ponta: descobriu, coletou,
          analisou com IA, visualizou, decidiu e gerou uma apresentação.
          Cada etapa tem uma página especializada para aprofundar.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link to="/dashboard" className="text-[11px] px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80">Dashboard</Link>
          <Link to="/experiments" className="text-[11px] px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80">Experimentos</Link>
          <Link to="/canvas" className="text-[11px] px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80">Canvas</Link>
          <Link to="/decision-center" className="text-[11px] px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80">Decision Center</Link>
          <button
            onClick={onRestart}
            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md bg-secondary hover:bg-secondary/80"
          >
            <RotateCcw className="h-3 w-3" aria-hidden /> Recomeçar jornada
          </button>
        </div>
      </div>
    </div>
  );
}
