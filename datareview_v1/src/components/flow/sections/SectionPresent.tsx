/**
 * Seção 14 — Apresentar: decks do dataset. Gera um deck executivo
 * determinístico (buildDatasetDeck) com um clique; lista decks existentes
 * com exportação HTML/Markdown e link para o editor completo.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Presentation, Plus, Trash2, ArrowRight, FileDown } from "lucide-react";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";
import { useFlowScope } from "@/components/flow/useFlowScope";
import {
  listDecks, saveDeck, deleteDeck, buildDatasetDeck, deckToMarkdown, deckToHTML,
  subscribePresentations, type Deck,
} from "@/lib/presentations";
import { EmptyState } from "@/components/shared/EmptyState";

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function SectionPresent() {
  const { scoped } = useFlowScope();
  const [decks, setDecks] = useState<Deck[]>(() => listDecks());

  useEffect(() => subscribePresentations(() => setDecks(listDecks())), []);

  const build = () => {
    const deck = buildDatasetDeck(
      scoped,
      scoped.length === 1 ? `Análise: ${scoped[0].app.name}` : "Análise de reviews",
    );
    saveDeck(deck);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={build}
          disabled={scoped.length === 0}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Gerar deck do dataset
        </button>
        <Link to="/apresentacoes" className="inline-flex items-center gap-1 rounded-lg border border-border/60 px-3 py-1.5 text-xs hover:bg-secondary">
          Editor completo <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {scoped.length === 0 && decks.length === 0 ? (
        <EmptyState
          icon={Presentation}
          title="Sem dados para apresentar"
          description="Colete apps para gerar decks executivos com KPIs, gráficos e quotes reais."
        />
      ) : decks.length === 0 ? (
        <p className="text-xs text-muted-foreground" role="status">
          Gere um deck determinístico com 1 clique — KPIs, distribuição, sentimento e amostras reais.
        </p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2" aria-label="Decks salvos">
          {decks.map((deck) => (
            <li key={deck.id} className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{deck.title}</p>
                <p className="text-[10px] text-muted-foreground">{deck.slides.length} slide(s)</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <button
                    onClick={() => download(`${deck.title}.md`, deckToMarkdown(deck), "text/markdown")}
                    className="inline-flex items-center gap-1 rounded border border-border/50 px-1.5 py-0.5 text-[10px] hover:bg-secondary"
                  >
                    <FileDown className="h-3 w-3" aria-hidden /> MD
                  </button>
                  <button
                    onClick={() => download(`${deck.title}.html`, deckToHTML(deck, scoped), "text/html")}
                    className="inline-flex items-center gap-1 rounded border border-border/50 px-1.5 py-0.5 text-[10px] hover:bg-secondary"
                  >
                    <FileDown className="h-3 w-3" aria-hidden /> HTML
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Excluir o deck "${deck.title}"?`)) deleteDeck(deck.id);
                    }}
                    aria-label={`Excluir ${deck.title}`}
                    className="inline-flex items-center gap-1 rounded border border-border/50 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Panel
        title="Editor completo de apresentações"
        subtitle="A página Apresentações inteira: editor de slides (8 tipos), temas, geração por IA, preview 16:9 e modo apresentar fullscreen — sem sair do Fluxo."
        icon={<Presentation className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-present"
      >
        <div className="h-[560px]">
          <FlowEmbed page="apresentacoes" />
        </div>
        <Link to="/apresentacoes" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
