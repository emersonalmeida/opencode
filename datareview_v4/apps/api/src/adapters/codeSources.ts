/**
 * Lote 5 de adaptadores reais (SourcePort) — ecossistema de código e
 * acadêmico com API pública estável: PyPI, RubyGems, crates.io,
 * npm downloads e DOAJ. Mesma convenção: fetch + map → parcial-OK.
 */
import type { CollectOptions, NormalizedItem } from "@v4/contracts";
import { cap, defineAdapter, item, num, str } from "./base.js";
import { asArray, asRecord, fetchJson } from "./http.js";

function excerpt(value: string, max = 220): string | undefined {
  const clean = value.trim();
  return clean ? clean.slice(0, max) : undefined;
}

/* -------------------------------------------------------------------- PyPI - */
/* pypi.org/pypi/{name}/json — lookup exato de um pacote (sem busca pública). */
export const pypi = defineAdapter(
  {
    id: "pypi",
    label: "PyPI",
    kind: "package",
    description: "Lookup exato de pacote Python (query = nome do pacote).",
    capabilities: ["code"],
    lookup: true,
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const name = options.query.trim();
      if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error("query deve ser um nome de pacote válido (ex.: requests, fastapi)");
      return fetchJson(`https://pypi.org/pypi/${encodeURIComponent(name)}/json`, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      const info = asRecord(asRecord(data).info);
      const name = str(info.name);
      if (!name) return [];
      const url =
        str(info.project_urls && asRecord(info.project_urls)["Homepage"]) ||
        (str(info.project_url) || `https://pypi.org/project/${encodeURIComponent(name)}/`);
      return [
        item(
          {
            id: `pypi:${name}:${str(info.version)}`,
            title: `${name} ${str(info.version)}`,
            url,
            text: excerpt(str(info.summary)) || excerpt(str(info.description), 400),
            author: str(info.author) || undefined,
            date: str(info.upload_time) || str(info.released) || undefined,
            score: undefined,
            meta: {
              version: str(info.version) || undefined,
              license: str(info.license)?.slice(0, 120) || undefined,
              requiresPython: str(info.requires_python) || undefined,
            },
          },
          "pypi",
          "package",
        ),
      ];
    },
  },
);

