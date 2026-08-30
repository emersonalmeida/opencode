import { Suspense, lazy, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { I18nProvider } from "@/lib/i18n";
import { RELEASES } from "@/lib/releases";
import { CollectionSettingsProvider } from "@/components/CollectionSettingsProvider";
import { AIContextProvider } from "@/context/AIContext";
import { CompareProvider } from "@/context/CompareContext";
import { SelectionProvider } from "@/context/SelectionContext";
import { AppShell } from "@/components/AppShell";
import { PageLoader } from "@/components/shared/PageLoader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { isFeatureEnabled, pagePathToFlag, useFeatureFlags } from "@/lib/featureFlags";
import { PAGES } from "@/lib/pages";
import { setDocumentTitle } from "@/lib/ux";
import { useActiveTaskCount } from "@/lib/activityStore";

// A Home é eager (first paint mais rápido); todas as outras páginas são
// code-split para o bundle inicial ficar pequeno e cada rota carregar sob demanda.
import Home from "./pages/Home.tsx";
import HomeLite from "./pages/HomeLite.tsx";

const Index = lazy(() => import("./pages/Index.tsx"));
const Welcome = lazy(() => import("./pages/Welcome.tsx"));
const UiShell = lazy(() => import("./pages/UiShell.tsx"));
const DemoPage = lazy(() => import("./pages/DemoPage.tsx"));
const AppDetail = lazy(() => import("./pages/AppDetail.tsx"));
const CompareRedirect = lazy(() => import("./pages/CompareRedirect.tsx"));
const SearchResults = lazy(() => import("./pages/SearchResults.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Experiments = lazy(() => import("./pages/Experiments.tsx"));
const Chat = lazy(() => import("./pages/Chat.tsx"));
const Canvas = lazy(() => import("./pages/Canvas.tsx"));
const GitCanvas = lazy(() => import("./pages/GitCanvas.tsx"));
const Playground = lazy(() => import("./pages/Playground.tsx"));
const Concept = lazy(() => import("./pages/Concept.tsx"));
const LayoutBuilder = lazy(() => import("./pages/LayoutBuilder.tsx"));
const Estrutura = lazy(() => import("./pages/Estrutura.tsx"));
const Inventario = lazy(() => import("./pages/Inventario.tsx"));
const Feedback = lazy(() => import("./pages/Feedback.tsx"));
const CaseIa = lazy(() => import("./pages/CaseIa.tsx"));
const CustomPageView = lazy(() => import("./pages/CustomPageView.tsx"));
const DecisionCenter = lazy(() => import("./pages/DecisionCenter.tsx"));
const Case = lazy(() => import("./pages/Case.tsx"));
const All = lazy(() => import("./pages/All.tsx"));
const DataExplorer = lazy(() => import("./pages/DataExplorer.tsx"));
const DesignSystemPage = lazy(() => import("./pages/DesignSystemPage.tsx"));
const ComponentsCatalog = lazy(() => import("./pages/ComponentsCatalog.tsx"));
const FileChat = lazy(() => import("./pages/FileChat.tsx"));
const Lab = lazy(() => import("./pages/Lab.tsx"));
const ExperimentDetailPage = lazy(() => import("./pages/ExperimentDetailPage.tsx"));
const DesignCanvas = lazy(() => import("./pages/DesignCanvas.tsx"));
const AnalysisAtlas = lazy(() => import("./pages/AnalysisAtlas.tsx"));
const Pipeline = lazy(() => import("./pages/Pipeline.tsx"));
const OS = lazy(() => import("./pages/OS.tsx"));
const Methodologies = lazy(() => import("./pages/Methodologies.tsx"));
const Agentes = lazy(() => import("./pages/Agentes.tsx"));
const SessionsPage = lazy(() => import("./pages/SessionsPage.tsx"));
const SettingsPage = lazy(() => import("./pages/SettingsPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const VersionGateway = lazy(() => import("./components/VersionGateway.tsx"));
const DataPipeline = lazy(() => import("./pages/DataPipeline.tsx"));
const Outputs = lazy(() => import("./pages/Outputs.tsx"));
const UsagePage = lazy(() => import("./pages/UsagePage.tsx"));
const Terminal = lazy(() => import("./pages/Terminal.tsx"));
const Presentations = lazy(() => import("./pages/Presentations.tsx"));
const Journey = lazy(() => import("./pages/Journey.tsx"));
const Flow = lazy(() => import("./pages/Flow.tsx"));
const Nucleo = lazy(() => import("./pages/Nucleo.tsx"));
const AICentral = lazy(() => import("./pages/AICentral.tsx"));
const ChatVoz = lazy(() => import("./pages/ChatVoz.tsx"));
const Conversa = lazy(() => import("./pages/Conversa.tsx"));
const TestCenter = lazy(() => import("./pages/TestCenter.tsx"));
const Page01 = lazy(() => import("./pages/Page01.tsx"));
const Uni = lazy(() => import("./pages/Uni.tsx"));
const Suggest = lazy(() => import("./pages/Suggest.tsx"));
const Trending = lazy(() => import("./pages/Trending.tsx"));
const Discover = lazy(() => import("./pages/Discover.tsx"));
const One = lazy(() => import("./pages/One.tsx"));
const MultiPipeline = lazy(() => import("./pages/MultiPipeline.tsx"));
const DataFlow = lazy(() => import("./pages/DataFlow.tsx"));
const Audit = lazy(() => import("./pages/Audit.tsx"));
const Keys = lazy(() => import("./pages/Keys.tsx"));
const SourceTests = lazy(() => import("./pages/SourceTests.tsx"));

const queryClient = new QueryClient();

/** Wraps a route element: if the page's feature flag is disabled, redirect
 *  home instead of rendering. Keeps disabled pages unreachable by URL.
 *  Subscribes to flag changes so disabling a page while elsewhere instantly
 *  bounces away from it. */
function FlaggedRoute({ path, children }: { path: string; children: React.ReactElement }) {
  useFeatureFlags(); // re-render on flag changes
  const flag = pagePathToFlag(path);
  if (flag && !isFeatureEnabled(flag)) return <Navigate to="/" replace />;
  return children;
}

/** Consistent page transition: every route change fades the new page in.
 *  Keyed by pathname only (query changes don't remount the page). */
function AnimatedRoutes() {
  const location = useLocation();
  const activeTasks = useActiveTaskCount();
  useEffect(() => {
    // Document title follows the current page (a11y + browser history/tabs)
    // + ● quando há tarefa em andamento (visibilidade de status).
    const page = PAGES.find((p) => p.path === location.pathname)
      ?? PAGES.find((p) => location.pathname.startsWith(p.path) && p.path !== "/");
    const label = page?.label
      ?? (location.pathname.startsWith("/app/") ? "Detalhe do app"
        : location.pathname.startsWith("/lab/experiments/") ? "Experimento" : "");
    setDocumentTitle(label || undefined, { running: activeTasks > 0 });
  }, [location.pathname, activeTasks]);
  return (
    <div key={location.pathname} className="anim-fade-in h-full">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location}>
          <Route path="/" element={<ErrorBoundary title="Erro ao renderizar a página inicial"><HomeLite /></ErrorBoundary>} />
          <Route path="/home" element={<FlaggedRoute path="/home"><ErrorBoundary title="Erro ao renderizar a Home"><Home /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/auditoria" element={<FlaggedRoute path="/auditoria"><ErrorBoundary title="Erro ao renderizar a Auditoria"><Audit /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/chaves" element={<FlaggedRoute path="/chaves"><ErrorBoundary title="Erro ao renderizar as Chaves API"><Keys /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/testes-fontes" element={<FlaggedRoute path="/testes-fontes"><ErrorBoundary title="Erro ao renderizar os Testes de fontes"><SourceTests /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/ui" element={<FlaggedRoute path="/ui"><ErrorBoundary title="Erro ao renderizar a UI"><UiShell /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/inicio" element={<FlaggedRoute path="/inicio"><ErrorBoundary title="Erro ao renderizar a Coleta"><Index /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/boas-vindas" element={<FlaggedRoute path="/boas-vindas"><ErrorBoundary title="Erro ao renderizar as Boas-vindas"><Welcome /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/demo" element={<FlaggedRoute path="/demo"><ErrorBoundary title="Erro ao renderizar a demo"><DemoPage /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/01" element={<FlaggedRoute path="/01"><ErrorBoundary title="Erro ao renderizar a página 01"><Page01 /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/00" element={<FlaggedRoute path="/00"><ErrorBoundary title="Erro ao renderizar a Uni"><Uni /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/suggest" element={<FlaggedRoute path="/suggest"><ErrorBoundary title="Erro ao renderizar o Suggest"><Suggest /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/trending" element={<FlaggedRoute path="/trending"><ErrorBoundary title="Erro ao renderizar o Trending"><Trending /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/descoberta" element={<FlaggedRoute path="/descoberta"><ErrorBoundary title="Erro ao renderizar a Descoberta"><Discover /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/one" element={<FlaggedRoute path="/one"><ErrorBoundary title="Erro ao renderizar a One Page"><One /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/pipeline-multifonte" element={<FlaggedRoute path="/pipeline-multifonte"><ErrorBoundary title="Erro ao renderizar o Pipeline Multifonte"><MultiPipeline /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/fluxo-dados" element={<FlaggedRoute path="/fluxo-dados"><ErrorBoundary title="Erro ao renderizar o Fluxo de dados"><DataFlow /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/chat-voz" element={<FlaggedRoute path="/chat-voz"><ErrorBoundary title="Erro ao renderizar o Chat com voz"><ChatVoz /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/chat-arquivos" element={<FlaggedRoute path="/chat-arquivos"><ErrorBoundary title="Erro ao renderizar o Chat com arquivos"><FileChat /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/conversa" element={<FlaggedRoute path="/conversa"><ErrorBoundary title="Erro ao renderizar a Conversa"><Conversa /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/teste" element={<FlaggedRoute path="/teste"><ErrorBoundary title="Erro ao renderizar o Test Center"><TestCenter /></ErrorBoundary></FlaggedRoute>} />
          {/* Compatibilidade: a rota antiga redireciona para o novo Chat com voz. */}
          <Route path="/assistente" element={<Navigate to="/chat-voz" replace />} />
          <Route path="/os" element={<FlaggedRoute path="/os"><ErrorBoundary title="Erro ao renderizar o Nexus OS"><OS /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/metodologias" element={<FlaggedRoute path="/metodologias"><ErrorBoundary title="Erro ao renderizar Metodologias"><Methodologies /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/app/:store/:id" element={<AppDetail />} />
          <Route path="/compare" element={<CompareRedirect />} />
          <Route path="/search" element={<SearchResults />} />
          <Route path="/experiments" element={<FlaggedRoute path="/experiments"><Experiments /></FlaggedRoute>} />
          <Route path="/dashboard" element={<FlaggedRoute path="/dashboard"><ErrorBoundary><Dashboard /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/chat" element={<FlaggedRoute path="/chat"><ErrorBoundary title="Erro ao renderizar o Chat"><Chat /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/canvas" element={<FlaggedRoute path="/canvas"><ErrorBoundary title="Erro ao renderizar o Canvas"><Canvas /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/git" element={<FlaggedRoute path="/git"><ErrorBoundary title="Erro ao renderizar o Git Canvas"><GitCanvas /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/playground" element={<FlaggedRoute path="/playground"><ErrorBoundary title="Erro ao renderizar o Playground"><Playground /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/concept" element={<FlaggedRoute path="/concept"><ErrorBoundary title="Erro ao renderizar o Conceito"><Concept /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/layouts" element={<FlaggedRoute path="/layouts"><ErrorBoundary title="Erro ao renderizar Layouts"><LayoutBuilder /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/estrutura" element={<FlaggedRoute path="/estrutura"><ErrorBoundary title="Erro ao renderizar a Estrutura"><Estrutura /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/inventario" element={<FlaggedRoute path="/inventario"><ErrorBoundary title="Erro ao renderizar o Inventário"><Inventario /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/feedback" element={<FlaggedRoute path="/feedback"><ErrorBoundary title="Erro ao renderizar o Feedback"><Feedback /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/case-ia" element={<FlaggedRoute path="/case-ia"><ErrorBoundary title="Erro ao renderizar o Case IA"><CaseIa /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/p/:id" element={<ErrorBoundary title="Erro ao renderizar a página customizada"><CustomPageView /></ErrorBoundary>} />
          <Route path="/decision-center" element={<FlaggedRoute path="/decision-center"><ErrorBoundary title="Erro ao renderizar o Decision Center"><DecisionCenter /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/case" element={<FlaggedRoute path="/case"><ErrorBoundary title="Erro ao renderizar a exploração"><Case /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/all" element={<FlaggedRoute path="/all"><ErrorBoundary title="Erro ao renderizar a página All"><All /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/dados" element={<ErrorBoundary title="Erro ao renderizar os dados"><DataExplorer /></ErrorBoundary>} />
          <Route path="/lab" element={<FlaggedRoute path="/lab"><ErrorBoundary title="Erro ao renderizar o Lab"><Lab /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/lab/experiments/:id" element={<FlaggedRoute path="/lab"><ErrorBoundary title="Erro ao renderizar o experimento"><ExperimentDetailPage /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/design" element={<FlaggedRoute path="/design"><ErrorBoundary title="Erro ao renderizar o Design Canvas"><DesignCanvas /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/design-system" element={<FlaggedRoute path="/design-system"><ErrorBoundary title="Erro ao renderizar o Design System"><DesignSystemPage /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/componentes" element={<FlaggedRoute path="/componentes"><ErrorBoundary title="Erro ao renderizar o catálogo de componentes"><ComponentsCatalog /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/atlas" element={<FlaggedRoute path="/atlas"><ErrorBoundary title="Erro ao renderizar o Analysis Atlas"><AnalysisAtlas /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/pipeline" element={<FlaggedRoute path="/pipeline"><ErrorBoundary title="Erro ao renderizar o Pipeline"><Pipeline /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/pipeline-dados" element={<FlaggedRoute path="/pipeline-dados"><ErrorBoundary title="Erro ao renderizar o Pipeline de dados"><DataPipeline /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/outputs" element={<FlaggedRoute path="/outputs"><ErrorBoundary title="Erro ao renderizar os Outputs"><Outputs /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/uso" element={<FlaggedRoute path="/uso"><ErrorBoundary title="Erro ao renderizar o Uso do sistema"><UsagePage /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/terminal" element={<FlaggedRoute path="/terminal"><ErrorBoundary title="Erro ao renderizar o Terminal"><Terminal /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/apresentacoes" element={<FlaggedRoute path="/apresentacoes"><ErrorBoundary title="Erro ao renderizar Apresentações"><Presentations /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/jornada" element={<FlaggedRoute path="/jornada"><ErrorBoundary title="Erro ao renderizar a Jornada"><Journey /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/fluxo" element={<FlaggedRoute path="/fluxo"><ErrorBoundary title="Erro ao renderizar o Fluxo"><Flow /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/nucleo" element={<FlaggedRoute path="/nucleo"><ErrorBoundary title="Erro ao renderizar o Núcleo"><Nucleo /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/ia" element={<FlaggedRoute path="/ia"><ErrorBoundary title="Erro ao renderizar a Central de IA"><AICentral /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/agentes" element={<FlaggedRoute path="/agentes"><ErrorBoundary title="Erro ao renderizar Agentes"><Agentes /></ErrorBoundary></FlaggedRoute>} />
          <Route path="/sessions" element={<FlaggedRoute path="/sessions"><SessionsPage /></FlaggedRoute>} />
          <Route path="/configuracoes" element={<ErrorBoundary title="Erro ao renderizar Configurações"><SettingsPage /></ErrorBoundary>} />
          {/* URLs versionadas: /v0 /v1 /v2 … (uma rota por release do registry), /latest, /oldest. */}
          {RELEASES.map((r) => (
            <Route key={r.tag} path={`/${r.short}`} element={<VersionGateway />} />
          ))}
          <Route path="/latest" element={<VersionGateway />} />
          <Route path="/oldest" element={<VersionGateway />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}

const App = () => (
  <ThemeProvider>
    <I18nProvider>
    <CollectionSettingsProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AIContextProvider>
              <CompareProvider>
                <SelectionProvider>
                <AppShell>
                  <AnimatedRoutes />
                </AppShell>
                </SelectionProvider>
              </CompareProvider>
            </AIContextProvider>

          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </CollectionSettingsProvider>
    </I18nProvider>
  </ThemeProvider>
);

export default App;
