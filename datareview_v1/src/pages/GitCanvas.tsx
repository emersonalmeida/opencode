/**
 * Página Git — Visual Git Canvas (Prompt Mestre §1–§56).
 *
 * UMA página com um canvas infinito: o mapa vivo do projeto. O estado vive no
 * store `gitCanvas` (ProjectMap normalizado + projeção); providers alimentam
 * o mapa; a UI nunca finge dados (demo é sempre marcado).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { Activity, Bot, Play } from "lucide-react";
import { GitCanvasBoard } from "@/components/gitCanvas/GitCanvasBoard";
import { GitBlocksView } from "@/components/gitCanvas/GitBlocksView";
import { GitTopBar } from "@/components/gitCanvas/GitTopBar";
import { GitOnboarding } from "@/components/gitCanvas/GitOnboarding";
import { GitCommandPalette } from "@/components/gitCanvas/GitCommandPalette";
import { GitInspector } from "@/components/gitCanvas/GitInspector";
import { GitTimelinePanel } from "@/components/gitCanvas/GitTimelinePanel";
import { ContextMenuOverlay, useContextMenu } from "@/components/shared/ContextMenu";
import { useGitCanvas } from "@/lib/gitCanvas/store";
import { computeProjectHealth } from "@/lib/gitCanvas/types";
import { GIT_COMMANDS, VIEW_SHORTCUTS, type GitCommand } from "@/lib/gitCanvas/commands";
import type { GitCanvasView } from "@/lib/gitCanvas/types";
import { actionsForNode, runBuiltinAction, type ResolvedObjectAction } from "@/lib/gitCanvas/objectActions";
import { fetchGitHubProjectMap } from "@/lib/gitCanvas/githubClient";
import { DEFAULT_REPO } from "@/lib/gitCanvas/providers";
import { uploadResultToMap } from "@/lib/gitCanvas/gitUpload";
import { toastError, toastInfo, toastSuccess } from "@/lib/ux";

function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function GitCanvasInner() {
  const { map, view, nodes, edges, selectedId, onboarded, mode, setView, setNodes, select, loadDemo, loadMap, loadUpload } = useGitCanvas();

  const connectGitHub = useCallback(async (): Promise<boolean> => {
    const r = await fetchGitHubProjectMap(DEFAULT_REPO);
    if (r.ok && r.map) {
      loadMap(r.map, "github");
      toastSuccess("GitHub conectado", { description: `${r.map.repository.id} carregado de verdade.` });
      return true;
    }
    return false;
  }, [loadMap]);

  const connectUpload = useCallback((result: import("@/lib/gitCanvas/gitUpload").GitUploadResult) => {
    // uploadResultToMap é a ÚNICA implementação da conversão (lib pura)
    const map = uploadResultToMap(result, "upload");
    loadUpload(map, map.uploadMeta ?? null);
    toastSuccess("Arquivos processados", {
      description: `${result.filesRead} arquivos → ${result.commits.length} commits, ${result.branches.length} branches.`,
    });
  }, [loadUpload]);

  // Modo GitHub NÃO é cacheado: ao recarregar, reconecta sozinho; se a
  // conexão não voltar, cai honestamente no onboarding de novo.
  useEffect(() => {
    if (onboarded && !map && mode === "github") {
      void connectGitHub().then((ok) => {
        if (!ok) {
          toastError("Não foi possível recarregar o GitHub", { description: "Confira GITHUB_TOKEN no servidor e tente de novo." });
          useGitCanvas.getState().unload();
        }
      });
    }
  }, [onboarded, map, mode, connectGitHub]);
  const online = useOnlineStatus();
  const [syncing, setSyncing] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { menu, openAt, close } = useContextMenu();

  const health = useMemo(
    () => (map ? computeProjectHealth(map) : { status: "healthy" as const, signals: [] }),
    [map],
  );

  const syncLabel = useMemo(() => {
    if (!map) return "";
    const loc = map.local;
    if (!loc.connected) return "local não conectado";
    if (loc.ahead === 0 && loc.behind === 0 && loc.modifiedFiles === 0 && loc.untrackedFiles === 0) return "sincronizado";
    const parts: string[] = [];
    if (loc.behind > 0) parts.push(`↓${loc.behind}`);
    if (loc.ahead > 0) parts.push(`↑${loc.ahead}`);
    if (loc.modifiedFiles > 0) parts.push(`${loc.modifiedFiles} mod.`);
    if (loc.untrackedFiles > 0) parts.push(`${loc.untrackedFiles} novos`);
    return parts.join(" ");
  }, [map]);

  const focusNode = useCallback(
    (nodeId: string) => {
      select(nodeId);
      fitView({ nodes: [{ id: nodeId }], duration: 400, padding: 0.6, maxZoom: 1.3 });
    },
    [fitView, select],
  );

  // Troca de visão: na Timeline (mais larga), refaz o fit depois de renderizar
  // (duplo rAF — mede os nós já posicionados).
  const changeView = useCallback(
    (v: GitCanvasView) => {
      setView(v);
      if (v === "timeline") {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => fitView({ duration: 400, padding: 0.2 })),
        );
      }
    },
    [setView, fitView],
  );

  const runCommand = useCallback(
    (cmd: GitCommand) => {
      if (!cmd.uiAction) return; // ações reais só executam com providers conectados
      if (cmd.uiAction.type === "view") {
        changeView(cmd.uiAction.view);
        return;
      }
      if (cmd.uiAction.type === "panel") {
        if (cmd.uiAction.panel === "timeline") setTimelineOpen(true);
        return;
      }
      const kind = cmd.uiAction.kind;
      const target = useGitCanvas.getState().nodes.find((n) => n.data.kind === kind);
      if (target) focusNode(target.id);
      else toastInfo("Nada para focar", { description: "Nenhum objeto desse tipo na visão atual." });
    },
    [focusNode, changeView],
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  );

  const runObjectAction = useCallback(
    (action: ResolvedObjectAction) => {
      if (!selectedNode) return;
      if (action.builtin && runBuiltinAction(action, selectedNode, focusNode)) {
        if (action.builtin === "copy-sha") toastSuccess("SHA copiado");
        if (action.builtin === "copy-link") toastSuccess("Link copiado");
        return;
      }
      // Ação ligada ao registry: só executa se for ação de UI (as demais
      // estão desabilitadas no inspector/menu com a razão honesta).
      if (action.commandId) {
        const cmd = GIT_COMMANDS.find((c) => c.id === action.commandId);
        if (cmd?.uiAction) runCommand(cmd);
      }
    },
    [selectedNode, focusNode, runCommand],
  );

  // Atalhos do canvas (spec §33). Capture-phase: a página tem precedência
  // sobre os atalhos globais do AppShell (ex.: "g" de navegação, ⌘K).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (!paletteOpen && useGitCanvas.getState().selectedId) {
          e.stopPropagation();
          select(null);
        }
        return;
      }
      if (inField || mod || !map) return;

      const k = e.key.toLowerCase();
      const handled =
        k === "f" ||
        k === "+" || k === "=" || k === "-" ||
        k === "i" || k === "t" ||
        Object.keys(VIEW_SHORTCUTS).includes(k);
      if (!handled) return;
      e.stopPropagation();
      e.preventDefault();
      if (k === "f") fitView({ duration: 400, padding: 0.25 });
      else if (k === "+" || k === "=") zoomIn({ duration: 200 });
      else if (k === "-") zoomOut({ duration: 200 });
      else if (k === "t") setTimelineOpen((v) => !v);
      else if (k === "i") {
        const issue = nodes.find((n) => n.data.kind === "issue");
        if (issue) focusNode(issue.id);
        else toastInfo("Nenhuma issue nesta visão", { description: "Troque para a visão Projeto para ver issues." });
      } else {
        const v = VIEW_SHORTCUTS[k];
        if (v) changeView(v);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [map, nodes, fitView, zoomIn, zoomOut, setView, focusNode, changeView, paletteOpen, select]);

  const onNodeContextMenu = useCallback(
    (nodeId: string, x: number, y: number) => {
      const st = useGitCanvas.getState();
      const node = st.nodes.find((n) => n.id === nodeId);
      if (!node || !st.map) return;
      st.select(nodeId);
      const actions = actionsForNode(node, st.map);
      openAt(x, y, actions.map((a) => ({
        label: a.available ? a.label : `${a.label} — ${a.reason ?? "indisponível"}`,
        disabled: !a.available,
        danger: a.danger,
        onClick: () => {
          if (a.builtin && runBuiltinAction(a, node, focusNode)) {
            if (a.builtin === "copy-sha") toastSuccess("SHA copiado");
            if (a.builtin === "copy-link") toastSuccess("Link copiado");
            return;
          }
          if (a.commandId) {
            const cmd = GIT_COMMANDS.find((c) => c.id === a.commandId);
            if (cmd?.uiAction) runCommand(cmd);
          }
        },
      })));
    },
    [openAt, focusNode, runCommand],
  );

  const onPaneContextMenu = useCallback(
    (x: number, y: number) => {
      openAt(x, y, [
        { label: "Ajustar à tela (F)", onClick: () => fitView({ duration: 400, padding: 0.25 }) },
        { label: "Command Palette (⌘K)", onClick: () => setPaletteOpen(true) },
        { label: timelineOpen ? "Ocultar atividade (T)" : "Mostrar atividade (T)", onClick: () => setTimelineOpen((v) => !v) },
      ]);
    },
    [openAt, fitView, timelineOpen],
  );

  /** Refetch do snapshot local; `silent=true` não tosta (p polling). */
  const refreshLocalSnapshot = useCallback(async (silent = false) => {
    const { fetchLocalSnapshotMap } = await import("@/lib/gitCanvas/gitLocalClient");
    const r = await fetchLocalSnapshotMap();
    if (r.ok && r.map) {
      const current = useGitCanvas.getState().map;
      const changed = !current || r.map.local.headSha !== current.local.headSha || r.map.local.modifiedFiles !== current.local.modifiedFiles;
      if (changed) {
        loadUpload(r.map, r.map.uploadMeta ?? null);
        if (!silent) toastSuccess("Snapshot atualizado", { description: r.message });
      }
      return true;
    }
    if (!silent) toastError("Snapshot não atualizado", { description: r.message });
    return false;
  }, [loadUpload]);

  const onSync = useCallback(async () => {
    if (!map || syncing) return;
    setSyncing(true);
    try {
      if (mode === "github") {
        const r = await fetchGitHubProjectMap(DEFAULT_REPO);
        if (r.ok && r.map) {
          loadMap(r.map, "github");
        } else {
          toastError("GitHub não respondeu com dados reais", {
            description: `${r.error ?? "Sem mapa na resposta."} Nada foi simulado.`,
          });
        }
      } else if (mode === "upload" && map.uploadMeta?.source === "local-snapshot") {
        await refreshLocalSnapshot(false);
      } else {
        // demo: re-gera o dataset determinístico (mesmo conteúdo, honesto)
        loadDemo();
        toastInfo("Modo demo", { description: "Dataset demo recarregado (determinístico)." });
      }
    } finally {
      setSyncing(false);
    }
  }, [map, mode, syncing, loadDemo, loadMap, refreshLocalSnapshot]);

  // Auto-refresh do snapshot local: a cada 30s e ao focar a janela, o
  // servidor relê o repositório; se o HEAD/status mudou, o canvas recarrega.
  useEffect(() => {
    if (mode !== "upload" || map?.uploadMeta?.source !== "local-snapshot") return;
    const tick = () => { void refreshLocalSnapshot(true); };
    const timer = window.setInterval(tick, 30_000);
    window.addEventListener("focus", tick);
    return () => {
      if (timer) window.clearInterval(timer);
      window.removeEventListener("focus", tick);
    };
  }, [mode, map?.uploadMeta?.source, refreshLocalSnapshot]);

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="flex-1 relative min-h-0">
        {map && (
          <GitTopBar
            projectName={map.project.name}
            health={health}
            syncLabel={syncLabel}
            providerLabel={map.repository ? `${map.repository.provider}${map.demo ? " (demo)" : ""}` : "nenhum"}
            demo={map.demo}
            online={online}
            view={view}
            onViewChange={changeView}
            onSync={onSync}
            syncing={syncing}
            onOpenPalette={() => setPaletteOpen(true)}
            uploadRepos={Object.keys(useGitCanvas.getState().uploadMaps)}
            activeUpload={useGitCanvas.getState().activeUploadName ?? undefined}
            onSwitchUpload={(name) => useGitCanvas.getState().switchUpload(name)}
            extraActions={
              <>
                <button
                  type="button"
                  onClick={() => setTimelineOpen((v) => !v)}
                  aria-pressed={timelineOpen}
                  aria-label="Atividade recente (T)"
                  title="Atividade recente (T)"
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Atividade</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const agent = nodes.find((n) => n.data.kind === "agent");
                    if (agent) focusNode(agent.id);
                    else toastInfo("Nenhum agente ativo", { description: "OpenHands ainda não está conectado (spec §13)." });
                  }}
                  aria-label="Agente de IA"
                  title="Agente de IA — foca o agente ativo"
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Agente</span>
                </button>
                <button
                  type="button"
                  onClick={() => toastInfo("Execução de testes requer ponte local", { description: "Um app web não executa comandos na sua máquina sem uma integração local segura (spec §44). Disponível em breve." })}
                  aria-label="Executar testes"
                  title="Executar testes — requer ponte local"
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Testar</span>
                </button>
              </>
            }
          />
        )}
        {view === "blocks" && map ? (
          <GitBlocksView map={map} />
        ) : (
          <GitCanvasBoard
            nodes={nodes}
            edges={edges}
            onNodesChange={setNodes}
            selectedId={selectedId}
            onSelect={select}
            onNodeDoubleClick={focusNode}
            onNodeContextMenu={onNodeContextMenu}
            onPaneContextMenu={onPaneContextMenu}
          />
        )}
        {selectedNode && map && (
          <GitInspector
            node={selectedNode}
            map={map}
            onAction={runObjectAction}
            onClose={() => select(null)}
          />
        )}
        {timelineOpen && map && (
          <GitTimelinePanel map={map} onFocus={focusNode} onClose={() => setTimelineOpen(false)} />
        )}
        {menu && <ContextMenuOverlay state={menu} onClose={close} />}
        <GitCommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          map={map}
          nodes={nodes}
          onRunCommand={runCommand}
          onFocusNode={focusNode}
        />
        {!onboarded && <GitOnboarding onDemo={loadDemo} onGitHubConnected={connectGitHub} onUpload={connectUpload} />}
        {onboarded && map?.demo && (
          <button
            type="button"
            onClick={() => useGitCanvas.getState().unload()}
            className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-md border border-amber-500/40 bg-card/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 shadow-sm backdrop-blur transition-colors hover:bg-amber-500/10 dark:text-amber-400"
            title="Sair do modo demo e voltar ao onboarding"
          >
            Demo mode — sair
          </button>
        )}
        {onboarded && map?.upload && (
          <button
            type="button"
            onClick={() => useGitCanvas.getState().unload()}
            className="absolute bottom-3 left-1/2 z-20 -translate-x-1/2 rounded-md border border-violet-500/40 bg-card/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600 shadow-sm backdrop-blur transition-colors hover:bg-violet-500/10 dark:text-violet-400"
            title="Descartar dados de upload e voltar ao onboarding"
          >
            {map.uploadMeta?.source === "local-snapshot" ? "Snapshot local (auto 30s) — sair"
              : map.uploadMeta?.source === "local-folder" ? "Pasta local — sair"
              : "Upload mode — sair"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function GitCanvas() {
  return (
    <ReactFlowProvider>
      <GitCanvasInner />
    </ReactFlowProvider>
  );
}
