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
import { cratesio, doaj, npmDownloads, pypi, rubygems } from "../src/adapters/codeSources.js";
import { archive, itchio, openfoodfacts, podcasts, producthunt, tvmaze } from "../src/adapters/mediaSources.js";
import { lobsters, suggestProvider, web } from "../src/adapters/uni.js";
import { apple } from "../src/adapters/apple.js";
import {
  brasilapiFeriados, brasilapiTaxas, crypto, frankfurter, githubTrending, ibgeNomes, mastodonTrends,
  onthisday, openlibraryTrending, steamtop, trending, weather, wikitop, wikiviews,
} from "../src/adapters/dataSources.js";

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

test("pypi: lookup exato de pacote", () => {
  const first = one(mapItems(pypi, {
    info: {
      name: "requests",
      version: "2.32.3",
      summary: "Python HTTP for Humans.",
      author: "Kenneth Reitz",
      license: "Apache-2.0",
      requires_python: ">=3.8",
      project_urls: { Homepage: "https://requests.readthedocs.io" },
    },
  }));
  assert.equal(first.source, "pypi");
  assert.equal(first.kind, "package");
  assert.equal(first.title, "requests 2.32.3");
  assert.equal(first.author, "Kenneth Reitz");
  assert.equal(first.url, "https://requests.readthedocs.io");
  assert.equal((first.meta as Record<string, unknown>).version, "2.32.3");
});

test("pypi: nome inválido recusa SEM rede", () => {
  assert.rejects(() => pypi.fetch({ query: "../etc/passwd" }), /nome de pacote válido/);
});

test("rubygems: normaliza gems", () => {
  const first = one(mapItems(rubygems, [
    { name: "rails", version: "8.0.0", info: "Ruby on Rails", homepage_uri: "https://rubyonrails.org", downloads: 123456, version_created_at: "2026-08-01T00:00:00Z" },
  ]));
  assert.equal(first.source, "rubygems");
  assert.equal(first.kind, "package");
  assert.equal(first.title, "rails");
  assert.equal(first.score, 123456);
  assert.equal(first.url, "https://rubyonrails.org");
});

test("cratesio: normaliza crates", () => {
  const first = one(mapItems(cratesio, {
    crates: [
      { id: "serde", name: "serde", max_version: "1.0.200", description: "bom", downloads: 5, recent_downloads: 3, updated_at: "2026-08-01T00:00:00Z" },
    ],
  }));
  assert.equal(first.source, "cratesio");
  assert.equal(first.kind, "package");
  assert.equal(first.score, 3);
  assert.ok(first.url!.includes("crates.io/crates/serde"));
});

test("npm-downloads: normaliza ponto agregado", () => {
  const first = one(mapItems(npmDownloads, { downloads: 424242, start: "2026-08-01", end: "2026-08-08", package: "typescript" }));
  assert.equal(first.source, "npm-downloads");
  assert.equal(first.kind, "metric");
  assert.equal(first.score, 424242);
  assert.match(first.title!, /424\.242/);
});

test("npm-downloads: período inválido recusa SEM rede", () => {
  assert.rejects(() => npmDownloads.fetch({ query: "typescript", engine: "banana" }), /período inválido/);
});

test("doaj: normaliza artigos (results ou data)", () => {
  const first = one(mapItems(doaj, {
    results: [
      {
        bibjson: {
          title: "TypeScript em pesquisa",
          abstract: "resumo",
          year: "2025",
          author: [{ name: "Ada Lovelace" }],
          journal: { title: "J. Program." },
          identifier: [{ type: "doi", id: "10.1000/abc" }],
          link: [{ url: "https://ex.com/pdf" }],
        },
      },
    ],
  }));
  assert.equal(first.source, "doaj");
  assert.equal(first.kind, "paper");
  assert.equal(first.author, "Ada Lovelace");
  assert.equal((first.meta as Record<string, unknown>).doi, "10.1000/abc");
  assert.equal(first.url, "https://ex.com/pdf");
});

