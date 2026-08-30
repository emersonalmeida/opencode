/**
 * Guard do aviso padronizado de IA desativada (AIDisabledNotice).
 *
 * Regra: toda superfície de IA com empty state "IA desativada" usa o
 * componente compartilhado (texto consistente + link para /configuracoes)
 * em vez de mensagem inline. MIGRATED_SURFACES é a lista de superfícies já
 * migradas — ao migrar uma nova, adicionar aqui (o guard exige o import).
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AIDisabledNotice, AIDisabledEmptyState } from "@/components/shared/AIDisabledNotice";

const REPO_ROOT = process.cwd();

/** Superfícies que DEVEM usar o aviso compartilhado (cresce a cada migração). */
const MIGRATED_SURFACES = [
  "src/components/shared/AutoAIAnalysis.tsx",
  "src/components/shared/UnifiedComparisonAI.tsx",
  "src/components/layoutBuilder/LayoutComponents.tsx",
  "src/components/journey/StageAnalyze.tsx",
  "src/components/journey/StageDecide.tsx",
  "src/components/os/OSViews.tsx",
  "src/components/flow/sections/SectionAgents.tsx",
  "src/components/flow/sections/SectionDecide.tsx",
  "src/components/flow/sections/SectionInvestigate.tsx",
  "src/components/lab/ExperimentDetail.tsx",
  "src/components/uni/UniAI.tsx",
  "src/pages/Methodologies.tsx",
  "src/pages/Agentes.tsx",
  "src/pages/CaseIa.tsx",
  "src/pages/Pipeline.tsx",
  "src/pages/DataExplorer.tsx",
  "src/pages/MultiPipeline.tsx",
  "src/pages/Concept.tsx",
  "src/pages/DecisionCenter.tsx",
  "src/components/designCanvas/DesignCanvasAICopilot.tsx",
  "src/components/designCanvas/DesignCanvasNode.tsx",
  "src/components/AIAssistantPanel.tsx",
];

describe("AIDisabledNotice (componente compartilhado)", () => {
  it("renderiza mensagem com link para Configurações", () => {
    render(
      <MemoryRouter>
        <AIDisabledNotice />
      </MemoryRouter>,
    );
    expect(screen.getByRole("note")).toBeTruthy();
    expect(screen.getByText(/sistema funciona completo sem IA/)).toBeTruthy();
    const link = screen.getByRole("link", { name: /Configurações → Inteligência Artificial/ });
    expect(link.getAttribute("href")).toBe("/configuracoes");
  });

  it("variante compact reduz padding", () => {
    const { container } = render(
      <MemoryRouter>
        <AIDisabledNotice compact />
      </MemoryRouter>,
    );
    expect(container.querySelector(".p-2\\.5")).toBeNull();
  });
});

describe("AIDisabledEmptyState (empty state de seção)", () => {
  it("renderiza título, descrição e CTA para ativar a IA", () => {
    render(
      <MemoryRouter>
        <AIDisabledEmptyState />
      </MemoryRouter>,
    );
    expect(screen.getByRole("status")).toBeTruthy();
    expect(screen.getByText("IA desativada")).toBeTruthy();
    expect(screen.getByText(/funciona completo sem IA/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ativar IA nas Configurações/ }).getAttribute("href")).toBe("/configuracoes");
  });
});

describe("AIDisabledNotice inlineConfigure", () => {
  it("renderiza botão de configuração inline quando fornecido", async () => {
    let opened = 0;
    render(
      <MemoryRouter>
        <AIDisabledNotice inlineConfigure={() => opened++} />
      </MemoryRouter>,
    );
    const btn = screen.getByRole("button", { name: /aqui mesmo/ });
    btn.click();
    expect(opened).toBe(1);
  });
});

describe("superfícies migradas usam o aviso compartilhado", () => {
  it("todas importam AIDisabledNotice", () => {
    for (const file of MIGRATED_SURFACES) {
      const content = readFileSync(path.join(REPO_ROOT, file), "utf8");
      expect(
        content.includes('from "@/components/shared/AIDisabledNotice"'),
        `${file} deve importar o aviso compartilhado`,
      ).toBe(true);
    }
  });

  it("nenhuma mantém a mensagem inline antiga hardcoded", () => {
    const LEGACY = "Ative-a em <strong>Configurações";
    for (const file of MIGRATED_SURFACES) {
      const content = readFileSync(path.join(REPO_ROOT, file), "utf8");
      expect(content.includes(LEGACY), `${file} ainda tem mensagem inline antiga`).toBe(false);
    }
  });
});
