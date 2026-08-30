/**
 * Nexus OS — sidebar esquerda (ações, funcionalidades e configurações
 * PRIMÁRIAS). Três abas:
 *
 *  - "Ações": coletar app (busca nas 2 lojas + coleta inline), análises
 *    rápidas, agente em 1 clique, exportações, navegação.
 *  - "Dados": apps do dataset com seleção global (useSelection) — o escopo
 *    que TODAS as análises/agentes/chat do OS usam.
 *  - "Config": limite de reviews, ordenação, região da loja, estado da IA.
 *
 * Usa CollapsibleColumn (mesmo contrato de recolher/expandir/redimensionar
 * do resto do sistema). No rail recolhido, ícones trocam de aba + expandem.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Database, Download, Loader2, Play, Search, Settings2, Sparkles, Zap,
} from "lucide-react";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useCollectionSettings, REVIEW_SORT_OPTIONS } from "@/components/CollectionSettingsProvider";
import { REGION_OPTIONS, getUserRegion, setUserRegion } from "@/lib/region";
import { BUILTIN_AGENTS } from "@/lib/agents";
import { cn } from "@/lib/utils";

export type OSLeftTab = "acoes" | "dados" | "config";

export const OS_LEFT_TABS: Array<{ id: OSLeftTab; label: string; icon: typeof Zap }> = [
  { id: "acoes", label: "Ações", icon: Zap },
  { id: "dados", label: "Dados", icon: Database },
  { id: "config", label: "Config", icon: Settings2 },
];

export interface OSLeftSidebarProps {
  aiOn: boolean;
  busy: boolean;
  collectBusy: boolean;
  collectMsg: string | null;
  onCollect: (term: string) => void;
  onRunSection: (id: string) => void;
  onRunAgent: (id: string) => void;
  onExport: (fmt: "json" | "md") => void;
}

const QUICK_SECTIONS = [
  { id: "summary", label: "Resumo executivo" },
  { id: "problems", label: "Problemas" },
  { id: "opportunities", label: "Oportunidades" },
];

/** Ícones do rail (coluna recolhida) — trocam a aba ativa da sidebar. */
export function OSLeftRailIcons({ tab, onTab }: { tab: OSLeftTab; onTab: (t: OSLeftTab) => void }) {
  return (
    <>
      {OS_LEFT_TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onTab(t.id)}
          aria-label={`Aba ${t.label}`}
          title={t.label}
          aria-pressed={tab === t.id}
          className={cn(
            "p-2 rounded-lg transition-colors",
            tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary",
          )}
        >
          <t.icon className="h-4 w-4" />
        </button>
      ))}
    </>
  );
}

/**
 * Conteúdo da sidebar esquerda do Nexus OS (SEM a moldura da coluna — o shell
 * aplica CollapsibleColumn via <PageSidebar>). `tab`/`onTab` vêm da página,
 * para que os ícones do rail (coluna recolhida) troquem a aba.
 */
