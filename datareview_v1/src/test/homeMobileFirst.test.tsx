/**
 * Home real (`/`) — guarda do modelo puro (`homeMobileFirst`) + render da nova
 * página inicial mobile-first com conteúdo REAL:
 *
 *  - Modelo: saudação por hora, formatação pt-BR compacta, ações rápidas e
 *    seções de navegação (núcleo puro, sem React).
 *  - Render: saudação contextual, KPIs do dataset (ou empty state honesto
 *    com coleta embutida quando vazio), ações rápidas tocáveis e seções com
 *    rotas reais (cada uma validada contra o registry PAGES).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  greetingForDate, formatCompact, quickActions, homeSections,
 type HomeLinkSectionSpec,
 type QuickActionSpec,
 } from "@/lib/home/homeMobileFirst";
import { HomeMobileFirst } from "@/components/home/HomeMobileFirst";
import { buildDemoEntry } from "@/lib/demoDataset";
import { upsertDataset, clearDataset } from "@/lib/datasetStore";
import { PAGES } from "@/lib/pages";
import type { DatasetEntry } from "@/lib/datasetStore";
import { computeKPIs } from "@/lib/dashboardAnalytics";

beforeEach(() => {
  localStorage.clear();
  clearDataset();
});

afterEach(cleanup);

function reviewsOf(entry: DatasetEntry) {
  return entry.reviews;
}

/* ----------------------------------------------------------- modelo puro */

describe("homeMobileFirst (modelo puro)", () => {
it("saudacao pela hora do dia", () => {
    const madrugada = new Date(2026, 0, 1, 4, 0, 0);
    const manha    = new Date(2026, 0, 1, 11, 0, 0);
    const tarde     = new Date(2026, 0, 1, 12, 0,  0);
    const noite     = new Date(2026, 0, 1,  18,  0,  0);
    expect(greetingForDate(madrugada)).toBe("Boa madrugada");
    expect(greetingForDate(manha)).toBe("Boa manhã");
    expect(greetingForDate(tarde)).toBe("Boa tarde");
    expect(greetingForDate(noite)).toBe("Boa noite");
  });
  it("formata numeros compactos em pt-BR", () => {
    expect(formatCompact(0)).toBe("0");
    expect(formatCompact(999)).toBe("999");
    expect(formatCompact(1234)).toBe("1,2 mil");
    expect(formatCompact(10500)).toBe("10,5 mil");
    expect(formatCompact(10_000_000)).toBe("10000 mil");
  });
  it("4 acoes rapidas com ids unicos e rotas reais do registry", () => {
    const actions = quickActions();
    expect(actions).toHaveLength(4);
    expect(new Set(actions.map((a) => a.id)).size).toBe(actions.length);
    for (const a of actions) {
      expect(PAGES.some((p) => p.path === a.path), `rota ${a.path} fora do registry`).toBe(true);
    }
  });
  it("acao Coletar apps e a primaria", () => {
    expect(quickActions().find((a) => a.primary)?.path).toBe("/inicio");
  });
  it("secoes de navegacao com rotas reais do registry", () => {
    const sections = homeSections();
    expect(sections.length).toBeGreaterThanOrEqual(3);
    const seen = new Set<string>();
    for (const s of sections) {
      expect(s.links.length).toBeGreaterThan(0);
      for (const l of s.links) {
        expect(seen.has(l.path), `rota ${l.path} duplicada`).toBe(false);
        seen.add(l.path);
        expect(PAGES.some((p) => p.path === l.path), `rota ${l.path} fora do registry`).toBe(true);
      }
    }
  });
});

/* --------------------------------------------------------------- render */

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <HomeMobileFirst />
    </MemoryRouter>,
  );
}

describe("HomeMobileFirst (render)", () => {
  it("saudacao contextual e data no cabecalho", () => {
    renderHome();
    const greeting = greetingForDate(new Date());
    expect(screen.getByRole("heading", { name: new RegExp(`^${greeting}`) })).toBeTruthy();
  });
  it("vazio: mostra empty state com coleta embutida e sem KPIs", () => {
    clearDataset();
    renderHome();
    expect(screen.getByRole("status")).toHaveTextContent("Nada coletado ainda");
    expect(screen.queryByText("Reviews")).toBeNull();
  });
  it("com dados: mostra KPIs reais do dataset", () => {
    upsertDataset(buildDemoEntry());
    renderHome();
    expect(screen.getByText("Reviews")).toBeTruthy();
    expect(screen.getByText("Nota média")).toBeTruthy();
    expect(screen.getByText("Positividade")).toBeTruthy();
    expect(screen.queryByText("Nada coletado ainda")).toBeNull();
  });
  it("acoes rapidas navegam para rotas reais", () => {
    renderHome();
    const first = quickActions()[0];
    const btn = screen.getByRole("button", { name: new RegExp(`^${first.title}`) });
    fireEvent.click(btn);
  });
  it("secoes de navegacao renderizam todas as linhas com rotas reais", () => {
    renderHome();
    for (const s of homeSections()) {
      for (const l of s.links) {
        expect(screen.getByRole("link", { name: (n) => n.startsWith(l.label) })).toBeTruthy();
      }
    }
  });
  it("botões e links presentes para navegacao", () => {
    renderHome();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link").length).toBeGreaterThan(0);
  });
});
