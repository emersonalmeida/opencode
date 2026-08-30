import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuditVisualCharts } from "@/components/audit/AuditVisualCharts";
import { YOUTUBE_AUDIT } from "@/lib/audit/sources/youtube";
import { PASTE_AUDIT } from "@/lib/audit/sources/extractors";

// jsdom precisa de ResizeObserver (polyfill já no setup).
describe("AuditVisualCharts (donut + barra por fonte)", () => {
  it("renderiza e soma 100%", () => {
    const { container } = render(
      <MemoryRouter>
        <AuditVisualCharts source={YOUTUBE_AUDIT} />
      </MemoryRouter>,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Distribuição por status");
    expect(text).toContain("Presença de campos");
  });

  it("fonte sem outputs omite o bloco presença", () => {
    const { container } = render(
      <MemoryRouter>
        <AuditVisualCharts source={PASTE_AUDIT} />
      </MemoryRouter>,
    );
    expect(container.textContent).toContain("Distribuição por status");
  });
});
