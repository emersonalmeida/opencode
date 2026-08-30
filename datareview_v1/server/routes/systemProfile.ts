import type { RequestHandler } from "express";
import { detectSystemProfile, invalidateProfileCache } from "../lib/systemProfileDetect.js";

/**
 * GET/POST /functions/v1/system-profile
 *
 * Devolve o perfil de hardware da máquina onde o servidor local roda
 * (CPU, RAM, GPU, modelos Ollama instalados) + a recomendação calculada
 * (tier, melhor modelo, uso de GPU, num_ctx). O cliente usa isso para o modo
 * de IA "Automático" e para popular o dropdown de modelos com o que está
 * realmente instalado.
 *
 * Query/body opcionais: `ollamaUrl` (detecta contra outro endpoint Ollama,
 * sem usar o cache) e `refresh=1` (invalida o cache de 15s).
 */
export const systemProfile: RequestHandler = async (req, res) => {
  try {
    const body = (req.body ?? {}) as { ollamaUrl?: string; refresh?: boolean };
    const ollamaUrl =
      (typeof req.query.ollamaUrl === "string" && req.query.ollamaUrl) ||
      body.ollamaUrl ||
      undefined;
    const refresh = req.query.refresh === "1" || body.refresh === true;
    if (refresh) invalidateProfileCache();
    const profile = await detectSystemProfile(ollamaUrl);
    res.json(profile);
  } catch (e) {
    console.error("system-profile error:", e);
    res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
  }
};
