// @vitest-environment node
/**
 * Testes do núcleo puro de extração universal (server/lib/webExtract):
 * extractArticle (HTML→texto legível), parseFeed (RSS/Atom), splitTextItems.
 */
import { describe, it, expect } from "vitest";
import { extractArticle, parseFeed, splitTextItems } from "../../server/lib/webExtract";

const HTML_PAGE = `<!doctype html><html lang="pt-BR"><head>
<title>Título da tag</title>
<meta property="og:title" content="Meu Artigo Incrível" />
<meta property="og:site_name" content="Blog Teste" />
<meta name="author" content="Maria" />
<meta property="article:published_time" content="2026-01-15" />
<meta name="description" content="Descrição do artigo" />
</head><body>
<nav>menu menu menu</nav>
<article>
<h1>Meu Artigo Incrível</h1>
<p>Este é o primeiro parágrafo do artigo com conteúdo suficientemente longo para ser considerado texto legível.</p>
<p>Segundo parágrafo também longo o suficiente para passar no filtro de quarenta caracteres mínimos.</p>
</article>
<footer>rodapé</footer>
</body></html>`;

describe("extractArticle — HTML → artigo legível", () => {
  it("extrai título, texto e metadados", () => {
    const a = extractArticle(HTML_PAGE, "https://blog.teste/artigo");
    expect(a.title).toBe("Meu Artigo Incrível");
    expect(a.siteName).toBe("Blog Teste");
    expect(a.author).toBe("Maria");
    expect(a.publishedAt).toBe("2026-01-15");
    expect(a.lang).toBe("pt-BR");
    expect(a.text).toContain("primeiro parágrafo");
    expect(a.text).toContain("Segundo parágrafo");
    expect(a.words).toBeGreaterThan(10);
  });
  it("ignora nav/footer e blocos curtos", () => {
    const a = extractArticle(HTML_PAGE, "https://blog.teste/artigo");
    expect(a.text).not.toContain("menu menu menu");
    expect(a.text).not.toContain("rodapé");
  });
  it("fallback para body quando não há article/main", () => {
    const a = extractArticle("<html><body><p>conteúdo simples sem estrutura semântica de artigo aqui</p></body></html>", "https://x.com");
    expect(a.text).toContain("conteúdo simples");
  });
});

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel>
<item><title>Notícia A</title><link>https://news.test/a</link><pubDate>Mon, 20 Jan 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Resumo <b>da</b> notícia A</p>]]></description></item>
<item><title>Notícia B</title><link>https://news.test/b</link><pubDate>Tue, 21 Jan 2026 10:00:00 GMT</pubDate><description>Resumo B</description></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>Post Um</title><link href="https://blog.test/1"/><published>2026-01-20T10:00:00Z</published><summary>Resumo um</summary><author><name>João</name></author></entry>
</feed>`;

describe("parseFeed — RSS 2.0 e Atom", () => {
  it("parseia RSS com CDATA e strip de HTML", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Notícia A");
    expect(items[0].url).toBe("https://news.test/a");
    expect(items[0].text).toBe("Resumo da notícia A");
  });
  it("parseia Atom", () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Post Um");
    expect(items[0].author).toBe("João");
    expect(items[0].date).toContain("2026-01-20");
  });
  it("respeita o limite", () => {
    expect(parseFeed(RSS, 1)).toHaveLength(1);
  });
});

describe("splitTextItems — texto colado → itens", () => {
  it("detecta e divide markdown por heading", () => {
    const items = splitTextItems("# Capítulo 1\nTexto do cap 1.\n\n## Seção 1.1\nMais texto aqui.", "auto");
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Capítulo 1");
    expect(items[1].title).toBe("Seção 1.1");
  });
  it("detecta e divide JSON array", () => {
    const items = splitTextItems(JSON.stringify([{ title: "A", text: "conteúdo A" }, { name: "B", body: "conteúdo B" }]), "auto");
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("A");
    expect(items[1].text).toBe("conteúdo B");
  });
  it("divide CSV por linhas com cabeçalho como meta", () => {
    const items = splitTextItems("nome,nota,comentário\nApp A,5,ótimo app\nApp B,2,ruim demais", "auto");
    expect(items).toHaveLength(2);
    expect(items[0].meta?.nota).toBe("5");
    expect(items[1].title).toBe("App B");
  });
  it("divide texto plano em parágrafos agrupados", () => {
    const items = splitTextItems("Primeiro parágrafo solto.\n\nSegundo parágrafo solto.", "txt");
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].text).toContain("Primeiro parágrafo");
  });
  it("JSON malformado cai para texto plano (não quebra)", () => {
    const items = splitTextItems("{json quebrado", "json");
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});
