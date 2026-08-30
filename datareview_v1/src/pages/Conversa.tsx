/**
 * Página Conversa (`/conversa`) — "apenas o chat": input + config + output.
 *
 * A página minimalista onde TODO o sistema é acessível pela conversa:
 * exibir componentes reais, coletar apps, pesquisar em todas as fontes,
 * executar pipeline, gerar relatórios — com ou sem IA, sem sair da página.
 * É o UnifiedChatPanel em tela cheia, com uma gaveta de config inline
 * (IA, coleta) e chips de escopo.
 */
import { useState } from "react";
import { Settings2, Database } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { UnifiedChatPanel } from "@/components/shared/UnifiedChatPanel";
import { AISettingsPanel } from "@/components/AISettingsPanel";
import { CollectionConfigPanel } from "@/components/page01/panels";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { cn } from "@/lib/utils";

export default function Conversa() {
  const { entries } = useDataset();
  const { selected } = useSelection();
  const [configOpen, setConfigOpen] = useState(false);

  const scopeApps = selected.size > 0
    ? entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)))
    : entries;
  const totalReviews = scopeApps.reduce((s, e) => s + e.reviews.length, 0);

  return (
    <div className="flex h-screen flex-col">
      <AppHeader
        title="Conversa"
        crumb="Todo o sistema via chat — com e sem IA"
        extraMenu={
          <button
            type="button"
            onClick={() => setConfigOpen((v) => !v)}
            aria-pressed={configOpen}
            aria-label="Abrir configuração"
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs",
              configOpen
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:border-primary/40",
            )}
          >
            <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
            Config
          </button>
        }
      />

      {/* Escopo atual */}
      <div className="border-b border-border/40 px-4 py-1.5 text-[11px] text-muted-foreground" role="status">
        <span className="inline-flex items-center gap-1.5">
          <Database className="h-3 w-3" aria-hidden="true" />
          Escopo: {scopeApps.length} app(s) · {totalReviews} reviews
          {selected.size === 0 && entries.length > 0 && " (dataset inteiro — selecione apps na sidebar para focar)"}
          {" · "}Peça "ajuda" para ver tudo que o chat faz sem IA.
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Conversa (output + input) */}
        <main className="flex min-w-0 flex-1 flex-col p-4" id="content">
          <UnifiedChatPanel
            className="mx-auto w-full max-w-4xl"
            messagesClassName="max-h-none flex-1"
            welcomeMessage={'Olá! Eu opero todo o sistema pela conversa. Peça para **exibir** componentes ("exiba os gráficos"), **coletar** ("colete nubank"), **pesquisar** ("pesquise bitcoin em todas as fontes"), **executar** ("execute o pipeline") ou **relatar** ("gere um relatório"). Digite **ajuda** para ver tudo.'}
            suggestions={[
              "ajuda",
              "exiba os gráficos",
              "selecione as fontes",
              "execute o pipeline",
              "gere um relatório",
            ]}
          />
        </main>

        {/* Gaveta de configuração inline */}
        {configOpen && (
          <aside
            className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/40 p-4 md:flex"
            aria-label="Configuração da conversa"
          >
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Inteligência Artificial
              </h2>
              <AISettingsPanel />
            </section>
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Coleta de dados
              </h2>
              <CollectionConfigPanel />
            </section>
          </aside>
        )}
      </div>
    </div>
  );
}
