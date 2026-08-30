import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client + cache before importing the module under test.
// `fetchReviews` now calls the `apple-reviews` server route first (which returns
// `{ reviews: [...] }`), and falls back to the legacy `itunes-proxy` RSS path
// when that route errors or returns no reviews.
const appleReviewsMock = vi.fn(); // fn name -> { reviews } | Error | null
const itunesFetchMock = vi.fn(); // url -> RSS payload (fallback path)

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: async (fn: string, { body }: { body: Record<string, unknown> }) => {
        if (fn === "apple-reviews") {
          const result = appleReviewsMock(body);
          if (result instanceof Error) return { data: null, error: { message: result.message } };
          return { data: result, error: null };
        }
        if (fn === "itunes-proxy") {
          const data = itunesFetchMock(body.url);
          if (data instanceof Error) return { data: null, error: { message: data.message } };
          return { data, error: null };
        }
        return { data: null, error: { message: `unknown fn ${fn}` } };
      },
    },
  },
}));

vi.mock("@/lib/cache", () => ({
  makeKey: (parts: (string | number | boolean | null | undefined)[]) =>
    parts.map((p) => String(p ?? "")).join("|"),
  cached: async (_key: string, fetcher: () => Promise<unknown>) => fetcher(),
  clearCache: () => {},
}));

import { fetchReviews } from "@/lib/appStoreApi";

// Monta um payload fake da rota apple-reviews do servidor: um array de reviews
// normalizadas (o formato que a nova rota SSR retorna).
function appleReviews(reviews: { id: string; author?: string; rating?: number; title?: string; text?: string; date?: string }[]) {
  return { reviews: reviews.map((r) => ({ id: r.id, author: r.author || "", rating: r.rating || 0, title: r.title || "", text: r.text || "", date: r.date || "", country: "br" })) };
}

// Monta um payload fake de RSS (caminho de fallback).
function rssPage(reviews: { id: string; author: string; rating: number; title: string; text: string; date: string }[], opts: { withMetadata?: boolean } = {}) {
  const entry: Record<string, unknown>[] = [];
  if (opts.withMetadata) {
    entry.push({ "im:name": { label: "Some App" }, id: { label: "meta-id" }, title: { label: "App Title" } });
  }
  for (let i = 0; i < reviews.length; i++) {
    entry.push({
      id: { label: reviews[i].id },
      author: { name: { label: reviews[i].author } },
      "im:rating": { label: String(reviews[i].rating) },
      title: { label: reviews[i].title },
      content: { label: reviews[i].text },
      updated: { label: reviews[i].date },
      "im:version": { label: "1.0" },
    });
  }
  return { feed: { entry } };
}

const EMPTY = { feed: { entry: null } };

function mkReviews(prefix: string, n: number): { id: string; author: string; rating: number; title: string; text: string; date: string }[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i}`, author: `U${i}`, rating: 5, title: `T${i}`, text: `x${i}`, date: "2026-01-01",
  }));
}

describe("fetchReviews (Apple SSR route primary, RSS fallback)", () => {
  beforeEach(() => {
    appleReviewsMock.mockReset();
    itunesFetchMock.mockReset();
    // Default: the server route errors so tests opt into either path explicitly.
    appleReviewsMock.mockImplementation(() => new Error("route unavailable"));
  });

  it("uses the apple-reviews server route and dedupes by id", async () => {
    appleReviewsMock.mockReturnValue(appleReviews([
      ...mkReviews("a", 50),
      ...mkReviews("a", 50), // exact duplicates — must be removed
      ...mkReviews("b", 30),
    ]));
    const reviews = await fetchReviews("123", "App", "br", 500);
    expect(reviews.length).toBe(80); // 50 + 30 unique
    expect(reviews.every((r) => r.store === "apple")).toBe(true);
    expect(reviews[0].appName).toBe("App");
  });

  it("caps at the requested amount from the server route", async () => {
    appleReviewsMock.mockReturnValue(appleReviews(mkReviews("r", 1000)));
    const reviews = await fetchReviews("123", "App", "br", 100);
    expect(reviews.length).toBe(100);
  });

  it("falls back to RSS when the server route errors", async () => {
    appleReviewsMock.mockImplementation(() => new Error("server down"));
    itunesFetchMock.mockImplementation((url: string) =>
      url.includes("/page=1/") ? rssPage(mkReviews("rss", 50)) : EMPTY
    );
    const reviews = await fetchReviews("123", "App", "br", 500);
    expect(reviews.length).toBe(50);
    expect(reviews[0].id).toBe("rss0");
  });

  it("falls back to RSS when the server route returns no reviews", async () => {
    appleReviewsMock.mockReturnValue({ reviews: [] });
    itunesFetchMock.mockImplementation((url: string) =>
      url.includes("/page=1/") ? rssPage(mkReviews("rss", 50)) : EMPTY
    );
    const reviews = await fetchReviews("123", "App", "br", 500);
    expect(reviews.length).toBe(50);
  });

  it("RSS fallback scans all pages (scattered reviews on page 2)", async () => {
    appleReviewsMock.mockImplementation(() => new Error("route unavailable"));
    itunesFetchMock.mockImplementation((url: string) => {
      if (url.includes("/page=1/")) return EMPTY;
      if (url.includes("/page=2/")) return rssPage(mkReviews("p2", 50));
      return EMPTY;
    });
    const reviews = await fetchReviews("123", "App", "br", 500);
    expect(reviews.length).toBe(50);
    expect(reviews[0].id).toBe("p20");
  });

  it("RSS fallback filters the metadata entry and keeps real reviews", async () => {
    appleReviewsMock.mockImplementation(() => new Error("route unavailable"));
    itunesFetchMock.mockImplementation((url: string) =>
      url.includes("/page=1/") ? rssPage(mkReviews("real", 10), { withMetadata: true }) : EMPTY
    );
    const reviews = await fetchReviews("123", "App", "br", 500);
    expect(reviews.length).toBe(10);
    expect(reviews.every((r) => r.id.startsWith("real"))).toBe(true);
  });

  it("returns [] when both server route and RSS yield nothing", async () => {
    appleReviewsMock.mockReturnValue({ reviews: [] });
    itunesFetchMock.mockResolvedValue(EMPTY);
    const reviews = await fetchReviews("999", "DeadApp", "br", 500);
    expect(reviews).toEqual([]);
  });

  it("caps requested amount at 10000 (hard ceiling)", async () => {
    // Server route returns exactly the target; ensure no infinite loop / huge set.
    appleReviewsMock.mockReturnValue(appleReviews(mkReviews("cap", 10000)));
    const reviews = await fetchReviews("123", "App", "br", 999999);
    expect(reviews.length).toBeLessThanOrEqual(10000);
    expect(new Set(reviews.map((r) => r.id)).size).toBe(reviews.length);
  });
});
