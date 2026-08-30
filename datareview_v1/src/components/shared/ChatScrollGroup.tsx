/**
 * ChatScrollGroup — CONTAINER PADRÃO de listas de mensagens em TODOS os
 * chats. Resolve o bug de "4+ respostas ficam sem rolagem e cortam o bloco"
 * e centraliza o comportamento de scroll em uma única peça:
 *
 *  - o grupo SEMPRE rola (`flex-1 min-h-0 overflow-y-auto` no parent;
 *    `className` de dimensionamento legado — ex.: `max-h-[60vh]` — é
 *    descartada com aviso dev);
 *  - stub de estado vazio renderizado quando `empty=true` (clicável se
 *    `onEmptyAction` for passado);
 *  - toolbar fixa no topo (filtros/opções/configurações do chat);
 *  - botão flutuante "Recentes" quando o usuário sobe a rolagem (usa
 *    useSmartAutoScroll — segue o fim só quando já está no fim).
 *
 * Input: `empty`, `toolbar`, `children` (mensagens), `emptyLabel/
 *  emptyButton`, `className` do wrapper externo.
 */

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";
import { ArrowDown } from "lucide-react";

export interface ChatScrollGroupProps {
  /** Mensagens exibidas? false = renderizar as empty-stubs/sugestões. */
  empty?: boolean;
  /** Texto/desenho do estado vazio (clicável quando `onEmptyAction` e foij). */
  emptyLabel?: ReactNode;
  /** Botão/atalho no estado vazio (`onEmptyAction` obrigatório). */
  emptyButton?: ReactNode;
  /** Acção ao clicar no rótulo de empty (navegação plain). */
  onEmptyAction?: () => void;
  /** Toolbar fixa no topo do grupo (configurações/filtros/opções). */
  toolbar?: ReactNode;
  /** Conteúdo: as mensagens (MessageBubbles). */
  children: ReactNode;
  /** aria-label da região rolável (padrão "Mensagens da conversa"). */
  label?: string;
  className?: string;
  /** Classe extra da região rolável (espaçamento entre mensagens). */
  messagesClassName?: string;
  /** Deps do auto-scroll (ex.: [messages.length]) — o grupo segue o fim
   *  quando o conteúdo cresce E o usuário já está no fim. */
  deps?: readonly unknown[];
  /** Quando muda, o grupo vai ao fim (ex.: envio de mensagem — "sending
   *  always jumps"). Não dispara no primeiro render. */
  followTrigger?: unknown;
}

export function ChatScrollGroup({
  empty = false,
  emptyLabel,
  emptyButton,
  onEmptyAction,
  toolbar,
  children,
  label = "Mensagens da conversa",
  className,
  messagesClassName,
  deps = [empty],
  followTrigger,
}: ChatScrollGroupProps) {
  const { ref, onScroll, showJump, resumeFollow } =
    useSmartAutoScroll<HTMLDivElement>(deps);

  // Envio/ação explícita → vai ao fim (não dispara no primeiro render).
  const firstTrigger = useRef(true);
  useEffect(() => {
    if (firstTrigger.current) { firstTrigger.current = false; return; }
    resumeFollow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followTrigger]);

  const content = useMemo(() => {
    if (empty) {
      return (
        <div
          role={onEmptyAction ? "button" : undefined}
          onClick={onEmptyAction}
          className={cn(
            "flex flex-col items-start gap-2 rounded-lg border border-dashed p-4 text-xs text-muted-foreground",
            onEmptyAction && "cursor-pointer hover:border-primary/50",
          )}
        >
          {emptyLabel}
          {emptyButton}
        </div>
      );
    }
    return children;
  }, [empty, emptyLabel, emptyButton, onEmptyAction, children]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {toolbar && (
        <div className="sticky top-0 z-10 border-b border-border/30 bg-card/80 backdrop-blur-sm px-2 py-1">
          {toolbar}
        </div>
      )}
      <div
        ref={ref}
        onScroll={onScroll}
        className={cn("flex-1 overflow-y-auto overflow-x-hidden", messagesClassName)}
        // A roupagem do scroll vive no grupo; a roupagem da mensagem é
        // responsabilidade de cada ChatMessageBlock (AIOutputCard / region).
        role="log"
        aria-live="polite"
        aria-label={label}
      >
        {content}
      </div>
      {showJump && (
        <button
          type="button"
          onClick={resumeFollow}
          aria-label="Ir para as mensagens mais recentes"
          className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors animate-fade-in"
        >
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
          Recentes
        </button>
      )}
    </div>
  );
}
