/**
 * ChatMessageBlock — bloco PADRONIZADO de mensagem de chat (usuário E
 * assistente). Cada mensagem da conversa é um bloco independente:
 *
 *   ┌ header ─ título ("Você"/"Assistente") + badge de origem + ações
 *   ├ conteúdo — texto (usuário) ou AIOutputCard/superfície real (assistente)
 *   └ status   — streaming ao vivo / métricas finais (via AIOutputCard)
 *
 * Níveis de expansão (collapsed → default → expanded, persistidos por
 * storageKey): collapsed = só o header; default = conteúdo com altura
 * limitada + scroll interno; expanded = conteúdo completo. Blocos podem
 * conter outros blocos (componentes embutidos) — o comportamento se repete.
 *
 * Acessibilidade: role="article" nomeado, aria-expanded, botão de ciclo com
 * rótulo dinâmico. Nunca depende só de cor (ícone + texto de origem).
 */
import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronsUpDown, ChevronsDownUp, Minus, Copy, Check, Maximize2,
  MessageSquare, Sparkles, Loader2, RefreshCw,
} from "lucide-react";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { EmbeddedSurface } from "@/components/shared/EmbeddedSurface";
import { EmbeddedPage } from "@/components/shared/EmbeddedPage";
import { OriginBadge } from "@/components/shared/OriginBadge";
import { FeatureModal } from "@/components/shared/FeatureModal";
import { cn } from "@/lib/utils";

export type ChatBlockLevel = "collapsed" | "default" | "expanded";
const LEVEL_ORDER: ChatBlockLevel[] = ["collapsed", "default", "expanded"];