test("registry: lote 5 registrado (pypi, rubygems, cratesio, doaj, npm-downloads)", () => {
  for (const id of ["pypi", "rubygems", "cratesio", "doaj", "npm-downloads"]) {
    const built = buildAdapter(id, {});
    assert.ok(built.source, `${id} deve ter adaptador real`);
    assert.equal(built.source!.id, id);
  }
});

test("archive: normaliza itens do Internet Archive", () => {
  const first = one(mapItems(archive, {
    response: {
      numFound: 1,
      docs: [
        { identifier: "abc123", title: "O livro velho", creator: "Autor X", date: "1950", downloads: 5000, mediatype: "texts" },
      ],
    },
  }));
  assert.equal(first.source, "archive");
  assert.equal(first.kind, "document");
  assert.equal(first.score, 5000);
  assert.ok(first.url!.includes("/details/abc123"));
});

test("tvmaze: normaliza séries", () => {
  const first = one(mapItems(tvmaze, [
    { score: 0.9, show: { id: 100, name: "Dark", url: "https://tvmaze.com/shows/100", rating: { average: 8.5 }, premiered: "2017-12-01", status: "Ended", genres: ["Drama", "Mystery"], summary: "<p>Família</p>", language: "German", image: { medium: "https://x/img.jpg" } } },
  ]));
  assert.equal(first.source, "tvmaze");
  assert.equal(first.kind, "series");
  assert.equal(first.title, "Dark");
  assert.equal(first.score, 8.5);
  assert.equal(first.date, "2017-12-01");
});

test("openfoodfacts: normaliza produtos", () => {
  const first = one(mapItems(openfoodfacts, {
    products: [
      { code: "789000", product_name: "Arroz Integral", brands: "Tio João", nutriscore_grade: "b", nova_group: 1, ingredients_text: "arroz", categories_tags: ["en:cereals", "pt:graos"], image_url: "https://x/img.jpg" },
    ],
  }));
  assert.equal(first.source, "openfoodfacts");
  assert.equal(first.kind, "product");
  assert.equal(first.title, "Arroz Integral");
  assert.equal(first.text, "arroz");
  assert.equal((first.meta as Record<string, unknown>).nutriscore, "b");
});

test("podcasts: normaliza charts do iTunes (JSON RSS)", () => {
  const first = one(mapItems(podcasts, {
    feed: {
      entry: [
        { "im:name": { label: "Pod" }, title: { label: "Pod — duração curta" }, id: { label: "https://podcasts.apple.com/pod/id1" }, "im:artist": { label: "Fulano" }, "im:image": [{ label: "https://x/s.jpg" }] },
      ],
    },
  }));
  assert.equal(first.source, "podcasts");
  assert.equal(first.kind, "podcast");
  assert.equal(first.author, "Fulano");
  assert.equal(first.score, 1);
});

