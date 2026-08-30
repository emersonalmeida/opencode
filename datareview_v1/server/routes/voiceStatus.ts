/**
 * GET /functions/v1/voice-status — capacidades de voz do servidor local.
 *
 * Retorna quais backends de STT/TTS estão disponíveis na máquina (detectados
 * em runtime) + instruções de instalação quando faltam. O frontend usa isso
 * para escolher o engine de voz e mostrar o diagnóstico ao usuário.
 * Query `refresh=1` força re-detecção (depois de instalar algo).
 */
import type { Request, Response } from "express";
import { detectVoiceCapabilities, invalidateVoiceCache } from "../lib/voiceBackends.js";

export async function voiceStatus(req: Request, res: Response) {
  const refresh = req.query.refresh === "1" || (req.body as { refresh?: boolean } | undefined)?.refresh === true;
  if (refresh) invalidateVoiceCache();
  try {
    const caps = await detectVoiceCapabilities(refresh);
    res.json(caps);
  } catch (e) {
    res.status(500).json({
      stt: { engine: null, available: false },
      tts: { engine: null, available: false },
      hints: [],
      error: e instanceof Error ? e.message : "Falha ao detectar backends de voz",
    });
  }
}
