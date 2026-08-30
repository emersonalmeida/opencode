import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PageFrame } from "@/components/catalog/PageFrame";
import { catalogSectionId, openCatalogSection, type PageEmbedSpec } from "@/lib/pageFrames";

const spec: PageEmbedSpec = {
  path: "/dashboard",
  loader: () => Promise.resolve({ default: () => null }),
};

const notedSpec: PageEmbedSpec = {
  path: "/compare",
  loader: () => Promise.resolve({ default: () => null }),
  note: "Rota de redirecionamento.",
};

function renderFrame(s: PageEmbedSpec = spec) {
  return render(
    <MemoryRouter>
      <PageFrame
        spec={s}
        number="06"
        label="Dashboard"
        description="Analytics e KPIs"
        icon={<span data-testid="icon" />}
        anchorId={catalogSectionId(s.path)}
        componentCount={1}
        components={<div data-testid="children">componentes da página</div>}
      />
    </MemoryRouter>,
  );
}

describe("PageFrame", () => {
  beforeEach(() => localStorage.clear());

  it("nasce recolhido (lazy mount — iframe não montado)", () => {
    renderFrame();
    expect(screen.getByRole("region", { name: "06. Dashboard" })).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.queryByTestId("children")).toBeNull();
  });

  it("expande no clique e monta o iframe da rota real + children", () => {
    renderFrame();
    fireEvent.click(screen.getAllByRole("button", { name: /Expandir página/i })[0]);
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe!.getAttribute("src")).toBe("/dashboard");
    expect(iframe!.getAttribute("loading")).toBe("lazy");
    expect(iframe!.getAttribute("title")).toContain("Dashboard");
    expect(screen.getByTestId("children")).toBeTruthy();
  });

  it("persiste o nível e reidrata expandido", () => {
    const { unmount } = renderFrame();
    fireEvent.click(screen.getAllByRole("button", { name: /Expandir página/i })[0]);
    expect(document.querySelector("iframe")).toBeTruthy();
    unmount();
    renderFrame();
    expect(document.querySelector("iframe")).toBeTruthy();
  });

  it("evento catalog:open-section expande um frame recolhido", () => {
    renderFrame();
    act(() => {
      openCatalogSection(catalogSectionId("/dashboard"));
    });
    expect(document.querySelector("iframe")).toBeTruthy();
  });

  it("evento com tab alterna para a aba Componentes", () => {
    renderFrame();
    act(() => {
      openCatalogSection(catalogSectionId("/dashboard"), { tab: "componentes" });
    });
    const tab = screen.getByRole("tab", { name: /Componentes/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByTestId("children").parentElement?.hasAttribute("hidden")).toBe(false);
  });

  it("spec com nota renderiza a razão em vez do iframe", () => {
    renderFrame(notedSpec);
    fireEvent.click(screen.getAllByRole("button", { name: /Expandir página/i })[0]);
    expect(screen.getByText("Rota de redirecionamento.")).toBeTruthy();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("presets de largura alternam com aria-pressed", () => {
    renderFrame();
    fireEvent.click(screen.getAllByRole("button", { name: /Expandir página/i })[0]);
    const mobile = screen.getByRole("button", { name: /Mobile/ });
    expect(mobile.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(mobile);
    expect(mobile.getAttribute("aria-pressed")).toBe("true");
  });

  it("handle de altura responde ao teclado com clamp", () => {
    renderFrame();
    fireEvent.click(screen.getAllByRole("button", { name: /Expandir página/i })[0]);
    const handle = screen.getByRole("separator");
    expect(handle.getAttribute("aria-valuenow")).toBe("560");
    fireEvent.keyDown(handle, { key: "End" });
    expect(handle.getAttribute("aria-valuenow")).toBe("1600");
    fireEvent.keyDown(handle, { key: "Home" });
    expect(handle.getAttribute("aria-valuenow")).toBe("240");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(handle.getAttribute("aria-valuenow")).toBe("264");
  });

  it("ciclo de níveis: collapsed → default → expanded → collapsed", () => {
    renderFrame();
    fireEvent.click(screen.getAllByRole("button", { name: /Expandir página/i })[0]);
    expect(document.querySelector("iframe")).toBeTruthy();
    // default → expanded
    fireEvent.click(screen.getAllByRole("button", { name: /Expandir totalmente/i })[0]);
    expect(localStorage.getItem(`aso:pageframe-level:${catalogSectionId("/dashboard")}`)).toBe("expanded");
    // expanded → collapsed (desmonta)
    fireEvent.click(screen.getAllByRole("button", { name: /Recolher página/i })[0]);
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("link para a página real aponta para a rota", () => {
    renderFrame();
    const link = screen.getByRole("link", { name: /Abrir a página Dashboard/ });
    expect(link.getAttribute("href")).toBe("/dashboard");
  });
});
