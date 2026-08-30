/**
 * POST /functions/v1/stt — transcrição de áudio (voz → texto) LOCAL.
 *
 * Body: áudio bruto (audio/webm;codecs=opus, audio/ogg, audio/wav…), gravado
 * pelo MediaRecorder do navegador. Query/body: `lang` (BCP-47, ex.: pt-BR).
 *
 * Engines (ordem de preferência, detectadas em runtime):
 *   1. faster-whisper (pip install faster-whisper) — roda na GPU (CUDA) com
 *      fallback para CPU; decodifica webm/opus direto (PyAV).
 *   2. whisper-cli (whisper.cpp) + ffmpeg (converte webm → wav 16k mono).
 *
 * Resposta: `{ text, engine, ms }`. 503 com instruções quando nenhum
 * backend está instalado.
 */
import type { Request, Response } from "express";
import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { detectVoiceCapabilities, projectPython } from "../lib/voiceBackends.js";

const WHISPER_MODEL = process.env.WHISPER_MODEL || "small";
const WHISPER_CLI_MODEL = process.env.WHISPER_CLI_MODEL || ""; // caminho .bin p/ whisper.cpp
const TIMEOUT_MS = Number(process.env.STT_TIMEOUT_MS) || 300_000; // 1ª execução baixa o modelo

function run(cmd: string, args: string[], timeout = TIMEOUT_MS): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout);
    });
  });
}

/** faster-whisper via python inline. device: "cuda" → fallback "cpu". */
async function transcribeFasterWhisper(file: string, lang: string): Promise<string> {
  const script = [
    "import sys",
    "from faster_whisper import WhisperModel",
    "model_name, device, path, lang = sys.argv[1], sys.argv[2], sys.argv[3], (sys.argv[4] or None)",
    "compute = 'float16' if device == 'cuda' else 'int8'",
    "try:",
    "    model = WhisperModel(model_name, device=device, compute_type=compute)",
    "except Exception:",
    "    model = WhisperModel(model_name, device='cpu', compute_type='int8')",
    "segments, _ = model.transcribe(path, language=lang, beam_size=1, vad_filter=True)",
    "print(' '.join(s.text.strip() for s in segments).strip())",
  ].join("\n");
  // Warnings do HF vão para stdout em algumas versões — garante stderr limpo.
  const cleanScript = "import os; os.environ.setdefault('HF_HUB_DISABLE_PROGRESS_BARS','1'); " +
    "import logging; logging.disable(logging.WARNING); " + script;
  const device = process.env.WHISPER_DEVICE || "cuda";
  const out = await run(projectPython(), ["-c", cleanScript, WHISPER_MODEL, device, file, lang]);
  return out.trim();
}

/** whisper.cpp: precisa WAV 16k mono — converte com ffmpeg antes. */
async function transcribeWhisperCli(file: string, lang: string, workDir: string): Promise<string> {
  if (!WHISPER_CLI_MODEL) throw new Error("WHISPER_CLI_MODEL não configurado (caminho do modelo .bin)");
  const wav = join(workDir, "in.wav");
  await run("ffmpeg", ["-y", "-i", file, "-ar", "16000", "-ac", "1", "-f", "wav", wav], 60_000);
  const out = await run("whisper-cli", ["-m", WHISPER_CLI_MODEL, "-f", wav, "-l", lang.split("-")[0], "--no-timestamps", "-nt"]);
  return out.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ").trim();
}

export async function stt(req: Request, res: Response) {
  const started = Date.now();
  const rawLang = String(req.query.lang ?? "pt-BR");
  // faster-whisper espera o código primário ("pt"), não a tag completa ("pt-BR").
  const lang = rawLang.split("-")[0].toLowerCase();
  const body = req.body as Buffer | undefined;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).json({ error: "Envie o áudio bruto no corpo da requisição (MediaRecorder)." });
    return;
  }
  if (body.length > 25 * 1024 * 1024) {
    res.status(413).json({ error: "Áudio muito grande (máx 25MB)." });
    return;
  }

  const caps = await detectVoiceCapabilities();
  if (!caps.stt.available) {
    res.status(503).json({
      error: "Nenhum backend de voz → texto instalado no servidor.",
      hint: caps.hints.find((h) => h.id === "stt"),
    });
    return;
  }

  const workId = randomUUID();
  const workDir = tmpdir();
  const ext = (req.headers["content-type"] ?? "").includes("wav") ? "wav" : "webm";
  const input = join(workDir, `stt-${workId}.${ext}`);
  try {
    await writeFile(input, body);
    let text: string;
    if (caps.stt.engine === "faster-whisper") {
      text = await transcribeFasterWhisper(input, lang);
    } else {
      text = await transcribeWhisperCli(input, lang, workDir);
    }
    if (!text) {
      res.json({ text: "", engine: caps.stt.engine, ms: Date.now() - started, empty: true });
      return;
    }
    res.json({ text, engine: caps.stt.engine, ms: Date.now() - started });
  } catch (e) {
    res.status(500).json({
      error: e instanceof Error ? e.message.slice(0, 500) : "Falha na transcrição",
      engine: caps.stt.engine,
    });
  } finally {
    unlink(input).catch(() => {});
    unlink(join(workDir, "in.wav")).catch(() => {});
  }
}
