/**
 * Servidor mínimo sobre node:http — zero dependências de framework.
 * Porta 8788 (a aplicação original usa 8787 — ambas podem rodar juntas).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { cors, notFound, route, type Route } from "./router.js";
import { listSources, collectSource } from "./routes/sources.js";
import { health } from "./routes/health.js";

const PORT = Number(process.env.PORT ?? 8788);

const routes: Route[] = [
  route("GET", "/api/v1/health", health),
  route("GET", "/api/v1/sources", listSources),
  route("POST", "/api/v1/sources/collect", collectSource),
];

function match(req: IncomingMessage, res: ServerResponse): boolean {
  const url = (req.url ?? "").split("?")[0] ?? "";
  for (const r of routes) {
    if (r.method !== req.method) continue;
    const m = r.pattern.exec(url);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? "")));
    void r.handler(req, res, { params });
    return true;
  }
  return false;
}

const server = createServer((req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  if (!match(req, res)) notFound(res);
});

server.listen(PORT, () => {
  console.log(`core-next server → http://localhost:${PORT}`);
});