test("producthunt: normaliza o feed público (RSS)", () => {
  const xml = `<rss><channel><item><title>App Foda — lançamento</title><link>https://www.producthunt.com/posts/app-foda</link><description>desc</description><pubDate>Sat, 30 Aug 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const first = one(mapItems(producthunt, xml));
  assert.equal(first.source, "producthunt");
  assert.equal(first.kind, "product");
  assert.equal(first.title, "App Foda — lançamento");
  assert.ok(first.url!.includes("producthunt.com/posts/app-foda"));
});

test("itchio: extrai títulos do HTML de busca", () => {
  const html = `<div class="game_cell"><a class="title game_link" href="/game/meu-jogo" data-label="Game_title">Meu Jogo</a> <a class="title game_link" href="/game/outro">Outro</a></div>`;
  const items = mapItems(itchio, html);
  assert.ok(items.length >= 1);
  assert.equal(items[0]!.source, "itchio");
  assert.equal(items[0]!.kind, "game");
  assert.equal(items[0]!.title, "Meu Jogo");
});

test("itchio: HTML sem jogos → erro honesto (map)", () => {
  assert.throws(() => mapItems(itchio, "<html><body>empty</body></html>"), /nenhum jogo extraído/);
});

test("registry: lote 6 registrado (archive, tvmaze, openfoodfacts, podcasts, producthunt, itchio)", () => {
  for (const id of ["archive", "tvmaze", "openfoodfacts", "podcasts", "producthunt", "itchio"]) {
    const built = buildAdapter(id, {});
    assert.ok(built.source, `${id} deve ter adaptador real`);
    assert.equal(built.source!.id, id);
  }
});

test("wikitop: normaliza ranking de views", () => {
  const first = one(mapItems(wikitop, {
    items: [{ project: "pt.wikipedia", year: "2026", month: "08", day: "29", articles: [{ article: "Ayrton_Senna", views: 5000, rank: 1 }] }],
  }));
  assert.equal(first.source, "wikitop");
  assert.equal(first.score, 5000);
  assert.match(first.title!, /Ayrton Senna/);
  assert.ok(first.url!.includes("pt.wikipedia.org/wiki/Ayrton_Senna"));
});

test("wikiviews: agrega views diárias (Action API prop=pageviews)", () => {
  const first = one(mapItems(wikiviews, {
    query: { pages: { 123: { pageid: 123, ns: 0, title: "TypeScript", pageviews: { "20260828": 100, "20260829": 40 } } } },
  }));
  assert.equal(first.source, "wikiviews");
  assert.equal(first.kind, "metric");
  assert.equal(first.score, 140);
  assert.match(first.title!, /140/);
});

test("onthisday: normaliza eventos escolhidos", () => {
  const items = mapItems(onthisday, {
    selected: [
      { text: "Nasceu Ada Lovelace", year: 1815, pages: [{ content_urls: { desktop: { page: "https://pt.wikipedia.org/wiki/Ada_Lovelace" } } }] },
    ],
  });
  const first = one(items);
  assert.equal(first.source, "onthisday");
  assert.equal(first.kind, "event");
  assert.equal(first.date, "1815");
  assert.match(first.title!, /Ada Lovelace/);
});

test("crypto: normaliza trending da CoinGecko", () => {
  const first = one(mapItems(crypto, {
    coins: [
      { item: { id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1, data: { price: { usd: 60000 }, price_change_percentage_24h: { usd: 1.5 } } } },
    ],
  }));
  assert.equal(first.source, "crypto");
  assert.equal(first.kind, "crypto");
  assert.equal(first.title, "Bitcoin (btc)");
  assert.equal(first.score, 1);
});

test("steamtop: normaliza top da SteamSpy", () => {
  const first = one(mapItems(steamtop, {
    "10": { appid: 10, name: "Counter-Strike", positive: 900000, negative: 5000, owners: "10M..15M", players_2weeks: 400000, price: 0 },
  }));
  assert.equal(first.source, "steamtop");
  assert.equal(first.kind, "game");
  assert.match(first.title!, /Counter-Strike/);
  assert.match(first.text!, /grátis/);
});

test("weather: normaliza clima por cidade", () => {
  const first = one(mapItems(weather, [
    { city: "São Paulo", temperature_2m: 24.3, relative_humidity_2m: 62, precipitation: 0, wind_speed_10m: 8, weather_code: 1, units: { relative_humidity_2m: "%", precipitation: "mm", wind_speed_10m: "km/h" } },
  ]));
  assert.equal(first.source, "weather");
  assert.equal(first.kind, "metric");
  assert.match(first.title!, /São Paulo/);
});

test("brasilapi-feriados: normaliza lista anual", () => {
  const first = one(mapItems(brasilapiFeriados, [{ date: "2026-01-01", name: "Confraternização Universal", type: "national" }]));
  assert.equal(first.source, "brasilapi-feriados");
  assert.equal(first.kind, "event");
  assert.equal(first.date, "2026-01-01");
});

test("brasilapi-taxas: normaliza taxas do BC", () => {
  const first = one(mapItems(brasilapiTaxas, [{ nome: "Taxa Selic", valor: 10.75, data: "2026-08-29" }]));
  assert.equal(first.source, "brasilapi-taxas");
  assert.equal(first.kind, "metric");
  assert.equal(first.score, 10.75);
  assert.match(first.text!, /10\.75/);
});
test("frankfurter: normaliza câmbio (engine = base, query = símbolos)", () => {
  const items = mapItems(frankfurter, { base: "USD", date: "2026-08-29", rates: { BRL: 5.4, EUR: 0.9 } });
  assert.equal(items.length, 2);
  const brl = one(items);
  assert.match(brl.title!, /1 USD = 5,4 BRL/);
  assert.equal((brl.meta as Record<string, unknown>).symbol, "BRL");
});

test("suggest-provider: normaliza sugestões bing", () => {
  const first = one(mapItems(suggestProvider, { provider: "bing", label: "Bing", query: "typescript", suggs: ["typescript tutorial", "typescript handbook"] }));
  assert.equal(first.source, "suggest-provider");
  assert.equal(first.kind, "suggestion");
  assert.equal(first.title, "typescript tutorial");
  assert.equal(first.score, 1000);
  const items = mapItems(suggestProvider, { provider: "bing", label: "Bing", query: "typescript", suggs: ["a", "b"] });
  assert.equal(items[1]?.score, 900);
});

test("web: extrai artigo de URL (action page)", () => {
  const items = mapItems(web, { action: "page", url: "https://example.com/a", article: { title: "Artigo Teste", text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\nSegundo paragrafo com conteudo suficiente para passar no filtro de tamanho minimo de quarenta caracteres ok ok.", words: 31 }, links: ["https://x.com"] });
  const first = one(items);
  assert.equal(first.source, "web");
  assert.equal(first.kind, "document");
  assert.equal(first.title, "Artigo Teste");
  assert.equal((first.meta as Record<string, unknown>).links, 1);
});

test("web: action feed usa parseFeed", () => {
  const xml = `<rss><channel><item><title>Primeiro</title><link>https://e.com/1</link><description>Descricao do item</description></item></channel></rss>`;
  const first = one(mapItems(web, { action: "feed", url: "https://e.com/feed", xml }));
  assert.equal(first.source, "web");
  assert.equal(first.kind, "article");
  assert.equal(first.title, "Primeiro");
});

