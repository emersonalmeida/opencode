/**
 * /terminal — Terminal vivo do App Intelligence.
 *
 * Interface estilo terminal (tty/tmux/Alacritty): tabs, splits horizontais e
 * verticais, prompt com autocomplete, histórico, IA embutida (texto sem "/"
 * é prompt em linguagem natural). Tudo que o app faz via UI é executável via
 * CLI — o mesmo motor de comandos do Nexus OS (`src/lib/os/commands.ts`),
 * mas com os outputs escritos diretamente no pane (não em chat lateral).
 *
 * Atalhos: Ctrl+T (aba) · Ctrl+S (split h) · Ctrl+D (split v) · Ctrl+W (fecha
 * pane) · Ctrl+1..9 (troca aba) · Ctrl+K (foco no input) · Ctrl+L (limpa).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Terminal as TermIcon } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { TerminalPane } from "@/components/terminal/TerminalPane";
import { useDataset } from "@/hooks/useDataset";
import { useSelection } from "@/context/SelectionContext";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { executeCLI } from "@/lib/os/commands";
import type { OSCommandContext } from "@/lib/os/commands";
import { streamExperiment } from "@/lib/experimentApi";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { BUILTIN_AGENTS } from "@/lib/agents";
import { runAgent, type StepState } from "@/lib/agentRunner";
import { searchApps } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { collectApp } from "@/lib/collect";
import { getUserRegion } from "@/lib/region";
import { line } from "@/lib/os/types";
import type { ConsoleLine } from "@/lib/os/types";
import { createTab, bootLines, type TermTab } from "@/lib/terminal/model";
import { trackOSEvent } from "@/lib/os/memory";

interface PaneBuffers {
  [paneId: string]: { lines: ConsoleLine[]; busy: boolean };
}

const PROMPT = "nexterm$";
const CAP_LINES = 400;

export default function Terminal({ embedded = false }: { embedded?: boolean }) {
  return (
    <ErrorBoundary title="Erro ao renderizar o Terminal">
      <TerminalInner embedded={embedded} />
    </ErrorBoundary>
  );
}

function TerminalInner({ embedded = false }: { embedded?: boolean }) {
  const { entries } = useDataset();
  const { selected } = useSelection();
  const { settings } = useCollectionSettings();
  const ai = useAISettings();
  const aiOn = isAIEnabled(ai);
  const navigate = useNavigate();

  /* ------------------------------------------------ escopo da IA ------- */
  const scoped = useMemo(() => {
    const all = entries ?? [];
    if (selected.size === 0) return all;
    return all.filter((e) => selected.has(`${e.app.store}:${e.app.id}`));
  }, [entries, selected]);

  const aiInfo = useMemo(() => {
    if (!aiOn) return "IA: desativada (Config → IA)";
    if (ai.mode === "auto") return `IA: auto (${ai.local.model})`;
    if (ai.mode === "local") return `IA: local ${ai.local.model}`;
    if (ai.mode === "cloud") return `IA: cloud ${ai.cloud.provider}`;
    return "IA: —";
  }, [ai, aiOn]);

  /* ------------------------------------------------ tabs + panes ------- */
  const [tabs, setTabs] = useState<TermTab[]>(() => [createTab(1)]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  const [buffers, setBuffers] = useState<PaneBuffers>({});
  const buffersRef = useRef(buffers);
  buffersRef.current = buffers;
  const abortRef = useRef<AbortController | null>(null);

  // Boot da primeira aba
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    setBuffers((b) => {
      const firstPane = tabs[0].panes[0].id;
      return { ...b, [firstPane]: { lines: bootLines("shell principal", aiInfo), busy: false } };
    });
  }, [tabs, aiInfo]);

  const pushLines = useCallback((paneId: string, newLines: ConsoleLine[]) => {
    setBuffers((b) => {
      const prev = b[paneId] ?? { lines: [], busy: false };
      return {
        ...b,
        [paneId]: { ...prev, lines: [...prev.lines, ...newLines].slice(-CAP_LINES) },
      };
    });
  }, []);

  const setBusy = useCallback((paneId: string, busy: boolean) => {
    setBuffers((b) => ({
      ...b,
      [paneId]: { ...(b[paneId] ?? { lines: [], busy: false }), busy },
    }));
  }, []);

  const clearPane = useCallback((paneId: string) => {
    setBuffers((b) => ({ ...b, [paneId]: { ...(b[paneId] ?? { lines: [], busy: false }), lines: [] } }));
  }, []);

  /* ------------------------------------------------ IA -> pane --------- */
  /**
   * Atualiza/substitui a última linha "stream" do pane (a linha que cresce
   * conforme os tokens chegam). Se `markDone`, marca o fim do stream.
   */
  const updateStream = useCallback((paneId: string, chunkText: string) => {
    setBuffers((b) => {
      const prev = b[paneId] ?? { lines: [], busy: false };
      const last = prev.lines[prev.lines.length - 1];
      if (last && last.kind === "out" && last.text.startsWith("🤖 ")) {
        const replaced = [...prev.lines.slice(0, -1), line("out", `🤖 ${chunkText}`)];
        return { ...b, [paneId]: { ...prev, lines: replaced } };
      }
      return { ...b, [paneId]: { ...prev, lines: [...prev.lines, line("out", `🤖 ${chunkText}`)] } };
    });
  }, []);

  const runAIChat = useCallback(
    (paneId: string, prompt: string) => {
      if (!aiOn) {
        pushLines(paneId, [line("err", "IA desativada — ative em Config → Inteligência Artificial.")]);
        return;
      }
      if (scoped.length === 0) {
        pushLines(paneId, [line("err", "Dataset vazio — colete um app primeiro: /collect <termo>")]);
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setBusy(paneId, true);
      pushLines(paneId, [line("in", prompt), line("sys", `IA → ${scoped.length} app(s) · ${scoped.reduce((s, e) => s + e.reviews.length, 0)} reviews`)]);
      streamExperimentChat(
        scoped,
        [{ role: "user", content: prompt }],
        {
          onToken: (full) => updateStream(paneId, full),
          onDone: () => setBusy(paneId, false),
          onError: (err) => {
            pushLines(paneId, [line("err", `⚠ ${err}`)]);
            setBusy(paneId, false);
          },
        },
        ctrl.signal,
      );
    },
    [aiOn, scoped, pushLines, setBusy, updateStream],
  );

  const runSectionInPane = useCallback(
    (paneId: string, sectionId: string) => {
      if (!aiOn) {
        pushLines(paneId, [line("err", "IA desativada — ative em Config → Inteligência Artificial.")]);
        return;
      }
      if (scoped.length === 0) {
        pushLines(paneId, [line("err", "Dataset vazio — colete um app primeiro: /collect <termo>")]);
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setBusy(paneId, true);
      const label = EXPERIMENT_SECTIONS.find((s) => s.id === sectionId)?.label ?? sectionId;
      pushLines(paneId, [line("in", `/analyze ${sectionId}`), line("sys", `⏱ ${label} · ${scoped.length} app(s)`)]);
      streamExperiment(
        sectionId,
        scoped,
        {
          onToken: (full) => updateStream(paneId, full),
          onDone: () => {
            pushLines(paneId, [line("ok", "✓ pronto")]);
            setBusy(paneId, false);
          },
          onError: (err) => {
            pushLines(paneId, [line("err", `⚠ ${err}`)]);
            setBusy(paneId, false);
          },
        },
        ctrl.signal,
      );
    },
    [aiOn, scoped, pushLines, setBusy, updateStream],
  );

  const runAgentInPane = useCallback(
    (paneId: string, agentId: string) => {
      const agent = BUILTIN_AGENTS.find((a) => a.id === agentId);
      if (!agent) {
        pushLines(paneId, [line("err", `Agente desconhecido: ${agentId}. Use /agent para listar. `)]);
        return;
      }
      if (scoped.length === 0) {
        pushLines(paneId, [line("err", "Dataset vazio — colete um app primeiro: /collect <termo>")]);
        return;
      }
      setBusy(paneId, true);
      pushLines(paneId, [
        line("in", `/agent ${agentId}`),
        line("sys", `🤖 Agente ${agent.label} — ${agent.pipeline.length} etapas`),
      ]);
      runAgent(
        agent,
        scoped,
        {
          onStep: (idx, state: StepState) => {
            const step = agent.pipeline[idx];
            if (!step) return;
            if (state.status === "running" && !state.output) {
              pushLines(paneId, [line("sys", `▸ ${step.label}…`)]);
            } else if (state.status === "done" && state.output) {
              // Mostra só um resumo curto no pane (o output completo fica salvo)
              pushLines(paneId, [
                line("ok", `✓ ${step.label}`),
                line("out", state.output.length > 400 ? `${state.output.slice(0, 400)}…` : state.output),
              ]);
            } else if (state.status === "error") {
              pushLines(paneId, [line("err", `✗ ${step.label}`)]);
            }
          },
          onDone: () => setBusy(paneId, false),
          onError: (msg) => {
            pushLines(paneId, [line("err", msg)]);
            setBusy(paneId, false);
          },
        },
      ).catch((e: unknown) => {
        pushLines(paneId, [line("err", e instanceof Error ? e.message : "Falha")]);
        setBusy(paneId, false);
      });
    },
    [scoped, pushLines, setBusy],
  );

  const collectTerm = useCallback(
    async (term: string): Promise<string> => {
      trackOSEvent("collect", term);
      const region = getUserRegion();
      try {
        const [apple, google] = await Promise.all([
          searchApps(term, region, 5).catch(() => []),
          searchGooglePlayApps(term, region, 5).catch(() => []),
        ]);
        const results = [...google, ...apple];
        if (results.length === 0) return `Nenhum app encontrado para "${term}".`;
        const app = results[0];
        const { entry, reused } = await collectApp(app, region, settings.reviewLimit, settings.reviewSort);
        return `✓ ${entry.app.name} (${entry.app.store === "apple" ? "Apple" : "Google"}) — ${entry.reviews.length} reviews ${reused ? "(cache)" : "coletados"}`;
      } catch (e) {
        return e instanceof Error ? e.message : "Falha na coleta";
      }
    },
    [settings.reviewLimit, settings.reviewSort],
  );

  const exportDataset = useCallback(
    (fmt: "json" | "md"): string => {
      trackOSEvent("export", fmt);
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `app-intel-dataset-${stamp}.${fmt}`;
      if (entries.length === 0) return filename;
      const payload = JSON.stringify({ exportedAt: new Date().toISOString(), apps: entries }, null, 2);
      const blob = new Blob([fmt === "md" ? toMarkdown(entries) : payload], { type: fmt === "md" ? "text/markdown" : "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      return filename;
    },
    [entries],
  );

  /* ------------------------------------------------ executor ---------- */
  const execute = useCallback(
    (paneId: string, input: string) => {
      const ctx: OSCommandContext = {
        entries: scoped,
        aiEnabled: aiOn,
        navigate,
        setView: () => undefined, // terminal não tem views de página
        runSection: (id) => runSectionInPane(paneId, id),
        runAgent: (id) => runAgentInPane(paneId, id),
        collectTerm,
        exportDataset,
      };
      pushLines(paneId, [line("in", input)]);
      executeCLI(input, ctx)
        .then((res) => {
          if (res.aiPrompt) {
            runAIChat(paneId, res.aiPrompt);
          } else {
            pushLines(paneId, res.lines);
          }
        })
        .catch((e: unknown) => {
          pushLines(paneId, [line("err", e instanceof Error ? e.message : "Erro inesperado")]);
        });
    },
    [scoped, aiOn, navigate, runSectionInPane, runAgentInPane, collectTerm, exportDataset, pushLines, runAIChat],
  );

  /* ------------------------------------------------ tabs/panes ops ---- */
  const addTab = useCallback(() => {
    setTabs((t) => {
      const nt = createTab(t.length + 1);
      setActiveTabId(nt.id);
      setBuffers((b) => ({
        ...b,
        [nt.panes[0].id]: { lines: bootLines(`aba ${t.length + 1}`, aiInfo), busy: false },
      }));
      return [...t, nt];
    });
  }, [aiInfo]);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((t) => {
        if (t.length === 1) return t; // sempre manter pelo menos 1 aba
        const next = t.filter((x) => x.id !== tabId);
        if (activeTabId === tabId) setActiveTabId(next[0].id);
        return next;
      });
    },
    [activeTabId],
  );

  const splitPane = useCallback(
    (tabId: string, dir: "h" | "v") => {
      setTabs((t) =>
        t.map((tab) => {
          if (tab.id !== tabId) return tab;
          if (tab.panes.length >= 4) return tab;
          const np: typeof tab.panes[0] = {
            id: `${tab.id}_sp${tab.panes.length}_${Date.now().toString(36)}`,
            title: `sessão ${tab.panes.length + 1}`,
          };
          setBuffers((b) => ({
            ...b,
            [np.id]: { lines: bootLines(np.title, aiInfo), busy: false },
          }));
          return { ...tab, direction: dir, panes: [...tab.panes, np], activePaneId: np.id };
        }),
      );
    },
    [aiInfo],
  );

  const closePane = useCallback(
    (tabId: string, paneId: string) => {
      setTabs((t) =>
        t.map((tab) => {
          if (tab.id !== tabId) return tab;
          if (tab.panes.length === 1) return tab; // manter 1 pane por aba
          const panes = tab.panes.filter((p) => p.id !== paneId);
          const activePaneId = tab.activePaneId === paneId ? panes[panes.length - 1].id : tab.activePaneId;
          return { ...tab, panes, activePaneId };
        }),
      );
      setBuffers((b) => {
        const next = { ...b };
        delete next[paneId];
        return next;
      });
    },
    [],
  );

  /* ------------------------------------------------ atalhos globais ---- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const inInput = (e.target as HTMLElement)?.tagName === "INPUT";
      if (e.ctrlKey && !e.metaKey && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "t") { e.preventDefault(); addTab(); return; }
        if (k === "s") { e.preventDefault(); splitPane(activeTabId, "h"); return; }
        if (k === "d") { e.preventDefault(); splitPane(activeTabId, "v"); return; }
        if (k === "w") {
          e.preventDefault();
          const tab = tabs.find((x) => x.id === activeTabId);
          if (tab && tab.panes.length > 1) closePane(activeTabId, tab.activePaneId);
          else closeTab(activeTabId);
          return;
        }
        if (k >= "1" && k <= "9") {
          e.preventDefault();
          const idx = Number(k) - 1;
          if (tabs[idx]) setActiveTabId(tabs[idx].id);
          return;
        }
        if (inInput) return; // Ctrl+L etc ficam no pane
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tabs, activeTabId, addTab, splitPane, closePane, closeTab]);

  /* ------------------------------------------------ render ------------- */
  const reviewsTotal = scoped.reduce((s, e) => s + e.reviews.length, 0);
  const layoutGrid =
    activeTab.direction === "h"
      ? { gridTemplateColumns: `repeat(${activeTab.panes.length}, 1fr)` }
      : { gridTemplateRows: `repeat(${activeTab.panes.length}, 1fr)` };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card text-card-foreground">
      {!embedded && (
        <AppHeader
          title="Terminal"
          crumb="nexterm — shell inteligente"
          extraMenu={
            <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
              <TermIcon className="h-3.5 w-3.5 text-cyan-400" aria-hidden="true" />
              <span>{scoped.length} app · {reviewsTotal} reviews · {aiInfo}</span>
            </div>
          }
        />
      )}

      {/* tabs (tmux window tabs) */}
      <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 border-b border-slate-700/60 bg-slate-900/60 overflow-x-auto select-none" role="tablist" aria-label="Abas do terminal">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === activeTabId}
            onClick={() => setActiveTabId(t.id)}
            className={`px-3 py-1 text-[11px] font-mono rounded-t border-b-2 transition-colors ${
              t.id === activeTabId
                ? "bg-slate-800 text-cyan-300 border-cyan-400"
                : "bg-transparent text-slate-500 border-transparent hover:text-slate-300"
            }`}
          >
            {i + 1}:{t.label}
          </button>
        ))}
        <button
          onClick={addTab}
          title="Nova aba (Ctrl+T)"
          aria-label="Nova aba"
          className="ml-1 p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-cyan-300"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <span className="ml-auto text-[10px] font-mono text-slate-600">
          Ctrl+T aba · Ctrl+S split h · Ctrl+D split v · Ctrl+W fecha · Ctrl+1-9 troca
        </span>
      </div>

      {/* panes */}
      <div className="flex-1 min-h-0 p-2 grid gap-2" style={layoutGrid}>
        {activeTab.panes.map((p) => (
          <TerminalPane
            key={p.id}
            paneId={p.id}
            title={p.title}
            lines={buffers[p.id]?.lines ?? []}
            busy={buffers[p.id]?.busy ?? false}
            prompt={PROMPT}
            autoFocus={p.id === activeTab.activePaneId}
            onExecute={(input) => execute(p.id, input)}
            onClear={() => clearPane(p.id)}
            onClosePane={() => closePane(activeTabId, p.id)}
            onSplitH={() => splitPane(activeTabId, "h")}
            onSplitV={() => splitPane(activeTabId, "v")}
          />
        ))}
      </div>
    </div>
  );
}

function toMarkdown(entries: { app: { name: string; store: string; rating?: number }; reviews: { text: string; rating: number }[] }[]): string {
  return entries
    .map(
      (e) =>
        `# ${e.app.name} (${e.app.store === "apple" ? "Apple" : "Google"})\n\n- Nota: ${e.app.rating ?? "—"}\n- Reviews: ${e.reviews.length}\n\n` +
        e.reviews.map((r, i) => `## ${i + 1}. ★${r.rating}\n${r.text}`).join("\n\n"),
    )
    .join("\n\n---\n\n");
}
