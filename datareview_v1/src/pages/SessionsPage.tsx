/**
 * Sessions page — `/sessions`
 *
 * Página dedicada ao histórico unificado de tudo que foi coletado e gerado.
 * Renderiza o `SessionsPanel` em layout full-width. Permite ao usuário revisitar
 * qualquer coleta ou análise de IA feita anteriormente (atlas, canvas, chat)
 * sem recarregar nem refazer — tudo persistido em localStorage.
 */
import { History } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { SessionsPanel } from "@/components/SessionsPanel";

export default function SessionsPage() {
  return (
    <ErrorBoundary title="Erro ao renderizar Sessões">
      <div className="h-full flex flex-col">
        <AppHeader title="Sessões" crumb="Histórico unificado · coletas + gerações" showSearch={false} />
        <div className="flex-1 min-h-0 overflow-hidden p-3">
          <div className="h-full w-full max-w-none rounded-lg border border-border/60 bg-card/40 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-card/60">
              <History className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">Tudo que foi coletado e gerado</h2>
              <span className="text-[10px] text-muted-foreground ml-auto">persistido · pesquisável · restaurável</span>
            </div>
            <div className="h-[calc(100%-41px)] overflow-y-auto">
              <SessionsPanel />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