test("lobsters: normaliza timeline da tag", () => {
  const first = one(mapItems(lobsters, [
    { short_id: "abc123", title: "TypeScript 6 chegou", description: "Resumo", short_id_url: "https://lobste.rs/s/abc123", url: "https://e.com/x", comment_count: 4, score: 10, created_at: "2026-08-30T00:00:00Z", submitter_user: { username: "joe" } },
  ]));
  assert.equal(first.source, "lobsters");
  assert.equal(first.kind, "post");
  assert.equal(first.title, "TypeScript 6 chegou");
  assert.equal(first.author, "joe");
  assert.equal(first.score, 10);
  assert.equal((first.meta as Record<string, unknown>).comments, 4);
});

test("registry: lote 8 registrado (suggest-provider, web, lobsters)", () => {
  for (const id of ["suggest-provider", "web", "lobsters"]) {
    const built = buildAdapter(id, {});
    assert.ok(built.source, `${id} deve ter adaptador real`);
    assert.equal(built.source!.id, id);
  }
});

test("apple: normaliza reviews (shape amp-api/SSR)", () => {
  const items = mapItems(apple, {
    id: "284882215",
    cc: "br",
    sort: "mostrecent",
    reviews: [
      { id: "1", rating: 4, title: "Muito bom", text: "App estável e rápido no dia a dia.", author: "Maria", date: "2026-08-29", version: "470.0" },
      { id: "2", rating: 2, title: "Lento", text: "Abriu várias vezes depois da atualização até responder.", author: "Joao", date: "2026-08-28", version: "470.0" },
    ],
  });
  assert.equal(items.length, 2);
  const first = one(items);
  assert.equal(first.source, "apple");
  assert.equal(first.kind, "review");
  assert.equal(first.score, 4);
  assert.equal(first.author, "Maria");
  assert.equal((first.meta as Record<string, unknown>).country, "br");
});