/* ----------------------------------------------------------------- RubyGems - */
/* rubygems.org/api/v1/search.json — busca pública de gems, sem chave. */
export const rubygems = defineAdapter(
  {
    id: "rubygems",
    label: "RubyGems",
    kind: "package",
    description: "Busca pública de gems Ruby (query = termo).",
    capabilities: ["code"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      // api.v1.search só busca por prefixo exato do nome; terms adicionais não
      // mudam o resultado — o map usa full_name/downloads reais mesmo assim.
      const url = `https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(options.query)}`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      return asArray(data)
        .slice(0, cap(options.limit ?? 10, 50))
        .map((g) => {
          const gem = asRecord(g);
          const name = str(gem.name);
          if (!name) return null;
          return item(
            {
              id: `rubygems:${name}:${str(gem.version)}`,
              title: name,
              url: str(gem.homepage_uri) || `https://rubygems.org/gems/${encodeURIComponent(name)}`,
              text: excerpt(str(gem.info)),
              author: str(gem.authors) || undefined,
              date: str(gem.version_created_at) || undefined,
              score: num(gem.downloads),
              meta: {
                version: str(gem.version) || undefined,
                downloads: num(gem.downloads),
                versionDownloads: num(gem.version_downloads),
                totalDownloads: num(gem.downloads),
              },
            },
            "rubygems",
            "package",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ----------------------------------------------------------------- crates.io - */
/* crates.io/api/v1/crates?q= — busca pública; exige User-Agent (fetchJson envia). */
export const cratesio = defineAdapter(
  {
    id: "cratesio",
    label: "crates.io",
    kind: "package",
    description: "Busca pública de crates Rust (query = termo).",
    capabilities: ["code"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://crates.io/api/v1/crates?q=${encodeURIComponent(options.query)}&per_page=${cap(options.limit ?? 10, 50)}`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      return asArray(asRecord(data).crates)
        .map((c) => {
          const krate = asRecord(c);
          const name = str(krate.name);
          if (!name) return null;
          return item(
            {
              id: `cratesio:${name}:${str(krate.max_version)}`,
              title: name,
              url: `https://crates.io/crates/${encodeURIComponent(name)}`,
              text: excerpt(str(krate.description)),
              date: str(krate.updated_at) || undefined,
              score: num(krate.recent_downloads),
              meta: {
                version: str(krate.max_version) || undefined,
                downloads: num(krate.downloads),
                recentDownloads: num(krate.recent_downloads),
              },
            },
            "cratesio",
            "package",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

/* ------------------------------------------------------------ npm-downloads - */
/* api.npmjs.org/downloads/point/{period}/{package} — contagem agregada. */
const NPM_PERIODS = new Set(["last-day", "last-week", "last-month", "last-year", "last-6-months"]);
export const npmDownloads = defineAdapter(
  {
    id: "npm-downloads",
    label: "npm downloads",
    kind: "metric",
    description: "Downloads de pacote npm num período (query = pacote; engine = período).",
    capabilities: ["code", "trends"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const pkg = options.query.trim();
      if (!/^[\w@./-]+$/.test(pkg)) throw new Error("query deve ser um nome de pacote npm (ex.: typescript)");
      const period = (options.engine?.trim() || "last-week").replace(/^point[:-]/, "");
      if (!NPM_PERIODS.has(period as string)) throw new Error(`período inválido: ${period} (use last-day|week|month|year|6-months)`);
      const url = `https://api.npmjs.org/downloads/point/${period}/${encodeURIComponent(pkg)}`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      const r = asRecord(data);
      const pkg = str(r.package);
      const downloads = num(r.downloads);
      if (!pkg || downloads === undefined) return [];
      const start = str(r.start);
      const end = str(r.end);
      let text: string | undefined;
      if (start && end) text = `Downloads entre ${start} e ${end}.`;
      return [
        item(
          {
            id: `npm:${pkg}:${start || "period"}`,
            title: `${pkg} · ${downloads.toLocaleString("pt-BR")} downloads`,
            url: `https://www.npmjs.com/package/${encodeURIComponent(pkg)}`,
            text,
            score: downloads,
            meta: { downloads, period: `${start}→${end}` },
          },
          "npm-downloads",
          "metric",
        ),
      ];
    },
  },
);

/* --------------------------------------------------------------------- DOAJ - */
/* doaj.org/api/search/articles/{q}?pageSize= — artigos open access. */
export const doaj = defineAdapter(
  {
    id: "doaj",
    label: "DOAJ (open access)",
    kind: "paper",
    description: "Busca pública de artigos open access (query = termo).",
    capabilities: ["academic"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const url = `https://doaj.org/api/search/articles/${encodeURIComponent(options.query)}?pageSize=${cap(options.limit ?? 10, 50)}`;
      return fetchJson(url, { signal: options.signal, timeoutMs: 15000 });
    },
    map(data: unknown): NormalizedItem[] {
      const root = asRecord(data);
      const results = asArray(root.results).length ? asArray(root.results) : asArray(root.data);
      return results
        .map((a) => {
          const bib = asRecord(asRecord(a).bibjson);
          const title = str(bib.title);
          if (!title) return null;
          const authors = asArray(bib.author)
            .map((author) => str(asRecord(author).name))
            .filter(Boolean);
          const identifier = str(pickId(asArray(bib.identifier)));
          const link = str(firstUrl(asArray(bib.link)));
          return item(
            {
              id: identifier || title,
              title,
              url: link || (identifier ? `https://doi.org/${identifier}` : undefined),
              text: excerpt(str(bib.abstract)),
              author: authors[0] || undefined,
              date: str(bib.year) || undefined,
              score: undefined,
              meta: {
                doi: identifier || undefined,
                journal: str(asRecord(bib.journal).title) || undefined,
                authors,
                year: str(bib.year) || undefined,
              },
            },
            "doaj",
            "paper",
          );
        })
        .filter((x): x is NormalizedItem => x !== null);
    },
  },
);

function pickId(dd: unknown[]): string | undefined {
  for (const d of dd) {
    const e = asRecord(d);
    if (str(e.type).toLowerCase() === "doi") return str(e.id);
  }
  return undefined;
}

function firstUrl(links: unknown[]): string | undefined {
  for (const l of links) {
    const url = str(asRecord(l).url);
    if (url) return url;
  }
  return undefined;
}

/** Lote 5 — factories (assignable a AdapterFactory). */
export const codeSources = {
  pypi: () => pypi,
  rubygems: () => rubygems,
  cratesio: () => cratesio,
  doaj: () => doaj,
  "npm-downloads": () => npmDownloads,
};
export type CodeSourceId = keyof typeof codeSources;