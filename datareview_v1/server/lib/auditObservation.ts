/**
 * auditObservation — wrapper server-side para gravar uma Observation a cada
 * chamada de fonte, no padrão failure-safe do rawStore (A3). A rota da fonte
 * encapsula o fetch com `withObservation(...)` e passa a gravação do
 * schema+duração+confiança sem acoplar a regra ao renderer.
 */
import { captureObservation, type Observation } from "./rawStore";

/**
 * Encapsula uma chamada de fonte, medindo a duração e gravando a Observation.
 * O HTTP status do fetch interno não é capturado (rotas de fonte usam fetch
 * diretamente); o que se registra aqui é a camada do Engine: duration/schema/
 * confidence. Falha na gravação nunca quebra a coleta.
 */
export async function withObservation<T>(
  runId: string,
  sourceId: string,
  endpoint: string,
  url: string | undefined,
  params: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  let result: T | undefined;
  
  try {
    result = await fn();
  } catch (err) {
    ;
    // Grava a falha honesta (confidence=0 vindo de blocked/rate-limit/timeout)
    // e re-lança — a rota original segue respondendo o erro do mesmo jeito.
    try {
      captureObservation({
        runId,
        sourceId,
        endpoint,
        url,
        params,
        payload: undefined,
        durationMs: Date.now() - started,
      });
    } catch {
      // best-effort
    }
    throw err;
  }
  try {
    captureObservation({
      runId,
      sourceId,
      endpoint,
      url,
      params,
      payload: result,
      durationMs: Date.now() - started,
    });
  } catch {
    // best-effort — a coleta segue mesmo se a gravação falhar.
  }
  return result;
}
