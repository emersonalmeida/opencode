/**
 * POST /functions/v1/tts — síntese de voz (texto → áudio WAV) LOCAL.
 *
 * Body: `{ text, lang?, speed? }`. Engines (ordem de preferência):
 *   1. piper (binário ou `python3 -m piper`) — vozes neurais pt-BR naturais;
 *      o modelo (default pt_BR-faber-medium) baixa automaticamente na 1ª vez
 *      (env PIPER_MODEL/PIPER_VOICES_DIR configuráveis).
 *   2. espeak-ng / espeak — qualidade robótica, mas quase sempre instalável.
 *
 * Resposta: audio/wav (bytes) + header X-TTS-Engine. 503 com instruções
 * quando nenhum backend está instalado.
 */
import type { Request, Response } from "express";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { detectVoiceCapabilities, projectPython } from "../lib/voiceBackends.js";
import { homedir } from "node:os";

const PIPER_MODEL = process.env.PIPER_MODEL || "pt_BR-faber-medium";
const PIPER_DIR = process.env.PIPER_VOICES_DIR || join(homedir(), ".local", "share", "piper-voices");
const TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS) || 180_000; // 1ª síntese baixa o modelo

interface RunResult { code: number }

function runWithStdin(cmd: string, args: string[], input: string, timeout = TIMEOUT_MS): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { timeout, maxBuffer: 4 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve();
    });
    child.stdin?.write(input);
    child.stdin?.end();
  });
}

function espeakVoiceFor(lang: string): string {
  const l = lang.toLowerCase();
  if (l.startsWith("pt")) return l.includes("pt-pt") ? "pt" : "pt-br";
  if (l.startsWith("en")) return "en-us";
  if (l.startsWith("es")) return "es";
  return "pt-br";
}

/** Piper 1.7+ não baixa a voz na síntese — baixa antes (1ª vez ~60MB). */
async function ensurePiperVoice(engine: string): Promise<string> {
  const modelPath = join(PIPER_DIR, `${PIPER_MODEL}.onnx`);
  if (!existsSync(modelPath)) {
    const dl = ["-m", "piper.download_voices", "--download-dir", PIPER_DIR, PIPER_MODEL];
    if (engine === "piper") await runWithStdin("piper", dl, "", TIMEOUT_MS);
    else await runWithStdin(projectPython(), dl, "", TIMEOUT_MS);
  }
  return modelPath;
}

async function synthPiper(text: string, outWav: string, engine: string): Promise<void> {
  const modelPath = await ensurePiperVoice(engine);
  const args = ["--model", modelPath, "--output_file", outWav];
  if (engine === "piper") await runWithStdin("piper", args, text);
  else await runWithStdin(projectPython(), ["-m", "piper", ...args], text);
}

async function synthEspeak(text: string, outWav: string, lang: string, speed: number, bin: string): Promise<void> {
  // espeak words-per-minute ~80..450; speed 1.0 → 170
  const wpm = Math.round(170 * Math.min(2, Math.max(0.5, speed)));
  await runWithStdin(bin, ["-v", espeakVoiceFor(lang), "-s", String(wpm), "-w", outWav, "--stdin"], text, 60_000);
}

export async function tts(req: Request, res: Response) {
  const { text, lang, speed } = (req.body ?? {}) as { text?: string; lang?: string; speed?: number };
  const clean = String(text ?? "").slice(0, 12_000);
  if (!clean.trim()) {
    res.status(400).json({ error: "Texto vazio." });
    return;
  }
  const caps = await detectVoiceCapabilities();
  if (!caps.tts.available || !caps.tts.engine) {
    res.status(503).json({
      error: "Nenhum backend de texto → voz instalado no servidor.",
      hint: caps.hints.find((h) => h.id === "tts"),
    });
    return;
  }

  const outWav = join(tmpdir(), `tts-${randomUUID()}.wav`);
  const engine = caps.tts.engine;
  try {
    if (engine.startsWith("piper")) {
      await synthPiper(clean, outWav, engine);
    } else {
      await synthEspeak(clean, outWav, lang ?? "pt-BR", speed ?? 1, engine === "espeak-ng" ? "espeak-ng" : "espeak");
    }
    const wav = await readFile(outWav);
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("X-TTS-Engine", engine);
    res.send(wav);
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message.slice(0, 500) : "Falha na síntese de voz",
      engine,
    });
  } finally {
    unlink(outWav).catch(() => {});
  }
}
