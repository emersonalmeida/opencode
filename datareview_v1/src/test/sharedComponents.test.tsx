import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageLoader } from "@/components/shared/PageLoader";

describe("EmptyState", () => {
  it("renderiza título, descrição e ação", () => {
    render(
      <EmptyState
        icon={Inbox}
        title="Nada por aqui"
        description="Colete um app para começar."
        action={<button>Coletar</button>}
      />,
    );
    expect(screen.getByText("Nada por aqui")).toBeTruthy();
    expect(screen.getByText("Colete um app para começar.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Coletar" })).toBeTruthy();
  });

  it("modo compacto omite descrição ausente sem quebrar", () => {
    render(<EmptyState icon={Inbox} title="Vazio" compact />);
    expect(screen.getByText("Vazio")).toBeTruthy();
  });
});

describe("PageLoader", () => {
  it("anuncia status de carregamento para leitores de tela", () => {
    render(<PageLoader />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("Carregando página…")).toBeTruthy();
  });
});
