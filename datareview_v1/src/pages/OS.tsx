/**
 * Nexus OS — `/os` — sistema operacional inteligente para fluxos de trabalho
 * com dados reais + IA.
 *
 * Layout de 4 regiões (o "desktop" do sistema):
 *  - TOPBAR (OSTopbar): seletor de views + ferramentas globais (console ⌃K,
 *    badge de IA, medidor de aprendizado);
 *  - SIDEBAR ESQUERDA (OSLeftSidebar): ações/funcionalidades/config PRIMÁRIAS
 *    (coletar, análise rápida, agente, exportações, escopo do dataset, config
 *    de coleta) em abas;
 *  - COLUNA CENTRAL: 4 views — Visão geral (KPIs+gráficos determinísticos),
 *    Análises (12 seções de IA), Fluxos (agentes), Insights (recomendações
 *    do motor de aprendizado);
 *  - SIDEBAR DIREITA (OSRightSidebar): Console (CLI /comandos), Memória (o
 *    que o sistema aprendeu), Sessões (histórico unificado);
 *  - BOTTOMBAR (OSBottombar): chat de IA + ferramentas (chips proativos,
 *    parar/limpar, colapsável).
 *
 * O motor de aprendizado (`lib/os/memory.ts`) observa TODAS as ações e torna
 * o sistema progressivamente mais assertivo: insights proativos, chips com
 * seus comandos frequentes e um score de aprendizado visível no topbar.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Zap, Terminal } from "lucide-react";
import { OSTopbar } from "@/components/os/OSTopbar";
import { OSLeftContent, OSLeftRailIcons, type OSLeftTab } from "@/components/os/OSLeftSidebar";
import { OSRightContent, OSRightRailIcons, type OSRightTab } from "@/components/os/OSRightSidebar";
import { PageSidebar } from "@/context/PageSidebarsContext";
import { OSBottombar } from "@/components/os/OSBottombar";
import {
  OSOverview, OSAnalises, OSFluxos, OSInsights,
  type SectionRun, type AgentRun,
} from "@/components/os/OSViews";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { useOSEvents, buildOSInsights, learningScore, trackOSEvent } from "@/lib/os/memory";
import { executeCLI, type OSCommandContext } from "@/lib/os/commands";
import { line, type ConsoleLine, type OSView } from "@/lib/os/types";
import { streamExperiment } from "@/lib/experimentApi";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { appendPlaceholder, patchIndex } from "@/lib/chatStream";
import { runAgent, type StepState } from "@/lib/agentRunner";
import { BUILTIN_AGENTS, type GeneratorAgent } from "@/lib/agents";
import { collectApp } from "@/lib/collect";
import { searchApps } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { getUserRegion } from "@/lib/region";
import { recordGeneration } from "@/lib/sessionStore";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import type { AppInfo } from "@/lib/appStoreApi";

const WELCOME = line("sys", "Nexus OS pronto. Digite /help ou pergunte à IA. ⌃K foca este console.");

export default function OS() {
  const navigate = useNavigate();
  const dataset = useDataset();
  const { selected } = useSelection();
  const ai = useAISettings();
  const aiOn = isAIEnabled(ai);
  const { settings } = useCollectionSettings();
  const events = useOSEvents();

  // Escopo: honra a seleção global (vazio = todo o dataset).
  const entries = useMemo(() => {
    if (selected.size === 0) return dataset.entries;
    return dataset.entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)));
  }, [dataset.entries, selected]);

  const totalReviews = useMemo(() => entries.reduce((s, e) => s + e.reviews.length, 0), [entries]);

  /* ---------------------------------------------------------- views ----- */
  const [view, setViewState] = useState<OSView>("overview");
  const setView = useCallback((v: OSView) => {
    setViewState(v);
    trackOSEvent("view", v);
  }, []);

  /* --------------------------- abas das sidebars internas ---------------- */
  const [osLeftTab, setOsLeftTab] = useState<OSLeftTab>("acoes");
  const [osRightTab, setOsRightTab] = useState<OSRightTab>("console");

  /* --------------------------------------------------------- console ---- */
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([WELCOME]);
  const [consoleBusy, setConsoleBusy] = useState(false);
  const consoleRef = useRef<HTMLInputElement>(null);
  const pushLines = useCallback((ls: ConsoleLine[]) => {
    setConsoleLines((prev) => [...prev.slice(-299), ...ls]);
  }, []);

  /* ------------------------------------------------------- seções IA ---- */
  const [sectionRuns, setSectionRuns] = useState<Record<string, SectionRun | undefined>>({});
  /** Registro de todos os streams em voo — modo parallel: seções/agentes/chat não se abortam. */
  const abortsRef = useRef<Set<AbortController>>(new Set());
  const abortAll = useCallback(() => {
    for (const c of abortsRef.current) c.abort();
    abortsRef.current.clear();
  }, []);

  const runSection = useCallback((id: string) => {
    if (entries.length === 0) return;
    const ac = new AbortController();
    abortsRef.current.add(ac);
    trackOSEvent("analysis", id);
    setSectionRuns((prev) => ({ ...prev, [id]: { status: "running", text: "" } }));
    setViewState("analises");
    const label = EXPERIMENT_SECTIONS.find((s) => s.id === id)?.label ?? id;
    streamExperiment(id, entries, {
      onToken: (full) => setSectionRuns((prev) => ({ ...prev, [id]: { status: "running", text: full } })),
      onDone: (full) => {
        setSectionRuns((prev) => ({ ...prev, [id]: { status: "done", text: full } }));
        try {
          recordGeneration({
            type: "ai-section",
            title: `OS: ${label}`,
            appKeys: entries.map((e) => entryKey(e.app.store, e.app.id)),
            markdown: full,
            summary: `Seção ${label}`,
            source: "os",
          });
        } catch { /* logging nunca quebra */ }
      },
      onError: () => setSectionRuns((prev) => ({ ...prev, [id]: { status: "error", text: prev[id]?.text ?? "" } })),
    }, ac.signal, ai);
  }, [entries, ai]);

  /* -------------------------------------------------------- agentes ----- */
  const [agentRuns, setAgentRuns] = useState<Record<string, AgentRun | undefined>>({});

  const runAgentNow = useCallback((agent: GeneratorAgent) => {
    if (entries.length === 0) return;
    const ac = new AbortController();
    abortsRef.current.add(ac);
    trackOSEvent("agent", agent.id);
    setViewState("fluxos");
    const init: AgentRun = {
      running: true,
      steps: agent.pipeline.map(() => ({ status: "pending", output: "" })),
    };
    setAgentRuns((prev) => ({ ...prev, [agent.id]: init }));
    runAgent(agent, entries, {
      onStep: (idx, state: StepState) => {
        setAgentRuns((prev) => {
          const cur = prev[agent.id];
          if (!cur) return prev;
          const steps = [...cur.steps];
          steps[idx] = state;
          return { ...prev, [agent.id]: { ...cur, steps } };
        });
      },
      onDone: () => setAgentRuns((prev) => prev[agent.id] ? { ...prev, [agent.id]: { ...prev[agent.id]!, running: false } } : prev),
      onError: () => setAgentRuns((prev) => prev[agent.id] ? { ...prev, [agent.id]: { ...prev[agent.id]!, running: false } } : prev),
    }, { signal: ac.signal, ai });
  }, [entries, ai]);

  const runAgentById = useCallback((id: string) => {
    const agent = BUILTIN_AGENTS.find((a) => a.id === id);
    if (agent) runAgentNow(agent);
  }, [runAgentNow]);

  /* ---------------------------------------------------------- coleta ---- */
  const [collectBusy, setCollectBusy] = useState(false);
  const [collectMsg, setCollectMsg] = useState<string | null>(null);

  const collectTerm = useCallback(async (term: string): Promise<string> => {
    setCollectBusy(true);
    setCollectMsg(null);
    trackOSEvent("collect", term);
    const region = getUserRegion();
    try {
      const [apple, google] = await Promise.all([
        searchApps(term, region, 5).catch(() => [] as AppInfo[]),
        searchGooglePlayApps(term, region, 5).catch(() => [] as AppInfo[]),
      ]);
      const results = [...google, ...apple];
      if (results.length === 0) {
        const msg = `Nenhum app encontrado para "${term}".`;
        setCollectMsg(msg);
        return msg;
      }
      const app = results[0];
      const { entry, reused } = await collectApp(app, region, settings.reviewLimit, settings.reviewSort);
      const msg = `✓ ${entry.app.name} (${entry.app.store === "apple" ? "Apple" : "Google"}) — ${entry.reviews.length} reviews ${reused ? "(cache)" : "coletados"}`;
      setCollectMsg(msg);
      return msg;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na coleta";
      setCollectMsg(msg);
      return msg;
    } finally {
      setCollectBusy(false);
    }
  }, [settings.reviewLimit, settings.reviewSort]);

  /* -------------------------------------------------------- export ------ */
  const exportDataset = useCallback((fmt: "json" | "md"): string => {
    trackOSEvent("export", fmt);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `nexus-os-dataset-${stamp}.${fmt}`;
    if (entries.length === 0) return filename;
    if (fmt === "json") {
      const payload = {
        exportedAt: new Date().toISOString(),
        totalApps: entries.length,
        totalReviews: entries.reduce((s, e) => s + e.reviews.length, 0),
        apps: entries,
      };
      download(JSON.stringify(payload, null, 2), filename, "application/json");
    } else {
      const md = entries.map((e) => {
        const head = `# ${e.app.name} (${e.app.store === "apple" ? "Apple" : "Google"})\n\n` +
          `- Reviews coletados: ${e.reviews.length}\n- Nota da loja: ${e.app.rating ?? "—"}\n- Coletado em: ${new Date(e.collectedAt).toLocaleDateString("pt-BR")}\n\n`;
        const reviews = e.reviews.map((r, i) =>
          `### ${i + 1}. ${"★".repeat(r.rating)} — ${r.title || r.author}\n> ${r.text}\n— ${r.author}${r.country ? ` (${r.country})` : ""}${r.date ? ` em ${new Date(r.date).toLocaleDateString("pt-BR")}` : ""}`
        ).join("\n\n");
        return head + reviews;
      }).join("\n\n---\n\n");
      download(`# Dataset Nexus OS\n\n${md}`, filename, "text/markdown");
    }
    return `arquivo ${filename} baixado (${entries.length} apps)`;
  }, [entries]);

  /* ----------------------------------------------------------- chat ----- */
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInFlight, setChatInFlight] = useState(0);
  const chatStreaming = chatInFlight > 0;
  const chatMessagesRef = useRef<ChatMessage[]>([]);
  useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);

  const sendChat = useCallback((text: string) => {
    if (!aiOn || entries.length === 0) {
      pushLines([line("err", !aiOn ? "IA desativada." : "Dataset vazio — colete apps antes de conversar com a IA.")]);
      return;
    }
    trackOSEvent("chat", text.slice(0, 48));
    const ac = new AbortController();
    abortsRef.current.add(ac);
    setChatInFlight((n) => n + 1);
    const userMsg: ChatMessage = { role: "user", content: text };
    const history = [...chatMessagesRef.current, userMsg];
    const idxRef = { current: -1 };
    setChatMessages((prev) => appendPlaceholder([...prev, userMsg], idxRef));
    streamExperimentChat(entries, history, {
      onToken: (full) => setChatMessages((prev) => patchIndex(prev, idxRef.current, full)),
      onDone: () => {
        abortsRef.current.delete(ac);
        setChatInFlight((n) => Math.max(0, n - 1));
      },
      onError: (errMsg) => {
        abortsRef.current.delete(ac);
        setChatInFlight((n) => Math.max(0, n - 1));
        setChatMessages((prev) => patchIndex(prev, idxRef.current, `⚠️ ${errMsg}`));
      },
    }, ac.signal, ai, "custom");
  }, [aiOn, entries, ai, pushLines]);

  const stopChat = useCallback(() => {
    abortAll();
    setChatInFlight(0);
  }, [abortAll]);

  /* ----------------------------------------------------- execução CLI --- */
  const ctx: OSCommandContext = useMemo(() => ({
    entries,
    aiEnabled: aiOn,
    navigate,
    setView,
    runSection,
    runAgent: runAgentById,
    collectTerm,
    exportDataset,
  }), [entries, aiOn, navigate, setView, runSection, runAgentById, collectTerm, exportDataset]);

  const runCommand = useCallback(async (input: string) => {
    pushLines([line("in", input)]);
    setConsoleBusy(true);
    try {
      const result = await executeCLI(input, ctx);
      pushLines(result.lines);
      if (result.aiPrompt) sendChat(result.aiPrompt);
    } finally {
      setConsoleBusy(false);
    }
  }, [ctx, pushLines, sendChat]);

  /* ------------------------------------------------- chips proativos ---- */
  const insights = useMemo(() => buildOSInsights(entries, events), [entries, events]);
  const score = useMemo(() => learningScore(entries, events), [entries, events]);
  const chips = useMemo(() => {
    const fromInsights = insights.filter((i) => i.command).map((i) => i.command!);
    const extra = [
      "Resuma os apps selecionados",
      "Quais os 3 maiores problemas?",
      "Oportunidades priorizadas",
    ];
    return [...fromInsights, ...extra].slice(0, 5);
  }, [insights]);

  const runningCount = useMemo(() => {
    const sections = Object.values(sectionRuns).filter((s) => s?.status === "running").length;
    const agents = Object.values(agentRuns).filter((s) => s?.running).length;
    return sections + agents + (chatStreaming ? 1 : 0);
  }, [sectionRuns, agentRuns, chatStreaming]);

  /* --------------------------------------------------------- hotkey ----- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        consoleRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Sidebars INTERNAS da página — renderizadas pelo AppShell entre o centro
          e as sidebars externas (mesmo contrato: recolher/rail/resize/persist).
          Sem shell (teste isolado), caem no fallback inline. */}
      <PageSidebar
        id="os-left"
        side="left"
        title="Nexus OS"
        subtitle="ações primárias"
        icon={<Zap className="h-4 w-4" />}
        storageKey="aso:os-left-w"
        defaultWidth={280}
        minWidth={220}
        railIcons={<OSLeftRailIcons tab={osLeftTab} onTab={setOsLeftTab} />}
        content={
          <OSLeftContent
            aiOn={aiOn}
            busy={runningCount > 0}
            collectBusy={collectBusy}
            collectMsg={collectMsg}
            onCollect={(t) => { collectTerm(t); }}
            onRunSection={runSection}
            onRunAgent={runAgentById}
            onExport={(fmt) => pushLines([line("ok", `✓ ${exportDataset(fmt)}`)])}
            tab={osLeftTab}
            onTab={setOsLeftTab}
          />
        }
      />
      <PageSidebar
        id="os-right"
        side="right"
        title="Controle"
        subtitle="console · memória · sessões"
        icon={<Terminal className="h-4 w-4" />}
        storageKey="aso:os-right-w"
        defaultWidth={340}
        minWidth={280}
        railIcons={<OSRightRailIcons tab={osRightTab} onTab={setOsRightTab} />}
        content={
          <OSRightContent
            ref={consoleRef}
            consoleLines={consoleLines}
            consoleBusy={consoleBusy}
            onConsoleSubmit={runCommand}
            tab={osRightTab}
            onTab={setOsRightTab}
          />
        }
      />

      <OSTopbar
        view={view}
        onViewChange={setView}
        aiOn={aiOn}
        aiMode={ai.mode === "cloud" ? "cloud" : ai.mode === "local" || ai.mode === "auto" ? "local" : "off"}
        score={score}
        runningCount={runningCount}
        onFocusConsole={() => consoleRef.current?.focus()}
      />

      <div className="flex-1 min-h-0 flex">
        <main className="flex-1 min-w-0" role="main">
          {view === "overview" && <OSOverview entries={entries} />}
          {view === "analises" && (
            <OSAnalises entries={entries} runs={sectionRuns} aiOn={aiOn} onRun={runSection} />
          )}
          {view === "fluxos" && (
            <OSFluxos entries={entries} runs={agentRuns} aiOn={aiOn} onRun={runAgentNow} />
          )}
          {view === "insights" && (
            <OSInsights insights={insights} onCommand={runCommand} />
          )}
        </main>
      </div>

      <OSBottombar
        messages={chatMessages}
        streaming={chatStreaming}
        aiOn={aiOn}
        suggestions={chips}
        scopeLabel={`${entries.length} apps · ${totalReviews.toLocaleString("pt-BR")} reviews ${selected.size > 0 ? "(seleção)" : ""}`}
        onSend={sendChat}
        onStop={stopChat}
        onClear={() => setChatMessages([])}
        onCommand={runCommand}
      />
    </div>
  );
}

/* -------------------------------------------------------- helpers ------- */

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
