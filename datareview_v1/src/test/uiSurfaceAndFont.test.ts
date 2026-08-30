/** surfaceMode (solid/translucent) + fontFamily (Google Fonts) do uiSettings. */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getUISettings, setUISettings, resetUISettings, applyUISettings,
  setFontRole, googleFontsUrlFor, clearUICache,
  sanitizeFontFamily, googleFontsUrl, FONT_PRESETS, DEFAULT_UI,
} from "@/lib/uiSettings";

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  document.getElementById("ui-font-link")?.remove();
  resetUISettings();
});

describe("surfaceMode", () => {
  it("default é solid", () => {
    expect(getUISettings().surfaceMode).toBe("solid");
  });

  it("aplica classe ui-surface-solid no <html>", () => {
    applyUISettings();
    expect(document.documentElement.classList.contains("ui-surface-solid")).toBe(true);
    expect(document.documentElement.classList.contains("ui-surface-translucent")).toBe(false);
  });

  it("modo translucent troca as classes (skeumorphism com blur)", () => {
    setUISettings({ surfaceMode: "translucent" });
    expect(document.documentElement.classList.contains("ui-surface-translucent")).toBe(true);
    expect(document.documentElement.classList.contains("ui-surface-solid")).toBe(false);
  });

  it("persiste e migra storage antigo sem o campo", () => {
    localStorage.setItem("aso:ui-settings:v1", JSON.stringify({ panelOpacity: 80 }));
    resetUISettings(); // limpa cache
    localStorage.setItem("aso:ui-settings:v1", JSON.stringify({ panelOpacity: 80 }));
    // recarrega via getUISettings após limpar cache interno via reset+set
    setUISettings({ panelOpacity: 80 });
    expect(getUISettings().panelOpacity).toBe(80);
    expect(getUISettings().surfaceMode).toBe("solid"); // default aplicado no merge
  });
});

describe("fontFamily (Google Fonts)", () => {
  it("default é Inter", () => {
    expect(getUISettings().fontFamily).toBe("Inter");
  });

  it("aplica --ui-font-family e injeta <link> do Google Fonts", () => {
    applyUISettings();
    expect(document.documentElement.style.getPropertyValue("--ui-font-family")).toContain("Inter");
    const link = document.getElementById("ui-font-link") as HTMLLinkElement;
    expect(link).toBeTruthy();
    expect(link.rel).toBe("stylesheet");
    expect(link.href).toContain("fonts.googleapis.com/css2?family=Inter");
  });

  it("trocar a fonte atualiza variável e link (espaços viram +)", () => {
    setUISettings({ fontFamily: "Open Sans" });
    expect(document.documentElement.style.getPropertyValue("--ui-font-family")).toContain("Open Sans");
    const link = document.getElementById("ui-font-link") as HTMLLinkElement;
    expect(link.href).toContain("family=Open+Sans");
  });

  it("sanitizeFontFamily remove caracteres perigosos", () => {
    expect(sanitizeFontFamily('Roboto";<script>')).toBe("Robotoscript");
    expect(sanitizeFontFamily("  Fira Sans  ")).toBe("Fira Sans");
  });

  it("googleFontsUrl codifica espaços e inclui pesos", () => {
    expect(googleFontsUrl("IBM Plex Sans")).toBe(
      "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700;800&display=swap",
    );
  });

  it("presets incluem Inter e famílias comuns", () => {
    const families = FONT_PRESETS.map((f) => f.family);
    expect(families).toContain("Inter");
    expect(families).toContain("Roboto");
    expect(FONT_PRESETS.length).toBeGreaterThanOrEqual(8);
  });

  it("fonte vazia cai no default na aplicação", () => {
    setUISettings({ fontFamily: "" });
    applyUISettings();
    expect(document.documentElement.style.getPropertyValue("--ui-font-family")).toContain(DEFAULT_UI.fontFamily);
  });

  it("setUISettings({ fontFamily }) legado atualiza fontRoles.primary", () => {
    setUISettings({ fontFamily: "Open Sans" });
    expect(getUISettings().fontRoles.primary).toBe("Open Sans");
    expect(getUISettings().fontFamily).toBe("Open Sans");
  });
});

