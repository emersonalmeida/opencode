// @vitest-environment node
/**
 * Testes do motor declarativo de conectores (server/lib/uniConnectors):
 * integridade do catálogo + buildUrl + mapItem com payloads reais mínimos.
 */
import { describe, it, expect } from "vitest";
import { UNI_CONNECTORS, getConnector, mapConnectorItems, getByPath } from "../../server/lib/uniConnectors";

describe("uniConnectors — catálogo", () => {
  it("ids únicos e metadados completos", () => {
    const ids = UNI_CONNECTORS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of UNI_CONNECTORS) {
      expect(c.label).toBeTruthy();
      expect(c.description).toBeTruthy();
      expect(c.kind).toBeTruthy();
    }
  });
  it("buildUrl gera URL http(s) válida com a query encodada", () => {
    for (const c of UNI_CONNECTORS) {
      const url = c.buildUrl("meu app", 10);
      expect(url).toMatch(/^https:\/\//);
      expect(url.toLowerCase()).toContain("meu"); // presença do termo (cada fonte sanitiza de forma própria)
    }
  });
  it("getConnector resolve por id e retorna undefined p/ desconhecido", () => {
    expect(getConnector("devto")?.label).toBe("DEV Community");
    expect(getConnector("inexistente")).toBeUndefined();
  });
  it("getByPath navega caminho dot-separated", () => {
    expect(getByPath({ a: { b: [1, 2] } }, "a.b")).toEqual([1, 2]);
    expect(getByPath({ a: 1 }, "x.y")).toBeUndefined();
    expect(getByPath([1], "")).toEqual([1]);
  });
});

describe("uniConnectors — mapConnectorItems", () => {
  it("devto: mapeia artigos com reações e tags", () => {
    const items = mapConnectorItems(getConnector("devto")!, [
      { title: "Artigo X", description: "desc", url: "https://dev.to/x", published_at: "2026-01-01", positive_reactions_count: 42, user: { name: "Ana" }, tag_list: ["react"], comments_count: 3 },
    ], 10);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Artigo X");
    expect(items[0].score).toBe(42);
    expect(items[0].author).toBe("Ana");
  });
  it("bluesky: segue listPath posts e monta URL do post", () => {
    const items = mapConnectorItems(getConnector("bluesky")!, {
      posts: [{ record: { text: "olá mundo" }, author: { handle: "user.bsky.social", displayName: "User" }, uri: "at://did:plc:x/app.bsky.feed.post/abc123", likeCount: 5, repostCount: 2, indexedAt: "2026-01-01T00:00:00Z" }],
    }, 10);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe("olá mundo");
    expect(items[0].url).toBe("https://bsky.app/profile/user.bsky.social/post/abc123");
    expect(items[0].score).toBe(7);
  });
  it("openlibrary: usa fields solicitados (nota arredondada)", () => {
    const items = mapConnectorItems(getConnector("openlibrary")!, {
      docs: [{ key: "/works/OL1W", title: "Livro Y", author_name: ["Autor"], first_publish_year: 1999, ratings_average: 4.26, ratings_count: 100 }],
    }, 10);
    expect(items[0].title).toBe("Livro Y");
    expect(items[0].score).toBe(4.3);
    expect(items[0].url).toBe("https://openlibrary.org/works/OL1W");
  });
  it("pypi (lookup): resposta objeto único sem listPath vira 1 item", () => {
    const items = mapConnectorItems(getConnector("pypi")!, {
      info: { name: "requests", summary: "HTTP for Humans", version: "2.31.0", author: "Kenneth" },
    }, 10);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("requests");
    expect(items[0].meta?.version).toBe("2.31.0");
  });
  it("npm: descarta objetos sem package (robustez)", () => {
    const items = mapConnectorItems(getConnector("npm")!, { objects: [{ package: { name: "react" } }, {}] }, 10);
    expect(items).toHaveLength(1);
  });
  it("descarta itens sem título", () => {
    const items = mapConnectorItems(getConnector("devto")!, [{ description: "sem título" }], 10);
    expect(items).toHaveLength(0);
  });
  it("respeita o limite", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ title: `t${i}` }));
    expect(mapConnectorItems(getConnector("devto")!, many, 5)).toHaveLength(5);
  });
  it("rubygems: downloads viram score, fallback do URL por nome", () => {
    const items = mapConnectorItems(getConnector("rubygems")!, [
      { name: "rails", info: "framework", version: "8.1.0", downloads: 777000000, project_uri: "https://rubygems.org/gems/rails" },
    ], 10);
    expect(items[0].title).toBe("rails");
    expect(items[0].score).toBe(777000000);
    expect(items[0].meta?.version).toBe("8.1.0");
  });
  it("cratesio: segue listPath crates com repositório", () => {
    const items = mapConnectorItems(getConnector("cratesio")!, {
      crates: [{ name: "serde", description: "serialização", downloads: 1300000000, newest_version: "1.0.0", repository: "https://github.com/serde", updated_at: "2026-01-01" }],
    }, 10);
    expect(items[0].title).toBe("serde");
    expect(items[0].meta?.repository).toContain("github");
    expect(items[0].url).toBe("https://crates.io/crates/serde");
  });
  it("doaj: extrai bibjson (revista, doi, fulltext)", () => {
    const items = mapConnectorItems(getConnector("doaj")!, {
      results: [{ bibjson: { title: "ML paper", journal: { title: "Journal X" }, year: "2025", author: [{ name: "Ana" }], link: [{ url: "https://doi.org/x", type: "fulltext" }], identifier: [{ type: "doi", id: "10.x" }] } }],
    }, 10);
    expect(items[0].title).toBe("ML paper");
    expect(items[0].url).toBe("https://doi.org/x");
    expect(items[0].meta?.doi).toBe("10.x");
    expect(items[0].author).toBe("Ana");
  });
  it("openfoodfacts: descarta produto sem nome; nutri-score em meta", () => {
    const items = mapConnectorItems(getConnector("openfoodfacts")!, {
      products: [{ product_name: "Cola", brands: "Marca", nutriscore_grade: "c", code: "123", categories: "Bebidas,Refrigerante" }, { brands: "sem nome" }],
    }, 10);
    expect(items).toHaveLength(1);
    expect(items[0].meta?.nutriScore).toBe("C");
    expect(items[0].author).toBe("Marca");
  });
  it("archive: title/creator em array são achatados", () => {
    const items = mapConnectorItems(getConnector("archive")!, {
      response: { docs: [{ identifier: "book1", title: ["Título"], creator: ["Autor"], year: 2020, mediatype: "texts", downloads: 42 }] },
    }, 10);
    expect(items[0].title).toBe("Título");
    expect(items[0].author).toBe("Autor");
    expect(items[0].url).toBe("https://archive.org/details/book1");
    expect(items[0].date).toBe("2020");
  });
  it("tvmaze: limpa HTML da sinopse, nota vira score", () => {
    const items = mapConnectorItems(getConnector("tvmaze")!, [{ show: { name: "Série", summary: "<p>texto</p>", url: "https://tvmaze.com/x", premiered: "2020-01-01", rating: { average: 8.5 }, genres: ["Drama"], status: "Ended" } }], 10);
    expect(items[0].text).toBe("texto");
    expect(items[0].score).toBe(8.5);
    expect(items[0].meta?.genres).toBe("Drama");
  });
});
