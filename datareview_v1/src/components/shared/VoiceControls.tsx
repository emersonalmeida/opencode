/**
 * VoiceControls — controle COMPLETO de voz para qualquer conteúdo falável.
 *
 * Botões: Ouvir / Pausar / Continuar / Parar (estado global — um falante
 * por vez) + mudo rápido + popover de configurações com TUDO que a voz
 * oferece:
 *  - engine (automático / navegador / servidor local Piper — o usuário pode
 *    FORÇAR o Piper mesmo com vozes no navegador, pela qualidade);
 *  - velocidade, tom, VOLUME e mudo master;
 *  - idioma e voz específica;
 *  - "Ouvir ao vivo" por padrão (fala enquanto a IA gera);
 *  - botão "Testar voz".
 *
 * Funciona mesmo SEM vozes no navegador: cai para o TTS local do servidor
 * (Piper) via `speakTrackedSmart`. As configurações (`aso:voice-settings:v1`)
 * são compartilhadas com o Chat com voz e o sistema inteiro.
 */
import { useEffect, useRef, useState } from "react";
import { Play, Pause, Square, Settings2, Volume2, VolumeX, AudioLines } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  useVoiceSettings, setVoiceSettings, useSpeechState,
  stopTrackedSpeech, pauseTrackedSpeech, resumeTrackedSpeech,
  isTTSSupported, listVoices, RATE_LIMITS, PITCH_LIMITS, VOLUME_LIMITS,
} from "@/lib/voice";
import {
  getVoiceCapabilities, speakTrackedSmart, useVoiceCapsVersion,
} from "@/lib/voiceServer";
import { toastError } from "@/lib/ux";
import { cn } from "@/lib/utils";

interface Props {
  /** Texto (markdown ok) a ser falado. */
  text: string;
  /** Id estável desta origem de fala (ex.: id da instância do card). */
  id: string;
  /** Mostrar o botão de configurações de voz. Default true. */
  withSettings?: boolean;
  className?: string;
}

const LANGS: Array<{ value: string; label: string }> = [
  { value: "pt-BR", label: "Português (BR)" },
  { value: "pt-PT", label: "Português (PT)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español" },
];

const ENGINES: Array<{ value: "auto" | "browser" | "server"; label: string; hint: string }> = [
  { value: "auto", label: "Automático", hint: "navegador se tiver voz, senão Piper local" },
  { value: "browser", label: "Navegador", hint: "vozes do sistema (speechSynthesis)" },
  { value: "server", label: "Servidor local", hint: "Piper — voz neural pt-BR (offline)" },
];

