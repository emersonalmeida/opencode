/**
 * GET /functions/v1/google-fonts
 * Catálogo de famílias do Google Fonts para a busca de fontes da página de
 * Configurações. Proxy do metadata público (fonts.google.com/metadata/fonts),
 * cache de 24h em memória. Resposta: { families: string[], count }.
 * Falha de rede → 503 honesto (o cliente cai nos presets + campo manual).
 */
import type { Request, Response } from "express";

interface FontMeta { family: string }

let cache: { families: string[]; at: number } | null = null;
const TTL_MS = 24 * 60 * 60 * 1000;

export async function googleFontsCatalog(_req: Request, res: Response): Promise<void> {
  if (cache && Date.now() - cache.at < TTL_MS) {
    res.json({ families: cache.families, count: cache.families.length, cached: true });
    return;
  }
  try {
    const upstream = await fetch("https://fonts.google.com/metadata/fonts", {
      signal: AbortSignal.timeout(12_000),
    });
    if (!upstream.ok) {
      res.status(503).json({ error: `Google Fonts indisponível (${upstream.status})` });
      return;
    }
    const raw = await upstream.text();
    // O metadata vem com prefixo anti-XSSI ")]}'" — remover antes do parse.
    const json = JSON.parse(raw.replace(/^\)\]\}'\s*/, "")) as { familyMetadataList?: FontMeta[] };
    const families = (json.familyMetadataList ?? [])
      .map((f) => f.family)
      .filter((f): f is string => typeof f === "string" && f.length > 0)
      .sort((a, b) => a.localeCompare(b));
    if (families.length === 0) {
      res.status(503).json({ error: "Catálogo do Google Fonts vazio" });
      return;
    }
    cache = { families, at: Date.now() };
    res.json({ families, count: families.length, cached: false });
  } catch (err) {
    res.status(503).json({
      error: `Não foi possível buscar o catálogo do Google Fonts (${err instanceof Error ? err.message : "rede"})`,
    });
  }
}
