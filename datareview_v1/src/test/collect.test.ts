import { describe, it, expect, beforeEach, vi } from "vitest";
import { collectApp, collectCompareGroup } from "@/lib/collect";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";
import { listDataset, getDatasetEntry, upsertDataset } from "@/lib/datasetStore";
import { getHistory as getHist } from "@/lib/history";

// Mock the network layer so no real HTTP runs.
const appleReviews = (n: number): ReviewEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`, store: "apple", appId: "814456780", appName: "Nubank",
    author: `User${i}`, rating: 5, title: "t", text: `text ${i}`, date: "2024-01-01",
  } as ReviewEntry));

const gpReviews = (n: number, appId: string): ReviewEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `g${appId}-${i}`, store: "google", appId, appName: "GP",
    author: `User${i}`, rating: 4, title: "t", text: `gtext ${i}`, date: "2024-01-01",
  } as ReviewEntry));

vi.mock("@/lib/appStoreApi", () => ({
  fetchReviews: vi.fn(async (_id: string, _name: string, _region: string, limit: number) => appleReviews(Math.min(limit, 500))),
  lookupApp: vi.fn(async (id: string) => ({
    id, store: "apple", name: `Apple-${id}`, icon: "i", developer: "D",
    rating: 4.5, ratingCount: 100, price: "", url: "u", genre: "g",
    version: "1", size: "", contentRating: "", description: "", screenshots: [],
    releaseDate: "", currentVersionReleaseDate: "",
  }) as AppInfo),
}));
vi.mock("@/lib/googlePlayApi", () => ({
  fetchGooglePlayAppDetails: vi.fn(async (id: string) => ({
    id, store: "google", name: `GP-${id}`, icon: "g", developer: "D",
    rating: 4.2, ratingCount: 200, price: "", url: "u", genre: "g",
    version: "1", size: "", contentRating: "", description: "", screenshots: [],
    releaseDate: "", currentVersionReleaseDate: "",
  }) as AppInfo),
  fetchGooglePlayReviews: vi.fn(async (id: string, _name: string, _region: string, num: number) => gpReviews(Math.min(num, 500), id)),
}));

const appleApp = (): AppInfo => ({
  id: "814456780", store: "apple", name: "Nubank", icon: "ic", developer: "Nu",
  rating: 4.8, ratingCount: 1000, price: "", url: "u", genre: "Finance",
  version: "1", size: "", contentRating: "", description: "", screenshots: [],
  releaseDate: "", currentVersionReleaseDate: "",
});

describe("collectApp (unified collection + dedup + history)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("fetches + persists a new Google app and pushes it to the history sidebar", async () => {
    const app = appleApp(); app.store = "google"; app.id = "com.nu.production";
    const { reused } = await collectApp(app, "br", 500);
    expect(reused).toBe(false);
    expect(listDataset()).toHaveLength(1);
    expect(getDatasetEntry("google", "com.nu.production")).toBeTruthy();
    const hist = getHist();
    expect(hist.some(h => h.type === "app" && h.id === "com.nu.production")).toBe(true);
  });

  it("reuses the cached dataset entry on a second collect (no refetch)", async () => {
    const { fetchReviews } = await import("@/lib/appStoreApi");
    const lookup = (await import("@/lib/appStoreApi")).lookupApp as unknown as { mock: { calls: unknown[][] } };
    const app = appleApp();
    await collectApp(app, "br", 500);
    const callsBefore = lookup.mock.calls.length;
    const revBefore = (fetchReviews as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
    const { reused, entry } = await collectApp(app, "br", 500);
    expect(reused).toBe(true);
    expect(entry.app.id).toBe("814456780");
    // lookupApp + fetchReviews must NOT have been called again (dedup short-circuits before fetch).
    expect(lookup.mock.calls.length).toBe(callsBefore);
    expect((fetchReviews as unknown as { mock: { calls: unknown[][] } }).mock.calls.length).toBe(revBefore);
    expect(listDataset()).toHaveLength(1);
  });

  it("hydrates metadata for a bare AppInfo shell (from a compare URL)", async () => {
    const shell = { id: "814456780", store: "apple", name: "apple:814456780" } as unknown as AppInfo;
    const { entry } = await collectApp(shell, "br", 500);
    expect(entry.app.name).toBe("Apple-814456780"); // hydrated by lookupApp mock
    expect(entry.app.icon).toBe("i");
  });

  it("refetches (and merges) when the user raises the limit above the stored count", async () => {
    const { fetchReviews } = await import("@/lib/appStoreApi");
    const spy = fetchReviews as unknown as { mock: { calls: unknown[][] } };
    const app = appleApp();
    // First collect at limit 100 → 100 reviews stored.
    await collectApp(app, "br", 100);
    expect(getDatasetEntry("apple", "814456780")!.reviews.length).toBe(100);
    const callsAfterFirst = spy.mock.calls.length;
    // Second collect at limit 500 → must refetch (100 < 500) and grow toward 500.
    const { reused } = await collectApp(app, "br", 500);
    expect(reused).toBe(false);
    expect(spy.mock.calls.length).toBeGreaterThan(callsAfterFirst);
    const finalCount = getDatasetEntry("apple", "814456780")!.reviews.length;
    expect(finalCount).toBeGreaterThanOrEqual(100);
    expect(finalCount).toBe(500);
  });

  it("reuses the cache when the requested limit is already satisfied", async () => {
    const app = appleApp();
    await collectApp(app, "br", 100); // 100 stored
    const { fetchReviews } = await import("@/lib/appStoreApi");
    const spy = fetchReviews as unknown as { mock: { calls: unknown[][] } };
    const before = spy.mock.calls.length;
    const { reused } = await collectApp(app, "br", 50); // 100 >= 50 → reuse
    expect(reused).toBe(true);
    expect(spy.mock.calls.length).toBe(before); // no refetch
  });

  it("refetches stale entries (older than TTL) and merges without loss", async () => {
    const app = appleApp();
    await collectApp(app, "br", 100); // 100 stored
    const oldEntry = getDatasetEntry("apple", "814456780")!;
    // Artificially age the entry beyond the default TTL (7 days).
    upsertDataset({ ...oldEntry, collectedAt: Date.now() - 10 * 86400000 });
    const { fetchReviews } = await import("@/lib/appStoreApi");
    const spy = fetchReviews as unknown as { mock: { calls: unknown[][] } };
    const before = spy.mock.calls.length;
    const { reused } = await collectApp(app, "br", 100);
    expect(reused).toBe(false);
    expect(spy.mock.calls.length).toBeGreaterThan(before); // refetched
    expect(getDatasetEntry("apple", "814456780")!.reviews.length).toBe(100); // merged, not lost
  });

  it("keeps fresh entries reusable when the TTL window is generous", async () => {
    const app = appleApp();
    await collectApp(app, "br", 100);
    const oldEntry = getDatasetEntry("apple", "814456780")!;
    upsertDataset({ ...oldEntry, collectedAt: Date.now() - 10 * 86400000 });
    const { fetchReviews } = await import("@/lib/appStoreApi");
    const spy = fetchReviews as unknown as { mock: { calls: unknown[][] } };
    const before = spy.mock.calls.length;
    const { reused } = await collectApp(app, "br", 100, "mixed", { ttlDays: 30 });
    expect(reused).toBe(true); // within custom TTL → cache hits
    expect(spy.mock.calls.length).toBe(before);
  });
});

describe("collectCompareGroup (grouped history entry)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("pushes a single compare entry aggregating all apps, and collects each", async () => {
    const a = appleApp();
    const b: AppInfo = { ...a, id: "com.nu.production", store: "google", name: "Nubank GP" };
    await collectCompareGroup([a, b], "br", 500);
    expect(listDataset()).toHaveLength(2);
    const hist = getHist();
    const cmp = hist.find(h => h.type === "compare");
    expect(cmp).toBeTruthy();
    if (cmp && cmp.type === "compare") {
      expect(cmp.apps).toHaveLength(2);
      expect(cmp.apps.map(x => x.id).sort()).toEqual(["814456780", "com.nu.production"]);
    }
  });

  it("does not refetch apps already in the dataset (dedup within group)", async () => {
    const a = appleApp();
    await collectApp(a, "br", 500); // pre-collect one
    const b: AppInfo = { ...a, id: "com.spotify.music", store: "google", name: "Spotify" };
    const { fetchGooglePlayReviews } = await import("@/lib/googlePlayApi");
    const spy = fetchGooglePlayReviews as unknown as { mock: { calls: unknown[][] } };
    const before = spy.mock.calls.length;
    await collectCompareGroup([a, b], "br", 500);
    // Apple app already cached → no fetchReviews; Google app new → fetchGooglePlayReviews called exactly once here.
    expect(spy.mock.calls.length - before).toBe(1);
    expect(listDataset()).toHaveLength(2);
  });

  it("no-op on empty list", async () => {
    await collectCompareGroup([], "br", 500);
    expect(getHist().length).toBe(0);
  });
});
