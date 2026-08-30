/**
 * LiveTerminal — terminal vivo com IA na sidebar direita.
 *
 * Sub-abas:
 *  - Log:     stream de atividade em tempo real (activityStore) com busca.
 *  - Monitor: status do sistema ao vivo (dataset, IA, hardware, storage, página).
 *  - Tarefas: processos em andamento (queued/running/streaming) + recentes.
 *  - IA:      chat terminal — perguntas sobre o sistema, dados, gerações e
 *             atividade, com contexto da página atual (section "os").
 *  - Custom:  abas criadas pelo usuário = visões filtradas do log.
 *
 * Persiste aba ativa, filtros e histórico do chat IA. Copy/download do log.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Terminal, Activity, ListTodo, Sparkles, Plus, X, Search,
  Send, Square, Eraser, MonitorSmartphone, Cpu, MemoryStick,
} from "lucide-react";
import { toast } from "sonner";
import {
  useTerminalTabs, createTerminalTab, deleteTerminalTab,
  filterLogEvents, logToText, type TerminalTabDef,
} from "@/lib/terminalTabs";
import {
  useActivityEvents, useTrackedTasks, clearActivity,
  type ActivityEvent,
} from "@/lib/activityStore";
import { PHASE_META, STATUS_META, statusClasses, isActiveStatus } from "@/lib/statusSystem";
import { useDataset } from "@/hooks/useDataset";
import { useGenerations } from "@/hooks/useSessions";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { useSystemProfile } from "@/lib/systemProfile";
import { useFeatureFlags } from "@/lib/featureFlags";
import { inventoryOutputs, formatBytes } from "@/lib/outputs";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { UnifiedChatPanel, type UnifiedChatItem } from "@/components/shared/UnifiedChatPanel";
import { buildKnowledgeDigest } from "@/lib/aiKnowledge";
import { cn } from "@/lib/utils";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";

const ACTIVE_TAB_KEY = "aso:terminal-active";
const AI_HISTORY_KEY = "aso:terminal-ai:v1";
const MAX_AI_MSGS = 40;

/* --------------------------------------------------------------- helpers */

function phaseColor(phase: ActivityEvent["phase"]): string {
  const c = PHASE_META[phase]?.color ?? "idle";
  return `text-status-${c}`;
}

