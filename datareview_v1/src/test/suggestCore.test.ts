import { describe, expect, it } from "vitest";
import {
  buildSeeds, EXPANSION_GROUPS, groupStats, mergeObservations, recurring,
  seedBudget, suggestionTokens, VERTICAL_DS, verticalOverlap, rowsToMarkdown,
  type GatherObservation,
} from "@/lib/suggest/suggestCore";

const group = (id: string) => EXPANSION_GROUPS.find((g) => g.id === id)!;

describe("suggestCore — sondas (buildSeeds)", () => {
  it("base sempre primeiro + dedup + prefixo/sufixo", () => {
    const seeds = buildSeeds("python", [group("alphabet"), group("interrogative-prefix")]);
    expect(seeds[0]).toMatchObject({ seed: "python", group: "base", position: "base" });
    expect(seeds.some((s) => s.seed === "python a" && s.position === "suffix")).toBe(true);
    expect(seeds.some((s) => s.seed === "como python" && s.position === "prefix")).toBe(true);
    // sem duplicatas (case-insensitive)
    const keys = seeds.map((s) => s.seed.toLowerCase());
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("variações das categorias do docs/suggest.md viram sondas", () => {
    const all = buildSeeds("cripto");
    expect(all.some((s) => s.seed === "cripto tutorial")).toBe(true);
    expect(all.some((s) => s.seed === "cripto vs")).toBe(true);
    expect(all.some((s) => s.seed === "cripto golpe")).toBe(true);
  });

  it("orçamento respeita grupos selecionados e termo vazio não gera nada", () => {
    expect(buildSeeds("")).toEqual([]);
    expect(seedBudget("x", ["alphabet"])).toBe(27); // base + a–z
    expect(seedBudget("x", ["numbers"])).toBe(11); // base + 0–9
  });

  it("verticais do briefing mapeiam para ds correto", () => {
    expect(VERTICAL_DS.youtube).toBe("yt");
    expect(VERTICAL_DS.news).toBe("n");
    expect(VERTICAL_DS.shopping).toBe("sh");
    expect(VERTICAL_DS.web).toBe("");
  });
});

describe("suggestCore — merge determinístico", () => {
  const obs: GatherObservation[] = [
    { item: { text: "python tutorial", relevance: 500 }, seed: "python t", group: "alphabet", groupLabel: "Alfabeto", region: "br", vertical: "web" },
    { item: { text: "python tutorial", relevance: 800 }, seed: "python tutorial", group: "tutorials", groupLabel: "Tutoriais", region: "br", vertical: "youtube" },
    { item: { text: "python vs javascript", relevance: 300 }, seed: "python vs", group: "comparisons", groupLabel: "Comparações", region: "us", vertical: "web" },
    { item: { text: "Python Tutorial", relevance: 100 }, seed: "python a", group: "alphabet", groupLabel: "Alfabeto", region: "br", vertical: "web" },
  ];

  it("dedup case-insensitive com melhor relevância + proveniência acumulada", () => {
    const rows = mergeObservations(obs);
    // "python tutorial" e "Python Tutorial" viram uma linha
    expect(rows).toHaveLength(2);
    const tut = rows[0];
    expect(tut.text).toBe("python tutorial");
    expect(tut.relevance).toBe(800);
    expect(tut.occurrences).toBe(3);
    expect(tut.groups).toContain("alphabet");
    expect(tut.groups).toContain("tutorials");
    expect(tut.verticals).toContain("youtube");
    expect(tut.seeds).toHaveLength(3);
  });

  it("recorrência filtra sugestões frequentes", () => {
    const rows = mergeObservations(obs);
    expect(recurring(rows, 3)).toHaveLength(1);
    expect(recurring(rows, 3)[0].text).toBe("python tutorial");
  });

  it("estatísticas por grupo e sobreposição de verticais", () => {
    const stats = groupStats(obs);
    expect(stats.find((s) => s.group === "alphabet")?.seeds).toBe(2);
    const rows = mergeObservations(obs);
    const overlap = verticalOverlap(rows);
    const web = overlap.find((o) => o.vertical === "web")!;
    expect(web.unique).toBe(2); // ambas as linhas apareceram na web
    expect(web.shared).toBe(1); // python tutorial é compartilhado com youtube
  });

  it("tokens e markdown de exportação", () => {
    const rows = mergeObservations(obs);
    const tokens = suggestionTokens(rows, 10);
    expect(tokens[0].text).toBe("python");
    const md = rowsToMarkdown("python", rows);
    expect(md).toContain("# Suggest — python");
    expect(md).toContain("python tutorial");
  });
});
