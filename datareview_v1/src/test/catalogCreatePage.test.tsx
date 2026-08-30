/** Testes do fluxo "Criar página com este componente" do inspetor do catálogo. */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CatalogSidebars } from "@/components/catalog/CatalogSidebars";
import { selectComponent } from "@/lib/catalogSelection";
import { getCustomPage, listCustomPages } from "@/lib/customPages";
import { publicComponentFile } from "@/lib/layoutComponents";

describe("catalog → criar página com componente", () => {
  beforeEach(() => {
    localStorage.clear();
    selectComponent(null);
  });

  // A sidebar inteira é pesada (PageTabsSidebar ×2); timeout elevado p/ CI.
  it("inspetor oferece a ação e cria a página customizada com o componente vinculado", { timeout: 30000 }, () => {
    selectComponent({ file: "components/shared/EmptyState.tsx", pagePath: "shared", pageLabel: "Sistema" });
    render(
      <MemoryRouter>
        <CatalogSidebars />
      </MemoryRouter>,
    );
    const btn = screen.getByRole("button", { name: /Criar página com o componente EmptyState/ });
    fireEvent.click(btn);

    const pages = listCustomPages();
    expect(pages.length).toBe(1);
    const page = getCustomPage(pages[0].id)!;
    expect(page.name).toBe("EmptyState");
    const block = page.spec.columns[0].blocks[0];
    expect(publicComponentFile(block.component)).toBe("components/shared/EmptyState.tsx");
    expect(block.desc).toContain("src/components/shared/EmptyState.tsx");
  });

  it("sem seleção, a ação não aparece", { timeout: 30000 }, () => {
    render(
      <MemoryRouter>
        <CatalogSidebars />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: /Criar página com o componente/ })).toBeNull();
  });
});
