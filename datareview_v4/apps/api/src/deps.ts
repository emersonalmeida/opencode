/**
 * Dependências do app — montadas uma vez no bootstrap e injetadas nos routes
 * (testável: o teste injeta storage em memória + registry de adaptadores fake).
 */
import type { SerpApiQuotaPort, SourcePort, StoragePort } from "@v4/domain";
import { createSerpApiQuotaStore } from "@v4/sources/quota";
import { SerpApiSource } from "@v4/sources";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ApiKeys } from "./keys.js";
import { keysFromEnv } from "./keys.js";
import { SqliteStorage } from "./storage/sqlite.js";
import type { AdapterFactory } from "./adapters/index.js";
import { ADAPTERS } from "./adapters/index.js";

export interface SerpDeps {
  source: SourcePort;
  quota: SerpApiQuotaPort;
}

export interface AppDeps {
  storage: StoragePort;
  keys: ApiKeys;
  adapters: Record<string, AdapterFactory>;
  serp?: SerpDeps;
  /** Porta de escuta do server (apenas bootstrap). */
  port: number;
  /** Diretório de dados persistidos (bootstrap/log). */
  dataDir: string;
}

export interface EnvLike {
  PORT?: string;
  DATA_DIR?: string;
  SERPAPI_KEY?: string;
}

export async function buildDeps(env: EnvLike, processEnv: NodeJS.ProcessEnv = process.env): Promise<AppDeps> {
  const port = Number.parseInt(env.PORT ?? processEnv.PORT ?? "8787", 10);
  const dataDir = resolve(env.DATA_DIR ?? processEnv.DATA_DIR ?? ".data");
  mkdirSync(dataDir, { recursive: true });

  const storage: StoragePort = new SqliteStorage(join(dataDir, "dataset.sqlite"));
  const keys = keysFromEnv(processEnv);

  let serp: SerpDeps | undefined;
  if (keys.SERPAPI_KEY) {
    const quota = await createSerpApiQuotaStore({ filePath: join(dataDir, "serpapi-quota.json") });
    serp = {
      source: new SerpApiSource({ apiKey: keys.SERPAPI_KEY, quotaManagedExternally: true }),
      quota,
    };
  }

  return { storage, keys, adapters: ADAPTERS, serp, port, dataDir };
}