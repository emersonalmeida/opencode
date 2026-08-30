import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { publicComponentId, publicComponentFile } from "@/lib/layoutComponents";
import { LayoutComponentBody } from "@/components/layoutBuilder/LayoutComponents";

describe("layouts — componentes do catálogo completo (prefixo cat:)", () => {
  it("publicComponentId/publicComponentFile fazem round trip", () => {
    const id = publicComponentId("components/shared/EmptyState.tsx");
    expect(id).toBe("cat:components/shared/EmptyState.tsx");
    expect(publicComponentFile(id)).toBe("components/shared/EmptyState.tsx");
    expect(publicComponentFile("kpis")).toBeNull();
    expect(publicComponentFile(undefined)).toBeNull();
  });

  it("render genérico carrega o lazy module e usa ErrorBoundary quando props faltam", async () => {
    render(<LayoutComponentBody component={publicComponentId("components/shared/EmptyState.tsx")} />);
    const txt = await screen.findByText(/precisa de props ou contexto específico|Sem dados|título/i, {}, { timeout: 4000 });
    expect(txt).toBeTruthy();
  });

  it("componente de registry segue renderizando normal", () => {
    const { container } = render(<LayoutComponentBody component={undefined} />);
    expect(container.textContent).toContain("Componente expansível");
  });
});
