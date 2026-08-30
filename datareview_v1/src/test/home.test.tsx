/**
 * Home (`/`) — guarda do modelo puro + render do shell mobile-first:
 * status bar, header, abas, conteúdo em seções, task bar e footer.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  HOME_TABS, HOME_TASKBAR, homeShellMode, getHomeTab, loadHomeTab, saveHomeTab,
} from "@/lib/home/homeModel";
import { HomeShell } from "@/components/home/HomeShell";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("homeModel (puro)", () => {
  it("tem exatamente 4 abas e 5 itens na task bar", () => {
    expect(HOME_TABS).toHaveLength(4);
    expect(HOME_TASKBAR).toHaveLength(5);
  });

  it("ids únicos em abas, seções, componentes e tasks", () => {
    const tabIds = HOME_TABS.map((t) => t.id);
    expect(new Set(tabIds).size).toBe(tabIds.length);
    const taskIds = HOME_TASKBAR.map((t) => t.id);
    expect(new Set(taskIds).size).toBe(taskIds.length);
    for (const t of HOME_TABS) {
      for (const s of t.sections) {
        expect(s.components.length, `seção ${s.id} sem componentes`).toBeGreaterThan(0);
        const cIds = s.components.map((c) => c.id);
        expect(new Set(cIds).size).toBe(cIds.length);
      }
    }
  });

  it("linhas skeleton são percentuais válidos (1–100)", () => {
    for (const t of HOME_TABS)
      for (const s of t.sections)
        for (const c of s.components) {
          expect(c.lines.length, `componente ${c.id} sem linhas`).toBeGreaterThan(0);
          for (const w of c.lines) {
            expect(w).toBeGreaterThan(0);
            expect(w).toBeLessThanOrEqual(100);
          }
        }
  });

  it("homeShellMode: phone <640, tablet <1024, senão desktop", () => {
    expect(homeShellMode(320)).toBe("phone");
    expect(homeShellMode(639)).toBe("phone");
    expect(homeShellMode(640)).toBe("tablet");
    expect(homeShellMode(1023)).toBe("tablet");
    expect(homeShellMode(1024)).toBe("desktop");
    expect(homeShellMode(1920)).toBe("desktop");
  });

  it("getHomeTab cai na primeira aba com id desconhecido", () => {
    expect(getHomeTab("nope").id).toBe(HOME_TABS[0].id);
    expect(getHomeTab(HOME_TABS[2].id).id).toBe(HOME_TABS[2].id);
  });

  it("aba ativa persiste e valida contra o modelo", () => {
    expect(loadHomeTab()).toBe(HOME_TABS[0].id);
    saveHomeTab(HOME_TABS[3].id);
    expect(loadHomeTab()).toBe(HOME_TABS[3].id);
    saveHomeTab("nope");
    expect(loadHomeTab()).toBe(HOME_TABS[3].id);
    localStorage.setItem("aso:home-tab:v1", "nope");
    expect(loadHomeTab()).toBe(HOME_TABS[0].id);
  });

  it("tasks navegam para rotas reais do registry", () => {
    for (const t of HOME_TASKBAR) expect(t.path.startsWith("/")).toBe(true);
  });
});

function renderHome(width: number, initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <HomeShell forceWidth={width} />
    </MemoryRouter>,
  );
}

describe("HomeShell (render)", () => {
  it("renderiza status bar, header, tablist, main, task bar e footer", () => {
    renderHome(1280);
    expect(screen.getByRole("status", { name: "Status da Home" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Home" })).toBeTruthy();
    expect(screen.getByRole("tablist", { name: "Abas da Home" })).toBeTruthy();
    expect(screen.getByRole("main")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Task bar" })).toBeTruthy();
    expect(screen.getByRole("contentinfo")).toBeTruthy();
    expect(screen.getByRole("status", { name: "Status do rodapé" })).toBeTruthy();
  });

  it("modo phone (375px): task bar só ícones; tablet (768): rótulos visíveis", () => {
    const { unmount } = renderHome(375);
    for (const t of HOME_TASKBAR) {
      const btn = screen.getByRole("button", { name: t.label });
      expect(btn.textContent).toBe("");
    }
    unmount();
    renderHome(768);
    for (const t of HOME_TASKBAR) {
      const btn = screen.getByRole("button", { name: t.label });
      expect(btn.textContent).toBe(t.label);
    }
  });

  it("trocar de aba muda o título do conteúdo e persiste", () => {
    renderHome(1280);
    const target = HOME_TABS[1]; // Descobrir
    fireEvent.click(screen.getByRole("tab", { name: target.label }));
    expect(screen.getByRole("heading", { level: 2, name: target.pageTitle })).toBeTruthy();
    expect(loadHomeTab()).toBe(target.id);
  });

  it("botão de info do componente revela a descrição (aria-expanded)", () => {
    renderHome(1280);
    const first = HOME_TABS[0].sections[0].components[0];
    const btn = screen.getByRole("button", { name: `Sobre o componente ${first.title}` });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(first.desc)).toBeTruthy();
  });

  it("seções renderizam botões de ação com aria-label contextual", () => {
    renderHome(1280);
    const tab = HOME_TABS[0];
    for (const s of tab.sections) {
      expect(screen.getByRole("button", { name: `${s.action.label} (seção ${s.title})` })).toBeTruthy();
    }
  });

  it("task bar marca a rota ativa com aria-current", () => {
    renderHome(1280, "/");
    const homeBtn = screen.getByRole("button", { name: "Início" });
    expect(homeBtn.getAttribute("aria-current")).toBe("page");
  });
});
