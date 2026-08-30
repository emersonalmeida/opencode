import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SourcesSection } from "@/components/settings/SourcesSection";
import { __resetSourcesCacheForTests } from "@/lib/sourcesClient";
import { listSources } from "../../server/lib/sourceRegistry";

/** Mock simples do endpoint GET /functions/v1/sources. */
function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal("fetch", (url: unknown) =>
    Promise.resolve(
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }),
    ),
  );
}

describe("SourcesSection — render do catálogo de fontes", () => {
  beforeEach(() => {
    __resetSourcesCacheForTests();
    mockFetch({ sources: listSources() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renderiza um card por fonte com capabilities", async () => {
    render(<SourcesSection />);
    await waitFor(() => {
      expect(screen.getByTestId("source-card-apple")).toBeInTheDocument();
      expect(screen.getByTestId("source-card-google")).toBeInTheDocument();
    });
    const apple = screen.getByTestId("source-card-apple");
    expect(apple.textContent).toContain("reviews/menções");
    expect(apple.textContent).toContain("amp-api + SSR");
  });

  it("mostra erro acessível quando o servidor não responde", async () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", () => Promise.resolve(new Response("err", { status: 503 })));
    render(<SourcesSection />);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
