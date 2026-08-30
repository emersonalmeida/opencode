/**
 * Identidade estável de um item — determinística, usada para deduplicação.
 *
 * A prioridade é: id explícito da fonte → URL → hash do conteúdo. Assim o
 * mesmo item coletado duas vezes gera a mesma chave, sem depender do adaptador.
 */
import type { NormalizedItem } from "@v4/contracts";

/** FNV-1a 32-bit — determinístico e portátil (Node/browser), sem deps. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
 for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function stableId(item: NormalizedItem): string {
  const explicit = item.id || item.url;
  if (explicit) {
    return `${item.source}#${explicit.slice(0, 200)}`;
  }
  const hash = fnv1a(
    `${item.title}|${item.author ?? ""}|${item.date ?? ""}|${(item.text ?? "").slice(0, 80)}`,
  );
  return `${item.source}#${hash}`;
}