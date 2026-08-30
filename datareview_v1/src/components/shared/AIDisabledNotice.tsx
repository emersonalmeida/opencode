import { AlertCircle, BrainCircuit, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";

/**
 * Aviso padronizado de IA desativada (CTA de recuperação).
 *
 * TODA superfície de IA usa este componente quando `!isAIEnabled(ai)` em vez
 * de mensagem inline — garante texto consistente, link para Configurações e
 * comunicação de que o resto do sistema continua funcionando sem IA.
 * Guard: src/test/noAiNotice.test.tsx mantém a lista de superfícies migradas.
 *
 * - Use `AIDisabledNotice` para avisos inline (junto a botões/blocos de IA).
 * - Use `inlineConfigure` quando a página abre as Configurações de IA num
 *   modal local (padrão FeatureModal da Uni) — melhor que navegar.
 * - Use `AIDisabledEmptyState` quando a SEÇÃO INTEIRA depende de IA.
 */
export function AIDisabledNotice({
  className = "",
  compact = false,
  inlineConfigure,
}: {
  className?: string;
  /** compact = versão com padding reduzido para headers/badges estreitos. */
  compact?: boolean;
  /** Abre a configuração de IA inline (ex.: FeatureModal) em vez de só linkar. */
  inlineConfigure?: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg bg-secondary/60 text-xs text-muted-foreground ${compact ? "p-2" : "p-2.5"} ${className}`}
      role="note"
    >
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>
        A IA está desativada — o sistema funciona completo sem IA. Para gerar
        análises, ative em{" "}
        {inlineConfigure && (
          <>
            <button
              type="button"
              onClick={inlineConfigure}
              className="text-primary font-medium hover:underline"
            >
              aqui mesmo
            </button>{" "}
            (sem sair da página) ou em{" "}
          </>
        )}
        <Link to="/configuracoes" className="text-primary font-medium hover:underline">
          Configurações → Inteligência Artificial
        </Link>
        .
      </span>
    </div>
  );
}

/**
 * Empty state padronizado para SEÇÕES que dependem inteiramente de IA.
 * Compõe o EmptyState do sistema com copy consistente + CTA para ativar a IA.
 */
export function AIDisabledEmptyState({
  icon = BrainCircuit,
  className,
}: {
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <EmptyState
      icon={icon}
      title="IA desativada"
      description="O sistema funciona completo sem IA — coleta, dados, gráficos e exportações seguem disponíveis. Para gerar análises com IA, ative um modo."
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/configuracoes">Ativar IA nas Configurações</Link>
        </Button>
      }
      className={className}
    />
  );
}
