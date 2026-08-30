import { beforeAll, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import Index from "@/pages/Index";
import Home from "@/pages/Home";
import HomeLite from "@/pages/HomeLite";
import UiShell from "@/pages/UiShell";
import Dashboard from "@/pages/Dashboard";
import Experiments from "@/pages/Experiments";
import Chat from "@/pages/Chat";
import Canvas from "@/pages/Canvas";
import Lab from "@/pages/Lab";
import Design from "@/pages/DesignCanvas";
import DesignSystemPage from "@/pages/DesignSystemPage";
import ComponentsCatalog from "@/pages/ComponentsCatalog";
import FileChat from "@/pages/FileChat";
import Atlas from "@/pages/AnalysisAtlas";
import Pipeline from "@/pages/Pipeline";
import Agentes from "@/pages/Agentes";
import Case from "@/pages/Case";
import Configuracoes from "@/pages/SettingsPage";
import DecisionCenter from "@/pages/DecisionCenter";
import Playground from "@/pages/Playground";
import DataExplorer from "@/pages/DataExplorer";
import DataPipeline from "@/pages/DataPipeline";
import Outputs from "@/pages/Outputs";
import UsagePage from "@/pages/UsagePage";
import Terminal from "@/pages/Terminal";
import TestCenter from "@/pages/TestCenter";
import OS from "@/pages/OS";
import Presentations from "@/pages/Presentations";
import Journey from "@/pages/Journey";
import Flow from "@/pages/Flow";
import Nucleo from "@/pages/Nucleo";
import AICentral from "@/pages/AICentral";
import Methodologies from "@/pages/Methodologies";
import Concept from "@/pages/Concept";
import LayoutBuilder from "@/pages/LayoutBuilder";
import Estrutura from "@/pages/Estrutura";
import Inventario from "@/pages/Inventario";
import Feedback from "@/pages/Feedback";
import CaseIa from "@/pages/CaseIa";
import Sessions from "@/pages/SessionsPage";
import Search from "@/pages/SearchResults";
import Compare from "@/pages/CompareRedirect";
import ChatVoz from "@/pages/ChatVoz";
import Conversa from "@/pages/Conversa";
import Page01 from "@/pages/Page01";
import Uni from "@/pages/Uni";
import Suggest from "@/pages/Suggest";
import Trending from "@/pages/Trending";
import Discover from "@/pages/Discover";
import One from "@/pages/One";
import MultiPipeline from "@/pages/MultiPipeline";
import DataFlow from "@/pages/DataFlow";
import GitCanvas from "@/pages/GitCanvas";
import DemoPage from "@/pages/DemoPage";
import Welcome from "@/pages/Welcome";
import All from "@/pages/All";
import Audit from "@/pages/Audit";
import Keys from "@/pages/Keys";
import SourceTests from "@/pages/SourceTests";
import { PAGES } from "@/lib/pages";

// jsdom não implementa scrollTo / ResizeObserver (React Flow) — polyfills.
beforeAll(() => {
  Object.assign(Element.prototype, { scrollTo: () => {} });
  Object.assign(globalThis, {
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    DOMMatrixReadOnly: class {
      static fromString() { return new (globalThis as { DOMMatrixReadOnly: new () => unknown }).DOMMatrixReadOnly(); }
      constructor() {}
      m22 = 1;
    },
    IntersectionObserver: class {
      constructor(_cb?: unknown, _opts?: unknown) {}
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() { return []; }
    },
  });
});

// Isolamento entre páginas: algumas (ex.: /demo) escrevem no localStorage
// no mount — sem limpar, páginas seguintes renderizam com dados e mudam de
// profundidade (ex.: /pipeline com artefatos usa Tooltip sem provider).
afterEach(() => {
  localStorage.clear();
});

// Chaveado por path do registry PAGES — o meta-teste abaixo garante que
// TODA página do registry tem smoke render (se adicionar página no registry
// sem tratá-la aqui, o teste de cobertura falha).
const pages: Array<[string, React.ComponentType]> = [
  ["/auditoria", Audit],
  ["/chaves", Keys],
  ["/testes-fontes", SourceTests],
  ["/", HomeLite],
  ["/home", Home],
  ["/inicio", Index],
  ["/boas-vindas", Welcome],
  ["/demo", DemoPage],
  ["/00", Uni],
  ["/suggest", Suggest],
  ["/trending", Trending],
  ["/descoberta", Discover],
  ["/one", One],
  ["/pipeline-multifonte", MultiPipeline],
  ["/fluxo-dados", DataFlow],
  ["/01", Page01],
  ["/chat-voz", ChatVoz],
  ["/conversa", Conversa],
  ["/fluxo", Flow],
  ["/nucleo", Nucleo],
  ["/jornada", Journey],
  ["/os", OS],
  ["/ia", AICentral],
  ["/dados", DataExplorer],
  ["/dashboard", Dashboard],
  ["/experiments", Experiments],
  ["/chat", Chat],
  ["/canvas", Canvas],
  ["/git", GitCanvas],
  ["/lab", Lab],
  ["/metodologias", Methodologies],
  ["/decision-center", DecisionCenter],
  ["/concept", Concept],
  ["/layouts", LayoutBuilder],
  ["/estrutura", Estrutura],
  ["/inventario", Inventario],
  ["/feedback", Feedback],
  ["/case-ia", CaseIa],
  ["/playground", Playground],
  ["/teste", TestCenter],
  ["/design", Design],
  ["/design-system", DesignSystemPage],
  ["/componentes", ComponentsCatalog],
  ["/chat-arquivos", FileChat],
  ["/atlas", Atlas],
  ["/pipeline", Pipeline],
  ["/pipeline-dados", DataPipeline],
  ["/outputs", Outputs],
  ["/uso", UsagePage],
  ["/terminal", Terminal],
  ["/apresentacoes", Presentations],
  ["/agentes", Agentes],
  ["/sessions", Sessions],
  ["/configuracoes", Configuracoes],
  ["/search", Search],
  ["/compare", Compare],
  ["/case", Case],
  ["/all", All],
  ["/ui", UiShell],
];

describe("páginas renderizam sem crash", () => {
  it("cobre TODAS as páginas do registry PAGES", () => {
    const internal = PAGES.filter((p) => !p.external);
    const covered = pages.map(([path]) => path);
    expect(covered.length).toBe(internal.length);
    expect(new Set(pages.map(([p]) => p)).size).toBe(internal.length);
    for (const p of internal) {
      expect(covered, `smoke render cobre ${p.path}`).toContain(p.path);
    }
  });
  for (const [path, Comp] of pages) {
    it(`${path}`, () => {
      render(<MemoryRouter initialEntries={[path]}><Comp /></MemoryRouter>);
      expect(document.body.innerHTML.length).toBeGreaterThan(200);
      cleanup();
    });
  }
});
