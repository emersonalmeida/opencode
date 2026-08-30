import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { SerpApiBudget } from "@v4/contracts";
import type { SerpApiQuotaPort } from "@v4/domain";

export interface SerpApiQuotaStoreOptions {
  filePath: string;
  limit?: number;
}

export interface SerpApiQuotaStore extends SerpApiQuotaPort {
  readonly filePath: string;
}

const MONTH_MS = 30 * 24 * 60 * 60 * 1000;

export async function createSerpApiQuotaStore(
  options: SerpApiQuotaStoreOptions,
  now: number =Date.now(),
): Promise<SerpApiQuotaStore> {
  const limit = options.limit ?? 250;
  let used =0;
  let resetsAt = now + MONTH_MS;

  try {
    const raw = await readFile(options.filePath, "utf8");
    const data = JSON.parse(raw) as { used?: unknown; resetsAt?: unknown };
    if (typeof data.resetsAt === "number" && (data.resetsAt as number) > now) {
      resetsAt = data.resetsAt as number;
      used = typeof data.used === "number" ? (data.used as number) : 0;
    }
  } catch {
    // arquivo ausente ou corrompido — comeca zerada ate persistir
  }

  async function persist(): Promise<void> {
    await mkdir(dirname(options.filePath), { recursive: true });
    await writeFile(options.filePath, JSON.stringify({ used, resetsAt, updatedAt: now }, null, 2));
  }

  async function reconcile(): Promise<void> {
    if (resetsAt <= now) {
      used =0;
      resetsAt = now + MONTH_MS;
      await persist();
    }
  }

  return {
    filePath: options.filePath,

    async budget() {
      await reconcile();
      return { limit, used, resetsAt };
    },

    async remaining(count: number) {
      await reconcile();
      return used + count <= limit;
    },

    async consume(count: number, engine: string, forSource: string) {
      await reconcile();
      if (used + count > limit) {
        throw new Error("serpapi quota exhausted (" + engine + " for " + forSource + ")");
      }
      used += count;
      await persist();
    },

    async reconcile(): Promise<SerpApiBudget> {
      await reconcile();
      return { limit, used, resetsAt };
    },
  };
}