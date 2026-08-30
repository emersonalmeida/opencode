/**
 * Git Canvas — cliente do snapshot do repositório local (servidor).
 *
 * Chama `GET /functions/v1/git-local/snapshot`: o servidor executa os
 * comandos git SOMENTE-LEITURA no seu cwd e devolve os textos; aqui eles
 * são parseados pelo mesmo parser do upload (fonte única de verdade) e
 * convertidos para ProjectMap via `uploadResultToMap`.
 *
 * Sempre fresco: cada chamada relê o repositório — sem arquivos
 * intermediários, sem estado defasado.
 */
import { buildProjectMapFromUpload, uploadResultToMap } from "./gitUpload";
import { apiUrl } from "@/lib/apiBase";
import type { ProjectMap } from "./types";


export interface LocalSnapshotResponse {
  ok: boolean;
  repoName?: string;
  files: { name: string; text: string }[];
  failed: string[];
  message?: string;
  generatedAt: string;
}

export interface LocalSnapshotResult {
  ok: boolean;
  map?: ProjectMap;
  message: string;
  /** sha do HEAD no momento do snapshot — usado p/ detectar mudanças. */
  headSha?: string;
}

/** Busca o snapshot do servidor e converte para ProjectMap. Nunca lança. */
export async function fetchLocalSnapshotMap(): Promise<LocalSnapshotResult> {
  let snap: LocalSnapshotResponse;
  try {
    const r = await fetch(apiUrl("/functions/v1/git-local/snapshot"));
    snap = (await r.json()) as LocalSnapshotResponse;
    if (!r.ok && !snap.files) {
      return { ok: false, message: snap.message ?? `Servidor respondeu ${r.status}.` };
    }
  } catch {
    return {
      ok: false,
      message: "Servidor local inacessível. Rode `npm run dev:server` na raiz do repositório.",
    };
  }
  if (!snap.ok) {
    return { ok: false, message: snap.message ?? "Snapshot indisponível." };
  }
  const result = buildProjectMapFromUpload(
    snap.files.map((f) => ({ name: f.name, relativePath: f.name, text: f.text })),
  );
  if (result.commits.length === 0 && result.branches.length === 0) {
    return { ok: false, message: "Snapshot lido, mas sem commits nem branches reconhecidos." };
  }
  if (snap.repoName) result.name = snap.repoName;
  const map = uploadResultToMap(result, "snapshot do servidor", "local-snapshot");
  if (snap.repoName) map.project.name = snap.repoName;
  if (snap.failed.length > 0) {
    map.uploadMeta = {
      ...map.uploadMeta!,
      gaps: [...(map.uploadMeta?.gaps ?? []), `Comandos que falharam no servidor: ${snap.failed.join(", ")}`],
    };
  }
  return { ok: true, map, message: `Snapshot de ${snap.repoName ?? "repo"} gerado em ${snap.generatedAt}.`, headSha: map.local.headSha };
}
