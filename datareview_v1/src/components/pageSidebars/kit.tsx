/**
 * Kit reutilizável de CONTEÚDO para as sidebars INTERNAS das páginas
 * (modelo de 5 colunas). As páginas compõem suas abas internas a partir
 * destes corpos padronizados:
 *
 *  - `ContextPanel`  — escopo de dados da página (seleção global + contagens).
 *  - `InsightsPanel` — insights de IA registrados pelo feedback loop.
 *  - `ActivityPanel` — log de atividade do sistema (eventos/tarefas).
 *  - `AnchorsPanel`  — índice de âncoras (scroll suave na coluna central).
 *  - `HelpPanel`     — "Como usar" da página (texto + dicas).
 *
 * Todos são responsivos (rolagem interna) e honram stores globais.
 */
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, CheckSquare, Database, Eraser, Info, Lightbulb, Square, Sparkles,
} from "lucide-react";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useActivityEvents, clearActivity } from "@/lib/activityStore";
import { useInsights } from "@/lib/insightStore";
import { PHASE_META } from "@/lib/statusSystem";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------ Contexto --- */

/**
 * Escopo de dados da página: quais apps do dataset estão no contexto atual,
 * com toggles que sincronizam com a seleção GLOBAL (SelectionContext). Leve e
 * livre de rede — a coleta/busca fica na assistente (sidebar externa direita).
 */
