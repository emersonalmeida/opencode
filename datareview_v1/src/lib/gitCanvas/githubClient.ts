/**
 * Git Canvas — cliente do provider GitHub (spec §25).
 *
 * O TOKEN NUNCA vive no frontend: quem fala com a API do GitHub é o servidor
 * local (rota /functions/v1/github/*, Parte 6), que lê GITHUB_TOKEN do
 * ambiente. Este cliente apenas consulta o status e, quando a rota existe,
 * busca o ProjectMap real. Qualquer falha vira um estado HONESTO
 * ("Conexão necessária" + o que o usuário pode fazer — spec §41/§51).
 */
import type { ProjectMap } from "./types";
import { apiUrl } from "@/lib/apiBase";
import type { ProviderStatus, RepoRef } from "./providers";


export async function checkGitHubStatus(): Promise<ProviderStatus> {
  try {
    const r = await fetch(apiUrl("/functions/v1/github/status"), {
      signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) {
      return {
        kind: "github",
        state: "disconnected",
        connected: false,
        message:
          r.status === 404
            ? "Conexão necessária — o servidor local ainda não expõe a integração GitHub."
            : `Erro de API (${r.status}). Verifique o servidor local.`,
      };
    }
    const data = (await r.json()) as { connected?: boolean; message?: string };
    return {
      kind: "github",
      state: data.connected ? "connected" : "disconnected",
      connected: data.connected === true,
      message: data.message,
    };
  } catch {
    return {
      kind: "github",
      state: "disconnected",
      connected: false,
      message: "Servidor local indisponível. Rode `npm run dev:server` e configure GITHUB_TOKEN no .env.",
    };
  }
}

/**
 * Resultado plano (o app usa strict:false — sem narrowing de union
 * discriminada; checar `ok === true && map` antes de usar).
 */
export interface FetchMapResult {
  ok: boolean;
  map?: ProjectMap;
  error?: string;
}

/** Busca o mapa real do projeto. Erros vêm com a razão honesta para exibir. */
export async function fetchGitHubProjectMap(repo: RepoRef): Promise<FetchMapResult> {
  try {
    const r = await fetch(apiUrl("/functions/v1/github/project-map"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(repo),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      let msg = `Erro ${r.status} no servidor local.`;
      try {
        const body = (await r.json()) as { error?: string };
        if (body.error) msg = body.error;
      } catch { /* corpo não-JSON */ }
      return { ok: false, error: msg };
    }
    const data = (await r.json()) as { map?: ProjectMap };
    if (data.map) return { ok: true, map: data.map };
    return { ok: false, error: "O servidor respondeu sem mapa. Verifique a versão do servidor local." };
  } catch {
    return { ok: false, error: "Servidor local indisponível ou timeout. Rode `npm run dev:server`." };
  }
}
