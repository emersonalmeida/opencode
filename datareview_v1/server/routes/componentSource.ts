/**
 * Component source — leitura/escrita segura do código-fonte de componentes
 * do inventário, para o editor embutido da página `/componentes`. Escopo
 * restrito a `src/components/**` (sem traversal).
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve, normalize } from "node:path";
import type { Request, Response } from "express";

const COMPONENT_ROOT = resolve(process.cwd(), "src", "components");

/** Sanitiza e resolve o path; null se inválido/inesperto. */
export function sanitizeComponentPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.length > 200) return null;
  const rel = raw.replace(/^src[\\/]/, "");
  if (!rel.startsWith("components/")) return null;
  if (rel.includes("..")) return null;
  // Apenas .ts/.tsx dentro do diretório de componentes.
  if (!/\.(tsx|ts)$/.test(rel)) return null;
  const abs = normalize(join(COMPONENT_ROOT, rel.slice("components/".length)));
  if (!abs.startsWith(COMPONENT_ROOT)) return null;
  return abs;
}

export function componentSource(req: Request, res: Response) {
  const body = req.body as { op?: string; file?: string; source?: string } | undefined;
  const file = req.method === "GET" ? req.query.file : body?.file;
  const abs = sanitizeComponentPath(file);
  if (!abs) {
    res.status(400).json({ ok: false, error: "path inválido — apenas arquivos .ts/.tsx em src/components/" });
    return;
  }

  if (req.method === "GET" || body?.op === "read") {
    if (!existsSync(abs)) {
      res.status(404).json({ ok: false, error: "arquivo não encontrado" });
      return;
    }
    res.json({ ok: true, file: abs.slice(COMPONENT_ROOT.length + 1), source: readFileSync(abs, "utf8") });
    return;
  }

  const source = body?.source;
  if (typeof source !== "string" || !source.trim()) {
    res.status(400).json({ ok: false, error: "source vazio" });
    return;
  }
  if (source.length > 200_000) {
    res.status(413).json({ ok: false, error: "source excede 200KB" });
    return;
  }
  try {
    writeFileSync(abs, source, "utf8");
    res.json({ ok: true, file: abs.slice(COMPONENT_ROOT.length + 1), bytes: source.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: String((err as Error).message) });
  }
}
