import type { RequestHandler } from "express";
import {
  listRunEvents,
  subscribeRunEvents,
  type RunEvent,
} from "../lib/rawStore.js";

/**
 * Stream SSE dos eventos de coleta (rawStore) — alimenta a aba "Output" da
 * página Uni (terminal de coleta em tempo real, no estilo do docs/_uni.py).
 *
 *   GET /functions/v1/uni-runs/stream
 *
 * Ao conectar, envia os últimos 30 eventos (histórico recente) e depois
 * todos os eventos ao vivo: start/finish de runs e progress intermediário.
 * Heartbeat a cada 25s para manter proxies/conexões abertas.
 */
export const uniRunStream: RequestHandler = (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  const send = (e: RunEvent) => {
    res.write(`data: ${JSON.stringify(e)}\n\n`);
  };

  // Histórico recente primeiro (mais antigo → mais novo) para contexto.
  const history = listRunEvents(30).reverse();
  for (const h of history) {
    send({ event: h.event as "start" | "finish", run: h.run });
  }

  const unsubscribe = subscribeRunEvents(send);
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
};
