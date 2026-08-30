/**
 * Painéis internos da página 01 — montados a partir de libs/componentes já
 * existentes do sistema (nada de lógica duplicada):
 *
 *  - `PagesNavPanel`        — menu de páginas derivado do registry (grupos/lista).
 *  - `CollectedDataPanel`   — resumo dos dados COLETADOS (KPIs + por app).
 *  - `CollectedListPanel`   — lista organizada de TUDO que foi coletado (grupos
 *                             por loja, apps expansíveis com amostra de reviews).
 *  - `CollectionConfigPanel`— TODAS as configurações de coleta (resultados,
 *                             limite de reviews, ordenação, região, idioma).
 *  - `SystemHistoryPanel`   — histórico de TUDO que aconteceu no sistema
 *                             (coletas, gerações de IA, chats, eventos).
 *  - `DataQualityPanel`     — validação determinística do dataset (8 checks).
 *  - `FeatureFlagsPanel`    — todas as funcionalidades ligáveis/desligáveis.
 *  - `PipelineArtifactsPanel` — conhecimento produzido pelo Pipeline (vault).
 */
import { useMemo, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Star, ShieldCheck, ShieldAlert, ShieldQuestion, ExternalLink, Search,
  CheckCircle2, AlertTriangle, XCircle, Sparkles, Check, ChevronDown,
} from "lucide-react";
import { PageGroupsNav } from "@/components/PageGroupsNav";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { PAGES, pageNumber } from "@/lib/pages";
import { useFeatureFlags, isFeatureEnabled, pagePathToFlag, setFeatureFlag, FEATURE_FLAGS, FEATURE_GROUP_LABEL, FEATURE_GROUP_ORDER } from "@/lib/featureFlags";
import { useDataset } from "@/hooks/useDataset";
import type { DatasetEntry } from "@/lib/datasetStore";
import { computePerAppStats } from "@/lib/dashboardAnalytics";
import { runValidation, type CheckStatus } from "@/lib/dataPipeline";
import { useArtifacts } from "@/lib/pipeline/artifactStore";
import { STAGE_META, type PipelineArtifact } from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { REGION_OPTIONS, LANGUAGE_OPTIONS, getUserRegion, setUserRegion, getUserLanguage, setUserLanguage } from "@/lib/region";
import { useGenerations } from "@/hooks/useSessions";
import { useChatHistory } from "@/hooks/useChatHistory";
import type { GenerationType } from "@/lib/sessionStore";
import { ActivityPanel } from "@/components/pageSidebars/kit";
import { useSelection, entryKey } from "@/context/SelectionContext";

/* -------------------------------------------------------------- Páginas --- */

/** Menu de navegação derivado do registry PAGES (respeita feature flags).
 *  Espelha a sidebar externa: grupos (quando a flag liga) ou lista plana. */
export function PagesNavPanel() {
  const location = useLocation();
  useFeatureFlags();
  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path + "/"));
  const pages = PAGES.filter((p) => { const fk = pagePathToFlag(p.path); return !fk || isFeatureEnabled(fk); });
  return (
    <nav aria-label="Páginas do sistema" className="p-2 space-y-0.5">
      {isFeatureEnabled("ui.page-groups") ? (
        <PageGroupsNav isActive={isActive} />
      ) : (
        pages.map((p) => {
          const Icon = p.icon;
          const active = isActive(p.path);
          return (
            <NavLink
              key={p.path}
              to={p.path}
              end={p.path === "/"}
              title={p.desc}
              className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
            >
              <span className="w-6 shrink-0 text-[9px] font-medium tabular-nums text-muted-foreground/60">{pageNumber(p.path)}</span>
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{p.label}</span>
            </NavLink>
          );
        })
      )}
    </nav>
  );
}

/* ------------------------------------------------------- Dados coletados --- */

