import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { DatasetEntry } from "@/lib/datasetStore";

vi.mock("@/context/CompareContext", () => ({
  useCompare: () => ({ setPickerOpen: vi.fn() }),
}));

import { LinkedStoresCard } from "@/components/dashboard/LinkedStoresCard";

function entry(store: "apple" | "google", id: string, name: string, dev = "Dev", nReviews = 2): DatasetEntry {
  return {
    app: {
      store, id, name, icon: "", developer: dev, rating: 4, ratingCount: 1,
      price: "", url: "", genre: "", version: "1", description: "",
      screenshots: [], releaseDate: "", currentVersionReleaseDate: "",
    } as DatasetEntry["app"],
    reviews: Array.from({ length: nReviews }, (_, i) => ({
      id: `${store}${id}r${i}`, store, appId: id, appName: name, author: `U${i}`,
      rating: 5, title: "t", text: "ok", date: "2024-01-01",
    })),
    collectedAt: Date.now(),
  };
}

describe("LinkedStoresCard", () => {
  it("renderiza grupo com Apple+Google detectado", () => {
    render(
      <LinkedStoresCard
        entries={[
          entry("apple", "1", "Nubank", "Nu Holdings"),
          entry("google", "2", "Nubank", "Nu Holdings"),
        ]}
      />,
    );
    const card = screen.getByTestId("linked-stores-card");
    expect(card).toBeTruthy();
    expect(card.textContent).toContain("Nubank");
    expect(card.textContent).toContain("apple + google");
    expect(card.textContent).toMatch(/confiança (alta|média|fraca)/);
  });

  it("não renderiza sem matches cross-store", () => {
    render(<LinkedStoresCard entries={[entry("apple", "1", "Nubank", "Nu")]} />);
    expect(screen.queryByTestId("linked-stores-card")).toBeNull();
  });
});
