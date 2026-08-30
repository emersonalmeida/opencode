/**
 * Alerta de rate-limit do amp-api (todo.md P0): lê a telemetria delta que a
 * rota apple-reviews embute na resposta (`{ telemetry: { amp, degraded } }`)
 * e alerta o usuário quando >=30% das tentativas foram throttled (429) —
 * loga no activityStore e mostra toast acionável. O status agregado do
 * processo também é consultável via GET /functions/v1/rate-limit-status.
 */
import { toastError } from "@/lib/ux";
import { logActivity } from "@/lib/activityStore";

export interface AmpTelemetry {
  attempts: number;
  ok: number;
  status429: number;
  status0: number;
  other: number;
  last429At: number | null;
}
export interface AppleRouteTelemetry {
  amp?: AmpTelemetry;
  degraded?: boolean;
}

/** Se degradada, loga + toasta (idempotente por coleta — chama-se 1x por resposta). */
export function checkAppleTelemetry(telemetry: AppleRouteTelemetry | undefined, appName: string): void {
  if (!telemetry?.amp || telemetry.degraded !== true) return;
  const { attempts, status429 } = telemetry.amp;
  const msg = `Apple rate-limit em "${appName}": ${status429}/${attempts} tentativas retornaram 429 — a coleta está degradada para este IP.`;
  logActivity("apple-reviews", "error", msg, "Tente novamente em alguns minutos; o IP é desbanido sozinho.");
  toastError("Coleta Apple degradada por rate-limit", {
    description: `${status429}/${attempts} tentativas 429 • rendimento menor — tente de novo em alguns minutos.`,
  });
}
