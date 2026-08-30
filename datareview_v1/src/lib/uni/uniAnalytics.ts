/**
 * Uni — analytics determinísticos puros sobre UniItem[] (sem UI, testáveis).
 */
import type { UniItem } from "./types";

const STOPWORDS = new Set(
  ("a,o,e,ou,de,da,do,em,um,uma,que,com,para,por,como,mais,mas,se,na,no,ao,à,os,as,dos,das," +
   "é,foi,ser,ter,está,estão,são,não,sim,meu,minha,seu,sua,isso,esse,essa,este,esta," +
   "the,and,for,with,you,your,this,that,from,have,has,are,was,were,not,but,all,can")
    .split(","),
);

/** Frequência de termos (2+ letras, sem stopwords) sobre título+texto. */
export function uniWordFreq(items: UniItem[], limit = 30): { text: string; value: number }[] {
  const freq = new Map<string, number>();
  for (const item of items) {
    const text = `${item.title} ${item.text ?? ""}`.toLowerCase();
    const seenInItem = new Set<string>();
    for (const raw of text.split(/[^\p{L}\p{N}]+/u)) {
      if (raw.length < 3 || STOPWORDS.has(raw) || /^\d+$/.test(raw)) continue;
      if (seenInItem.has(raw)) continue; // conta 1x por item (frequência de documento)
      seenInItem.add(raw);
      freq.set(raw, (freq.get(raw) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Distribuição por fonte. */
export function uniSourceDist(items: UniItem[]): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const item of items) map.set(item.source, (map.get(item.source) ?? 0) + 1);
  return [...map.entries()].map(([label, value]) => ({ label, value }));
}

/** Distribuição por tipo de item. */
export function uniKindDist(items: UniItem[]): { label: string; value: number }[] {
  const map = new Map<string, number>();
  for (const item of items) map.set(item.kind, (map.get(item.kind) ?? 0) + 1);
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Top itens por score (engajamento). */
export function uniTopScored(items: UniItem[], limit = 15): { label: string; value: number }[] {
  return items
    .filter((i) => (i.score ?? 0) > 0)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit)
    .map((i) => ({ label: i.title.slice(0, 40) || "(sem título)", value: i.score ?? 0 }));
}

/**
 * Serializa itens para o contexto da IA — cap de caracteres, os itens com
 * texto/score têm prioridade.
 */
export function uniSerializeForAI(items: UniItem[], maxChars = 12000): string {
  const sorted = [...items].sort((a, b) => {
    const wa = (a.text ? 1 : 0) + (a.score != null ? 1 : 0);
    const wb = (b.text ? 1 : 0) + (b.score != null ? 1 : 0);
    return wb - wa;
  });
  const lines: string[] = [];
  let used = 0;
  for (const item of sorted) {
    const parts = [
      `- [${item.source}/${item.kind}] ${item.title}`,
      item.author ? `autor: ${item.author}` : "",
      item.score != null ? `score: ${item.score}` : "",
      item.date ? `data: ${item.date.slice(0, 10)}` : "",
      item.url ? `url: ${item.url}` : "",
    ].filter(Boolean).join(" | ");
    const text = item.text && item.text !== item.title ? `\n  ${item.text.slice(0, 300)}` : "";
    const line = parts + text;
    if (used + line.length > maxChars) break;
    used += line.length;
    lines.push(line);
  }
  return lines.join("\n");
}
