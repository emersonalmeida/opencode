/**
 * Cliente da API interna — fetch nativo, zero dependência.
 * O cliente fala com a própria origem; em dev, o vite proxy repassa a 8788.
 */
import type { CollectResponse, SourceDescriptor } from "@shared/contracts.js";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, init);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return (await resp.json()) as T;
}

export const api = {
  sources() {
    return request<{ sources: SourceDescriptor[] }>("/api/v1/sources");
  },
  collect(source: string, query: string, limit = 12): Promise<CollectResponse> {
    return request<CollectResponse>("/api/v1/sources/collect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source, query, limit }),
    });
  },
};