function timeStr(ts: number): string {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function buildTerminalPrompt(events: ActivityEvent[], page: string): string {
  const recent = events.slice(-12).map((e) => `- [${timeStr(e.ts)}] [${e.source}/${e.phase}] ${e.message}`).join("\n");
  const digest = buildKnowledgeDigest(3000);
  return `Você é o TERMINAL VIVO do sistema "App Intelligence" — plataforma local-first de análise de reviews de apps (Apple + Google). Responda SEMPRE em PT-BR, direto, estilo terminal técnico mas amigável, em markdown curto.

VOCÊ MONITORA EM TEMPO REAL: coleta de reviews, análises determinísticas, gerações de IA (primeiro e segundo plano), pipelines, agentes, canvas, exports/imports e o estado do sistema.

ATIVIDADE RECENTE DO SISTEMA (log ao vivo):
${recent || "(sem eventos recentes)"}

CONTEXTO: o usuário está na página "${page}". Pergunte-se sempre: o que ele provavelmente está fazendo ali? O log acima mostra o que o sistema está fazendo agora.
${digest ? `\nCONHECIMENTO GERADO ATÉ AGORA:\n${digest}\n` : ""}
REGRAS: responda sobre o sistema, dados coletados/gerados, status, processos e próximos passos; se perguntarem sobre um app específico sem dados, oriente coletar (aba Apps); seja honesto quando não souber; sugira a página certa quando couber.`;
}

/* ------------------------------------------------------------------ Log */

function LogView({ filter }: { filter?: string }) {
  const events = useActivityEvents();
  const [query, setQuery] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const base = filterLogEvents(events, filter);
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((e) => `${e.message} ${e.source} ${e.detail ?? ""}`.toLowerCase().includes(q));
  }, [events, filter, query]);

  useEffect(() => {
    if (autoScroll) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [filtered.length, autoScroll]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {!filter && (
        <div className="relative px-2 pt-2 shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 mt-1 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filtrar log…"
            aria-label="Filtrar log"
            className="w-full text-[11px] pl-7 pr-2 py-1.5 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
          />
        </div>
      )}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Log de atividade do sistema"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
        }}
        className="flex-1 min-h-0 overflow-y-auto px-2 py-1.5 font-mono text-[10px] leading-relaxed"
      >
        {filtered.length === 0 && (
          <p className="text-muted-foreground px-1 py-3">
            {events.length === 0
              ? "// Sem atividade ainda. Colete apps, execute análises ou gere IA — tudo aparece aqui em tempo real."
              : "// Nenhum evento corresponde ao filtro."}
          </p>
        )}
        {filtered.map((e) => (
          <div key={e.id} className="flex gap-1.5 py-0.5 border-b border-border/10 last:border-0">
            <span className="text-muted-foreground/70 shrink-0">{timeStr(e.ts)}</span>
            <span className={cn("shrink-0 font-semibold w-14 truncate", phaseColor(e.phase))} title={PHASE_META[e.phase]?.label}>
              {e.phase}
            </span>
            <span className="text-primary/80 shrink-0 max-w-16 truncate" title={e.source}>{e.source}</span>
            <span className="text-foreground/90 min-w-0 break-words">{e.message}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1 px-2 py-1.5 border-t border-border/40 shrink-0">
        <span className="text-[9px] text-muted-foreground" role="status">{filtered.length} evento(s)</span>
        <span className="ml-auto" />
        <CopyDownloadButtons content={logToText(filtered)} filename="terminal-log" extension="txt" iconSize="h-3 w-3" />
        <button
          onClick={() => { clearActivity(); toast.success("Log limpo"); }}
          title="Limpar log"
          aria-label="Limpar log"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <Eraser className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Monitor */

function MonitorRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-background border border-border/30">
      {icon}
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="ml-auto text-[11px] font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function MonitorView() {
  const { entries } = useDataset();
  const generations = useGenerations();
  const ai = useAISettings();
  const { profile } = useSystemProfile();
  const flags = useFeatureFlags();
  const tasks = useTrackedTasks();
  const location = useLocation();

  const reviews = entries.reduce((s, e) => s + e.reviews.length, 0);
  const inv = useMemo(() => inventoryOutputs(), [flags]); // re-avalia a cada render de flags
  const totalBytes = inv.reduce((s, g) => s + g.totalBytes, 0);
  const activeTasks = tasks.filter((t) => isActiveStatus(t.status)).length;
  const enabledFlags = Object.values(flags).filter((v) => v !== false).length;

  return (
    <div className="h-full overflow-y-auto p-2 space-y-1.5">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-1 font-semibold">Sistema</p>
      <MonitorRow label="Página atual" value={location.pathname} icon={<MonitorSmartphone className="h-3 w-3 text-muted-foreground" />} />
      <MonitorRow label="Processos ativos" value={activeTasks > 0 ? `${activeTasks} em execução` : "idle"} />
      <MonitorRow label="Armazenamento local" value={`${inv.reduce((s, g) => s + g.entries.length, 0)} chaves · ${formatBytes(totalBytes)}`} />
      <MonitorRow label="Funcionalidades ativas" value={`${enabledFlags}`} />

      <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-1 font-semibold pt-2">Dados</p>
      <MonitorRow label="Apps coletados" value={`${entries.length}`} />
      <MonitorRow label="Reviews" value={reviews.toLocaleString("pt-BR")} />
      <MonitorRow label="Gerações de IA" value={`${generations.length}`} />

      <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-1 font-semibold pt-2">Inteligência artificial</p>
      <MonitorRow label="Modo" value={ai.mode === "auto" ? "auto (adapta ao hardware)" : ai.mode} />
      <MonitorRow label="Estado" value={isAIEnabled(ai) ? "ativa" : "desativada"} />
      {ai.mode === "local" || ai.mode === "auto" ? (
        <MonitorRow label="Modelo" value={ai.mode === "auto" ? (profile?.recommended?.model ?? ai.local.model) : ai.local.model} />
      ) : null}
      {profile && (
        <>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-1 font-semibold pt-2">Hardware (servidor)</p>
          <MonitorRow label="CPU" value={`${profile.hardware.cpuModel ?? "?"} · ${profile.hardware.cpuCores}t`} icon={<Cpu className="h-3 w-3 text-muted-foreground" />} />
          <MonitorRow label="RAM" value={`${Math.round(profile.hardware.totalRamBytes / 1e9)} GB`} icon={<MemoryStick className="h-3 w-3 text-muted-foreground" />} />
          {profile.hardware.gpus.length > 0 && (
            <MonitorRow label="GPU" value={`${profile.hardware.gpus[0].name} · ${Math.round(profile.hardware.gpus[0].vramBytes / 1e9)} GB VRAM`} />
          )}
          <MonitorRow label="Tier" value={profile.tier} />
          {profile.recommended?.numCtx && <MonitorRow label="Contexto IA" value={`${(profile.recommended.numCtx / 1024).toFixed(0)}k tokens`} />}
        </>
      )}
      {!profile && (
        <p className="text-[10px] text-muted-foreground px-1 py-1">Perfil de hardware indisponível (servidor local offline?).</p>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Tarefas */

function TasksView() {
  const tasks = useTrackedTasks();
  const active = tasks.filter((t) => isActiveStatus(t.status));
  const recent = tasks.filter((t) => !isActiveStatus(t.status)).slice(-12).reverse();

  return (
    <div className="h-full overflow-y-auto p-2 space-y-2">
      {active.length === 0 && recent.length === 0 && (
        <p className="text-[11px] text-muted-foreground px-1 py-3 text-center">
          Nenhum processo ainda. Coletas, análises e gerações de IA aparecem aqui com progresso em tempo real.
        </p>
      )}
      {active.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-1 font-semibold mb-1" role="status">
            {active.length} em execução
          </p>
          <div className="space-y-1">
            {active.map((t) => {
              const cls = statusClasses(t.status);
              const meta = STATUS_META[t.status];
              return (
                <div key={t.id} className={cn("rounded-md border px-2.5 py-1.5", cls.border, cls.bg)}>
                  <div className="flex items-center gap-1.5">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cls.dot, meta.pulse && "animate-pulse")} />
                    <span className="text-[11px] font-medium text-foreground truncate flex-1">{t.label}</span>
                    <span className={cn("text-[9px] shrink-0", cls.text)}>{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] text-muted-foreground">{t.source}</span>
                    {t.detail && <span className="text-[9px] text-muted-foreground truncate">{t.detail}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {recent.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground px-1 font-semibold mb-1">Recentes</p>
          <div className="space-y-0.5">
            {recent.map((t) => {
              const cls = statusClasses(t.status);
              return (
                <div key={t.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-background border border-border/20">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cls.dot)} />
                  <span className="text-[10px] text-foreground/80 truncate flex-1">{t.label}</span>
                  <span className={cn("text-[9px] shrink-0", cls.text)}>{STATUS_META[t.status].label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- IA */

function loadAIHistory(): UnifiedChatItem[] {
  try {
    const raw = localStorage.getItem(AI_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-MAX_AI_MSGS) : [];
  } catch { return []; }
}

/**
 * Chat do terminal — usa o UnifiedChatPanel (componente padronizado): section
 * "os" com o system prompt do terminal (log ao vivo + conhecimento gerado).
 * Comandos sem IA ("exiba…", "colete…", "pesquise…") também funcionam aqui.
 */
function AIView() {
  const events = useActivityEvents();
  const location = useLocation();
  const systemPrompt = useMemo(
    () => buildTerminalPrompt(events, location.pathname),
    [events, location.pathname],
  );

  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <UnifiedChatPanel
        section="os"
        systemPromptOverride={systemPrompt}
        initialMessages={loadAIHistory()}
        onMessagesChange={(msgs) => {
          try { localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(msgs.slice(-MAX_AI_MSGS))); } catch { /* quota */ }
        }}
        suggestions={[
          "O que o sistema está fazendo agora?",
          "O que já foi coletado e gerado?",
          "exiba a atividade",
          "ajuda",
        ]}
        messagesClassName="max-h-none flex-1"
        className="h-full"
      />
    </div>
  );
}

/* ---------------------------------------------------------------- Shell */

const TAB_ICON: Record<string, React.ReactNode> = {
  log: <Terminal className="h-3 w-3" />,
  monitor: <Activity className="h-3 w-3" />,
  tasks: <ListTodo className="h-3 w-3" />,
  ai: <Sparkles className="h-3 w-3" />,
};

export function LiveTerminal() {
  const tabs = useTerminalTabs();
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem(ACTIVE_TAB_KEY) ?? "log");
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newFilter, setNewFilter] = useState("");
  const events = useActivityEvents();

  const active: TerminalTabDef = tabs.find((t) => t.id === activeId) ?? tabs[0];

  useEffect(() => {
    try { localStorage.setItem(ACTIVE_TAB_KEY, active.id); } catch { /* ignore */ }
  }, [active.id]);

  const onCreate = () => {
    const tab = createTerminalTab(newLabel, newFilter);
    if (!tab) {
      toast.error("Não foi possível criar a aba", { description: "Nome vazio ou limite de 8 abas customizadas." });
      return;
    }
    setCreating(false);
    setNewLabel("");
    setNewFilter("");
    setActiveId(tab.id);
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-card/30">
      {/* Sub-abas */}
      <div className="flex items-center gap-0.5 px-1.5 pt-1.5 border-b border-border/40 shrink-0 overflow-x-auto scrollbar-thin" role="tablist" aria-label="Abas do terminal">
        {tabs.map((t) => (
          <div key={t.id} className="relative shrink-0 group">
            <button
              role="tab"
              aria-selected={active.id === t.id}
              onClick={() => setActiveId(t.id)}
              title={t.filter ? `Filtro: ${t.filter}` : t.label}
              className={cn(
                "flex items-center gap-1 text-[10px] px-2 py-1.5 rounded-t-md transition-colors whitespace-nowrap",
                active.id === t.id
                  ? "bg-background text-foreground font-medium border border-b-0 border-border/50"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
              )}
            >
              {t.kind === "custom" ? <Terminal className="h-3 w-3" /> : TAB_ICON[t.kind]}
              {t.label}
              {t.kind === "log" && events.length > 0 && (
                <span className="text-[8px] bg-primary/20 text-primary px-1 rounded">{events.length > 99 ? "99+" : events.length}</span>
              )}
            </button>
            {!t.builtin && (
              <button
                onClick={() => {
                  deleteTerminalTab(t.id);
                  if (active.id === t.id) setActiveId("log");
                }}
                title="Excluir aba"
                aria-label={`Excluir aba ${t.label}`}
                className="absolute -top-1 -right-1 hidden group-hover:flex p-0.5 rounded-full bg-destructive text-destructive-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setCreating((v) => !v)}
          title="Nova aba (visão filtrada do log)"
          aria-label="Criar nova aba"
          aria-expanded={creating}
          className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 ml-auto"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Criação de aba custom */}
      {creating && (
        <div className="px-2 py-2 border-b border-border/40 space-y-1.5 shrink-0 bg-background/60">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nome da aba (ex.: Coletas)"
            aria-label="Nome da nova aba"
            className="w-full text-[11px] px-2 py-1.5 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
          <input
            value={newFilter}
            onChange={(e) => setNewFilter(e.target.value)}
            placeholder="Filtrar por… (ex.: coleta, canvas, erro)"
            aria-label="Filtro da nova aba"
            className="w-full text-[11px] px-2 py-1.5 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 font-mono"
          />
          <div className="flex gap-1.5">
            <button
              onClick={onCreate}
              disabled={!newLabel.trim()}
              className="flex-1 text-[10px] px-2 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              Criar aba
            </button>
            <button
              onClick={() => setCreating(false)}
              className="px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground text-[10px] hover:bg-secondary/80"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Conteúdo da aba */}
      <div className="flex-1 min-h-0" role="tabpanel" aria-label={`Terminal: ${active.label}`}>
        {active.kind === "log" && <LogView />}
        {active.kind === "monitor" && <MonitorView />}
        {active.kind === "tasks" && <TasksView />}
        {active.kind === "ai" && <AIView />}
        {active.kind === "custom" && <LogView filter={active.filter} />}
      </div>
    </div>
  );
}
