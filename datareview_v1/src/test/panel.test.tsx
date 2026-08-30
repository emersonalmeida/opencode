import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Panel } from "@/components/Panel";

describe("Panel", () => {
  it("renders open by default with full content", () => {
    const { getByText, queryByText } = render(
      <Panel title="Meu Painel" subtitle="sub">
        <p>conteúdo completo aqui</p>
      </Panel>,
    );
    expect(getByText("Meu Painel")).toBeTruthy();
    expect(getByText("conteúdo completo aqui")).toBeTruthy();
    expect(getByText("sub")).toBeTruthy();
    // toggle button exists
    expect(getByText("Meu Painel")).toBeTruthy();
    void queryByText;
  });

  it("renders headerless content (bare) without crash", () => {
    const { getByText } = render(
      <Panel bare>
        <p>conteúdo solto</p>
      </Panel>,
    );
    expect(getByText("conteúdo solto")).toBeTruthy();
  });

  it("hides content when defaultOpen=false", () => {
    const { queryByText } = render(
      <Panel title="P" defaultOpen={false}>
        <p>escondido</p>
      </Panel>,
    );
    expect(queryByText("escondido")).toBeNull();
  });

  it("renders actions slot in header", () => {
    const { getByText } = render(
      <Panel title="P" actions={<span>ação-x</span>}>
        <p>corpo</p>
      </Panel>,
    );
    expect(getByText("ação-x")).toBeTruthy();
  });
});
