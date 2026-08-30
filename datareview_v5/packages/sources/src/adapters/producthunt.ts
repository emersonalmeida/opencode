import type { CollectOptions, NormalizedItem } from "@v5/contracts";
import { cap, defineAdapter, item } from "./base.js";
import { parseFeed } from "./infraSources.js";

/* ----------------------------------------------------------- Product Hunt - */
/* producthunt.com/feed — feed público Atom/RSS (sem chave); engine = categoria. */
export const producthunt = defineAdapter(
  {
    id: "producthunt",
    label: "Product Hunt",
    kind: "product",
    description: "Lançamentos do Product Hunt (feed público; engine = categoria).",
    capabilities: ["media", "news"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const category = options.engine?.trim() ? `?category=${encodeURIComponent(options.engine.trim())}` : "";
      const url = `https://www.producthunt.com/feed${category}`;
      const resp = await fetch(url, { signal: options.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return resp.text();
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      return parseFeed(typeof data === "string" ? data : "", cap(options.limit ?? 25, 50))
        .map((e, index) => {
          // Título do feed costuma ser "Nome — Tagline".
          return item(
            {
              id: e.id ?? e.title,
              title: e.title,
              url: e.url,
              text: e.text,
              date: e.date,
              score: undefined,
              meta: { rank: index + 1, feedSource: "producthunt.com/feed" },
            },
            "producthunt",
            "product",
          );
        });
    },
  },
);
