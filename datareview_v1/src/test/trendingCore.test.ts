/**
 * Guarda do núcleo do extrator Trending (server/lib/trendingCore.ts):
 * parsing do RPC batchexecute (fixture real capturada do Google em
 * 2026-08-25), parsing do RSS de notícias, merge determinístico com
 * proveniência, KPIs e utilidades de exibição.
 */
import { describe, it, expect } from "vitest";
import {
  enrichWithRss,
  exploreUrl,
  formatTraffic,
  hoursLabel,
  mergeTrending,
  parseBatchexecuteTrends,
  parseTrendingRss,
  relativeTime,
  topicLabel,
  trendKey,
  trendingKpis,
  type TrendingItem,
} from "../../server/lib/trendingCore";

// Envelope real do batchexecute (estrutura idêntica à resposta do Google):
// ")]}'" + linha com [["wrb.fr","i0OFE","<json string>",...]].
function rpcFixture(rows: unknown[][]): string {
  const inner = JSON.stringify([null, rows]);
  const envelope = JSON.stringify([["wrb.fr", "i0OFE", inner, null, null, "generic"]]);
  return `)]}'\n\n${envelope}\n`;
}

function row(over: Partial<Record<number, unknown>> = {}): unknown[] {
  const base: unknown[] = [
    "botafogo x athletico-pr", // 0 título
    null, // 1
    "BR", // 2 geo
    [1787602200], // 3 [startTs]
    null, // 4 [endTs] | null (ativo)
    null, // 5
    500000, // 6 volume
    null, // 7
    1000, // 8 crescimento %
    ["botafogo x athletico-pr", "athletico pr"], // 9 consultas relacionadas
    [17], // 10 tópicos
    [[4784599100, "pt", "BR"]], // 11 entity ids
    "botafogo x athletico-pr", // 12 título (dup)
  ];
  for (const [k, v] of Object.entries(over)) base[Number(k)] = v;
  return base;
}

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0">
  <channel>
    <item>
      <title>byd mako</title>
      <ht:approx_traffic>200+</ht:approx_traffic>
      <pubDate>Tue, 25 Aug 2026 06:50:00 -0700</pubDate>
      <ht:picture>https://img.example/byd.jpg</ht:picture>
      <ht:picture_source>G1</ht:picture_source>
      <ht:news_item>
        <ht:news_item_title>BYD mostra picape híbrida Mako</ht:news_item_title>
        <ht:news_item_snippet/>
        <ht:news_item_url>https://g1.globo.com/carros/byd-mako</ht:news_item_url>
        <ht:news_item_picture>https://img.example/byd.jpg</ht:news_item_picture>
        <ht:news_item_source>G1</ht:news_item_source>
      </ht:news_item>
      <ht:news_item>
        <ht:news_item_title>BYD Mako vs Fiat Toro</ht:news_item_title>
        <ht:news_item_url>https://motor1.uol.com.br/byd-mako</ht:news_item_url>
        <ht:news_item_source>Motor1.com Brasil</ht:news_item_source>
      </ht:news_item>
    </item>
    <item>
      <title>viaduto</title>
      <ht:approx_traffic>200+</ht:approx_traffic>
      <pubDate>Tue, 25 Aug 2026 06:30:00 -0700</pubDate>
      <ht:news_item>
        <ht:news_item_title>MP aponta problemas em viaduto</ht:news_item_title>
        <ht:news_item_url>https://campograndenews.com.br/viaduto</ht:news_item_url>
        <ht:news_item_source>Campo Grande News</ht:news_item_source>
      </ht:news_item>
    </item>
  </channel>
</rss>`;

describe("parseBatchexecuteTrends", () => {
  it("parseia linhas do RPC com todos os campos", () => {
    const items = parseBatchexecuteTrends(rpcFixture([row()]), { hours: 24 });
    expect(items).toHaveLength(1);
    const t = items[0];
    expect(t.title).toBe("botafogo x athletico-pr");
    expect(t.traffic).toBe(500000);
    expect(t.growthPct).toBe(1000);
    expect(t.startedAt).toBe(new Date(1787602200 * 1000).toISOString());
    expect(t.active).toBe(true);
    expect(t.endedAt).toBeUndefined();
    expect(t.relatedQueries).toEqual(["botafogo x athletico-pr", "athletico pr"]);
    expect(t.topicIds).toEqual([17]);
    expect(t.rank).toBe(0);
    expect(t.provenance.hours).toEqual([24]);
  });

  it("marca encerrado quando há endTs", () => {
    const items = parseBatchexecuteTrends(rpcFixture([row({ 4: [1787700000] })]), { hours: 48 });
    expect(items[0].active).toBe(false);
    expect(items[0].endedAt).toBe(new Date(1787700000 * 1000).toISOString());
  });

  it("ignora lixo: linhas não-JSON, chunks de outro rpcid e linhas sem título", () => {
    const garbage = `)]}'\n123\n[["wrb.fr","outroRPC","{}",null]]\n${JSON.stringify([["wrb.fr", "i0OFE", JSON.stringify([null, [[null, null, "BR"]]]), null]])}\n`;
    expect(parseBatchexecuteTrends(garbage, { hours: 24 })).toEqual([]);
  });

  it("preserva o rank (ordem da fonte)", () => {
    const items = parseBatchexecuteTrends(
      rpcFixture([row(), row({ 0: "segundo", 12: "segundo" })]),
      { hours: 24 },
    );
    expect(items.map((t) => t.rank)).toEqual([0, 1]);
  });
});