export function OSLeftContent({
  aiOn, busy, collectBusy, collectMsg, onCollect, onRunSection, onRunAgent, onExport, tab, onTab,
}: OSLeftSidebarProps & { tab: OSLeftTab; onTab: (t: OSLeftTab) => void }) {
  const navigate = useNavigate();

  return (
      <div className="flex flex-col h-full min-h-0">
        {/* Tab strip */}
        <div role="tablist" aria-label="Ações primárias" className="flex border-b border-border/50 flex-shrink-0">
          {OS_LEFT_TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => onTab(t.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors border-b-2",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-3 w-3" />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
          {tab === "acoes" && (
            <ActionsTab
              aiOn={aiOn}
              busy={busy}
              collectBusy={collectBusy}
              collectMsg={collectMsg}
              onCollect={onCollect}
              onRunSection={onRunSection}
              onRunAgent={onRunAgent}
              onExport={onExport}
              onNavigate={navigate}
            />
          )}
          {tab === "dados" && <DataTab />}
          {tab === "config" && <ConfigTab aiOn={aiOn} />}
        </div>
      </div>
  );
}

/* ------------------------------------------------------------ Ações ----- */

function ActionsTab({
  aiOn, busy, collectBusy, collectMsg, onCollect, onRunSection, onRunAgent, onExport, onNavigate,
}: OSLeftSidebarProps & { onNavigate: (p: string) => void }) {
  const [term, setTerm] = useState("");
  const dataset = useDataset();
  const agenteProduto = BUILTIN_AGENTS.find((a) => a.id === "seg-produto");

  return (
    <div className="space-y-4">
      {/* Coletar */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Coletar app</p>
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && term.trim() && onCollect(term.trim())}
              placeholder="Nome do app…"
              aria-label="Termo para buscar e coletar app"
              className="w-full pl-7 pr-2 py-1.5 rounded-md border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <button
            onClick={() => term.trim() && onCollect(term.trim())}
            disabled={collectBusy || !term.trim()}
            className="px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {collectBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            Coletar
          </button>
        </div>
        {collectMsg && (
          <p className={cn("text-[10px] mt-1.5", collectMsg.startsWith("✓") ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
            {collectMsg}
          </p>
        )}
        <p className="text-[9px] text-muted-foreground mt-1">Busca Apple + Google Play e coleta o resultado mais relevante com reviews.</p>
      </section>

      {/* Análises rápidas */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Análise rápida (IA)</p>
        <div className="space-y-1">
          {QUICK_SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => onRunSection(s.id)}
              disabled={!aiOn || busy || dataset.entries.length === 0}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/60 text-xs text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* Agente em 1 clique */}
      {agenteProduto && (
        <section>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Delegar a um agente</p>
          <button
            onClick={() => onRunAgent(agenteProduto.id)}
            disabled={!aiOn || busy || dataset.entries.length === 0}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Play className="h-3 w-3" />
            Agente Produto — pipeline completo
          </button>
          <p className="text-[9px] text-muted-foreground mt-1">{agenteProduto.pipeline.map((s) => s.label).join(" → ")}</p>
        </section>
      )}

      {/* Exportações */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Exportar dataset</p>
        <div className="flex gap-1.5">
          <button
            onClick={() => onExport("json")}
            disabled={dataset.entries.length === 0}
            className="flex-1 px-2 py-1.5 rounded-md border border-border/60 text-[11px] hover:bg-secondary/60 disabled:opacity-50 transition-colors"
          >
            JSON
          </button>
          <button
            onClick={() => onExport("md")}
            disabled={dataset.entries.length === 0}
            className="flex-1 px-2 py-1.5 rounded-md border border-border/60 text-[11px] hover:bg-secondary/60 disabled:opacity-50 transition-colors"
          >
            Markdown
          </button>
        </div>
      </section>

      {/* Navegação */}
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Ir para</p>
        <div className="flex flex-wrap gap-1">
          {[
            { label: "Dashboard", path: "/dashboard" },
            { label: "Canvas", path: "/canvas" },
            { label: "Pipeline", path: "/pipeline" },
            { label: "Dados", path: "/dados" },
          ].map((l) => (
            <button
              key={l.path}
              onClick={() => onNavigate(l.path)}
              className="px-2 py-1 rounded-full bg-secondary/70 text-[10px] text-secondary-foreground hover:bg-secondary transition-colors"
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------- Dados ---- */

function DataTab() {
  const dataset = useDataset();
  const { selected, toggle, selectAll, selectNone } = useSelection();
  const allKeys = dataset.entries.map((e) => entryKey(e.app.store, e.app.id));

  if (dataset.entries.length === 0) {
    return (
      <div className="text-center py-8">
        <Database className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">Nenhum app coletado.</p>
        <p className="text-[10px] text-muted-foreground mt-1">Use a aba Ações ou /collect no console.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Escopo ({selected.size === 0 ? "todos" : `${selected.size} sel.`})
        </p>
        <div className="flex gap-1">
          <button onClick={() => selectAll(allKeys)} className="text-[9px] text-primary hover:underline">Todos</button>
          <button onClick={selectNone} className="text-[9px] text-muted-foreground hover:underline">Nenhum</button>
        </div>
      </div>
      {dataset.entries.map((e) => {
        const key = entryKey(e.app.store, e.app.id);
        const on = selected.size === 0 || selected.has(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            aria-pressed={selected.has(key)}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-left transition-colors",
              on ? "border-primary/40 bg-primary/5" : "border-border/50 opacity-60 hover:opacity-90",
            )}
          >
            <img src={e.app.icon} alt="" className="w-6 h-6 rounded object-cover flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-foreground truncate">{e.app.name}</p>
              <p className="text-[9px] text-muted-foreground">
                {e.app.store === "apple" ? "Apple" : "Google"} · {e.reviews.length} reviews
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------ Config ---- */

function ConfigTab({ aiOn }: { aiOn: boolean }) {
  const { settings, setSettings, reviewOptions } = useCollectionSettings();
  const navigate = useNavigate();
  const region = getUserRegion();

  return (
    <div className="space-y-4">
      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Máx. reviews/app</p>
        <div className="flex flex-wrap gap-1">
          {reviewOptions.map((n) => (
            <button
              key={n}
              onClick={() => setSettings({ ...settings, reviewLimit: n })}
              aria-pressed={settings.reviewLimit === n}
              className={cn(
                "px-2 py-1 rounded-md text-[10px] font-medium border transition-colors",
                settings.reviewLimit === n
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {n >= 1000 ? `${n / 1000}k` : n}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Ordenação dos reviews</p>
        <div className="space-y-1">
          {REVIEW_SORT_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setSettings({ ...settings, reviewSort: o.value })}
              aria-pressed={settings.reviewSort === o.value}
              title={o.hint}
              className={cn(
                "w-full text-left px-2.5 py-1.5 rounded-md border text-[11px] transition-colors",
                settings.reviewSort === o.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Região da loja</p>
        <select
          value={region}
          onChange={(e) => { setUserRegion(e.target.value); window.location.reload(); }}
          aria-label="Região da loja"
          className="w-full px-2 py-1.5 rounded-md border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {REGION_OPTIONS.map((r) => (
            <option key={r.code} value={r.code}>{r.flag} {r.label}</option>
          ))}
        </select>
      </section>

      <section className="rounded-lg border border-border/60 bg-card/40 p-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Inteligência Artificial</p>
        <p className={cn("text-[11px]", aiOn ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
          {aiOn ? "Ativa — análises, agentes e chat disponíveis." : "Desativada — ative para usar IA."}
        </p>
        <button
          onClick={() => navigate("/configuracoes")}
          className="mt-1.5 text-[10px] text-primary hover:underline"
        >
          Abrir configurações completas →
        </button>
      </section>
    </div>
  );
}
