/**
 * Seção 03 — Coletar: estado da coleta por app + re-coleta com o limite
 * atual das configurações (cresce o dataset com merge/dedup, nunca perde
 * dados). A coleta em si acontece na etapa 01 (Descobrir) ou aqui.
 */
import { useState } from "react";
import { Download, Loader2, RefreshCw, Database, SlidersHorizontal } from "lucide-react";
import { useFlowScope } from "@/components/flow/useFlowScope";
import { EmptyState } from "@/components/shared/EmptyState";
import { Panel } from "@/components/Panel";
import { CollectionSettingsInline } from "@/components/SettingsPanel";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { collectApp } from "@/lib/collect";
import { getUserRegion } from "@/lib/region";
import { entryKey } from "@/context/SelectionContext";

export function SectionCollect() {
  const { entries, totalReviews } = useFlowScope();
  const { settings } = useCollectionSettings();
  const [busy, setBusy] = useState<string | null>(null);
  const region = getUserRegion();

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={Database}
        title="Nada coletado ainda"
        description="Use a etapa 01 (Descobrir) para buscar apps e coletar os primeiros reviews."
      />
    );
  }

  const recollect = async (store: string, id: string) => {
    const k = entryKey(store, id);
    const entry = entries.find((e) => e.app.store === store && e.app.id === id);
    if (!entry) return;
    setBusy(k);
    try {
      await collectApp(entry.app, region, settings.reviewLimit, settings.reviewSort);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground" role="status">
        {entries.length} app(s) · {totalReviews.toLocaleString("pt-BR")} reviews no dataset ·
        limite atual: {settings.reviewLimit.toLocaleString("pt-BR")} reviews/app.
        Re-coletar faz merge com o que já existe (dedup por id) e cresce o conjunto.
      </p>

      <Panel
        title="Parâmetros de coleta"
        subtitle="Limite de reviews por app (presets + personalizado até 10.000) e ordenação — ajuste aqui mesmo, sem sair do Fluxo."
        icon={<SlidersHorizontal className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-collect-settings"
        compact
      >
        <CollectionSettingsInline />
      </Panel>
      <ul className="grid gap-2 sm:grid-cols-2" aria-label="Estado da coleta por app">
        {entries.map((e) => {
          const k = entryKey(e.app.store, e.app.id);
          const underLimit = e.reviews.length < settings.reviewLimit;
          return (
            <li key={k} className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
              {e.app.icon ? (
                <img src={e.app.icon} alt="" className="h-9 w-9 shrink-0 rounded-lg" />
              ) : (
                <div className="h-9 w-9 shrink-0 rounded-lg bg-secondary" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{e.app.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {e.reviews.length.toLocaleString("pt-BR")} reviews
                  {underLimit && (
                    <span className="text-status-warning"> · abaixo do limite</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => recollect(e.app.store, e.app.id)}
                disabled={busy !== null}
                aria-label={`Re-coletar ${e.app.name} com o limite atual`}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border/60 px-2 py-1.5 text-[11px] hover:bg-secondary disabled:opacity-50"
              >
                {busy === k ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : underLimit ? (
                  <Download className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                )}
                {underLimit ? "Completar" : "Atualizar"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
