/**
 * ChatSettingsMenu — botão "Config" do composer que agrupa as configurações
 * do CHAT (de escopo global, que regem todos os blocos de uma só vez),
 * separadas das ações de resposta que ficam no header de cada bloco.
 *
 * Seções:
 *   - Leitura (zoom global da saída de IA, 75–250%)
 *   - Voz (ditado STT, leitura TTS, ouvir ao vivo durante a geração)
 *   - Exibição (barra de status da geração)
 *   - IA (modo de concorrência: paralela/sequencial — quando fornecido o
 *     callback, em chats que expõem essa configuração)
 *
 * Um popover simples (não Radix) — abre/fecha clipe fora/Esc, com
 * role="menu" e switches acessíveis (role="switch").
 */
import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import {
  useAIOutputSettings, setAIOutputSettings, SCALE_PRESETS,
} from "@/lib/aiOutputSettings";
import { useVoiceSettings, setVoiceSettings } from "@/lib/voice";
import { cn } from "@/lib/utils";

const CLAMPED_PRESETS_LIST = SCALE_PRESETS;

export interface ChatSettingsMenuProps {
  /** Callback opcional para alternar concorrência paralela/sequencial. */
  onConcurrencyChange?: (parallel: boolean) => void;
  /** Estado atual da concorrência (só exibido quando onConcurrencyChange). */
  parallel?: boolean;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary/60"
    >
      <span>{label}</span>
      <span
        className={cn(
          "relative h-4 w-8 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted",
        )}
        aria-hidden="true"
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

export function ChatSettingsMenu({ onConcurrencyChange, parallel }: ChatSettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const aiOut = useAIOutputSettings();
  const voice = useVoiceSettings();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Configurações do chat"
        aria-label="Abrir configurações do chat"
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Settings2 className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Configurações do chat"
          className="absolute bottom-full right-0 z-30 mb-1.5 w-60 rounded-lg border border-border/60 bg-popover p-2 shadow-lg"
        >
          {/* Leitura (zoom global) */}
          <p className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Leitura
          </p>
          <div className="mb-1 flex flex-wrap gap-1 px-1" role="group" aria-label="Tamanho global do texto">
            {CLAMPED_PRESETS_LIST.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAIOutputSettings({ fontScale: p })}
                aria-pressed={aiOut.fontScale === p}
                className={cn(
                  "rounded-md border px-2 py-0.5 text-[11px] tabular-nums",
                  aiOut.fontScale === p
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:text-foreground",
                )}
              >
                {p}%
              </button>
            ))}
          </div>

          {/* Voz */}
          <p className="px-2 pb-1 pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Voz
          </p>
          <Toggle
            checked={voice.sttEnabled}
            onChange={(v) => setVoiceSettings({ sttEnabled: v })}
            label="Ditado por voz (STT)"
          />
          <Toggle
            checked={voice.autoSpeak}
            onChange={(v) => setVoiceSettings({ autoSpeak: v })}
            label="Ler respostas em voz alta (TTS)"
          />
          <Toggle
            checked={voice.liveRead}
            onChange={(v) => setVoiceSettings({ liveRead: v })}
            label="Ouvir enquanto a IA gera"
          />

          {/* Exibição */}
          <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Exibição
          </p>
          <Toggle
            checked={aiOut.showStatusBar}
            onChange={(v) => setAIOutputSettings({ showStatusBar: v })}
            label="Barra de status da geração"
          />

          {/* IA — modo de concorrência (quando o chat expõe) */}
          {onConcurrencyChange && (
            <>
              <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                IA
              </p>
              <Toggle
                checked={parallel ?? true}
                onChange={(v) => onConcurrencyChange(v)}
                label="Gerações paralelas de IA"
              />
            </>
          )}

          <p className="border-t border-border/40 px-2 pt-1.5 text-[9px] text-muted-foreground">
            Configurações globais do chat. Ações da resposta (copiar, regenerar,
            zoom por card…) ficam no header de cada bloco.
          </p>
        </div>
      )}
    </div>
  );
}