describe("fontRoles + pesos (tipografia por papel)", () => {
  beforeEach(() => {
    localStorage.clear();
    resetUISettings();
  });

  it("defaults: primária Inter, secundária/mono vazias (herdam), pesos 400/700", () => {
    const s = getUISettings();
    expect(s.fontRoles).toEqual({ primary: "Inter", secondary: "", mono: "" });
    expect(s.fontWeightRegular).toBe(400);
    expect(s.fontWeightBold).toBe(700);
  });

  it("setFontRole define só o papel e sanitiza caracteres perigosos", () => {
    setFontRole("secondary", "Playfair Display");
    expect(getUISettings().fontRoles.secondary).toBe("Playfair Display");
    setFontRole("mono", 'Fira Code<script>');
    expect(getUISettings().fontRoles.mono).toBe("Fira Codescript");
  });

  it("applyUISettings expõe variáveis por papel e link combinado", () => {
    setFontRole("secondary", "Playfair Display");
    setFontRole("mono", "Fira Code");
    applyUISettings();
    const el = document.documentElement.style;
    expect(el.getPropertyValue("--ui-font-family-secondary")).toContain("Playfair Display");
    expect(el.getPropertyValue("--ui-font-family-mono")).toContain("Fira Code");
    const link = document.getElementById("ui-font-link") as HTMLLinkElement;
    expect(link.href).toContain("family=Inter");
    expect(link.href).toContain("family=Playfair+Display");
    expect(link.href).toContain("family=Fira+Code");
  });

  it("secundária/mono vazias herdam da primária (var) / mono do sistema", () => {
    applyUISettings();
    const el = document.documentElement.style;
    expect(el.getPropertyValue("--ui-font-family-secondary")).toContain("var(--ui-font-family)");
    expect(el.getPropertyValue("--ui-font-family-mono")).toContain("ui-monospace");
  });

  it("pesos são clampados (regular 300–700, bold 500–800) e aplicados", () => {
    setUISettings({ fontWeightRegular: 100, fontWeightBold: 999 });
    expect(getUISettings().fontWeightRegular).toBe(300);
    expect(getUISettings().fontWeightBold).toBe(800);
    applyUISettings();
    const el = document.documentElement.style;
    expect(el.getPropertyValue("--ui-font-weight-regular")).toBe("300");
    expect(el.getPropertyValue("--ui-font-weight-bold")).toBe("800");
  });

  it("migra storage antigo (só fontFamily, sem fontRoles)", () => {
    localStorage.setItem("aso:ui-settings:v1", JSON.stringify({ fontFamily: "Lato" }));
    clearUICache(); // força releitura do storage
    const s = getUISettings();
    expect(s.fontRoles.primary).toBe("Lato");
    expect(s.fontRoles.secondary).toBe("");
  });

  it("googleFontsUrlFor combina famílias únicas numa requisição", () => {
    expect(googleFontsUrlFor(["Inter", "Fira Code", "Inter", ""])).toBe(
      "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Fira+Code:wght@300;400;500;600;700;800&display=swap",
    );
    expect(googleFontsUrlFor([])).toBe("");
  });
});

describe("escala de títulos + altura de linha", () => {
  beforeEach(() => {
    localStorage.clear();
    resetUISettings();
  });

  it("defaults: headingScale 100, lineHeight 150", () => {
    const s = getUISettings();
    expect(s.headingScale).toBe(100);
    expect(s.lineHeight).toBe(150);
  });

  it("clamp + aplicação como variáveis CSS", () => {
    setUISettings({ headingScale: 999, lineHeight: 50 });
    expect(getUISettings().headingScale).toBe(150);
    expect(getUISettings().lineHeight).toBe(120);
    applyUISettings();
    const el = document.documentElement.style;
    expect(el.getPropertyValue("--ui-heading-scale")).toBe("1.5");
    expect(el.getPropertyValue("--ui-line-height")).toBe("1.2");
  });
});
