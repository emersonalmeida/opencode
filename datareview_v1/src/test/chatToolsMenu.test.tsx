import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatToolsMenu } from "@/components/shared/ChatToolsMenu";
import { EMBEDDABLE_SURFACES } from "@/lib/embeddableSurfaces";

beforeEach(() => localStorage.clear());

describe("ChatToolsMenu", () => {
  it("abre o popover e lista ações rápidas + todas as superfícies", () => {
    render(<ChatToolsMenu onCommand={() => undefined} />);
    fireEvent.click(screen.getByLabelText("Abrir ferramentas do chat"));
    expect(screen.getByText("Ferramentas")).toBeInTheDocument();
    expect(screen.getByText("Executar pipeline")).toBeInTheDocument();
    expect(screen.getByText("Gerar relatório")).toBeInTheDocument();
    // Todas as superfícies embutíveis aparecem no grid.
    for (const s of EMBEDDABLE_SURFACES) {
      // O label pode aparecer 2x (superfície + página com o mesmo nome).
      expect(screen.getAllByText(s.label).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("selecionar uma ação dispara a frase equivalente e fecha o menu", () => {
    const onCommand = vi.fn();
    render(<ChatToolsMenu onCommand={onCommand} />);
    fireEvent.click(screen.getByLabelText("Abrir ferramentas do chat"));
    fireEvent.click(screen.getByText("Executar pipeline"));
    expect(onCommand).toHaveBeenCalledWith("execute o pipeline");
    expect(screen.queryByText("Ferramentas")).not.toBeInTheDocument();
  });

  it("selecionar uma superfície dispara 'exiba <label>'", () => {
    const onCommand = vi.fn();
    render(<ChatToolsMenu onCommand={onCommand} />);
    fireEvent.click(screen.getByLabelText("Abrir ferramentas do chat"));
    fireEvent.click(screen.getByText(EMBEDDABLE_SURFACES[1].label));
    expect(onCommand).toHaveBeenCalledWith(`exiba ${EMBEDDABLE_SURFACES[1].label}`);
  });

  it("respeita disabled", () => {
    render(<ChatToolsMenu onCommand={() => undefined} disabled />);
    expect(screen.getByLabelText("Abrir ferramentas do chat")).toBeDisabled();
  });
});
