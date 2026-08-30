import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { PrimaryColorSwatches } from "@/components/settings/PrimaryColorSwatches";
import { parseColor } from "@/lib/colorUtils";

function PaletteProbe() {
  const { primaryColors } = useTheme();
  return (
    <div>
      <span data-testid="total">{primaryColors.length}</span>
      <span data-testid="coloridas">{primaryColors.filter((c) => c.group === "colorida").length}</span>
      <span data-testid="monocromas">{primaryColors.filter((c) => c.group === "monocromatica").length}</span>
    </div>
  );
}

describe("Paleta de cor principal expandida", () => {
  it("oferece muitas opções: coloridas em escalas + monocromáticas", () => {
    render(<ThemeProvider><PaletteProbe /></ThemeProvider>);
    const total = Number(screen.getByTestId("total").textContent);
    const coloridas = Number(screen.getByTestId("coloridas").textContent);
    const monocromas = Number(screen.getByTestId("monocromas").textContent);
    expect(total).toBeGreaterThanOrEqual(24);
    expect(coloridas).toBeGreaterThanOrEqual(18);
    expect(monocromas).toBeGreaterThanOrEqual(5);
    expect(total).toBe(coloridas + monocromas);
  });

  it("todas as cores da paleta são HSL válidos parseáveis", () => {
    let all: Array<{ hsl: string }> = [];
    function Grab() {
      const { primaryColors } = useTheme();
      all = primaryColors;
      return null;
    }
    render(<ThemeProvider><Grab /></ThemeProvider>);
    expect(all.length).toBeGreaterThanOrEqual(24);
    for (const c of all) {
      expect(parseColor(c.hsl), `cor inválida: ${c.hsl}`).not.toBeNull();
    }
  });

  it("swatches agrupados renderizam grupos com aria-label e aplicam a cor ao clicar", () => {
    localStorage.clear();
    render(
      <ThemeProvider>
        <PrimaryColorSwatches />
      </ThemeProvider>,
    );
    expect(screen.getByRole("group", { name: /cores principais coloridas/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /cores principais monocromáticas/i })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Cor principal Grafite"));
    expect(localStorage.getItem("app-primary-color")).toBe("240 6% 45%");
  });

  it("cada opção tem nome único e hsl único", () => {
    let all: Array<{ name: string; hsl: string }> = [];
    function Grab() {
      const { primaryColors } = useTheme();
      all = primaryColors;
      return null;
    }
    render(<ThemeProvider><Grab /></ThemeProvider>);
    expect(new Set(all.map((c) => c.name)).size).toBe(all.length);
    expect(new Set(all.map((c) => c.hsl)).size).toBe(all.length);
  });

  it("cores monocromáticas têm saturação baixa (≤25%)", () => {
    let mono: Array<{ hsl: string }> = [];
    function Grab() {
      const { primaryColors } = useTheme();
      mono = primaryColors.filter((c) => c.group === "monocromatica");
      return null;
    }
    render(<ThemeProvider><Grab /></ThemeProvider>);
    for (const c of mono) {
      const p = parseColor(c.hsl);
      expect(p).not.toBeNull();
      expect(p!.s).toBeLessThanOrEqual(25);
    }
  });
});
