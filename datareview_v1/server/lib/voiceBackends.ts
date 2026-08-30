/**
 * Detecção de backends locais de voz (STT/TTS) no servidor.
 *
 * O navegador nem sempre consegue fazer voz → texto (SpeechRecognition só
 * existe no Chrome/Edge e envia áudio para servidores do Google) nem
 * texto → voz (Chrome no Linux sem speech-dispatcher fica com ZERO vozes
 * e o speechSynthesis falha em silêncio). A solução é rodar engines
 * locais na máquina do usuário (mesmo hardware do Ollama):
 *
 *   STT (áudio → texto): faster-whisper (pip) [melhor, usa GPU] ou
 *     whisper-cli (whisper.cpp) + ffmpeg para converter webm → wav.
 *   TTS (texto → áudio): piper (pip/binário, vozes pt-BR naturais) ou
 *     espeak-ng (qualidade robótica, mas sempre disponível).
 *
 * Toda a detecção é feita em runtime com cache curto — se o usuário
 * instalar um backend, basta clicar "Verificar de novo".
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface VoiceBackendInfo {
  /** Engine detectada (ou null se nenhuma). */
  engine: string | null;
  available: boolean;
  /** Detalhes extras (ex.: caminho do binário, device GPU). */
  detail?: string;
}

export interface VoiceCapabilities {
  stt: VoiceBackendInfo;
  tts: VoiceBackendInfo;
  /** Instruções de instalação prontas para exibir ao usuário. */
  hints: { id: string; title: string; commands: string[] }[];
}

/**
 * Python dos backends de voz. Prioriza o venv do projeto (`.venv/bin/python`
 * — criado por `scripts/setup-voice.sh`), que é onde o setup instala
 * faster-whisper/piper sem PEP 668. Override por VOICE_PYTHON.
 * Também exportado para as rotas stt/tts executarem o MESMO intérprete.
 */
export function projectPython(): string {
  if (process.env.VOICE_PYTHON) return process.env.VOICE_PYTHON;
  const venv = join(process.cwd(), ".venv", "bin", "python");
  if (existsSync(venv)) return venv;
  return "python3";
}

function which(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile("which", [bin], { timeout: 3000 }, (err, stdout) => {
      resolve(err ? null : stdout.trim() || null);
    });
  });
}

function pyImportOk(mod: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(projectPython(), ["-c", `import ${mod}`], { timeout: 8000 }, (err) => resolve(!err));
  });
}

function hasGpu(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("nvidia-smi", ["-L"], { timeout: 3000 }, (err, stdout) => {
      resolve(!err && /GPU\s+\d+:/.test(stdout));
    });
  });
}

/** Instruções de instalação (BigLinux/Arch + pip genérico). */
export function buildInstallHints(caps: { stt: VoiceBackendInfo; tts: VoiceBackendInfo }) {
  const hints: VoiceCapabilities["hints"] = [];
  if (!caps.stt.available) {
    hints.push({
      id: "stt",
      title: "Voz → texto local (Whisper) — recomendado",
      commands: [
        "scripts/setup-voice.sh",
        "# instala whisper + piper num venv do projeto (sem sudo, sem PEP 668)",
        "# usa a GPU (NVIDIA) automaticamente; modelo baixa na 1ª vez",
      ],
    });
  }
  if (!caps.tts.available) {
    hints.push({
      id: "tts",
      title: "Texto → voz local (Piper, vozes pt-BR naturais) — recomendado",
      commands: [
        "scripts/setup-voice.sh",
        "# a voz pt_BR baixa automaticamente na 1ª síntese",
        "# fallback simples: sudo pacman -S espeak-ng (ou apt install espeak-ng)",
      ],
    });
  }
  return hints;
}

let cache: { caps: VoiceCapabilities; at: number } | null = null;
const CACHE_MS = 15_000;

/** Detecta os backends disponíveis (cache de 15s; force=true ignora). */
export async function detectVoiceCapabilities(force = false): Promise<VoiceCapabilities> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.caps;

  const [fasterWhisper, whisperCli, ffmpeg, piperBin, piperPy, espeakNg, espeak, gpu] =
    await Promise.all([
      pyImportOk("faster_whisper"),
      which("whisper-cli"),
      which("ffmpeg"),
      which("piper"),
      pyImportOk("piper"),
      which("espeak-ng"),
      which("espeak"),
      hasGpu(),
    ]);

  let stt: VoiceBackendInfo = { engine: null, available: false };
  if (fasterWhisper) {
    stt = {
      engine: "faster-whisper",
      available: true,
      detail: gpu ? "GPU (CUDA)" : "CPU",
    };
  } else if (whisperCli && ffmpeg) {
    stt = { engine: "whisper.cpp", available: true, detail: whisperCli };
  }

  let tts: VoiceBackendInfo = { engine: null, available: false };
  if (piperBin) {
    tts = { engine: "piper", available: true, detail: piperBin };
  } else if (piperPy) {
    tts = { engine: "piper (python)", available: true };
  } else if (espeakNg || espeak) {
    tts = { engine: espeakNg ? "espeak-ng" : "espeak", available: true, detail: (espeakNg ?? espeak) ?? undefined };
  }

  const caps: VoiceCapabilities = { stt, tts, hints: buildInstallHints({ stt, tts }) };
  cache = { caps, at: Date.now() };
  return caps;
}

export function invalidateVoiceCache() {
  cache = null;
}