describe("parseTrendingRss + enrichWithRss", () => {
  it("extrai notícias, imagem e fonte por trend", () => {
    const map = parseTrendingRss(RSS_FIXTURE);
    expect(map.size).toBe(2);
    const byd = map.get("byd mako")!;
    expect(byd.news).toHaveLength(2);
    expect(byd.news[0]).toMatchObject({ title: "BYD mostra picape híbrida Mako", source: "G1" });
    expect(byd.picture).toBe("https://img.example/byd.jpg");
    expect(byd.pictureSource).toBe("G1");
  });

  it("enriquece só os trends que batem por trendKey (dedup acento-insensível)", () => {
    const items = parseBatchexecuteTrends(rpcFixture([row({ 0: "BYD Mako", 12: "BYD Mako" })]), { hours: 24 });
    enrichWithRss(items, parseTrendingRss(RSS_FIXTURE));
    expect(items[0].news).toHaveLength(2);
    expect(items[0].picture).toBe("https://img.example/byd.jpg");
  });
});

describe("mergeTrending", () => {
  const a = parseBatchexecuteTrends(rpcFixture([row()]), { hours: 24 })[0];
  const b: TrendingItem = {
    ...a,
    traffic: 750000,
    growthPct: 1200,
    startedAt: new Date(1787500000 * 1000).toISOString(),
    relatedQueries: ["athletico pr", "onde assistir"],
    topicIds: [17, 14],
    provenance: { hours: [48] },
  };

  it("dedup por trendKey mantendo maior volume, início mais antigo e união de campos", () => {
    const merged = mergeTrending([[a], [b]]);
    expect(merged).toHaveLength(1);
    const t = merged[0];
    expect(t.traffic).toBe(750000);
    expect(t.growthPct).toBe(1200);
    expect(t.startedAt).toBe(new Date(1787500000 * 1000).toISOString());
    expect(t.relatedQueries).toEqual(["athletico pr", "botafogo x athletico-pr", "onde assistir"]);
    expect(t.topicIds).toEqual([14, 17]);
    expect(t.provenance.hours).toEqual([24, 48]);
  });

  it("active vence ended (trend ativo em qualquer janela fica ativo)", () => {
    const ended: TrendingItem = { ...a, active: false, endedAt: "2026-08-25T00:00:00.000Z", provenance: { hours: [168] } };
    const merged = mergeTrending([[ended], [a]]);
    expect(merged[0].active).toBe(true);
    expect(merged[0].endedAt).toBeUndefined();
  });

  it("ordena por volume desc", () => {
    const small: TrendingItem = { ...a, title: "outro", traffic: 100, provenance: { hours: [24] } };
    const merged = mergeTrending([[small, a]]);
    expect(merged.map((t) => t.title)).toEqual(["botafogo x athletico-pr", "outro"]);
  });
});

describe("trendingKpis", () => {
  it("agrega totais, ativos, fontes e tópicos", () => {
    const items = parseBatchexecuteTrends(
      rpcFixture([row(), row({ 0: "byd mako", 12: "byd mako", 6: 200, 10: [1] })]),
      { hours: 24 },
    );
    enrichWithRss(items, parseTrendingRss(RSS_FIXTURE));
    const k = trendingKpis(items);
    expect(k.total).toBe(2);
    expect(k.active).toBe(2);
    expect(k.totalTraffic).toBe(500200);
    expect(k.newsCount).toBe(2);
    expect(k.sources).toEqual(["G1", "Motor1.com Brasil"]);
    expect(k.perTopic).toEqual({ 1: 1, 17: 1 });
  });
});

describe("utilidades", () => {
  it("trendKey é acento/case-insensível (pontuação é preservada)", () => {
    expect(trendKey("Café")).toBe(trendKey("cafe"));
    expect(trendKey("  São Paulo ")).toBe("sao paulo");
  });

  it("formatTraffic compacta em PT-BR", () => {
    expect(formatTraffic(500)).toBe("500");
    expect(formatTraffic(10000)).toBe("10 mil");
    expect(formatTraffic(2000000)).toBe("2 mi");
  });

  it("relativeTime em PT-BR", () => {
    const now = Date.parse("2026-08-25T12:00:00Z");
    expect(relativeTime("2026-08-25T11:58:00Z", now)).toBe("há 2 min");
    expect(relativeTime("2026-08-25T10:00:00Z", now)).toBe("há 2 h");
    expect(relativeTime("2026-08-22T12:00:00Z", now)).toBe("há 3 dias");
    expect(relativeTime("lixo", now)).toBe("");
  });

  it("topicLabel tem nomes verificados e fallback honesto", () => {
    expect(topicLabel(17)).toBe("Esportes");
    expect(topicLabel(999)).toBe("Tópico 999");
  });

  it("hoursLabel e exploreUrl", () => {
    expect(hoursLabel(168)).toBe("Últimos 7 dias");
    expect(exploreUrl("byd mako", "br")).toBe(
      "https://trends.google.com/trends/explore?q=byd%20mako&geo=BR",
    );
  });
});
