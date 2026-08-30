import type { NormalizedItem } from "@v4/contracts";

export function serpApiItemKind(engine: string): string {
  switch (engine) {
    case "google_autocomplete": return "suggestion";
    case "google_trends": return "trend-point";
    case "google_news": return "news";
    case "youtube_search": return "video";
    case "apple_app_store": return "app";
    case "google_scholar": return "paper";
    default: return "result";
  }
}

const RESULT_KEYS = ["organic_results", "news_results", "video_results", "shopping_results"] as const;

interface SerpApiResult {
  result_id?: unknown;
  position?: unknown;
  link?: unknown;
  url?: unknown;
  snippet?: unknown;
  author?: unknown;
  published_date?: unknown;
  publication_date?: unknown;
  [key: string]: unknown;
}

export function normalizeSerpApiResults(
  engine: string,
  payload: unknown,
): NormalizedItem[] {const items: NormalizedItem[] = [];
  if (typeof payload !== "object" || payload == null) return items;
  const root = payload as Record<string, unknown>;
for (const key of RESULT_KEYS) {
    const list = root[key];
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (typeof raw !== "object" || raw == null) continue;
      const r = raw as SerpApiResult;
      const pos = typeof r.position === "number" ? (r.position as number) : undefined;
      items.push({
        id: typeof r.result_id === "string" ? (r.result_id as string) : "",
        source: "serpapi",
        kind: serpApiItemKind(engine),
        title: typeof r.title === "string" ? (r.title as string) : "",
        url: typeof r.link === "string" ? (r.link as string) : typeof r.url === "string" ? (r.url as string) : undefined,
        text: typeof r.snippet === "string" ? (r.snippet as string) : undefined,
        author: typeof r.author === "string" ? (r.author as string) : undefined,
        date: typeof r.published_date === "string" ? (r.published_date as string) : typeof r.publication_date === "string" ? (r.publication_date as string) : undefined,
        score: pos != null ? Math.max(0 , 100 - pos) : undefined,
        meta: { engine, raw: r },
      });
    }
  }

  if (engine === "google_autocomplete") {
    const sug = root.suggestions;
    if (Array.isArray(sug)) {
      for (const raw of sug) {
        if (typeof raw !== "string") continue;
        items.push({
          id: "",
          source: "serpapi",
          kind: "suggestion",
          title: raw,
          meta: { engine, raw: { suggestion: raw } },
        });
      }
    }
  }

return items;
}
