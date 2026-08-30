/**
 * Descoberta — guardas do catálogo do cliente + formato de métricas + o
 * resolver de URLs do núcleo puro do servidor (import cross-package, mesmo
 * padrão do cliente: server/lib é puro e não importa de src).
 */
import { describe, expect, it } from "vitest";
import {
  DISCOVER_GROUP_ORDER,
  DISCOVER_SECTIONS,
  getDiscoverSection,
  sectionParams,
} from "@/lib/discover/discoverSections";
import { formatScore, toUniItems } from "@/lib/discover/discoverApi";
import {
  normalizeInput,
  resolveUrl,
  fanoutTerm,
  RESOLVED_KIND_LABELS,
} from "../../server/lib/urlResolver";
import type { DiscoverItem } from "../../server/lib/discoverCore";

describe("Catálogo de seções da Descoberta", () => {
  it("ids únicos e contrato completo", () => {
    const ids = DISCOVER_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of DISCOVER_SECTIONS) {
      expect(s.title).toBeTruthy();
      expect(s.description.length).toBeGreaterThan(30);
      expect(DISCOVER_GROUP_ORDER).toContain(s.group);
      expect(s.icon).toBeTruthy();
      for (const f of s.fields) {
        expect(f.key).toBeTruthy();
        if (f.kind === "select") {
          expect(f.options?.length ?? 0).toBeGreaterThan(1);
          // default precisa ser uma das opções
          expect(f.options!.some((o) => o.value === f.default)).toBe(true);
        }
      }
    }
  });

  it("cobre as 14 fontes do lote A + B do servidor", () => {
    const ids = DISCOVER_SECTIONS.map((s) => s.id);
    expect(ids).toEqual([
      "wikitop", "wikiviews", "onthisday", "books",
      "crypto", "podcasts", "music", "steamtop",
      "clima", "brasil",
      "packages", "github-trending",
      "googlenews", "mastodon-trends",
    ]);
  });

  it("getDiscoverSection resolve e sectionParams mescla defaults", () => {
    const def = getDiscoverSection("packages");
    expect(def).toBeTruthy();
    const p = sectionParams(def!, {});
    expect(p.packages).toBe("react,vue,express");
    expect(p.period).toBe("last-week");
    // valor do usuário vence o default; campo vazio é omitido
    const p2 = sectionParams(def!, { packages: "vitest" });
    expect(p2.packages).toBe("vitest");
    const wiki = getDiscoverSection("wikitop")!;
    const p3 = sectionParams(wiki, { date: "" });
    expect(p3.project).toBe("pt.wikipedia");
    expect("date" in p3).toBe(false);
  });
});

describe("formatScore", () => {
  const mk = (score?: number, scoreLabel?: string): DiscoverItem => ({
    id: "x", title: "t", score, scoreLabel,
  });
  it("formata milhões, milhares e unidades com rótulo", () => {
    expect(formatScore(mk(2_500_000, "views"))).toBe("2,5 mi views");
    expect(formatScore(mk(35_000, "downloads no período"))).toBe("35 mil downloads no período");
    expect(formatScore(mk(1_200))).toBe("1,2 mil");
    expect(formatScore(mk(42, "°C agora"))).toBe("42 °C agora");
    expect(formatScore(mk(0.856, "% ao ano"))).toBe("0,86 % ao ano");
    expect(formatScore(mk())).toBe("");
  });
});

describe("toUniItems", () => {
  it("converte para o formato Uni (source custom) com proveniência da fonte", () => {
    const items: DiscoverItem[] = [
      { id: "a", title: "Brasil", subtitle: "Artigo", url: "https://x", score: 100, publishedAt: "2026-08-01", meta: { rank: 1 } },
      { id: "b", title: "Sem score" },
    ];
    const uni = toUniItems("wikitop", items);
    expect(uni).toHaveLength(2);
    expect(uni[0].source).toBe("custom");
    expect(uni[0].title).toBe("Brasil");
    expect(uni[0].score).toBe(100);
    expect(uni[0].date).toBe("2026-08-01");
    expect(uni[0].meta?.discoverSource).toBe("wikitop");
    expect(uni[0].id).toContain("discover-wikitop");
    // sem score → texto só com subtítulo; sem subtítulo → texto undefined
    expect(uni[1].text).toBeUndefined();
  });
});

