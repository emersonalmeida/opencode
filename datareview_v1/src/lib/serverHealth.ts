/**
 * Saúde do servidor local — store pub/sub com polling.
 *
 * O servidor pode subir DEPOIS da página abrir (npm run dev:all) ou cair
 * e voltar. Este store monitora /health a cada 5s e notifica quando o
 * estado muda — as superfícies se recuperam sozinhas sem reload.
 *
 * Regra: NUNCA mostrar "erro de fonte" quando o servidor está offline —
 * o erro é do servidor, não da fonte.
 */
import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiBase";

export interface ServerHealth {
  /** null = ainda não checou; true = online; false = offline */
  online: boolean | null;
  /** erro da última sonda (quando offline) */
  error?: string;
  /** timestamp da última sonda */
  checkedAt: number;
  /** versão/commit que o SERVIDOR reporta estar rodando */
  serverVersion?: string;
  serverCommit?: string | null;
  /** true = a página aberta é de um build/commit DIFERENTE do servidor */
  versionMismatch?: boolean;
}

/**
 * Compara o commit do cliente (build atual) com o do servidor.
 * Regra honesta: só acusa divergência quando AMBOS os lados têm commit —
 * sem commit em qualquer lado, não há evidência para alarmar o usuário.
 */
export function computeVersionMismatch(
  clientCommit: string,
  serverCommit: string | null | undefined,
): boolean {
  return Boolean(clientCommit && serverCommit && clientCommit !== serverCommit);
}

/** Commit/versão do build em execução (injetados pelo Vite; "" fora do build). */
export function clientBuildInfo(): { version: string; commit: string; builtAt: string } {
  try {
    return { version: __APP_VERSION__, commit: __GIT_COMMIT__, builtAt: __BUILD_TIME__ };
  } catch {
    return { version: "", commit: "", builtAt: "" };
  }
}

let health: ServerHealth = { online: null, checkedAt: 0 };
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

/** Sonda o servidor local (/health). */
export async function probeServerHealth(): Promise<ServerHealth> {
  const at = Date.now();
  try {
    // AbortSignal.timeout nem sempre existe (jsdom/testes): detecção de feature.
    const withTimeout = (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout;
    const resp = await fetch(apiUrl("/health"), withTimeout ? { signal: withTimeout(4000) } : undefined);
    if (!resp.ok) {
      health = { online: false, error: `HTTP ${resp.status}`, checkedAt: at };
      notify();
      return health;
    }
    // /health deve ser JSON — se veio HTML (proxy sem servidor), trata como offline.
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.includes("json")) {
      health = { online: false, error: "resposta não-JSON", checkedAt: at };
      notify();
      return health;
    }
    const body = (await resp.json().catch(() => ({}))) as { version?: string; commit?: string | null };
    health = {
      online: true,
      checkedAt: at,
      serverVersion: body.version,
      serverCommit: body.commit ?? null,
      versionMismatch: computeVersionMismatch(clientBuildInfo().commit, body.commit),
    };
    notify();
    return health;
  } catch (e) {
    health = {
      online: false,
      error: e instanceof Error ? e.message : "Failed to fetch",
      checkedAt: at,
    };
    notify();
    return health;
  }
}

/** Inicia o polling (chamado uma vez no boot do app). */
export function startServerHealthMonitor(): void {
  if (interval) return;
  void probeServerHealth();
  interval = setInterval(() => void probeServerHealth(), 5000);
}

/** Para o polling (testes). */
export function stopServerHealthMonitor(): void {
  if (interval) clearInterval(interval);
  interval = null;
}

/** Hook reativo: true = online, false = offline, null = ainda não checou. */
export function useServerOnline(): boolean | null {
  const [state, setState] = useState<boolean | null>(health.online);
  useEffect(() => {
    const update = () => setState(health.online);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return state;
}

/** Hook reativo: true quando o build da página diverge do commit do servidor. */
export function useVersionMismatch(): boolean {
  const [state, setState] = useState<boolean>(health.versionMismatch ?? false);
  useEffect(() => {
    const update = () => setState(health.versionMismatch ?? false);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);
  return state;
}

/** Snapshot para leitura fora de React. */
export function getServerHealth(): ServerHealth {
  return health;
}

/** Reseta o estado (testes). */
export function resetServerHealthForTests(): void {
  health = { online: null, checkedAt: 0 };
  stopServerHealthMonitor();
}

/** Insere estado de saúde diretamente (testes). */
export function setServerHealthForTests(next: ServerHealth): void {
  health = next;
  notify();
}
