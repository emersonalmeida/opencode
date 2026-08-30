import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

describe("MarkdownRenderer — markdown básico", () => {
  it("renderiza headings, negrito e listas", () => {
    render(<MarkdownRenderer content={"# Título\n\n**negrito**\n\n- item 1\n- item 2"} />);
    expect(screen.getByRole("heading", { level: 1, name: "Título" })).toBeInTheDocument();
    expect(screen.getByText("negrito").tagName).toBe("STRONG");
    expect(screen.getByText("item 1")).toBeInTheDocument();
  });

  it("renderiza tabela GFM com header fixo", () => {
    const { container } = render(<MarkdownRenderer content={"| A | B |\n|---|---|\n| 1 | 2 |"} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(container.querySelector("th")!.className).toContain("sticky");
  });

  it("task list vira checkbox visual", () => {
    const { container } = render(
      <MarkdownRenderer
        content={`- [x] feito
- [ ] pendente`}
      />,
    );
    const items = container.querySelectorAll("li");
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toContain("feito");
    expect(items[0].querySelector("input")).toBeNull(); // checkbox vira span visual
  });
});

describe("MarkdownRenderer — HTML embutido (rehype-raw)", () => {
  it("renderiza <details>/<summary>", () => {
    const { container } = render(<MarkdownRenderer content={"<details><summary>Mais</summary>conteúdo oculto</details>"} />);
    expect(container.querySelector("details")).not.toBeNull();
    expect(screen.getByText("Mais").tagName).toBe("SUMMARY");
    expect(screen.getByText(/conteúdo oculto/)).toBeInTheDocument();
  });

  it("renderiza <kbd> e <mark>", () => {
    render(<MarkdownRenderer content={"Pressione <kbd>Ctrl+K</kbd> e veja o <mark>destaque</mark>."} />);
    expect(screen.getByText("Ctrl+K").tagName).toBe("KBD");
    expect(screen.getByText("destaque").tagName).toBe("MARK");
  });

  it("enableHtml=false desativa HTML bruto", () => {
    const { container } = render(<MarkdownRenderer enableHtml={false} content={"<kbd>tecla</kbd>"} />);
    expect(container.querySelector("kbd")).toBeNull();
  });
});

describe("MarkdownRenderer — links e imagens", () => {
  it("link externo abre em nova aba com rel noopener", () => {
    render(<MarkdownRenderer content="[site](https://example.com)" />);
    const a = screen.getByRole("link", { name: /site/ });
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("link interno não ganha target _blank", () => {
    render(<MarkdownRenderer content="[âncora](#secao)" />);
    expect(screen.getByRole("link", { name: /âncora/ })).not.toHaveAttribute("target");
  });

  it("imagem é responsiva e mostra legenda do alt", () => {
    render(<MarkdownRenderer content="![gráfico de vendas](https://img.example/x.png)" />);
    const img = screen.getByRole("img", { name: "gráfico de vendas" });
    expect(img.className).toContain("max-w-full");
    expect(img).toHaveAttribute("loading", "lazy");
  });
});

describe("MarkdownRenderer — charts fenced", () => {
  it("chart-area renderiza quando enableCharts", () => {
    const { container } = render(
      <MarkdownRenderer enableCharts content={'```chart-area\n[{"name":"a","value":1}]\n```'} />,
    );
    expect(container.querySelector(".recharts-responsive-container")).not.toBeNull();
  });

  it("chart com JSON inválido mostra erro amigável", () => {
    render(<MarkdownRenderer enableCharts content={"```chart-bar\n{não é json}\n```"} />);
    expect(screen.getByText(/Erro ao renderizar gráfico/)).toBeInTheDocument();
  });

  it("sem enableCharts, chart vira bloco de código", () => {
    render(<MarkdownRenderer content={'```chart-bar\n[{"name":"a","value":1}]\n```'} />);
    expect(screen.getByText("chart-bar")).toBeInTheDocument();
  });
});

describe("MarkdownRenderer — componentes embutidos (fence component)", () => {
  it("fence component com id conhecido renderiza a superfície real", () => {
    render(
      <MemoryRouter>
        <MarkdownRenderer enableComponents content={"```component\nactivity\n```"} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("region", { name: /Componente embutido: Atividade/ })).toBeInTheDocument();
  });

  it("fence component com id desconhecido mostra erro honesto", () => {
    render(
      <MemoryRouter>
        <MarkdownRenderer enableComponents content={"```component\nnao-existe\n```"} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Superfície desconhecida: nao-existe/);
  });

  it("sem enableComponents, fence component vira bloco de código", () => {
    render(<MarkdownRenderer content={"```component\ncharts\n```"} />);
    expect(screen.getByText("component")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Componente embutido/ })).toBeNull();
  });
});
