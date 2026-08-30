/**
 * Rota GET|POST /functions/v1/git-local/snapshot
 *
 * Gera um snapshot do repositório git local (cwd do servidor) sob demanda —
 * sempre fresco, sem arquivos intermediários. O cliente parseia os textos
 * com o mesmo parser do upload (`gitUpload.ts`).
 *
 * Somente-leitura: nenhum comando de escrita é executado.
 */
import type { Request, Response } from "express";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { collectGitSnapshot } from "../lib/gitSnapshot.js";

const execFileP = promisify(execFile);

async function execGit(args: string[]): Promise<string> {
  const { stdout } = await execFileP("git", args, {
    cwd: process.cwd(),
    timeout: 10000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

export async function gitLocalSnapshot(_req: Request, res: Response) {
  const snapshot = await collectGitSnapshot(execGit);
  res.status(snapshot.ok ? 200 : 503).json(snapshot);
}