/** Resumo do que está coletado: KPIs do dataset + uma linha por app. */
export function CollectedDataPanel() {
  const { entries } = useDataset();
  const stats = useMemo(() => computePerAppStats(entries), [entries]);
  const totalReviews = stats.reduce((s, a) => s + a.reviewCount, 0);
  const posAvg = totalReviews > 0
    ? Math.round(stats.reduce((s, a) => s + a.positivePct * a.reviewCount, 0) / totalReviews)
    : 0;

  if (entries.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground space-y-2">
        <p>Nenhum app coletado ainda. Use a aba <b>Apps</b> acima para buscar e coletar — os dados aparecem aqui.</p>
      </div>
    );
  }

  return (
    <div className="p-2.5 space-y-2.5">
      <div className="grid grid-cols-3 gap-1.5" role="status" aria-label="Resumo do dataset">
        <div className="rounded-md border border-border/50 p-1.5 text-center">
          <div className="text-sm font-semibold">{entries.length}</div>
          <div className="text-[9px] text-muted-foreground">apps</div>
        </div>
        <div className="rounded-md border border-border/50 p-1.5 text-center">
          <div className="text-sm font-semibold">{totalReviews.toLocaleString("pt-BR")}</div>
          <div className="text-[9px] text-muted-foreground">reviews</div>
        </div>
        <div className="rounded-md border border-border/50 p-1.5 text-center">
          <div className="text-sm font-semibold">{posAvg}%</div>
          <div className="text-[9px] text-muted-foreground">positivos</div>
        </div>
      </div>
      <ul className="space-y-1" aria-label="Apps coletados">
        {stats.map((a) => (
          <li key={a.key}>
            <Link
              to={`/app/${a.store}/${a.key.split(":")[1]}`}
              className="flex items-center gap-2 rounded-md border border-border/40 px-2 py-1.5 hover:bg-secondary transition-colors"
              title={`${a.name} — abrir detalhe`}
            >
              {a.icon
                ? <img src={a.icon} alt="" className="h-6 w-6 rounded" loading="lazy" />
                : <div className="h-6 w-6 rounded bg-secondary" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium">{a.name}</p>
                <p className="text-[9px] text-muted-foreground">
                  {a.store === "apple" ? "Apple" : "Google"} · {a.reviewCount.toLocaleString("pt-BR")} reviews
                </p>
              </div>
              <span className="flex items-center gap-0.5 text-[10px] text-amber-500" title={`Nota média coletada: ${a.avgCollected.toFixed(1)}`}>
                <Star className="h-2.5 w-2.5 fill-current" />{a.avgCollected.toFixed(1)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex gap-2 text-[10px]">
        <Link to="/dados" className="flex items-center gap-0.5 text-primary hover:underline">
          Dados brutos <ExternalLink className="h-2.5 w-2.5" />
        </Link>
        <Link to="/pipeline-dados" className="flex items-center gap-0.5 text-primary hover:underline">
          Pipeline de dados <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>
    </div>
  );
}

/* ----------------------------------------------------- Qualidade (validação) */

const CHECK_ICON: Record<CheckStatus, React.ReactNode> = {
  pass: <CheckCircle2 className="h-3 w-3 text-emerald-500" />,
  warn: <AlertTriangle className="h-3 w-3 text-amber-500" />,
  fail: <XCircle className="h-3 w-3 text-red-500" />,
};

/** Validação determinística do dataset (8 checks de runValidation). */
export function DataQualityPanel() {
  const { entries } = useDataset();
  const report = useMemo(() => runValidation(entries), [entries]);

  if (entries.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        Sem dados para validar — colete apps na aba <b>Apps</b>.
      </div>
    );
  }

  const OverallIcon = report.overall === "pass" ? ShieldCheck : report.overall === "warn" ? ShieldAlert : ShieldQuestion;
  return (
    <div className="p-2.5 space-y-2">
      <div className="flex items-center gap-2 rounded-md border border-border/50 p-2" role="status">
        <OverallIcon className={cn("h-4 w-4", report.overall === "pass" ? "text-emerald-500" : report.overall === "warn" ? "text-amber-500" : "text-red-500")} />
        <div className="flex-1 text-[11px]">
          <b>{report.totalIssues === 0 ? "Tudo íntegro" : `${report.totalIssues} issue(s)`}</b>
          <span className="text-muted-foreground"> · {report.checks.length} verificações determinísticas</span>
        </div>
      </div>
      <ul className="space-y-0.5" aria-label="Verificações de qualidade">
        {report.checks.map((c) => (
          <li key={c.id} className="flex items-start gap-1.5 rounded px-1 py-1 text-[11px] hover:bg-secondary/60">
            <span className="mt-0.5 shrink-0">{CHECK_ICON[c.status]}</span>
            <div className="min-w-0 flex-1">
              <span>{c.label}</span>
              {c.issues.length > 0 && (
                <span className="ml-1 text-muted-foreground">({c.issues.length})</span>
              )}
              {c.issues[0] && (
                <p className="truncate text-[9px] text-muted-foreground" title={c.issues[0].message}>
                  {c.issues[0].message}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------- Funcionalidades --- */

/** Todos os feature flags do sistema, agrupados, com busca — o mesmo controle
 *  da página Configurações, em formato compacto de sidebar. */
export function FeatureFlagsPanel() {
  const flags = useFeatureFlags();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const matches = (label: string, desc: string, key: string) =>
    !query || label.toLowerCase().includes(query) || desc.toLowerCase().includes(query) || key.includes(query);
  const on = flags ? Object.values(flags).filter((v) => v !== false).length : 0;

  return (
    <div className="p-2.5 space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar funcionalidade…"
          aria-label="Buscar funcionalidade"
          className="w-full rounded-md border border-border bg-background py-1 pl-7 pr-2 text-[11px] outline-none focus:border-primary/50"
        />
      </div>
      <p className="text-[10px] text-muted-foreground" role="status">
        {on} de {FEATURE_FLAGS.length} ativas — aplica imediatamente.
      </p>
      {FEATURE_GROUP_ORDER.map((g) => {
        const items = FEATURE_FLAGS.filter((f) => f.group === g && matches(f.label, f.description, f.key));
        if (items.length === 0) return null;
        return (
          <section key={g}>
            <h3 className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
              {FEATURE_GROUP_LABEL[g]}
            </h3>
            <ul className="space-y-0.5">
              {items.map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-2 rounded px-1 py-1 hover:bg-secondary/60">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] leading-tight">{f.label}</p>
                    <p className="truncate text-[9px] text-muted-foreground" title={f.description}>{f.description}</p>
                  </div>
                  <Switch
                    checked={flags[f.key] !== false}
                    disabled={f.locked}
                    onCheckedChange={(v) => setFeatureFlag(f.key, v)}
                    aria-label={`${f.label}${f.locked ? " (sempre ativa)" : ""}`}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------- Artefatos do Pipeline --- */

function ArtifactItem({ a }: { a: PipelineArtifact }) {
  const [open, setOpen] = useState(false);
  const stage = STAGE_META[a.stage];
  return (
    <li className="rounded-md border border-border/40">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-secondary/60"
      >
        <Badge variant="outline" className={cn("shrink-0 text-[9px]", stage?.textColor)}>
          {stage?.short ?? a.stage}
        </Badge>
        <span className="min-w-0 flex-1 truncate text-[11px]">{a.title}</span>
        <span className="shrink-0 text-[9px] text-muted-foreground" title={a.methodology}>
          {a.engine === "ai" ? "IA" : "det."}
        </span>
      </button>
      {open && a.markdown && (
        <div className="border-t border-border/40 p-2">
          <AIOutputCard
            content={a.markdown}
            filename={`pipeline-${a.id}`}
            storageKey={`page01-artifact-${a.id}`}
            provenance={a.methodology}
          />
        </div>
      )}
      {open && !a.markdown && (
        <p className="border-t border-border/40 p-2 text-[10px] text-muted-foreground">
          Artefato estruturado (sem markdown) — abra o Pipeline para o detalhe completo.
        </p>
      )}
    </li>
  );
}

/** Conhecimento produzido pelo Pipeline (fatos, anomalias, análises de IA). */
export function PipelineArtifactsPanel() {
  const artifacts = useArtifacts();
  return (
    <div className="p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground" role="status">
          {artifacts.length} artefato(s) de conhecimento
        </p>
        <Link to="/pipeline" className="flex items-center gap-0.5 text-[10px] text-primary hover:underline">
          Abrir Pipeline <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>
      {artifacts.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nada ainda — o <Link to="/pipeline" className="text-primary hover:underline">Pipeline</Link> computa
          fatos e anomalias (sem IA) e gera análises encadeadas que viram artefatos aqui.
        </p>
      ) : (
        <ul className="space-y-1">
          {artifacts.slice(0, 30).map((a) => <ArtifactItem key={a.id} a={a} />)}
        </ul>
      )}
      <p className="flex items-center gap-1 text-[9px] text-muted-foreground">
        <Sparkles className="h-2.5 w-2.5" /> Cada artefato guarda metodologia, escopo e lineage.
      </p>
    </div>
  );
}


/* -------------------------------------------------- Configuração de coleta --- */

/**
 * TODAS as configurações de coleta do sistema num painel inline (sem
 * dropdown): resultados por loja, limite de reviews (presets + personalizado),
 * ordenação dos reviews, região da loja e idioma.
 */
export function CollectionConfigPanel() {
  const { settings, setSettings, searchOptions, reviewOptions, reviewSortOptions } = useCollectionSettings();
  const [region, setRegion] = useState(() => getUserRegion());
  const [language, setLanguage] = useState(() => getUserLanguage());

  const updateRegion = (r: string) => { setRegion(r); setUserRegion(r); window.location.reload(); };
  const updateLanguage = (l: string) => { setLanguage(l); setUserLanguage(l); window.location.reload(); };

  const groupCls = "space-y-1.5";
  const labelCls = "text-[9px] font-medium text-muted-foreground uppercase tracking-wider";
  const optCls = (on: boolean) =>
    `text-[10px] px-2 py-1 rounded-md transition-colors ${on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`;

  return (
    <div className="p-3 space-y-4">
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Controle como o sistema coleta: quantos resultados a busca traz, até
        quantos reviews cada app guarda e em que ordem, além da região e do
        idioma das lojas.
      </p>

      <div className={groupCls}>
        <p className={labelCls}>Resultados por loja (busca)</p>
        <div className="flex flex-wrap gap-1">
          {searchOptions.map((n) => (
            <button key={n} onClick={() => setSettings({ ...settings, searchLimit: n })} className={optCls(settings.searchLimit === n)} aria-pressed={settings.searchLimit === n}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <div className={groupCls}>
        <p className={labelCls}>Máx. reviews por app</p>
        <div className="flex flex-wrap gap-1">
          {reviewOptions.map((n) => (
            <button key={n} onClick={() => setSettings({ ...settings, reviewLimit: n })} className={optCls(settings.reviewLimit === n)} aria-pressed={settings.reviewLimit === n}>
              {n >= 1000 ? `${n / 1000}k` : n}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <label htmlFor="p01-review-limit" className="text-[9px] text-muted-foreground uppercase tracking-wider shrink-0">
            Personalizado
          </label>
          <input
            id="p01-review-limit"
            type="number"
            min={1}
            max={10000}
            step={50}
            value={settings.reviewLimit}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) setSettings({ ...settings, reviewLimit: Math.max(1, Math.min(n, 10000)) });
            }}
            className="flex-1 min-w-0 text-[10px] px-1.5 py-1 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
        <p className="text-[9px] text-muted-foreground leading-relaxed">
          O sistema coleta o máximo possível até o limite. Apple: amp-api + SSR
          multi-país (~1.000+ p/ apps globais). Google Play: até 10.000.
        </p>
      </div>

      <div className={groupCls}>
        <p className={labelCls}>Ordenação dos reviews</p>
        <div className="flex flex-wrap gap-1">
          {reviewSortOptions.map((opt) => (
            <button key={opt.value} onClick={() => setSettings({ ...settings, reviewSort: opt.value })} title={opt.hint} className={optCls(settings.reviewSort === opt.value)} aria-pressed={settings.reviewSort === opt.value}>
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-muted-foreground leading-relaxed">
          Google: escolhe a ordenação da coleta (NEWEST/HELPFUL/RATING). Apple:
          best-effort (APIs públicas não expõem sort) — a ordem final é aplicada
          aos reviews armazenados.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className={groupCls}>
          <label htmlFor="p01-region" className={labelCls}>Região da loja</label>
          <select
            id="p01-region"
            value={region}
            onChange={(e) => updateRegion(e.target.value)}
            className="w-full text-[11px] px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {REGION_OPTIONS.map((r) => <option key={r.code} value={r.code}>{r.flag} {r.label}</option>)}
          </select>
        </div>
        <div className={groupCls}>
          <label htmlFor="p01-lang" className={labelCls}>Idioma</label>
          <select
            id="p01-lang"
            value={language}
            onChange={(e) => updateLanguage(e.target.value)}
            className="w-full text-[11px] px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          >
            {LANGUAGE_OPTIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground leading-relaxed">
        Região e idioma recarregam a página para valer em todas as superfícies.
        A IA é configurada na aba <b>IA</b> da sidebar direita.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- Histórico --- */

const GEN_TYPE_LABEL: Record<GenerationType, string> = {
  collect: "Coletas",
  "atlas-run": "Atlas",
  "canvas-run": "Canvas",
  chat: "Chats IA",
  "ai-section": "Análises IA",
};

/**
 * Histórico de TUDO que já aconteceu no sistema: resumo por tipo (coletas,
 * gerações de IA, conversas) + linha do tempo de eventos em tempo real.
 */
export function SystemHistoryPanel() {
  const generations = useGenerations();
  const chats = useChatHistory();

  const counts = useMemo(() => {
    const byType = new Map<GenerationType, number>();
    for (const g of generations) byType.set(g.type, (byType.get(g.type) ?? 0) + 1);
    return byType;
  }, [generations]);

  return (
    <div className="p-2.5 space-y-3">
      <div className="rounded-lg border border-border/50 bg-background p-2 space-y-1">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tudo que já aconteceu
        </p>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(GEN_TYPE_LABEL) as GenerationType[]).map((t) => {
            const n = counts.get(t) ?? 0;
            if (n === 0) return null;
            return (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[9px] text-secondary-foreground">
                {GEN_TYPE_LABEL[t]} <b>{n}</b>
              </span>
            );
          })}
          {chats.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[9px] text-secondary-foreground">
              Conversas <b>{chats.length}</b>
            </span>
          )}
          {generations.length === 0 && chats.length === 0 && (
            <span className="text-[10px] text-muted-foreground">Nada registrado ainda.</span>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <p className="px-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Eventos em tempo real
        </p>
        <ActivityPanel limit={30} />
      </div>

      <Link to="/sessions" className="flex items-center gap-0.5 px-1 text-[10px] text-primary hover:underline">
        Ver todas as gerações <ExternalLink className="h-2.5 w-2.5" />
      </Link>
    </div>
  );
}


/* ------------------------------------------- Coletados (lista organizada) --- */

/** Item expansível de app coletado: metadados + amostra de reviews. */
function CollectedAppItem({ entry }: { entry: DatasetEntry }) {
  const [open, setOpen] = useState(false);
  const { selected, toggle } = useSelection();
  const k = entryKey(entry.app.store, entry.app.id);
  const sel = selected.has(k);
  const samples = useMemo(() => entry.reviews.slice(0, 3), [entry.reviews]);

  return (
    <li className="rounded-md border border-border/40 overflow-hidden">
      <div className="flex items-center gap-1.5 px-1.5 py-1.5">
        <button
          onClick={() => toggle(k)}
          role="checkbox"
          aria-checked={sel}
          aria-label={`Selecionar ${entry.app.name} para o escopo`}
          className={cn(
            "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
            sel ? "bg-primary border-primary text-primary-foreground" : "border-border",
          )}
        >
          {sel && <Check className="h-2.5 w-2.5" />}
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <div className="w-5 h-5 rounded overflow-hidden bg-secondary shrink-0">
            {entry.app.icon && <img src={entry.app.icon} alt="" className="w-full h-full object-cover" loading="lazy" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium">{entry.app.name}</p>
            <p className="truncate text-[9px] text-muted-foreground">
              {entry.reviews.length.toLocaleString("pt-BR")} reviews · nota {entry.app.rating?.toFixed(1) ?? "—"}
            </p>
          </div>
          <ChevronDown className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open && (
        <div className="border-t border-border/40 p-2 space-y-2 text-[10px]">
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1">
            <div><dt className="text-muted-foreground">Desenvolvedor</dt><dd className="truncate font-medium">{entry.app.developer ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Versão</dt><dd className="truncate font-medium">{entry.app.version ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Avaliações na loja</dt><dd className="font-medium">{entry.app.ratingCount?.toLocaleString("pt-BR") ?? "—"}</dd></div>
            <div><dt className="text-muted-foreground">Coletado em</dt><dd className="font-medium">{new Date(entry.collectedAt).toLocaleDateString("pt-BR")}</dd></div>
          </dl>
          {samples.length > 0 && (
            <ul className="space-y-1" aria-label={`Amostra de reviews de ${entry.app.name}`}>
              {samples.map((r, i) => (
                <li key={r.id ?? i} className="rounded bg-secondary/50 px-2 py-1">
                  <p className="flex items-center gap-1 text-[9px] text-muted-foreground">
                    <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" /> {r.rating} · {r.author ?? "Anônimo"}
                  </p>
                  <p className="line-clamp-2 leading-snug">{r.title ? <b>{r.title} — </b> : null}{r.text}</p>
                </li>
              ))}
            </ul>
          )}
          <Link to={`/app/${entry.app.store}/${entry.app.id}`} className="inline-flex items-center gap-0.5 text-primary hover:underline">
            Abrir detalhe completo <ExternalLink className="h-2.5 w-2.5" />
          </Link>
        </div>
      )}
    </li>
  );
}

/**
 * Lista organizada de TUDO que foi coletado: resumo do dataset + apps
 * agrupados por loja (Apple/Google), cada um expansível com metadados e
 * amostra de reviews, com seleção de escopo.
 */
export function CollectedListPanel() {
  const { entries } = useDataset();
  const { selected, selectAll, selectNone } = useSelection();
  const groups = useMemo(() => {
    const apple = entries.filter((e) => e.app.store === "apple");
    const google = entries.filter((e) => e.app.store !== "apple");
    return [
      { id: "apple", label: "Apple App Store", items: apple },
      { id: "google", label: "Google Play", items: google },
    ].filter((g) => g.items.length > 0);
  }, [entries]);
  const totalReviews = useMemo(() => entries.reduce((s, e) => s + e.reviews.length, 0), [entries]);

  if (entries.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground space-y-1.5">
        <p className="font-medium text-foreground">Nada coletado ainda.</p>
        <p>
          Use a aba <b>Coleta</b> acima para buscar apps nas duas lojas e coletar
          com 1 clique. Tudo que for coletado aparece aqui, organizado por loja.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-[10px] text-muted-foreground" role="status">
          {entries.length} app(s) · {totalReviews.toLocaleString("pt-BR")} reviews coletados
        </p>
        {/* Toda lista selecionável tem "Todos"/"Nenhum" (padrão do sistema). */}
        <span className="flex gap-1.5 text-[10px]">
          <button
            type="button"
            onClick={() => selectAll(entries.map((e) => entryKey(e.app.store, e.app.id)))}
            disabled={selected.size === entries.length}
            className="text-primary hover:underline disabled:opacity-40"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={selectNone}
            disabled={selected.size === 0}
            className="text-primary hover:underline disabled:opacity-40"
          >
            Nenhum
          </button>
        </span>
      </div>
      {groups.map((g) => (
        <section key={g.id} aria-label={g.label}>
          <h3 className="px-1 pb-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {g.label} · {g.items.length}
          </h3>
          <ul className="space-y-1">
            {g.items.map((e) => <CollectedAppItem key={entryKey(e.app.store, e.app.id)} entry={e} />)}
          </ul>
        </section>
      ))}
      <div className="flex gap-2 text-[10px] px-1">
        <Link to="/dados" className="flex items-center gap-0.5 text-primary hover:underline">
          Dados brutos <ExternalLink className="h-2.5 w-2.5" />
        </Link>
        <Link to="/pipeline-dados" className="flex items-center gap-0.5 text-primary hover:underline">
          Pipeline de dados <ExternalLink className="h-2.5 w-2.5" />
        </Link>
      </div>
    </div>
  );
}