export function VoiceControls({ text, id, withSettings = true, className }: Props) {
  const vs = useVoiceSettings();
  const speech = useSpeechState();
  useVoiceCapsVersion(); // re-render quando as caps do servidor mudam
  const [serverTts, setServerTts] = useState<boolean | null>(null);
  const speakingThis = speech.id === id;
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let live = true;
    void getVoiceCapabilities().then((c) => {
      if (live) setServerTts(!!c?.tts.available);
    });
    return () => { live = false; };
  }, []);

  // Se o componente desmonta no meio da fala (navegação, card fechado),
  // cancela para não deixar "voz fantasma" falando sem contexto.
  useEffect(() => () => {
    cancelRef.current?.();
    cancelRef.current = null;
  }, []);

  const browserOk = isTTSSupported();
  const available = browserOk || serverTts === true;
  if (!available || !text.trim()) return null;

  const start = () => {
    cancelRef.current = speakTrackedSmart(id, text, vs, () => {
      cancelRef.current = null;
    }, (msg) => {
      cancelRef.current = null;
      if (msg) toastError(msg);
    });
  };

  const mainAction = () => {
    if (!speakingThis) return start();
    if (speech.paused) resumeTrackedSpeech();
    else pauseTrackedSpeech();
  };

  const mainLabel = !speakingThis
    ? "Ouvir em voz alta"
    : speech.paused ? "Continuar leitura em voz alta" : "Pausar leitura em voz alta";

  return (
    <div
      className={cn("flex items-center rounded-md border border-border/40", className)}
      role="group"
      aria-label="Leitura em voz alta"
    >
      <button
        onClick={mainAction}
        title={mainLabel}
        aria-label={mainLabel}
        aria-pressed={speakingThis && !speech.paused}
        className={cn(
          "p-1 rounded-l-md transition-colors",
          speakingThis
            ? "text-primary hover:bg-secondary"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary",
        )}
      >
        {!speakingThis ? <Play className="h-3.5 w-3.5" /> : speech.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5 animate-pulse" />}
      </button>
      {speakingThis && (
        <button
          onClick={stopTrackedSpeech}
          title="Parar leitura"
          aria-label="Parar leitura em voz alta"
          className="p-1 text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
        >
          <Square className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={() => setVoiceSettings({ muted: !vs.muted })}
        title={vs.muted ? "Ativar som" : "Silenciar (sem perder o volume escolhido)"}
        aria-label={vs.muted ? "Ativar som" : "Silenciar"}
        aria-pressed={vs.muted}
        className={cn(
          "p-1 transition-colors",
          vs.muted
            ? "text-destructive hover:bg-secondary"
            : "text-muted-foreground hover:text-foreground hover:bg-secondary",
          !withSettings && "rounded-r-md",
        )}
      >
        {vs.muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      </button>
      {withSettings && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              title="Configurações de voz (engine, velocidade, tom, volume, idioma)"
              aria-label="Configurações de voz"
              className="p-1 rounded-r-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3" align="end" sideOffset={6}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold">Voz da leitura</p>
              <button
                onClick={() => speakTrackedSmart(`${id}:test`, "Esta é a voz que lê as análises para você.", vs, undefined, (m) => m && toastError(m))}
                className="text-[10px] text-primary hover:underline"
              >
                Testar voz
              </button>
            </div>

            {/* Engine */}
            <div className="space-y-1">
              <span className="text-[11px]">Engine de voz</span>
              <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Engine de voz">
                {ENGINES.map((e) => (
                  <button
                    key={e.value}
                    role="radio"
                    aria-checked={vs.engine === e.value}
                    title={e.hint}
                    onClick={() => setVoiceSettings({ engine: e.value })}
                    className={cn(
                      "rounded-md border px-1.5 py-1 text-[10px] transition-colors",
                      vs.engine === e.value
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border text-muted-foreground hover:border-primary/40",
                      e.value === "server" && serverTts === false && "opacity-40",
                    )}
                  >
                    {e.label}
                  </button>
                ))}
              </div>
              {serverTts === false && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Servidor sem TTS local — instale com <code>npm run voice:setup</code>.
                </p>
              )}
            </div>

            {/* Velocidade */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span>Velocidade</span>
                <span className="text-muted-foreground tabular-nums">{vs.rate.toFixed(2)}×</span>
              </div>
              <Slider
                value={[vs.rate]}
                min={RATE_LIMITS.min}
                max={RATE_LIMITS.max}
                step={0.05}
                onValueChange={([v]) => setVoiceSettings({ rate: v })}
                aria-label="Velocidade da fala"
              />
            </div>

            {/* Tom */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span>Tom</span>
                <span className="text-muted-foreground tabular-nums">{vs.pitch.toFixed(2)}</span>
              </div>
              <Slider
                value={[vs.pitch]}
                min={PITCH_LIMITS.min}
                max={PITCH_LIMITS.max}
                step={0.05}
                onValueChange={([v]) => setVoiceSettings({ pitch: v })}
                aria-label="Tom da fala"
              />
            </div>

            {/* Volume */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span>Volume</span>
                <span className="text-muted-foreground tabular-nums">{vs.muted ? "mudo" : `${Math.round(vs.volume * 100)}%`}</span>
              </div>
              <Slider
                value={[vs.volume]}
                min={VOLUME_LIMITS.min}
                max={VOLUME_LIMITS.max}
                step={0.05}
                onValueChange={([v]) => setVoiceSettings({ volume: v, ...(v === 0 ? { muted: true } : v > 0 && vs.muted ? { muted: false } : {}) })}
                aria-label="Volume da fala"
              />
            </div>

            {/* Ouvir ao vivo */}
            <div className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5">
              <span className="flex items-center gap-1.5 text-[11px]">
                <AudioLines className="h-3 w-3 text-primary" />
                Ouvir ao vivo (durante a geração)
              </span>
              <Switch
                checked={vs.liveRead}
                onCheckedChange={(v) => setVoiceSettings({ liveRead: v })}
                aria-label="Ouvir ao vivo por padrão"
              />
            </div>

            {/* Idioma */}
            <div className="space-y-1">
              <label className="text-[11px]" htmlFor={`voice-lang-${id}`}>Idioma</label>
              <select
                id={`voice-lang-${id}`}
                className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                value={vs.lang}
                onChange={(e) => setVoiceSettings({ lang: e.target.value, voiceURI: null })}
              >
                {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            {(() => {
              const langVoices = listVoices().filter((v) =>
                v.lang.toLowerCase().startsWith(vs.lang.split("-")[0].toLowerCase()),
              );
              if (langVoices.length === 0) return null;
              return (
                <div className="space-y-1">
                  <label className="text-[11px]" htmlFor={`voice-voice-${id}`}>Voz (navegador)</label>
                  <select
                    id={`voice-voice-${id}`}
                    className="w-full rounded-md border border-border bg-background px-2 py-1 text-xs"
                    value={vs.voiceURI ?? ""}
                    onChange={(e) => setVoiceSettings({ voiceURI: e.target.value || null })}
                  >
                    <option value="">Padrão do sistema</option>
                    {langVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
                    ))}
                  </select>
                </div>
              );
            })()}
            <p className="text-[10px] text-muted-foreground leading-snug">
              Compartilhado com o Chat com voz — ajustar aqui vale para todo o sistema.
            </p>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
