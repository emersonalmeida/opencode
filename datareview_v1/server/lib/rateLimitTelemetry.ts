/**
 * Telemetria local de rate-limit (todo.md P0): contadores em memória por
 * fonte de coleta (amp-api / SSR / RSS) — requests, sucessos, 429s e
 * transitórios (timeout/rede). Exposta via `GET /functions/v1/rate-limit-status`
 * e embutida nas respostas da rota apple-reviews (delta do run) para o
 * cliente alertar quando a coleta estiver degradada por IP.
 */
export interface RateSourceStats {
  attempts: number;
  ok: number;
  status429: number;
  status0: number;
  other: number;
  last429At: number | null;
}
export type RateSourceId = "amp" | "ssr" | "rss";
export interface RateTelemetry {
  resetAt: number;
  sources: Record<RateSourceId, RateSourceStats>;
}

const blank = (): RateSourceStats => ({ attempts: 0, ok: 0, status429: 0, status0: 0, other: 0, last429At: null });
const telemetry: RateTelemetry = {
  resetAt: Date.now(),
  sources: { amp: blank(), ssr: blank(), rss: blank() },
};

export function recordStatus(source: RateSourceId, status: number): void {
  const s = telemetry.sources[source];
  s.attempts++;
  if (status === 200) s.ok++;
  else if (status === 429) { s.status429++; s.last429At = Date.now(); }
  else if (status === 0) s.status0++;
  else s.other++;
}

/** Snapshot profundo — o delta por run é calculado com before/after. */
export function getTelemetry(): RateTelemetry {
  return JSON.parse(JSON.stringify(telemetry)) as RateTelemetry;
}

/** Degradado quando ≥30% das tentativas recentes forem throttled (429). */
export function isDegraded(source: RateSourceStats): boolean {
  return source.attempts >= 10 && source.status429 / source.attempts >= 0.3;
}