describe("Resolver de URLs (núcleo puro do servidor)", () => {
  it("normalizeInput aceita DOI cru e domínio sem esquema", () => {
    expect(normalizeInput("10.1038/nature12373")).toBe("https://doi.org/10.1038/nature12373");
    expect(normalizeInput("github.com/a/b")).toBe("https://github.com/a/b");
    expect(normalizeInput("  https://x.com  ")).toBe("https://x.com");
  });

  it("resolve os 13 tipos cobertos + rótulos em PT-BR", () => {
    const cases: [string, string, string][] = [
      ["https://www.youtube.com/watch?v=abc123", "youtube", "abc123"],
      ["https://youtu.be/abc123", "youtube", "abc123"],
      ["https://pt.wikipedia.org/wiki/Brasil", "wikipedia", "Brasil"],
      ["https://github.com/facebook/react", "github", "facebook/react"],
      ["https://www.npmjs.com/package/react", "npm", "react"],
      ["https://pypi.org/project/requests", "pypi", "requests"],
      ["10.1038/nature12373", "doi", "10.1038/nature12373"],
      ["https://apps.apple.com/br/app/nubank/id814456780", "apple-app", "814456780"],
      ["https://play.google.com/store/apps/details?id=com.x.y", "google-app", "com.x.y"],
      ["https://store.steampowered.com/app/730", "steam", "730"],
      ["https://openlibrary.org/isbn/9780132350884", "openlibrary", "9780132350884"],
      ["https://mastodon.social/@user/109345", "mastodon", "mastodon.social/@user/109345"],
      ["https://www.reddit.com/r/brasil/comments/abc/titulo", "reddit", "brasil/abc"],
      ["https://exemplo.com/artigo", "generic", "https://exemplo.com/artigo"],
    ];
    for (const [input, kind, id] of cases) {
      const r = resolveUrl(input);
      expect(r, input).toBeTruthy();
      expect(r!.kind).toBe(kind);
      expect(r!.id).toBe(id);
      expect(RESOLVED_KIND_LABELS[r!.kind]).toBeTruthy();
    }
  });

  it("rotas do site GitHub (trending/explore) NÃO viram repositório", () => {
    const r = resolveUrl("https://github.com/trending/typescript");
    expect(r?.kind).not.toBe("github");
  });

  it("entradas inválidas retornam null", () => {
    expect(resolveUrl(":::")).toBeNull();
    expect(resolveUrl("")).toBeNull();
  });

  it("fanoutTerm sugere termo para repo/wiki/pacote e vazio para o resto", () => {
    expect(fanoutTerm(resolveUrl("https://github.com/facebook/react")!)).toBe("react");
    expect(fanoutTerm(resolveUrl("https://pt.wikipedia.org/wiki/Copa_do_Mundo")!)).toBe("Copa do Mundo");
    expect(fanoutTerm(resolveUrl("https://pypi.org/project/flask")!)).toBe("flask");
    // escopo npm com @ — remove o @ e pega o nome do pacote
    expect(fanoutTerm(resolveUrl("https://www.npmjs.com/package/@scope/name")!)).toBe("name");
    expect(fanoutTerm(resolveUrl("https://www.youtube.com/watch?v=x")!)).toBe("");
  });

  it("generic e reddit trazem hint de ação honesto", () => {
    expect(resolveUrl("https://exemplo.com")!.hint).toContain("Uni");
    expect(resolveUrl("https://www.reddit.com/r/x/comments/y/z")!.hint).toContain("Reddit");
  });
});