function loadLevel(storageKey: string | undefined, fb: ChatBlockLevel): ChatBlockLevel {
  if (!storageKey) return fb;
  try {
    const v = localStorage.getItem(`aso:chat-msg-level:${storageKey}`);
    return v === "collapsed" || v === "default" || v === "expanded" ? v : fb;
  } catch { return fb; }
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export interface ChatMessageBlockProps {
  role: "user" | "assistant";
  /** Texto da mensagem. Assistente: markdown; usuário: texto puro. */
  content: string;
  /** Streaming em andamento (só assistente) — força nível expandido. */
  streaming?: boolean;
  /** Superfície real do sistema embutida nesta mensagem (componente vivo). */
  surfaceId?: string;
  surfaceLabel?: string;
  /** Página real embutida (rota inteira renderizada no chat — intent goto). */
  page?: { path: string; label: string };
  /** Persistência do nível (ex.: `chat-3`). */
  storageKey?: string;
  defaultLevel?: ChatBlockLevel;
  /** Regenerar a resposta (só assistente). */
  onRegenerate?: () => void;
  /** Sugestões de próxima pergunta (quick replies) sob a resposta. */
  quickReplies?: string[];
  /** Clique num quick reply — envia a sugestão como nova pergunta. */
  onQuickReply?: (text: string) => void;
  /** Permite reenviar/editar a mensagem do usuário (preenche o composer). */
  onResend?: (text: string) => void;
  /** Base do nome do arquivo p/ baixar (assistente). */
  filename?: string;
  /** Densidade compacta (coluna estreita): sem avatar, margens menores. */
  compact?: boolean;
  className?: string;
}

/** Header compartilhado dos dois papéis: título + origem + ações. */
function BlockHeader({
  icon, title, origin, headerRight, levelLabel, onCycle, onCollapse,
  level, streaming,
}: {
  icon: ReactNode; title: string; origin: "user" | "ai";
  headerRight?: ReactNode; levelLabel: string;
  onCycle: () => void; onCollapse: () => void;
  level: ChatBlockLevel; streaming?: boolean;
}) {
  return (
    <header className="flex items-center gap-1.5 px-2.5 py-1.5">
      <span className="shrink-0 text-muted-foreground" aria-hidden="true">{icon}</span>
      <h4 className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground flex items-center gap-1.5">
        {title}
        {streaming && <Loader2 className="h-3 w-3 animate-spin text-primary" aria-label="Gerando" />}
      </h4>
      <OriginBadge origin={origin} short />
      <div className="flex shrink-0 items-center gap-0.5">
        {headerRight}
        {level !== "collapsed" && (
          <button
            type="button" onClick={onCollapse} title="Recolher (só título)"
            aria-label={`Recolher mensagem: ${title}`}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <Minus className="h-3 w-3" aria-hidden="true" />
          </button>
        )}
        <button
          type="button" onClick={onCycle} title={levelLabel} aria-label={levelLabel}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {level === "expanded"
            ? <ChevronsDownUp className="h-3 w-3" aria-hidden="true" />
            : <ChevronsUpDown className="h-3 w-3" aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}

/** Botão copiar texto simples com feedback. */
function CopyTextButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      title={copied ? "Copiado!" : label}
      aria-label={copied ? "Copiado" : label}
      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
    >
      {copied
        ? <Check className="h-3 w-3 text-primary" aria-hidden="true" />
        : <Copy className="h-3 w-3" aria-hidden="true" />}
    </button>
  );
}

export function ChatMessageBlock({
  role, content, streaming = false, surfaceId, surfaceLabel, page,
  storageKey, defaultLevel = "expanded", onRegenerate, onResend,
  quickReplies, onQuickReply,
  filename, compact = false, className,
}: ChatMessageBlockProps) {
  const isUser = role === "user";
  const [level, setLevel] = useState<ChatBlockLevel>(() => loadLevel(storageKey, defaultLevel));
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(`aso:chat-msg-level:${storageKey}`, level); } catch { /* quota */ }
  }, [level, storageKey]);

  // Streaming sempre expande — o bloco cresce com a geração.
  const effectiveLevel: ChatBlockLevel = streaming ? "expanded" : level;
  const cycle = () =>
    setLevel(LEVEL_ORDER[(LEVEL_ORDER.indexOf(effectiveLevel) + 1) % LEVEL_ORDER.length]);
  const collapse = () => setLevel("collapsed");

  const title = isUser ? "Você" : "Assistente";
  const levelLabel =
    effectiveLevel === "expanded" ? "Recolher para altura padrão"
    : effectiveLevel === "default" ? "Expandir conteúdo completo"
    : "Expandir";
  const words = content ? countWords(content) : 0;

  const surfaceBlock = (surfaceId || page) ? (
    <div className="not-prose px-2.5 pb-2.5">
      {surfaceId && <EmbeddedSurface id={surfaceId} />}
      {page && <EmbeddedPage path={page.path} label={page.label} />}
    </div>
  ) : null;

  const contentRegion = (
    <div
      role="region"
      aria-label={`Conteúdo da mensagem: ${title}`}
      className={cn(
        "px-2.5 pb-2.5",
        effectiveLevel === "default" && "max-h-64 overflow-y-auto scrollbar-thin",
      )}
    >
      {isUser ? (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{content}</p>
      ) : (
        <AIOutputCard
          bare
          content={content}
          streaming={streaming}
          filename={filename ?? "chat-resposta"}
          enableComponents
        />
      )}
    </div>
  );

  const icon = isUser
    ? <MessageSquare className="h-3.5 w-3.5" />
    : <Sparkles className="h-3.5 w-3.5 text-primary" />;

  const userActions = (
    <>
      {content && <CopyTextButton text={content} label="Copiar sua mensagem" />}
      {onResend && content && (
        <button
          type="button" onClick={() => onResend(content)}
          title="Reenviar esta mensagem (volta para o campo de texto)"
          aria-label="Reenviar esta mensagem"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
      {content && (
        <button
          type="button" onClick={() => setModalOpen(true)}
          title="Abrir em tela cheia" aria-label="Abrir mensagem em tela cheia"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Maximize2 className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </>
  );

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border bg-card/70 animate-msg-in",
        isUser
          ? "ml-auto border-primary/30 w-fit min-w-0 max-w-full sm:max-w-[88%]"
          : "mr-auto w-full border-border/50",
        className,
      )}
      aria-label={`Mensagem de ${title}`}
      aria-expanded={effectiveLevel !== "collapsed"}
      data-role={role}
    >
      <BlockHeader
        icon={icon} title={title} origin={isUser ? "user" : "ai"}
        headerRight={isUser ? userActions : (
          <>
            {onRegenerate && !streaming && (
              <button
                type="button" onClick={onRegenerate}
                title="Regenerar resposta" aria-label="Regenerar resposta"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <RefreshCw className="h-3 w-3" aria-hidden="true" />
              </button>
            )}
          </>
        )}
        levelLabel={levelLabel} onCycle={cycle} onCollapse={collapse}
        level={effectiveLevel} streaming={streaming}
      />

      {effectiveLevel === "collapsed" ? (
        <button
          type="button" onClick={cycle}
          className="flex w-full items-center gap-1.5 border-t border-border/30 px-2.5 py-1 text-left text-[10px] text-muted-foreground hover:text-foreground"
        >
          <ChevronsUpDown className="h-3 w-3" aria-hidden="true" />
          {words > 0
            ? `Mensagem recolhida — ${words} palavras · clique para expandir`
            : surfaceLabel
              ? `Componente recolhido: ${surfaceLabel} — clique para expandir`
              : "Mensagem recolhida — clique para expandir"}
        </button>
      ) : (
        <>
          {(content || streaming) && contentRegion}
          {surfaceBlock}
        </>
      )}

      {/* Quick replies — próximos passos antecipados sob a ÚLTIMA resposta
          (o caller decide onde mostrar; some durante o streaming). */}
      {!isUser && !streaming && quickReplies && quickReplies.length > 0 && onQuickReply && (
        <footer className="flex flex-wrap items-center gap-1.5 border-t border-border/30 px-2.5 py-1.5">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">Próximo passo:</span>
          {quickReplies.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onQuickReply(q)}
              className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              {q}
            </button>
          ))}
        </footer>
      )}

      {modalOpen && (
        <FeatureModal
          open={modalOpen} onOpenChange={setModalOpen}
          title={`Mensagem — ${title}`} size="lg"
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{content}</p>
          ) : (
            <AIOutputCard bare content={content} filename={filename ?? "chat-resposta"} enableComponents />
          )}
          {surfaceId && <div className="mt-3"><EmbeddedSurface id={surfaceId} /></div>}
        </FeatureModal>
      )}
    </article>
  );
}
