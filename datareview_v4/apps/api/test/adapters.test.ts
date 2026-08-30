/**
 * Testes herméticos do lote 2 de adaptadores — o mapa `map` de cada fonte é
 * exercitado com fixtures inline (sem rede). Valida normalização e shape.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import { bluesky, deezer, googlenews, mastodon, openalex, steam, wikidata } from "../src/adapters/moreSources.js";
import { buildAdapter } from "../src/adapters/index.js";

const opts: CollectOptions = { query: "typescript" };

function mapItems(source: { map: (data: unknown, options: CollectOptions) => NormalizedItem[] }, data: unknown): NormalizedItem[] {
  return source.map(data, opts);
}

function one(items: NormalizedItem[]): NormalizedItem {
  assert.ok(items[0], "deve haver ao menos 1 item");
  return items[0];
}

test("bluesky: normaliza posts públicos", () => {
  const first = one(mapItems(bluesky, {
    posts: [
      {
        uri: "at://did:plc:abc/app.bsky.feed.post/1",
        cid: "cid1",
        indexedAt: "2026-08-30T00:00:00.000Z",
        likeCount: 5,
        repostCount: 2,
        replyCount: 1,
        author: { handle: "ea.bsky.social", displayName: "EA" },
        record: { text: "Olá Typescript!" },
      },
    ],
  }));
  assert.equal(first.source, "bluesky");
  assert.equal(first.kind, "post");
  assert.equal(first.author, "ea.bsky.social");
  assert.equal(first.score, 5);
  assert.match(first.title!, /Olá Typescript/);
  assert.ok(first.url!.includes("bsky.app"));
});

test("deezer: normaliza faixas", () => {
  const first = one(mapItems(deezer, {
    data: [
      {
        id: 3135556,
        title: "Hard Times",
        link: "https://deezer.page.link/x",
        duration: 244,
        rank: 357894,
        explicit_lyrics: false,
        artist: { name: "Paramore" },
        album: { title: "After Laughter" },
      },
    ],
  }));
  assert.equal(first.source, "deezer");
  assert.equal(first.kind, "track");
  assert.equal(first.author, "Paramore");
  assert.match(first.title!, /Hard Times — Paramore/);
  assert.equal((first.meta as Record<string, unknown>).duration, 244);
});

test("steam: normaliza jogos (preço em centavos)", () => {
  const first = one(mapItems(steam, {
    items: [
      {
        id: 570,
        name: "Hades",
        price: { final: 3000, currency: "BRL" },
        discount: 15,
        platforms: ["win", "linux"],
        metacritic: { score: 93, url: "/metacritic/headlines/search/?appid=570" },
      },
    ],
  }));
  assert.equal(first.source, "steam");
  assert.equal(first.kind, "game");
  assert.equal(first.score, 93);
  assert.ok(first.url!.includes("/app/570/"));
  assert.match(first.text!, /BRL 30.00/);
});

test("lobsters: sem JSON público (endpoint descontinuado)", () => {
  const built = buildAdapter("lobsters", {});
  assert.equal(built.source, undefined);
  assert.equal(built.manifest?.id, "lobsters");
  assert.equal(built.manifest?.status, "bridge");
});

test("googlenews: normaliza itens do RSS", () => {
  const xml = `<rss><channel><item><title>TypeScript 6 saiu</title><link>https://ex.com/a</link><source url="https://ex.com">Blog Dev</source><pubDate>Sat, 30 Aug 2026 10:00:00 GMT</pubDate><guid>t</guid></item></channel></rss>`;
  const first = one(mapItems(googlenews, xml));
  assert.equal(first.source, "googlenews");
  assert.equal(first.kind, "article");
  assert.equal(first.author, "Blog Dev");
  assert.equal(first.url, "https://ex.com/a");
});

test("wikidata: normaliza entidades", () => {
  const first = one(mapItems(wikidata, {
    search: [
      { id: "Q12418", label: "TypeScript", description: "linguagem de programação", language: "pt", aliases: ["TS"] },
    ],
  }));
  assert.equal(first.source, "wikidata");
  assert.equal(first.kind, "entity");
  assert.equal(first.id, "Q12418");
  assert.ok(first.url!.includes("/wiki/Q12418"));
});

test("openalex: normaliza papers", () => {
  const first = one(mapItems(openalex, {
    results: [
      {
        id: "https://openalex.org/W1",
        title: "TypeScript in the wild",
        doi: "https://doi.org/10.1000/xyz",
        publication_year: 2024,
        cited_by_count: 12,
        type: "article",
        authorships: [{ author: { display_name: "Ada Lovelace" } }],
      },
    ],
  }));
  assert.equal(first.source, "openalex");
  assert.equal(first.score, 12);
  assert.equal(first.author, "Ada Lovelace");
  assert.equal(first.date, "2024");
});

test("mastodon: normaliza posts por hashtag (limpa HTML do content)", () => {
  const first = one(mapItems(mastodon, [
    {
      id: "1",
      uri: "https://mastodon.social/@ea/1",
      url: "https://mastodon.social/@ea/1",
      content: "<p>Olá <a href=\"#ts\">#typescript</a> &amp; amigos</p>",
      created_at: "2026-08-30T00:00:00Z",
      favourites_count: 3,
      reblogs_count: 1,
      replies_count: 0,
      account: { username: "ea", display_name: "EA Dev" },
    },
  ]));
  assert.equal(first.source, "mastodon");
  assert.equal(first.author, "ea");
  assert.match(first.title!, /#typescript/);
  assert.ok(!first.text!.includes("<"));
});

test("registry: lote 2 registrado (buildAdapter resolve fonte real)", () => {
  for (const id of ["bluesky", "deezer", "steam", "googlenews", "wikidata", "openalex", "mastodon"]) {
    const built = buildAdapter(id, {});
    assert.ok(built.source, `${id} deve ter adaptador real`);
    assert.equal(built.source!.id, id);
  }
});

test("registry: youtube continua 501 (não portado) com manifest bridge", () => {
  const built = buildAdapter("youtube", {});
  assert.equal(built.source, undefined);
  assert.equal(built.manifest?.id, "youtube");
  assert.equal(built.manifest?.status, "bridge");
});