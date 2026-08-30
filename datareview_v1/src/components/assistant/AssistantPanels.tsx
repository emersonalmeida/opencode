/**
 * Painéis laterais internos do Chat com voz (`/chat-voz`):
 *  - Contexto: seleção global de apps (escopo das análises/chat).
 *  - Ações: comandos de voz/texto clicáveis + seções de IA + agentes.
 *  - Voz: configurações de STT/TTS (auto-falar, velocidade, tom, voz, idioma).
 *  - Status: dataset, modo de IA e suporte de voz do navegador.
 */
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mic, MicOff, Volume2, VolumeX, Play, ChevronRight, Database, Bot, Sparkles } from "lucide-react";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled, aiProvenance } from "@/lib/aiSettings";
import {
  useVoiceSettings, setVoiceSettings, isSTTSupported, isTTSSupported, listVoices,
  RATE_LIMITS, PITCH_LIMITS,
} from "@/lib/voice";
import { OS_COMMANDS } from "@/lib/os/commands";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { BUILTIN_AGENTS } from "@/lib/agents";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { getVoiceCapabilities, useVoiceCapsVersion, type VoiceServerCaps } from "@/lib/voiceServer";

/* ------------------------------------------------------------ Contexto --- */

export function AssistantContextPanel() {
  const { entries } = useDataset();
  const { selected, toggle, selectAll, selectNone } = useSelection();
  const allKeys = entries.map((e) => entryKey(e.app.store, e.app.id));
  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{selected.size === 0 ? `Escopo: todos (${entries.length})` : `Escopo: ${selected.size} de ${entries.length}`}</span>
        <span className="flex gap-2">
          <button className="text-primary hover:underline" onClick={() => selectAll(allKeys)}>Todos</button>
          <button className="text-primary hover:underline" onClick={selectNone}>Nenhum</button>
        </span>
      </div>
      <Separator />
      {entries.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Dataset vazio. Diga ou digite <code className="rounded bg-muted px-1">/collect nubank</code> para coletar um app sem sair daqui.
        </p>
      )}
      <ul className="space-y-1">
        {entries.map((e) => {
          const k = entryKey(e.app.store, e.app.id);
          const on = selected.size === 0 || selected.has(k);
          return (
            <li key={k}>
              <button
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(k)}
                className={cn(
                  "w-full rounded-lg border px-2 py-1.5 text-left text-xs transition-colors",
                  on ? "border-primary/40 bg-primary/5" : "border-border/50 opacity-60 hover:opacity-100",
                )}
              >
                <span className="block truncate font-medium">{e.app.name}</span>
                <span className="text-muted-foreground">
                  {e.app.store === "apple" ? "Apple" : "Google"} · {e.reviews.length} reviews
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- Ações ---- */

interface ActionsProps {
  onCommand: (input: string) => void;
  onRunSection: (id: string) => void;
  onRunAgent: (id: string) => void;
  disabled?: boolean;
}

export function AssistantActionsPanel({ onCommand, onRunSection, onRunAgent, disabled }: ActionsProps) {
  const ai = useAISettings();
  const aiOn = isAIEnabled(ai);
  return (
    <div className="p-3 space-y-4">
      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Comandos</h3>
        <ul className="space-y-0.5">
          {OS_COMMANDS.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => onCommand(c.usage)}
                className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs hover:bg-secondary"
                title={c.description}
              >
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-primary" aria-hidden="true" />
                <span className="font-mono text-primary">{c.usage}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <Separator />
      <section>
        <h3 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles className="h-3 w-3" aria-hidden="true" /> Análises de IA
        </h3>
        <ul className="space-y-0.5">
          {EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai").map((s) => (
            <li key={s.id}>
              <button
                onClick={() => onRunSection(s.id)}
                disabled={disabled || !aiOn}
                className="w-full rounded-md px-1.5 py-1 text-left text-xs hover:bg-secondary disabled:opacity-50"
                title={s.description}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <Separator />
      <section>
        <h3 className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Bot className="h-3 w-3" aria-hidden="true" /> Agentes
        </h3>
        <ul className="space-y-0.5">
          {BUILTIN_AGENTS.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => onRunAgent(a.id)}
                disabled={disabled || !aiOn}
                className="w-full rounded-md px-1.5 py-1 text-left text-xs hover:bg-secondary disabled:opacity-50"
                title={`${a.segment}: ${a.pipeline.map((s) => s.label).join(" → ")}`}
              >
                {a.label}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- Voz ---- */

function Toggle({ label, desc, value, onChange, icon }: {
  label: string; desc?: string; value: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="flex items-start gap-2">
        {icon}
        <div>
          <div className="text-xs font-medium">{label}</div>
          {desc && <div className="text-[11px] text-muted-foreground">{desc}</div>}
        </div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}

export function AssistantVoicePanel() {
  const vs = useVoiceSettings();
  const capsVersion = useVoiceCapsVersion();
  const [caps, setCaps] = useState<VoiceServerCaps | null>(null);
  useEffect(() => { void getVoiceCapabilities().then(setCaps); }, [capsVersion]);
  // STT/TTS contam o navegador E o servidor local (Whisper/Piper) — o badge
  // só é "indisponível" quando NENHUM dos dois funciona.
  const sttBrowser = isSTTSupported();
  const sttOk = sttBrowser || Boolean(caps?.stt.available);
  const voices = listVoices();
  const ttsOk = (isTTSSupported() && voices.length > 0) || Boolean(caps?.tts.available);
  const sttDetail = sttBrowser ? "navegador" : caps?.stt.available ? caps.stt.engine ?? "servidor" : null;
  const ttsDetail = isTTSSupported() && voices.length > 0 ? "navegador" : caps?.tts.available ? caps.tts.engine ?? "servidor" : null;
  const langVoices = voices.filter((v) => v.lang.toLowerCase().startsWith(vs.lang.split("-")[0].toLowerCase()));
  return (
    <div className="p-3 space-y-3">
      <div className="flex gap-1.5">
        <Badge variant={sttOk ? "default" : "secondary"} className="gap-1" title={sttDetail ? `via ${sttDetail}` : "sem engine disponível — ver diagnóstico abaixo"}>
          {sttOk ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />} Voz → texto {sttOk ? `ok (${sttDetail})` : "indisponível"}
        </Badge>
        <Badge variant={ttsOk ? "default" : "secondary"} className="gap-1" title={ttsDetail ? `via ${ttsDetail}` : "sem engine disponível — ver diagnóstico abaixo"}>
          {ttsOk ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />} Texto → voz {ttsOk ? `ok (${ttsDetail})` : "indisponível"}
        </Badge>
      </div>
      <Separator />
      <Toggle label="Microfone" desc="Botão de fala no composer" value={vs.sttEnabled} onChange={(v) => setVoiceSettings({ sttEnabled: v })} icon={<Mic className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />} />
      <Toggle label="Falar respostas" desc="A IA lê as respostas em voz alta" value={vs.autoSpeak} onChange={(v) => setVoiceSettings({ autoSpeak: v })} icon={<Volume2 className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />} />
      <Toggle label="Hands-free" desc="Volta a ouvir depois de falar (conversa contínua)" value={vs.continuous} onChange={(v) => setVoiceSettings({ continuous: v })} icon={<Play className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />} />
      <Separator />
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span>Velocidade</span><span className="text-muted-foreground">{vs.rate.toFixed(2)}×</span>
        </div>
        <Slider value={[vs.rate]} min={RATE_LIMITS.min} max={RATE_LIMITS.max} step={0.05}
          onValueChange={([v]) => setVoiceSettings({ rate: v })} aria-label="Velocidade da fala" />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span>Tom</span><span className="text-muted-foreground">{vs.pitch.toFixed(2)}</span>
        </div>
        <Slider value={[vs.pitch]} min={PITCH_LIMITS.min} max={PITCH_LIMITS.max} step={0.05}
          onValueChange={([v]) => setVoiceSettings({ pitch: v })} aria-label="Tom da fala" />
      </div>
      <div className="space-y-1">
        <label className="text-xs" htmlFor="voice-lang">Idioma</label>
        <select
          id="voice-lang"
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          value={vs.lang}
          onChange={(e) => setVoiceSettings({ lang: e.target.value, voiceURI: null })}
        >
          <option value="pt-BR">Português (BR)</option>
          <option value="pt-PT">Português (PT)</option>
          <option value="en-US">English (US)</option>
          <option value="es-ES">Español</option>
        </select>
      </div>
      {langVoices.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs" htmlFor="voice-voice">Voz</label>
          <select
            id="voice-voice"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={vs.voiceURI ?? ""}
            onChange={(e) => setVoiceSettings({ voiceURI: e.target.value || null })}
          >
            <option value="">Padrão do sistema</option>
            {langVoices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Status --- */

export function AssistantStatusPanel() {
  const { entries } = useDataset();
  const ai = useAISettings();
  const reviews = entries.reduce((s, e) => s + e.reviews.length, 0);
  const pos = entries.flatMap((e) => e.reviews).filter((r) => r.rating >= 4).length;
  return (
    <div className="p-3 space-y-3 text-xs">
      <div className="flex items-center gap-2">
        <Database className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">Dataset</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/60 p-2">
          <div className="text-lg font-semibold">{entries.length}</div>
          <div className="text-muted-foreground">apps</div>
        </div>
        <div className="rounded-lg border border-border/60 p-2">
          <div className="text-lg font-semibold">{reviews}</div>
          <div className="text-muted-foreground">reviews</div>
        </div>
      </div>
      {reviews > 0 && (
        <p className="text-muted-foreground">{Math.round((pos / reviews) * 100)}% de reviews positivos no dataset.</p>
      )}
      <Separator />
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium">IA</span>
      </div>
      <Badge variant={isAIEnabled(ai) ? "default" : "secondary"}>
        {isAIEnabled(ai) ? aiProvenance(ai) : "IA desativada"}
      </Badge>
      {!isAIEnabled(ai) && (
        <p className="text-muted-foreground">
          Ative em Configurações → Inteligência Artificial. Comandos de dados (/collect, /stats) funcionam sem IA.
        </p>
      )}
    </div>
  );
}
