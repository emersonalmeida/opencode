/**
 * Snapshot demo (dados REAIS coletados) para o modo Demo da página
 * /testes-fontes.
 *
 * Princípio honesto: o modo Demo NÃO fabrica itens — carrega um snapshot
 * gravado em `public/demo-sources.json` (gerado por `npm run demo:freeze`
 * com o servidor local online). Sem o arquivo, o modo Demo fica
 * indisponível com instrução honesta (nunca inventa resultado).
 *
 * Formato: { capturedAt, term, sources: Record<sourceId, UniItem[]> }.
 */
import type { UniItem } from "@/lib/uni/types";

export interface DemoSnapshot {
  capturedAt: number;
  term: string;
  sources: Record<string, UniItem[]>;
}

let cached: Promise<DemoSnapshot | null> | null = null;

export function loadDemoSnapshot(): Promise<DemoSnapshot | null> {
  if (!cached) {
    cached = fetch("/demo-sources.json")
      .then(async (r) => (r.ok ? ((await r.json()) as DemoSnapshot) : null))
      .catch(() => null);
  }
  return cached;
}

export function resetDemoSnapshotCache(): void {
  cached = null;
}
