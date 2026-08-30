import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import type { SystemProfile } from "../../server/lib/systemProfileCore";

/**
 * Cliente do perfil de sistema: busca no servidor local o hardware detectado
 * (CPU/RAM/GPU) + modelos Ollama instalados + recomendação (tier, melhor
 * modelo, num_ctx). Usado pelo modo de IA "Automático" e pelo dropdown de
 * modelos nas configurações.
 *
 * Complementa com os hints do BROWSER (núcleos lógicos e deviceMemory) que o
 * servidor não vê — úteis quando o backend roda em outra máquina (modo cloud
 * ou servidor remoto).
 */


export interface BrowserHints {
  cores: number;
  /** deviceMemory é uma aproximação arredondada (Chrome): 0.25–8+. */
  memoryGB: number | null;
}

export function browserHints(): BrowserHints {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  return {
    cores: nav?.hardwareConcurrency ?? 0,
    memoryGB:
      nav && "deviceMemory" in nav && typeof (nav as { deviceMemory?: number }).deviceMemory === "number"
        ? (nav as { deviceMemory: number }).deviceMemory
        : null,
  };
}

let cache: { profile: SystemProfile | null; error: string | null; at: number } | null = null;
let inflight: Promise<SystemProfile | null> | null = null;
const CLIENT_CACHE_MS = 20_000;

/** Busca o perfil no servidor local. `force` ignora o cache (botão redetectar). */
export async function fetchSystemProfile(force = false): Promise<SystemProfile | null> {
  if (!force && cache && Date.now() - cache.at < CLIENT_CACHE_MS) return cache.profile;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const r = await fetch(apiUrl(`/functions/v1/system-profile${force ? "?refresh=1" : ""}`), {
        signal: AbortSignal.timeout(8000),
      });
      const ct = r.headers.get("content-type") ?? "";
      if (!ct.includes("json")) {
        // Servidor offline: o host de dev responde HTML (índice) — não é a
        // detecção que falhou, é o servidor local inacessível.
        throw new Error(`servidor local inacessível (resposta não-JSON: ${ct || r.status || "?"})`);
      }
      if (!r.ok) throw new Error(`servidor respondeu ${r.status}`);
      const profile = (await r.json()) as SystemProfile;
      cache = { profile, error: null, at: Date.now() };
      return profile;
    } catch (e) {
      cache = {
        profile: null,
        error: e instanceof Error ? e.message : "falha ao detectar",
        at: Date.now(),
      };
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export interface SystemProfileState {
  profile: SystemProfile | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSystemProfile(): SystemProfileState {
  const [profile, setProfile] = useState<SystemProfile | null>(cache?.profile ?? null);
  const [loading, setLoading] = useState(!cache);
  const [error, setError] = useState<string | null>(cache?.error ?? null);

  const load = useCallback(async (force: boolean) => {
    setLoading(true);
    const p = await fetchSystemProfile(force);
    setProfile(p);
    setError(p ? null : cache?.error ?? "servidor indisponível");
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!cache || Date.now() - cache.at >= CLIENT_CACHE_MS) void load(false);
    else setLoading(false);
  }, [load]);

  return { profile, loading, error, refresh: () => void load(true) };
}
