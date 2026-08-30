/**
 * QuickCollect — busca → coleta → seleção inline, reusável em QUALQUER página.
 *
 * Princípio "toda página funciona sozinha": se a página precisa de dados, ela
 * mesma oferece o caminho completo — buscar nas duas lojas (Apple + Google),
 * coletar 1-clique (reviews no dataset + app selecionado globalmente) e ver/
 * ajustar a seleção — sem navegar para fora.
 *
 * Implementação: compõe os painéis independentes de
 * `src/components/search/AppSearchPanels.tsx` (campo / resultados / seleção),
 * que compartilham estado via `src/lib/searchStore.ts`. Quando precisar das
 * partes SEPARADAS (ex.: blocos distintos no construtor `/layouts`), use os
 * painéis diretamente — ou os componentes `search-field`, `search-results`,
 * `app-selection` e `collection-config` do registry de layout.
 *
 * Não faz rede no render: só ao submeter a busca ou coletar.
 */
import {
  SearchFieldPanel, SearchResultsPanel, AppSelectionPanel,
} from "@/components/search/AppSearchPanels";
import { cn } from "@/lib/utils";

interface QuickCollectProps {
  /** Mostra a lista de apps do dataset com toggles de seleção (quando há dados). */
  showSelection?: boolean;
  /** Texto introdutório (substitui o padrão). */
  hint?: string;
  className?: string;
}

export function QuickCollect({ showSelection = true, hint, className }: QuickCollectProps) {
  return (
    <div className={cn("w-full max-w-xl mx-auto text-left space-y-3", className)}>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {hint ?? "Sem sair da página: busque nas duas lojas, colete com 1 clique e comece — os dados ficam disponíveis no sistema inteiro."}
      </p>
      <SearchFieldPanel />
      <SearchResultsPanel />
      {showSelection && <AppSelectionPanel />}
    </div>
  );
}
