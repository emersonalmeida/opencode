import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuditComparison } from "@/components/audit/AuditComparison";
import { YOUTUBE_AUDIT } from "@/lib/audit/sources/youtube";
import { PASTE_AUDIT } from "@/lib/audit/sources/extractors";

describe("AuditComparison (dashboard de fontes)", () => {
  it("renderiza c/ links", () => {
    const { container } = render(
      <MemoryRouter>
        <AuditComparison sources={[YOUTUBE_AUDIT, PASTE_AUDIT]} />
      </MemoryRouter>,
    );
    const links = container.querySelectorAll("a[href^='#']").length;
    expect(links).toBe(2);
  });

  it("mostra % implementado por fonte", () => {
    const { container } = render(
      <MemoryRouter>
        <AuditComparison sources={[YOUTUBE_AUDIT]} />
      </MemoryRouter>,
    );
    expect(container.textContent).toMatch(/\d+% implementado/);
  });
});