export function ContextPanel({ extras }: { extras?: ReactNode }) {
  const dataset = useDataset();
  const { selected, toggle, selectAll, selectNone } = useSelection();
  const keys = useMemo(() => dataset.entries.map((e) => entryKey(e.app.store, e.app.id)), [dataset.entries]);
  const totalReviews = useMemo(
    () => dataset.entries.reduce((acc, e) => acc + e.reviews.length, 0),
    [dataset.entries],
  );
  const effective = selected.size === 0 ? dataset.entries.length : selected.size;

  if (dataset.entries.length === 0) {
    return (
      <div className="p-3 space-y-2 text-xs text-muted-foreground">
        <p className="flex items-start gap-2">
          <Database className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
          Nenhum app coletado ainda. Use a aba <b>Apps</b> da assistente (sidebar
          direita) para buscar e coletar — o contexto aparece aqui.
        </p>
        {extras}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground" role="status">
          {effective === dataset.entries.length ? "Todos" : effective} de {dataset.entries.length} apps ·{" "}
          {totalReviews.toLocaleString("pt-BR")} reviews
        </p>
        <div className="flex gap-1.5 text-[10px]">
          <button
            onClick={() => selectAll(keys)}
            className="text-primary hover:underline"
            aria-label="Selecionar todos os apps"
          >
            Todos
          </button>
          <span className="text-border">·</span>
          <button
            onClick={selectNone}
            className="text-muted-foreground hover:underline"
            aria-label="Limpar seleção"
          >
            Nenhum
          </button>
        </div>
      </div>

      <ul className="space-y-1" role="group" aria-label="Apps no escopo">
        {dataset.entries.map((e) => {
          const k = entryKey(e.app.store, e.app.id);
          const on = selected.size === 0 || selected.has(k);
          return (
            <li key={k}>
              <button
                onClick={() => toggle(k)}
                role="checkbox"
                aria-checked={on}
                className={cn(
                  "w-full flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                  on
                    ? "border-primary/40 bg-primary/5"
                    : "border-border/50 bg-background/50 opacity-60 hover:opacity-100",
                )}
              >
                {on ? (
                  <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" />
                ) : (
                  <Square className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                {e.app.icon ? (
                  <img src={e.app.icon} alt="" className="h-5 w-5 rounded" loading="lazy" />
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-foreground">{e.app.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {e.app.store === "apple" ? "App Store" : "Google Play"} · {e.reviews.length} reviews
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {extras}
    </div>
  );
}

/* ------------------------------------------------------------ Insights --- */

/** Insights recentes do feedback loop de IA (insightStore), newest-first. */
export function InsightsPanel({ limit = 12 }: { limit?: number }) {
  const insights = useInsights();
  const [openId, setOpenId] = useState<string | null>(null);
  const recent = useMemo(() => [...insights].reverse().slice(0, limit), [insights, limit]);

  if (recent.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        Nenhum insight gerado ainda. Execute uma análise de IA — ela aparece aqui e fica reutilizável.
      </p>
    );
  }

  return (
    <div className="p-2 space-y-1.5" role="list" aria-label="Insights de IA">
      {recent.map((it) => {
        const open = openId === it.id;
        return (
          <article key={it.id} className="rounded-lg border border-border/50 bg-background/60" role="listitem">
            <button
              onClick={() => setOpenId(open ? null : it.id)}
              aria-expanded={open}
              className="w-full text-left p-2 space-y-0.5 hover:bg-secondary/40 rounded-lg"
            >
              <header className="flex items-center gap-1.5 text-[10px]">
                <Lightbulb className="h-3 w-3 shrink-0 text-amber-500" />
                <span className="font-semibold text-foreground truncate">{it.section}</span>
                <span className="ml-auto shrink-0 text-muted-foreground">
                  {new Date(it.generatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
              </header>
              {it.summary ? (
                <p className="text-[10px] text-muted-foreground line-clamp-2">{it.summary}</p>
              ) : null}
            </button>
            {open && (
              <div className="px-2 pb-2">
                <AIOutputCard bare content={it.markdown} filename={`insight-${it.section}`} storageKey={`insight-${it.id}`} />
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ Atividade --- */

const PHASE_DOT: Record<string, string> = {
  start: "bg-sky-500",
  progress: "bg-status-running",
  done: "bg-status-success",
  skip: "bg-muted-foreground/50",
  error: "bg-status-error",
  plan: "bg-violet-500",
};

/** Log de atividade do sistema (activityStore), mais recente primeiro. */
export function ActivityPanel({ limit = 40 }: { limit?: number }) {
  const events = useActivityEvents();
  const recent = useMemo(() => [...events].reverse().slice(0, limit), [events, limit]);

  if (recent.length === 0) {
    return (
      <p className="p-3 text-xs text-muted-foreground flex items-start gap-2">
        <Activity className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        Sem atividade registrada ainda. Coletas, análises e execuções aparecem aqui em tempo real.
      </p>
    );
  }

  return (
    <div className="p-2 space-y-0.5" role="log" aria-label="Atividade do sistema">
      <div className="flex justify-end px-1 pb-1">
        <button
          onClick={clearActivity}
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          aria-label="Limpar log de atividade"
        >
          <Eraser className="h-3 w-3" /> Limpar
        </button>
      </div>
      <ul className="space-y-0.5">
        {recent.map((ev) => (
          <li key={ev.id} className="flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-secondary/40">
            <span
              className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", PHASE_DOT[ev.phase] ?? "bg-muted-foreground/50")}
              title={PHASE_META[ev.phase]?.label ?? ev.phase}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] leading-snug text-foreground">{ev.message}</p>
              {ev.detail ? <p className="truncate text-[10px] text-muted-foreground">{ev.detail}</p> : null}
              <p className="text-[9px] text-muted-foreground/70">
                {ev.source} ·{" "}
                {new Date(ev.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------- Âncoras --- */

export interface PageAnchor {
  id: string;
  label: string;
  icon?: ReactNode;
}

/** Índice de seções da página — clique faz scroll suave na coluna central. */
export function AnchorsPanel({ anchors }: { anchors: PageAnchor[] }) {
  if (anchors.length === 0) return null;
  return (
    <nav className="p-2" aria-label="Seções desta página">
      <ul className="space-y-0.5">
        {anchors.map((a) => (
          <li key={a.id}>
            <button
              onClick={() => document.getElementById(a.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition-colors"
            >
              {a.icon}
              {a.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/* ---------------------------------------------------------------- Ajuda --- */

export function HelpPanel({ description, tips }: { description: string; tips?: string[] }) {
  const navigate = useNavigate();
  return (
    <div className="p-3 space-y-2.5 text-xs">
      <p className="flex items-start gap-2 text-muted-foreground leading-relaxed">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        {description}
      </p>
      {tips && tips.length > 0 ? (
        <ul className="space-y-1 pl-1">
          {tips.map((t, i) => (
            <li key={i} className="flex items-start gap-1.5 text-muted-foreground">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
              {t}
            </li>
          ))}
        </ul>
      ) : null}
      <button
        onClick={() => navigate("/configuracoes")}
        className="text-[10px] text-primary hover:underline"
        aria-label="Abrir as Configurações do sistema"
      >
        Abrir Configurações →
      </button>
    </div>
  );
}
