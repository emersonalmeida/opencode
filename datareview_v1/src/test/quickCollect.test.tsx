import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QuickCollect } from "@/components/shared/QuickCollect";
import { EmptyState } from "@/components/shared/EmptyState";
import { SelectionProvider } from "@/context/SelectionContext";
import { upsertDataset } from "@/lib/datasetStore";
import type { DatasetEntry } from "@/lib/datasetStore";
import { Database } from "lucide-react";

/**
 * Toda a rede do app passa por `fetch`: buscas/coletas vão via
 * `supabase.functions.invoke` (URLs `.../functions/v1/<nome>`) e o iTunes
 * search/lookup via função `itunes-proxy` (body `{ url }`). Mockamos por
 * substring da URL da função.
 */
/** supabase-js `.functions.invoke` só faz `.json()` se o Content-Type for JSON. */
function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function wrap(ui: React.ReactNode) {
  return render(<SelectionProvider>{ui}</SelectionProvider>);
}

const fakeAppleApp = {
  trackId: 123,
  trackName: "Nubank",
  sellerName: "Nu Financeira",
  averageUserRating: 4.5,
  userRatingCount: 999,
  artworkUrl100: "",
  primaryGenreName: "Finanças",
  formattedPrice: "Grátis",
  trackViewUrl: "https://example.com",
  description: "banco",
  version: "1",
  releaseDate: "2020-01-01",
  currentVersionReleaseDate: "2020-01-01",
  minimumOsVersion: "14",
  genres: ["Finanças"],
  price: 0,
  currency: "BRL",
};

function makeEntry(name: string, store: "apple" | "google", id: string, reviews = 3): DatasetEntry {
  return {
    app: {
      store,
      id,
      name,
      developer: "Dev",
      icon: "",
      rating: 4.4,
      ratingCount: 10,
      price: "Grátis",
      genre: "Geral",
      description: "",
      version: "1.0",
      releaseDate: "2020-01-01",
      currentVersionReleaseDate: "2020-01-01",
      screenshots: [],
      url: "https://example.com",
      raw: {},
    },
    reviews: Array.from({ length: reviews }, (_, i) => ({
      id: `${store}-${id}-r${i}`,
      store,
      appId: id,
      appName: name,
      author: `User${i}`,
      title: `Título ${i}`,
      rating: 5 - (i % 5),
      text: `Review ${i}`,
      date: "2026-01-01",
    })),
    collectedAt: Date.now(),
  };
}

describe("QuickCollect", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza busca e estado inicial sem rede", () => {
    wrap(<QuickCollect />);
    expect(screen.getByRole("search")).toBeTruthy();
    expect(screen.getByLabelText("Buscar app nas lojas")).toBeTruthy();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("busca nas duas lojas e lista resultados com botão Coletar", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("itunes-proxy"))
        return Promise.resolve(json({ results: [fakeAppleApp] }));
      if (url.includes("google-play-scraper"))
        return Promise.resolve(json([]));
      return Promise.resolve(json({ results: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    wrap(<QuickCollect />);
    fireEvent.change(screen.getByLabelText("Buscar app nas lojas"), { target: { value: "nubank" } });
    fireEvent.click(screen.getByText("Buscar"));

    await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());
    expect(screen.getByText("Nubank")).toBeTruthy();
    expect(screen.getAllByText("Coletar").length).toBe(1);
  });

  it("mostra mensagem honesta quando nada é encontrado", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("itunes-proxy")) return Promise.resolve(json({ results: [] }));
      if (url.includes("google-play-scraper")) return Promise.resolve(json([]));
      return Promise.resolve(json({ results: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    wrap(<QuickCollect />);
    fireEvent.change(screen.getByLabelText("Buscar app nas lojas"), { target: { value: "zzzz-nada" } });
    fireEvent.click(screen.getByText("Buscar"));

    await waitFor(() => expect(screen.getByText(/Nenhum app encontrado/)).toBeTruthy());
  });

  it("lista apps do dataset com seleção (Todos/Nenhum/chips) sem buscar", () => {
    upsertDataset(makeEntry("Spotify", "apple", "1"));
    upsertDataset(makeEntry("WhatsApp", "google", "2"));
    wrap(<QuickCollect />);

    expect(screen.getByText(/2 app\(s\)/)).toBeTruthy();
    expect(screen.getAllByRole("checkbox").length).toBe(2);

    fireEvent.click(screen.getByText("Todos"));
    expect(screen.getByText(/2 selecionado\(s\)/)).toBeTruthy();

    fireEvent.click(screen.getByText("Nenhum"));
    expect(screen.getByText(/0 selecionado\(s\)/)).toBeTruthy();

    const chip = screen.getAllByRole("checkbox")[0];
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-checked")).toBe("true");
  });

  it("coleta um app via collectAndSelect (selecionado globalmente)", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("apple-reviews"))
        return Promise.resolve(
          json({
            reviews: [{ id: "r1", author: "A", rating: 5, text: "ótimo", date: "2026-01-01" }],
            count: 1,
          }),
        );
      if (url.includes("itunes-proxy"))
        return Promise.resolve(json({ results: [fakeAppleApp] }));
      if (url.includes("google-play-scraper"))
        return Promise.resolve(json([]));
      return Promise.resolve(json({ results: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    wrap(<QuickCollect />);
    fireEvent.change(screen.getByLabelText("Buscar app nas lojas"), { target: { value: "nubank" } });
    fireEvent.click(screen.getByText("Buscar"));
    await waitFor(() => expect(screen.getByText("Coletar")).toBeTruthy());

    fireEvent.click(screen.getByText("Coletar"));
    await waitFor(() => expect(screen.getByText("Coletado")).toBeTruthy());
    // Dataset reage: o app coletado aparece na lista de seleção
    await waitFor(() => expect(screen.getByText(/1 app\(s\)/)).toBeTruthy());
  });
});

describe("EmptyState — prop collect", () => {
  it("embute o QuickCollect quando collect=true", () => {
    wrap(<EmptyState icon={Database} title="Sem dados" description="desc" collect />);
    expect(screen.getByText("Sem dados")).toBeTruthy();
    expect(screen.getByLabelText("Buscar app nas lojas")).toBeTruthy();
  });

  it("não embute quando collect ausente", () => {
    wrap(<EmptyState icon={Database} title="Sem dados" />);
    expect(screen.queryByLabelText("Buscar app nas lojas")).toBeNull();
  });
});
