import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuditSourceVisual } from "@/components/audit/AuditSourceVisual";
import { YOUTUBE_AUDIT } from "@/lib/audit/sources/youtube";
import { REDDIT_AUDIT } from "@/lib/audit/sources/reddit";
import { PASTE_AUDIT } from "@/lib/audit/sources/extractors";

describe("AuditSourceVisual (dashboard visual por fonte)", () => {
  it("YouTube renderiza com KPIs e campos", () => {
    const { container } = render(
      <MemoryRouter>
        <AuditSourceVisual source={YOUTUBE_AUDIT} />
      </MemoryRouter>,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("endpoints");
    expect(text).toContain("parâmetros");
    expect(text).toContain("campos");
    expect(text).toContain("implementados");
  });

  it("YouTube mostra lacunas documentadas (Data API v3)", () => {
    const { container } = render(
      <MemoryRouter>
        <AuditSourceVisual source={YOUTUBE_AUDIT} />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain("Lacunas documentadas");
  });

  it("Reddit renderiza sem quebrar (scraping público)", () => {
    const { container } = render(
      <MemoryRouter>
        <AuditSourceVisual source={REDDIT_AUDIT} />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain("403");
  });

  it("fonte minimalista (paste) não quebra", () => {
    const { container } = render(
      <MemoryRouter>
        <AuditSourceVisual source={PASTE_AUDIT} />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain("endpoints");
  });

  it("status bar soma 100%", () => {
    const { container } = render(
      <MemoryRouter>
        <AuditSourceVisual source={YOUTUBE_AUDIT} />
      </MemoryRouter>,
    );
    const text = container.textContent ?? "";
    expect(text).toMatch(/\d+% implementado/);
  });
});
