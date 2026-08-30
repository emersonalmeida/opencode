// Exportação multi-formato P1 (XLSX SpreadsheetML + PDF via diálogo de
// impressão): builders puros testáveis sem download/DOM.
import { describe, it, expect } from "vitest";
import { buildSpreadsheetXml, buildPrintHtml, escapeXml, XLSX_HEADERS } from "@/lib/exportUtils";

describe("escapeXml", () => {
  it("escapa os 5 caracteres especiais de XML", () => {
    expect(escapeXml(`a<b>c&d"e'f`)).toBe("a&lt;b&gt;c&amp;d&quot;e&apos;f");
    expect(escapeXml("sem")).toBe("sem");
  });
});

describe("buildSpreadsheetXml (XLSX SpreadsheetML)", () => {
  it("gera workbook com header + linhas, strings e números tipados", () => {
    const xml = buildSpreadsheetXml(["nome", "nota"], [["Ana", 5], ["Bia", 1]]);
    expect(xml.startsWith("<?xml version=\"1.0\"?>")).toBe(true);
    expect(xml).toContain("<Worksheet ss:Name=\"reviews\">");
    expect(xml).toContain('ss:Type="String"');
    expect(xml).toContain('ss:Type="Number"');
    expect(xml.match(/<Row>/g)?.length).toBe(3);
  });

  it("trata undefined como vazio e escapa XML nos valores", () => {
    const xml = buildSpreadsheetXml(["a"], [[undefined], ["x<y"]]);
    expect(xml).toContain("String\"");
    expect(xml).toContain("x&lt;y");
  });
});

describe("buildPrintHtml (PDF via impressão)", () => {
  it("gera doctype, título, summary e tabela com valores escapados", () => {
    const html = buildPrintHtml("Nubank — reviews", ["Total: 2"], ["Autor", "Nota"], [["Ana", 5], ["B<ia", 1]]);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<h1>Nubank — reviews</h1>");
    expect(html).toContain("<li>Total: 2</li>");
    expect(html).toContain("<th>Autor</th>");
    expect(html).toContain("<td>B&lt;ia</td>");
  });

  it("XLSX_HEADERS cobre os campos estendidos do review", () => {
    expect(XLSX_HEADERS).toContain("version");
    expect(XLSX_HEADERS).toContain("country");
    expect(XLSX_HEADERS).toContain("thumbsUp");
  });
});