test("apple: parseRss lê shape do feed itunes", async () => {
  const { parseRss } = await import("../src/adapters/apple.js");
  const reviews = parseRss(
    {
      feed: {
        entry: [
          { id: { label: "x1" }, "im:rating": { label: "5" }, title: { label: "Excelente" }, content: { label: "Recomendo muito este aplicativo." }, author: { label: "Ana" }, updated: { label: "2026-08-29T00:00:00-07:00" } },
        ],
      },
    },
    "br",
  );
  assert.equal(reviews[0]?.rating, 5);
  assert.equal(reviews[0]?.author, "Ana");
  assert.equal(reviews[0]?.country, "br");
});

test("registry: lote 9 registrado (apple)", () => {
  const built = buildAdapter("apple", {});
  assert.ok(built.source, "apple deve ter adaptador real");
  assert.equal(built.source!.id, "apple");
});

test("ibge-nomes: ranking do censo (entry.res)", () => {
  const first = one(mapItems(ibgeNomes, [{ localidade: "BR", res: [{ nome: "MARIA", frequencia: 11734129, ranking: 1 }, { nome: "JOSE", frequencia: 5754529, ranking: 2 }] }]));
  assert.equal(first.source, "ibge-nomes");
  assert.equal(first.kind, "person");
  assert.equal(first.title, "MARIA");
  assert.equal(first.score, 11734129);
});

test("ibge-nomes: nome exato devolve série por período", () => {
  const first = one(mapItems(ibgeNomes, [{ nome: "GABRIELA", res: [{ periodo: "1930[", frequencia: 457 }, { periodo: "[1930,1940[", frequencia: 668 }] }]));
  assert.equal(first.title, "GABRIELA");
  assert.equal(first.score, 1125);
});

test("openlibrary-trending: normaliza livros em alta", () => {
  const first = one(mapItems(openlibraryTrending, {
    works: [{ key: "/works/OL1W", title: "Dom Casmurro", author_name: ["Machado de Assis"], first_publish_year: 1899, ratings_average: 4.2, want_to_read_count: 1200 }],
  }));
  assert.equal(first.source, "openlibrary-trending");
  assert.equal(first.kind, "book");
  assert.equal(first.author, "Machado de Assis");
  assert.equal(first.score, 4.2);
});

test("github-trending: normaliza repos (proxy Search API)", () => {
  const first = one(mapItems(githubTrending, {
    items: [{ full_name: "openai/gpt-oss", description: "Modelos abertos", html_url: "https://github.com/openai/gpt-oss", stargazers_count: 42000, forks_count: 2000, language: "Python", pushed_at: "2026-08-29T00:00:00Z" }],
  }));
  assert.equal(first.source, "github-trending");
  assert.equal(first.kind, "repo");
  assert.equal(first.score, 42000);
  assert.equal(first.title, "openai/gpt-oss");
});

test("mastodon-trends: normaliza tags em alta", () => {
  const first = one(mapItems(mastodonTrends, [
    { name: "typescript", url: "https://mastodon.social/tags/typescript", uses: 123, accounts: 30 },
  ]));
  assert.equal(first.source, "mastodon-trends");
  assert.equal(first.kind, "trend-point");
  assert.match(first.title!, /#typescript/);
  assert.equal(first.score, 123);
});

test("trending: normaliza o RSS do Google Trends em alta", () => {
  const xml = `<rss><channel><item><title>Nubank</title><link>https://trends.google.com/trends/trending/1</link><pubDate>Sat, 30 Aug 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const first = one(mapItems(trending, xml));
  assert.equal(first.source, "trending");
  assert.equal(first.kind, "trend-point");
  assert.equal(first.title, "Nubank");
  assert.equal((first.meta as Record<string, unknown>).rank, 1);
});

test("registry: lote 7 registrado (14 fontes de dados)", () => {
  for (const id of ["wikitop", "wikiviews", "onthisday", "crypto", "steamtop", "weather", "brasilapi-feriados", "brasilapi-taxas", "frankfurter", "ibge-nomes", "openlibrary-trending", "github-trending", "mastodon-trends", "trending"]) {
    const built = buildAdapter(id, {});
    assert.ok(built.source, `${id} deve ter adaptador real`);
    assert.equal(built.source!.id, id);
  }
});