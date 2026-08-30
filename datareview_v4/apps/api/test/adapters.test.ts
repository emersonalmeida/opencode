/**
 * Testes herméticos do lote 2 de adaptadores — o mapa `map` de cada fonte é
 * exercitado com fixtures inline (sem rede). Valida normalização e shape.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import { bluesky, crossref, deezer, devto, googlenews, mastodon, npm, openalex, openlibrary, steam, wikidata } from "../src/adapters/moreSources.js";
import { buildAdapter } from "../src/adapters/index.js";
import { custom, embedSearch, feed, itunesProxy, paste } from "../src/adapters/infraSources.js";

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

test("npm: normaliza pacotes", () => {
  const first = one(mapItems(npm, {
    objects: [
      {
        package: {
          name: "typescript",
          version: "5.8.3",
          description: "TypeScript is a language for application scale JavaScript development",
          date: "2025-03-10T17:00:00.000Z",
          keywords: ["node", "typescript"],
          links: { npm: "https://www.npmjs.com/package/typescript" },
          publisher: { username: "typescript-bot" },
        },
        score: { final: 0.9 },
        searchScore: 0.95,
      },
    ],
  }));
  assert.equal(first.source, "npm");
  assert.equal(first.kind, "package");
  assert.equal(first.author, "typescript-bot");
  assert.equal(first.score, 95);
  assert.ok(first.url!.includes("npmjs.com/package/typescript"));
});

test("crossref: normaliza papers", () => {
  const first = one(mapItems(crossref, {
    message: {
      items: [
        {
          DOI: "10.1000/xyz123",
          title: ["TypeScript performance"],
          URL: "https://doi.org/10.1000/xyz123",
          author: [{ given: "Ada", family: "Lovelace" }],
          "published-print": { "date-parts": [[2023, 5, 1]] },
          "is-referenced-by-count": 9,
          "container-title": ["J. Program. Lang."],
          type: "journal-article",
        },
      ],
    },
  }));
  assert.equal(first.source, "crossref");
  assert.equal(first.kind, "paper");
  assert.equal(first.author, "Ada Lovelace");
  assert.equal(first.score, 9);
  assert.equal(first.date, "2023");
  assert.equal((first.meta as Record<string, unknown>).doi, "10.1000/xyz123");
});

test("openlibrary: normaliza livros", () => {
  const first = one(mapItems(openlibrary, {
    docs: [
      {
        key: "/works/OL1W",
        title: "Programming TypeScript",
        author_name: ["Boris Cherny"],
        first_publish_year: 2019,
        isbn: ["9781492037651"],
        cover_i: 12345,
      },
    ],
  }));
  assert.equal(first.source, "openlibrary");
  assert.equal(first.kind, "book");
  assert.equal(first.author, "Boris Cherny");
  assert.equal(first.id, "/works/OL1W");
  assert.ok(first.url!.includes("/works/OL1W"));
});

test("devto: normaliza artigos por tag", () => {
  const first = one(mapItems(devto, [
    {
      id: 42,
      title: "TypeScript no front",
      description: "Boas práticas",
      url: "https://dev.to/ea/ts-front",
      published_at: "2026-08-30T00:00:00Z",
      positive_reactions_count: 21,
      comments_count: 4,
      tags: ["typescript", "webdev"],
      reading_time_minutes: 5,
      user: { name: "EA Dev", username: "ea" },
    },
  ]));
  assert.equal(first.source, "devto");
  assert.equal(first.kind, "article");
  assert.equal(first.author, "EA Dev");
  assert.equal(first.score, 21);
  assert.equal((first.meta as Record<string, unknown>).readingMinutes, 5);
});

test("registry: lote 2 registrado (buildAdapter resolve fonte real)", () => {
  for (const id of ["bluesky", "deezer", "steam", "googlenews", "wikidata", "openalex", "mastodon", "npm", "crossref", "openlibrary", "devto"]) {
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

test("paste: texto vira um item por linha (entrada manual)", () => {
  const first = one(mapItems(paste, { lines: ["primeira linha", "segunda linha"] }));
  assert.equal(first.source, "paste");
  assert.equal(first.kind, "document");
  assert.equal(first.title, "primeira linha");
  assert.equal(mapItems(paste, { lines: ["a", "b"] }).length, 2);
});

test("feed: normaliza RSS 2.0 genérico (query = URL do feed)", () => {
  const xml = `<rss><channel><item><title>Post 1</title><link>https://ex.com/1</link><description>desc 1</description><author>autor@ex.com (Autor)</author><pubDate>Sat, 30 Aug 2026 10:00:00 GMT</pubDate><guid>g1</guid></item><item><title>Post 2</title><guid>g2</guid></item></channel></rss>`;
  const items = mapItems(feed, xml);
  assert.equal(items.length, 2);
  assert.equal(items[0]!.title, "Post 1");
  assert.equal(items[0]!.url, "https://ex.com/1");
  assert.equal(items[0]!.author, "Autor");
});

test("feed: normaliza Atom 1.0", () => {
  const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom 1</title><link href="https://ex.com/a1"/><updated>2026-08-30T10:00:00Z</updated></entry></feed>`;
  const first = one(mapItems(feed, xml));
  assert.equal(first.kind, "article");
  assert.equal(first.url, "https://ex.com/a1");
});

test("custom: JSON genérico sem chave 'data' vira itens (works/results/docs)", () => {
  const first = one(mapItems(custom, {
    results: [{ title: "Repo X", html_url: "https://github.com/a/x", description: "desc" }],
  }));
  assert.equal(first.source, "custom");
  assert.equal(first.title, "Repo X");
  assert.equal(first.url, "https://github.com/a/x");
});

test("custom: JSON raiz vira um item (heuristic)", () => {
  const first = one(mapItems(custom, { id: 1, title: "Só", text: "um item" }));
  assert.equal(first.title, "Só");
  assert.equal(first.text, "um item");
});

test("custom: author aninhado (ex.: {author: {name}})", () => {
  const first = one(mapItems(custom, [{ title: "t", author: { name: "EA" } }]));
  assert.equal(first.author, "EA");
});

test("embed-search: resolve URLs (roteador → kind/id/fanoutTerm)", () => {
  const first = one(mapItems(embedSearch, {
    kind: "youtube", id: "dQw4w9WgXcQ", apiUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", fanoutTerm: "dQw4w9WgXcQ",
  }));
  assert.equal(first.source, "embed-search");
  assert.match(first.title!, /^youtube:/);
  assert.equal((first.meta as Record<string, unknown>).fanoutTerm, "dQw4w9WgXcQ");
});

test("embed-search: URL desconhecida falha honesto SEM rede", async () => {
  await assert.rejects(
    () => embedSearch.fetch({ query: "https://exemplo-desconhecido.com/xyz", limit: 10 }),
    /URL não reconhecida/,
  );
});

test("embed-search: URL youtube reconhecida no fetch", async () => {
  const r = (await embedSearch.fetch({ query: "https://youtu.be/dQw4w9WgXcQ", limit: 10 })) as Record<string, string>;
  assert.equal(r.kind, "youtube");
  assert.equal(r.id, "dQw4w9WgXcQ");
});

test("itunes-proxy: hostname fora do allowlist falha SEM rede", async () => {
  await assert.rejects(
    () => itunesProxy.fetch({ query: "https://github.com/a/b", limit: 10 }),
    /hostnames permitidos/,
  );
});

test("registry: infra/manual registradas (paste, feed, custom, embed-search, itunes-proxy)", () => {
  for (const id of ["paste", "feed", "custom", "embed-search", "itunes-proxy"]) {
    const built = buildAdapter(id, {});
    assert.ok(built.source, `${id} deve ter adaptador real`);
    assert.equal(built.source!.id, id);
  }
});

test("registry: 9 adaptadores originais agora implemented (sem manifest 501)", () => {
  for (const id of ["suggest", "hackernews", "gdelt", "github", "arxiv", "stackexchange", "semanticscholar", "wikipedia", "reddit"]) {
    const built = buildAdapter(id, {});
    assert.ok(built.source, `${id} deve ter adaptador real`);
    assert.equal(built.source!.id, id);
  }
});