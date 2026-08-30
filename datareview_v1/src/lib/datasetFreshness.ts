/**
 * Freshness do dataset (todo.md P1): idade derivada de `collectedAt` com
 * label PT-BR ("hoje", "1 dia", "N dias", "N semanas", "N meses") e tom
 * (fresh ≤ 3d · aging ≤ 14d · stale). TTL padrão de 7 dias para marcar
 * "vencido" — humana e determinística (helpers puros).
 */
export interface Freshness {
  days: number;
  label: string;
  tone: "fresh" | "aging" | "stale";
  stale: boolean;
}
export const DEFAULT_TTL_DAYS = 7;

export function ageDays(collectedAt: number, now = Date.now()): number {
  if (!collectedAt || collectedAt <= 0) return 0;
  return Math.max(0, Math.floor((now - collectedAt) / 86400000));
}

function labelFor(days: number): string {
  if (days < 1) return "hoje";
  if (days < 2) return "há 1 dia";
  if (days < 7) return `há ${days} dias`;
  const weeks = Math.floor(days / 7);
  if (weeks < 2) return "há 1 semana";
  if (weeks < 5) return `há ${weeks} semanas`;
  const months = Math.max(1, Math.floor(days / 30));
  return months === 1 ? "há ~1 mês" : `há ~${months} meses`;
}

export function freshness(collectedAt: number, now = Date.now(), ttlDays = DEFAULT_TTL_DAYS): Freshness | null {
  if (!collectedAt || collectedAt <= 0) return null;
  const days = ageDays(collectedAt, now);
  const tone: Freshness["tone"] = days <= 3 ? "fresh" : days <= 14 ? "aging" : "stale";
  return { days, label: labelFor(days), tone, stale: days > ttlDays };
}
