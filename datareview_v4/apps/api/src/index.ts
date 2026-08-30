/**
 * Bootstrap da API — monta as deps (storage SQLite em DATA_DIR, chaves de env,
 * fallback SerpAPI opcional) e escuta em PORT (default 8787).
 *
 * Executar: pnpm --filter @v4/api dev   (tsx watch)
 */
import { buildDeps } from "./deps.js";
import { createApp } from "./server.js";

const deps = await buildDeps({});
const app = createApp(deps);

const server = app.listen(deps.port, () => {
  console.log(`[api] datareview-v4 escutando em http://127.0.0.1:${deps.port}`);
  console.log(`[api] dataDir: ${deps.dataDir}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}