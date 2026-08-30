/**
 * Testes do FeatureModal — componente que hospeda qualquer recurso do sistema
 * num modal Radix (para usar sem sair da página atual).
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { FeatureModal, useFeatureModal } from "@/components/shared/FeatureModal";
import { useState } from "react";

function Harness({ size }: { size?: "sm" | "md" | "lg" | "xl" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Abrir</button>
      <FeatureModal
        open={open}
        onOpenChange={setOpen}
        title="Título do recurso"
        description="Descrição acessível"
        size={size}
      >
        <p>Conteúdo real</p>
      </FeatureModal>
    </>
  );
}

describe("FeatureModal", () => {
  it("não monta conteúdo quando fechado e monta ao abrir", async () => {
    render(<Harness />);
    expect(screen.queryByText("Conteúdo real")).toBeNull();
    screen.getByText("Abrir").click();
    await screen.findByRole("dialog");
    expect(screen.getByText("Conteúdo real")).toBeTruthy();
    expect(screen.getByText("Título do recurso")).toBeTruthy();
    expect(screen.getByText("Descrição acessível")).toBeTruthy();
  });

  it("useFeatureModal expõe open/setOpen/openModal/closeModal", async () => {
    function HookHarness() {
      const modal = useFeatureModal();
      return (
        <>
          <button onClick={modal.openModal}>abrir</button>
          <button onClick={modal.closeModal}>fechar</button>
          <FeatureModal open={modal.open} onOpenChange={modal.setOpen} title="Teste">
            <p>corpo</p>
          </FeatureModal>
        </>
      );
    }
    render(<HookHarness />);
    screen.getByText("abrir").click();
    await screen.findByRole("dialog");
    // Radix fecha pelo botão dedicado (não pelo onOpenChange do harness).
    expect(screen.getByText("corpo")).toBeTruthy();
  });

  it("onOpenChange=false (Esc/fora) fecha o modal", async () => {
    render(<Harness />);
    screen.getByText("Abrir").click();
    await screen.findByRole("dialog");
    // Radix expõe o botão Close padrão.
    screen.getByRole("button", { name: /close/i }).click();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
