/** Smoke render do /teste sem executar testes ao abrir. */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TestCenter from "@/pages/TestCenter";

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("TestCenter page", () => {
  it("renderiza dashboard vazio com executables e suítes", async () => {
    render(
      <MemoryRouter initialEntries={["/teste"]}>
        <TestCenter />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: /executar quick/i })).toBeInTheDocument();
    expect(screen.getByText(/suítes/i)).toBeInTheDocument();
    expect(screen.getByText(/02 — Servidor/i)).toBeInTheDocument();
    expect(screen.getByText(/LocalStorage do cliente/i, { exact: false })).toBeInTheDocument();
  });
});
