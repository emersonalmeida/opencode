/**
 * Cliente do editor de componentes (`/functions/v1/component-source`).
 * Lê/escreve o código-fonte real via servidor local; sem servidor, mostra
 * erro honesto (o Vite HMR aplica a mudança em todas as páginas em dev).
 */
import { apiUrl } from "@/lib/apiBase";

export interface ComponentSourceResult { ok: boolean; error?: string }

export async function fetchComponentSource(file: string): Promise<{ ok: true; source: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(apiUrl(`/functions/v1/component-source?file=${encodeURIComponent(file)}`));
    const data = (await res.json()) as { ok: boolean; source?: string; error?: string };
    if (!res.ok || !data.ok || typeof data.source !== "string") {
      return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, source: data.source };
  } catch (err) {
    return {
      ok: false,
      error: "Sem servidor local — a edição precisa do backend (npm run dev:server). " + String((err as Error).message),
    };
  }
}

export async function saveComponentSource(file: string, source: string): Promise<ComponentSourceResult> {
  try {
    const res = await fetch(apiUrl("/functions/v1/component-source"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "write", file, source }),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!res.ok || !data.ok) return { ok: false, error: data.error ?? `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String((err as Error).message) };
  }
}
