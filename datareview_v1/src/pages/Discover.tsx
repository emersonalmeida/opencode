/**
 * Página Descoberta (/descoberta) — radar de fontes novas.
 *
 * Uma única página para descobrir o que podemos coletar de cada fonte
 * pública sem chave (14 fontes em 5 grupos): cada fonte é uma seção
 * independente (coleta, erro e cache próprios), e o painel "Investigar um
 * link" resolve qualquer URL para a entidade correspondente com detalhes.
 *
 * Resultados de qualquer seção podem virar coleção da Uni (/00) e ser
 * analisados pela IA embutida (mesmo UniAI da /00).
 */
import { useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DiscoverSection } from "@/components/discover/DiscoverSection";
import { UrlResolverPanel } from "@/components/discover/UrlResolverPanel";
import { UniAI } from "@/components/uni/UniAI";
import { Button } from "@/components/ui/button";
import { toastSuccess } from "@/lib/ux";
import { toUniItems, type DiscoverItem } from "@/lib/discover/discoverApi";
import {
  DISCOVER_GROUP_LABELS,
  DISCOVER_GROUP_ORDER,
  DISCOVER_SECTIONS,
} from "@/lib/discover/discoverSections";
import { saveCollection } from "@/lib/uni/uniStore";
import type { UniItem } from "@/lib/uni/types";
import { Compass, Save } from "lucide-react";

/** Seções que coletam sozinhas ao abrir (sem parâmetro obrigatório). */
const AUTO_RUN = new Set(["wikitop", "onthisday", "crypto", "podcasts", "books", "clima", "steamtop", "github-trending", "mastodon-trends"]);

export default function Discover() {
  // Itens por fonte — o usuário escolhe qual seção salvar/analisar.
  const [itemsBySource, setItemsBySource] = useState<Record<string, DiscoverItem[]>>({});
  const [saveSource, setSaveSource] = useState<string>("");

  const collectedSources = useMemo(
    () => Object.entries(itemsBySource).filter(([, items]) => items.length > 0),
    [itemsBySource],
  );
  const totalItems = useMemo(
    () => collectedSources.reduce((s, [, items]) => s + items.length, 0),
    [collectedSources],
  );

  const uniItems: UniItem[] = useMemo(() => {
    if (!saveSource || !itemsBySource[saveSource]?.length) return [];
    return toUniItems(saveSource, itemsBySource[saveSource]);
  }, [itemsBySource, saveSource]);

  const handleItems = (source: string, items: DiscoverItem[]) => {
    setItemsBySource((prev) => ({ ...prev, [source]: items }));
    // Auto-seleciona a primeira fonte com itens para a IA/salvar.
    setSaveSource((cur) => (cur || (items.length ? source : cur)));
  };

  const handleSave = () => {
    if (!saveSource || !uniItems.length) return;
    const def = DISCOVER_SECTIONS.find((s) => s.id === saveSource);
    saveCollection({
      label: `Descoberta · ${def?.title ?? saveSource}`,
      source: "custom",
      query: saveSource,
      items: uniItems,
      params: { discoverSource: saveSource },
    });
    toastSuccess("Coleção salva na Uni", {
      description: `${uniItems.length} itens de "${def?.title ?? saveSource}" — abra a página /00 para ver.`,
    });
  };

  // Fan-out do resolver: preenche o termo nas seções de busca por termo.
  const handleFanout = (term: string) => {
    const el = document.getElementById("discover-googlenews");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    toastSuccess("Termo pronto para fan-out", {
      description: `"${term}" — use nas seções de busca (Notícias, Música) ou na Uni (/00).`,
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader title="Descoberta" crumb="Radar de fontes" />
      <main id="content" className="content-fluid flex-1 space-y-6 py-6">
        {/* Hero */}
        <header className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Compass className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Descoberta</h1>
            <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
              {DISCOVER_SECTIONS.length} fontes públicas sem chave, organizadas em seções independentes.
              Colete, explore, salve na Uni e analise com IA — tudo num só lugar.
            </p>
          </div>
        </header>

        {/* Resolver de URLs */}
        <UrlResolverPanel onFanout={handleFanout} />

        {/* Barra de escopo para IA/salvar */}
        {collectedSources.length > 0 && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3"
          >
            <span className="text-sm text-muted-foreground">
              <strong className="text-foreground">{totalItems}</strong> itens coletados em{" "}
              <strong className="text-foreground">{collectedSources.length}</strong>{" "}
              {collectedSources.length === 1 ? "fonte" : "fontes"}
            </span>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Escopo para IA/salvar:
              <select
                value={saveSource}
                onChange={(e) => setSaveSource(e.target.value)}
                className="h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                aria-label="Fonte escopada para IA e salvar"
              >
                {collectedSources.map(([id]) => (
                  <option key={id} value={id}>
                    {DISCOVER_SECTIONS.find((s) => s.id === id)?.title ?? id} ({itemsBySource[id].length})
                  </option>
                ))}
              </select>
            </label>
            <Button size="sm" variant="outline" onClick={handleSave} disabled={!uniItems.length}>
              <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Salvar na Uni
            </Button>
          </div>
        )}

        {/* Seções por grupo */}
        {DISCOVER_GROUP_ORDER.map((group) => {
          const sections = DISCOVER_SECTIONS.filter((s) => s.group === group);
          if (!sections.length) return null;
          return (
            <div key={group}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {DISCOVER_GROUP_LABELS[group]}
              </h2>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {sections.map((def) => (
                  <DiscoverSection
                    key={def.id}
                    def={def}
                    autoRun={AUTO_RUN.has(def.id)}
                    onItems={handleItems}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* IA embutida sobre o escopo */}
        {uniItems.length > 0 && (
          <section id="discover-ia" aria-labelledby="discover-ia-title" className="scroll-mt-24 rounded-xl border bg-card p-4">
            <h2 id="discover-ia-title" className="mb-2 text-sm font-semibold">
              Análise com IA — {DISCOVER_SECTIONS.find((s) => s.id === saveSource)?.title ?? saveSource}
            </h2>
            <UniAI items={uniItems} source="custom" />
          </section>
        )}
      </main>
    </div>
  );
}
