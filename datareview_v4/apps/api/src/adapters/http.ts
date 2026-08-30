/**
 * Helper HTTP para os adaptadores — fetch com timeout conservador e User-Agent.
 * Convenção: NUNCA derruba a coleta; o adaptador captura e devolve `error`
 * honesto na CollectResponse (parcial-OK, igual ao legado v1).
 */
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/140.0 Safari/537.36";

export { UA };

export interface FetchJsonInit {
  signal?: AbortSignal;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** true = não envia header Accept (alguns hosts respondem mal a application/json). */
  noAccept?: boolean;
  /** corpo/método para POST (usado por YouTube next, Google Trends explore). */
  method?: string;
  body?: string;
}

/**
 * Combina o signal externo com um timeout interno. Quando o chamador aborta,
 * abortamos com a MESMA razão (para os adaptadores distinguirem cancelamento).
 */
export function withTimeout(
  signal?: AbortSignal,
  timeoutMs = 15000,
): { signal: AbortSignal; cleanup: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("timeout", "TimeoutError")), timeoutMs);
  if (signal) {
    if (signal.aborted) ctrl.abort(signal.reason);
    else signal.addEventListener("abort", () => ctrl.abort(signal.reason), { once: true });
  }
  return { signal: ctrl.signal, cleanup: () => clearTimeout(timer) };
}

export async function fetchJson(
  url: string,
  init: FetchJsonInit = {},
): Promise<unknown> {
  const { signal, cleanup } = withTimeout(init.signal, init.timeoutMs);
  try {
    const resp = await fetch(url, {
      method: init.method,
      body: init.body,
      headers: { "User-Agent": UA, ...(init.noAccept ? {} : { Accept: "application/json" }), ...init.headers },
      signal,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} ${resp.statusText}${body ? ` — ${body.slice(0, 160)}` : ""}`);
    }
    return fetchJsonBody(resp, url);
  } finally {
    cleanup();
  }
}

export function safe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fetchJsonBody(resp: Response, url: string): Promise<unknown> {
  return resp.json().catch(() => {
    throw new Error(`resposta inválida (JSON) de ${url}`);
  });
}

/** Busca HTML/texto (scraping) — mesmo timeout/UA do fetchJson. */
export async function fetchText(
  url: string,
  init: FetchJsonInit = {},
): Promise<string> {
  const { signal, cleanup } = withTimeout(init.signal, init.timeoutMs);
  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": UA, ...init.headers },
      signal,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`HTTP ${resp.status} ${resp.statusText}${body ? ` — ${body.slice(0, 160)}` : ""}`);
    }
    return resp.text();
  } finally {
    cleanup();
  }
}

/** Asserta shape de estrutura indexada (única checagem que os adaptadores fazem). */
export function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}