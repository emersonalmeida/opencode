/**
 * ChatComposer — composer de chat PADRONIZADO do sistema: textarea (Enter
 * envia, Shift+Enter quebra linha), ditado por voz (Web Speech → Whisper
 * local, com interim aparecendo no input e texto final entrando para revisão)
 * e botão enviar/parar. Antes esse padrão existia em variações na página Chat,
 * ChatVoz e AIAssistantPanel — agora é UM componente reutilizável em qualquer
 * superfície de chat (páginas, sidebars, abas, modais).
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useVoiceSettings } from "@/lib/voice";
import { toastError } from "@/lib/ux";
import { cn } from "@/lib/utils";
import { ChatToolsMenu } from "@/components/shared/ChatToolsMenu";
import { ChatCommandPalette } from "@/components/shared/ChatCommandPalette";
import { ChatSettingsMenu } from "@/components/shared/ChatSettingsMenu";
import { Loader2, Mic, MicOff, Send, Square, Slash } from "lucide-react";

export interface ChatComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  /** Quando presente e `loading`, mostra o botão Parar. */
  onStop?: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Ditado por voz (default true — segue voiceSettings.sttEnabled). */
  voice?: boolean;
  /** Menu de ferramentas (botão +): ações e componentes do sistema.
   *  Recebe a frase escolhida (preencher o input OU enviar direto). */
  onToolCommand?: (phrase: string) => void;
  /** Config do chat (botão engrenagem): leitura/voz/exibição/concorrência. */
  settings?: boolean;
  className?: string;
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  loading = false,
  disabled = false,
  placeholder = "Pergunte sobre os dados… (Enter envia, Shift+Enter quebra linha)",
  voice = true,
  onToolCommand,
  settings = true,
  className,
}: ChatComposerProps) {
  const voiceSettings = useVoiceSettings();
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Ditado: o texto final entra no input para REVISÃO antes de enviar.
  const dictationBaseRef = useRef("");
  const stt = useVoiceInput({
    lang: voiceSettings.lang,
    onFinal: (text) => {
      const base = dictationBaseRef.current;
      onChange((base ? `${base} ` : "") + text);
    },
  });

  useEffect(() => {
    if (stt.error) toastError(stt.error);
  }, [stt.error]);

  // Interim (só webspeech) aparece no input enquanto o usuário fala.
  useEffect(() => {
    if (stt.active && stt.interim) {
      const base = dictationBaseRef.current;
      onChange((base ? `${base} ` : "") + stt.interim);
    }
    // onChange é estável por contrato (setState) — intencionalmente fora das deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.active, stt.interim]);

  const toggleDictation = () => {
    if (stt.active) {
      stt.stop();
    } else {
      dictationBaseRef.current = value.trim();
      stt.start();
    }
  };

  return (
    <div className={cn("flex items-end gap-2", className)}>
      {onToolCommand && (
        <ChatToolsMenu
          onCommand={(phrase) =>
            // Frases com espaço final ("colete ") completam no input para o
            // usuário digitar o alvo; comandos fechados enviam direto.
            phrase.endsWith(" ") ? onChange((value ? `${value} ` : "") + phrase) : onToolCommand(phrase)
          }
          disabled={disabled}
        />
      )}
      {onToolCommand && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setPaletteOpen(true)}
          disabled={disabled}
          title="Catálogo de comandos (/) — páginas, componentes e ações"
          aria-label="Abrir catálogo de comandos"
        >
          <Slash className="h-4 w-4" />
        </Button>
      )}
      {settings && <ChatSettingsMenu />}
      <Textarea
        value={value}
        onChange={(e) => {
          // "/" no campo vazio abre o catálogo (atalho estilo Slack/Notion).
          if (e.target.value === "/" && value === "" && onToolCommand) {
            setPaletteOpen(true);
            return;
          }
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="min-h-10 flex-1 resize-none"
        aria-label="Mensagem para a IA"
      />
      {voice && voiceSettings.sttEnabled && (
        <Button
          type="button"
          variant={stt.active ? "destructive" : "ghost"}
          size="icon"
          onClick={toggleDictation}
          disabled={disabled || !stt.engine}
          title={
            !stt.engine
              ? "Ditado indisponível — veja o painel Voz (Chat com voz)"
              : stt.active
                ? "Parar ditado"
                : "Ditar por voz (o texto entra aqui para revisão)"
          }
          aria-label={stt.active ? "Parar ditado por voz" : "Ditar por voz"}
          aria-pressed={stt.active}
        >
          {stt.state === "transcribing" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : stt.active ? (
            <MicOff className="h-4 w-4 animate-pulse" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
      )}
      {loading && onStop ? (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={onStop}
          title="Parar geração"
          aria-label="Parar geração"
        >
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          size="icon"
          onClick={onSend}
          disabled={disabled || !value.trim()}
          title="Enviar"
          aria-label="Enviar mensagem"
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
      {onToolCommand && (
        <ChatCommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          onCommand={(phrase) =>
            phrase.endsWith(" ") ? onChange((value ? `${value} ` : "") + phrase) : onToolCommand(phrase)
          }
        />
      )}
    </div>
  );
}
