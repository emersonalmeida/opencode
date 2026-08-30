/**
 * VoiceDiagnostics — diagnóstico completo da cadeia de voz, com checagens
 * AO VIVO e instruções de instalação copiáveis.
 *
 * Checa: contexto seguro (HTTPS/localhost), permissão do microfone, STT do
 * navegador (Web Speech API), STT do servidor (Whisper local), vozes do
 * navegador (speechSynthesis — carregam assíncrono, por isso o listener
 * `voiceschanged`) e TTS do servidor (Piper/espeak). Quando algo falta,
 * mostra o comando exato para instalar (BigLinux/Arch + pip genérico).
 */
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Copy, Check, Terminal,
} from "lucide-react";
import { isSTTSupported, isTTSSupported, listVoices } from "@/lib/voice";
import { getVoiceCapabilities, useVoiceCapsVersion, type VoiceServerCaps } from "@/lib/voiceServer";
import { toastSuccess, toastError } from "@/lib/ux";
import { cn } from "@/lib/utils";

type CheckStatus = "ok" | "warn" | "fail" | "unknown";

interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />;
  if (status === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />;
  if (status === "fail") return <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />;
  return <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />;
}

function CopyCommand({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const isComment = cmd.trim().startsWith("#");
  if (isComment) return <p className="px-2 text-[10px] italic text-muted-foreground">{cmd}</p>;
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(cmd).then(
          () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
          () => toastError("Não consegui copiar — selecione manualmente."),
        );
      }}
      className="group flex w-full items-center justify-between gap-2 rounded border border-border/50 bg-muted/50 px-2 py-1 text-left font-mono text-[10px] hover:bg-muted"
      title="Copiar comando"
    >
      <span className="truncate">{cmd}</span>
      {copied ? <Check className="h-3 w-3 shrink-0 text-emerald-500" /> : <Copy className="h-3 w-3 shrink-0 text-muted-foreground group-hover:text-foreground" />}
    </button>
  );
}

export function VoiceDiagnostics() {
  const capsVersion = useVoiceCapsVersion();
  const [caps, setCaps] = useState<VoiceServerCaps | null>(null);
  const [capsError, setCapsError] = useState(false);
  const [voiceCount, setVoiceCount] = useState(() => listVoices().length);
  const [micPermission, setMicPermission] = useState<string>("unknown");
  const [checking, setChecking] = useState(false);

  // Vozes do navegador carregam de forma assíncrona (voiceschanged).
  useEffect(() => {
    if (!isTTSSupported()) return;
    const update = () => setVoiceCount(listVoices().length);
    window.speechSynthesis.addEventListener?.("voiceschanged", update);
    update();
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", update);
  }, []);

  // Permissão do microfone (quando a API Permissions existe).
  useEffect(() => {
    let alive = true;
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((p) => {
        if (!alive) return;
        setMicPermission(p.state);
        p.onchange = () => alive && setMicPermission(p.state);
      })
      .catch(() => setMicPermission("unknown"));
    return () => { alive = false; };
  }, []);

  const loadCaps = useCallback(async (force: boolean) => {
    setChecking(true);
    const c = await getVoiceCapabilities(force);
    setCaps(c);
    setCapsError(c === null);
    setChecking(false);
  }, []);

  useEffect(() => { void loadCaps(false); }, [loadCaps, capsVersion]);

  const secure = typeof window !== "undefined" && window.isSecureContext;
  const browserSTT = isSTTSupported();
  const serverSTT = Boolean(caps?.stt.available);
  const serverTTS = Boolean(caps?.tts.available);
  const browserTTS = isTTSSupported();

  const checks: Check[] = [
    {
      id: "secure",
      label: "Contexto seguro (HTTPS/localhost)",
      status: secure ? "ok" : "fail",
      detail: secure
        ? "A página pode usar microfone e áudio."
        : "Microfone bloqueado fora de HTTPS — acesse por http://localhost:8080 ou HTTPS.",
    },
    {
      id: "mic",
      label: "Permissão do microfone",
      status: micPermission === "granted" ? "ok" : micPermission === "denied" ? "fail" : micPermission === "prompt" ? "warn" : "unknown",
      detail: micPermission === "granted"
        ? "Microfone autorizado."
        : micPermission === "denied"
          ? "Negado — libere no cadeado da barra de endereço."
          : micPermission === "prompt"
            ? "Será pedido ao falar pela 1ª vez."
            : "O navegador não expõe o estado — será pedido ao falar.",
    },
    {
      id: "stt-browser",
      label: "Voz → texto no navegador (Web Speech)",
      status: browserSTT ? "ok" : "warn",
      detail: browserSTT
        ? "Disponível (Chrome/Edge). Atenção: envia o áudio ao Google."
        : "Indisponível neste navegador — use o Whisper local abaixo.",
    },
    {
      id: "stt-server",
      label: "Voz → texto local (Whisper no servidor)",
      status: serverSTT ? "ok" : capsError ? "fail" : "warn",
      detail: serverSTT
        ? `${caps!.stt.engine}${caps!.stt.detail ? ` · ${caps!.stt.detail}` : ""}`
        : capsError
          ? "Servidor local fora do ar — rode npm run dev:server."
          : "Não instalado — veja o comando abaixo.",
    },
    {
      id: "tts-browser",
      label: "Vozes do navegador (texto → voz)",
      status: voiceCount > 0 ? "ok" : browserTTS ? "warn" : "fail",
      detail: voiceCount > 0
        ? `${voiceCount} voz(es) disponíveis.`
        : browserTTS
          ? "Zero vozes (comum no Chrome/Linux sem speech-dispatcher) — use o TTS local abaixo."
          : "speechSynthesis ausente neste navegador.",
    },
    {
      id: "tts-server",
      label: "Texto → voz local (Piper/espeak no servidor)",
      status: serverTTS ? "ok" : capsError ? "fail" : "warn",
      detail: serverTTS
        ? `${caps!.tts.engine}${caps!.tts.detail ? ` · ${caps!.tts.detail}` : ""}`
        : capsError
          ? "Servidor local fora do ar — rode npm run dev:server."
          : "Não instalado — veja o comando abaixo.",
    },
  ];

  const okCount = checks.filter((c) => c.status === "ok").length;

  return (
    <div className="space-y-3" aria-label="Diagnóstico de voz">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground" role="status">
          {okCount}/{checks.length} verificações OK
        </p>
        <button
          onClick={() => {
            setVoiceCount(listVoices().length);
            void loadCaps(true);
            toastSuccess("Verificação de voz atualizada.");
          }}
          disabled={checking}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] hover:bg-secondary disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", checking && "animate-spin")} aria-hidden="true" />
          Verificar de novo
        </button>
      </div>

      <ul className="space-y-2" role="list">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 rounded-md border border-border/40 px-2 py-1.5">
            <span className="mt-0.5 shrink-0"><StatusIcon status={c.status} /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium leading-tight">{c.label}</p>
              <p className="text-[10px] text-muted-foreground leading-snug">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      {(caps?.hints ?? []).length > 0 && (
        <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-2">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold">
            <Terminal className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
            Instalar backends locais (no terminal)
          </p>
          {caps!.hints.map((h) => (
            <div key={h.id} className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">{h.title}</p>
              {h.commands.map((cmd) => <CopyCommand key={cmd} cmd={cmd} />)}
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground leading-snug">
            Depois de instalar, clique em “Verificar de novo”. O Whisper usa a GPU
            (RTX 3060) automaticamente e baixa o modelo na 1ª transcrição (~1–2 min).
          </p>
        </div>
      )}
    </div>
  );
}
