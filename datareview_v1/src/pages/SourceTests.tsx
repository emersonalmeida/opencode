/**
 * Página Testes de fontes (/testes-fontes).
 *
 * O usuário digita um termo e dispara o teste ao vivo em TODAS as fontes:
 * cada fonte roda suas variações (verticais, janelas, endpoints), mostra
 * o que funcionou, o que errou, o que foi pulado honestamente — separated
 * por probe e unificado geral. Raw é sagrado: nunca inventamos dados.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PageTabsSidebar } from "@/components/PageTabsSidebar";
import { SourceTestTerminal } from "@/components/sourceTests/SourceTestTerminal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildTestPlan, runTestPlan, runDemoPlan, aggregate } from "@/lib/sourceTests/sourceTestRunner";
import { loadDemoSnapshot, type DemoSnapshot } from "@/lib/sourceTests/sourceTestDemo";
import { probeServer } from "@/lib/uni/uniApi";
import type { SourceTestResult } from "@/lib/sourceTests/sourceTestPlan";
import { clearTestLog, logTestEvent, logStats, snapshotTestLog, subscribeTestLog } from "@/lib/sourceTests/sourceTestLog";
import { TEST_SOURCE_ORDER } from "@/lib/sourceTests/sourceTestPlan";
import { Play, Square, Terminal, FlaskConical, Layers3 } from "lucide-react";

const STATUS_META = {
  done: { label: "funcionou", tone: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  error: { label: "erro", tone: "bg-red-500/10 text-red-700 dark:text-red-300" },
  skipped: { label: "pulado", tone: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  running: { label: "rodando", tone: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  pending: { label: "pendente", tone: "bg-muted/40 text-muted-foreground" },
} as const;

function anchorFor(sourceId: string): string {
  return `test-${sourceId.replace(/[^a-z0-9-]/gi, "-")}`;
}

/** Visão unificada: cada item coletado, separado por fonte, num só feed. */
function UnifiedItemsView({ results }: { results: SourceTestResult[] }) {
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const all = useMemo(() => {
    const out: { sourceId: string; probeLabel: string; item: Record<string, unknown> }[] = [];
    for (const r of results) {
      for (const p of r.probes) {
        for (const item of p.items) {
          out.push({ sourceId: r.sourceId, probeLabel: p.label, item });
        }
      }
    }
    return out;
  }, [results]);
  const sources = useMemo(() => [...new Set(all.map((i) => i.sourceId))].sort(), [all]);
  const filtered = useMemo(
    () => sourceFilter ? all.filter((i) => i.sourceId === sourceFilter) : all,
    [all, sourceFilter],
  );
  const shown = filtered.slice(0, 300);
  if (!all.length) return null;
  return (
    <section className="space-y-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Itens unificados ({all.length})</h2>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="h-7 rounded-md border bg-background px-2 text-xs"
          aria-label="Filtrar por fonte"
        >
          <option value="">todas as fontes</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {filtered.length > shown.length && <Badge variant="outline">{shown.length} (amostrados)</Badge>}
      </div>
      <ul className="max-h-[520px] space-y-1 overflow-y-auto pr-1" role="list">
        {shown.map((entry, i) => {
          const it = entry.item;
          const title = String(it.title ?? it.name ?? it.text ?? it.label ?? "—").slice(0, 120);
          const url = it.url as string | undefined;
          return (
            <li key={`${entry.sourceId}-${i}`} className="flex flex-wrap items-start gap-2 rounded-md border bg-muted/20 p-2 text-xs">
              <Badge variant="outline" className="shrink-0">{entry.sourceId}</Badge>
              <span className="min-w-0 flex-1 break-words">{title}</span>
              {url && (
                <a href={url} target="_blank" rel="noreferrer noopener" className="shrink-0 text-primary hover:underline">
                  abrir ↗
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SourceCard({ result }: { result: SourceTestResult }) {
  const done = result.probes.filter((p) => p.status === "done").length;
  const error = result.probes.filter((p) => p.status === "error").length;
  const skipped = result.probes.filter((p) => p.status === "skipped").length;
  return (
    <section id={anchorFor(result.sourceId)} className="scroll-mt-20 rounded-lg border bg-card p-4 space-y-3">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{result.sourceId}</h3>
        <Badge variant="outline" className="bg-emerald-500/10">{done} ok</Badge>
        {error > 0 && <Badge variant="outline" className="bg-red-500/10">{error} erro</Badge>}
        {skipped > 0 && <Badge variant="outline" className="bg-amber-500/10">{skipped} pulado</Badge>}
        <span className="ml-auto text-xs text-muted-foreground">{result.totalItems} itens · {result.durationMs}ms</span>
      </header>
      <div className="space-y-2">
        {result.probes.map((p) => (
          <details key={p.id} className="rounded-md border bg-muted/20 p-2" open={p.status === "error"}>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className={STATUS_META[p.status].tone}>{STATUS_META[p.status].label}</Badge>
              <span className="font-medium">{p.label}</span>
              <span className="text-xs text-muted-foreground">
                {p.status === "done" && `${p.count} itens · ${p.fields.length} campos · ${p.durationMs}ms`}
                {p.status === "error" && (p.error ?? "erro")}
                {p.status === "skipped" && p.skippedReason}
              </span>
            </summary>
            <div className="mt-2 space-y-2 text-xs">
              {p.fields.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.fields.map((f) => <Badge key={f} variant="outline" className="font-mono">{f}</Badge>)}
                </div>
              )}
              {p.sample.length > 0 && (
                <pre className="max-h-52 overflow-auto rounded bg-background p-2 text-[10px] leading-relaxed">
                  {JSON.stringify(p.sample, null, 1)}
                </pre>
              )}
              {p.error && <p className="text-red-600 dark:text-red-300">{p.error}</p>}
            </div>
          </details>
        ))}
      </div>
      {result.allFields.length > 0 && (
        <p className="text-xs text-muted-foreground">
          União de campos da fonte: {result.allFields.join(" · ")}
        </p>
      )}
    </section>
  );
}

export default function SourceTests() {
  const plan = useMemo(() => buildTestPlan(), []);
  const [term, setTerm] = useState("");
  const [limit, setLimit] = useState(25);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Map<string, SourceTestResult>>(new Map());
  const abortRef = useRef<AbortController | null>(null);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [demoSnapshot, setDemoSnapshot] = useState<DemoSnapshot | null>(null);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [lastMode, setLastMode] = useState<"live" | "demo">("live");

  useEffect(() => {
    let alive = true;
    probeServer().then((p) => { if (alive) setServerOk(p.reachable); });
    loadDemoSnapshot().then((s) => {
      if (!alive) return;
      setDemoSnapshot(s);
      setDemoError(s ? null : "Snapshot demo não gerado — rode `npm run demo:freeze` com o servidor local online");
    });
    return () => { alive = false; };
  }, []);

  const ordered = useMemo(() => {
    const list = [...results.values()];
    return TEST_SOURCE_ORDER
      .map((id) => list.find((r) => r.sourceId === id))
      .filter((r): r is SourceTestResult => !!r)
      .concat(list.filter((r) => !TEST_SOURCE_ORDER.includes(r.sourceId)));
  }, [results]);

  // Log ao vivo: assina o store (snapshot memoizado — anti-loop).
  const logSnapshot = useSyncExternalStore(subscribeTestLog, snapshotTestLog);
  const stats = useMemo(() => logStats(logSnapshot), [logSnapshot]);

  const runAll = async () => {
    const q = term.trim();
    if (!q || running) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    clearTestLog();
    setResults(new Map());
    setRunning(true);
    setLastMode("live");
    logTestEvent("info", "run", "plan", "início", `${plan.length} probes · concorrência 4 · limit ${limit}`, { status: "running", probes: plan.length });
    try {
      await runTestPlan(plan, q, {
        limit,
        concurrency: 4,
        signal: ctrl.signal,
        onSource: (r) => setResults((prev) => new Map(prev).set(r.sourceId, aggregate(r.sourceId, r.probes))),
      });
      logTestEvent("success", "run", "plan", "fim", `plano completo — ${stats.done} ok / ${stats.error} erro / ${stats.skipped} pulado`, { status: "done" });
    } catch (e) {
      logTestEvent("error", "run", "plan", "falha", String((e as Error)?.message || e), { status: "error" });
    } finally {
      setRunning(false);
    }
  };

  const runDemo = async () => {
    if (running) return;
    if (!demoSnapshot) {
      setDemoError("Snapshot demo não gerado — rode `npm run demo:freeze` com o servidor local online");
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    clearTestLog();
    setResults(new Map());
    setRunning(true);
    setLastMode("demo");
    try {
      await runDemoPlan(plan, demoSnapshot, {
        limit,
        onSource: (r) => setResults((prev) => new Map(prev).set(r.sourceId, aggregate(r.sourceId, r.probes))),
      });
    } catch (e) {
      logTestEvent("error", "run", "demo", "falha", String((e as Error)?.message || e), { status: "error" });
    } finally {
      setRunning(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setRunning(false);
  };

  return (
    <>
      <PageTabsSidebar
        id="sourcetests-right"
        side="right"
        title="Testes de fontes"
        subtitle="terminal ao vivo"
        icon={<Terminal className="h-4 w-4" />}
        storageKey="aso:sourcetests-right-w"
        helpTab={{
          description: "Digite um termo e teste TODAS as fontes ao vivo: cada fonte roda suas variações máximas e mostra funcionou/erro/pulado com contagens e campos.",
          tips: [
            "Terminal = log do runner em tempo real (nada omitido).",
            "Clique num evento do log para expandir o payload JSON.",
            "O raw dos itens (amostra) fica dentro de cada probe.",
          ],
        }}
        tabs={[
          {
            id: "terminal",
            label: "Terminal",
            icon: <Terminal className="h-3 w-3" />,
            content: <SourceTestTerminal />,
          },
        ]}
      />
      <div className="flex h-full min-h-0 flex-col">
        <AppHeader title="Testes de fontes" crumb="ao vivo" />
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="content-fluid space-y-5 py-5">
            {/* Hero + runner */}
            <section className="space-y-3 rounded-lg border bg-card p-5">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-semibold">Testes de fontes (ao vivo)</h1>
              </div>
              <p className="max-w-3xl text-sm text-muted-foreground">
                Digite um termo e dispare o teste em <strong>{plan.length} probes</strong> —
                fontes × variações máximas (verticais, janelas, endpoints, plataformas,
                pacotes, verticais). O que funcionou, o que errou, o que foi pulado
                honestamente — separado por probe e unificado por fonte. Nada inventado.
              </p>
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(e) => { e.preventDefault(); void runAll(); }}
                role="search"
              >
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="termo de busca (ex.: nubank, bitcoin, app de finanças…)"
                  className="min-w-64 flex-1"
                  aria-label="Termo de busca"
                  type="search"
                />
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  aria-label="Limite por probe"
                >
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}/probe</option>)}
                </select>
                {running ? (
                  <Button type="button" variant="destructive" onClick={stop} className="gap-1">
                    <Square className="h-4 w-4" /> Parar
                  </Button>
                ) : (
                  <>
                    <Button type="submit" disabled={!term.trim() || serverOk === false} className="gap-1">
                      <Play className="h-4 w-4" /> Testar {plan.length} probes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void runDemo()}
                      disabled={running || !demoSnapshot}
                      className="gap-1"
                      title={demoError ?? "Roda o plano sobre os dados REAIS do snapshot (sem rede)"}
                    >
                      <FlaskConical className="h-4 w-4" /> Demo (dados reais)
                    </Button>
                  </>
                )}
              </form>
              {serverOk === false && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200" role="alert">
                  Servidor local inacessível — sem ele todas as fontes falham ("Failed to fetch" / resposta HTML).
                  Suba com <code>npm run dev:server</code> e tente de novo, ou use <strong>Demo (dados reais)</strong> — carrega o snapshot gerado por <code>npm run demo:freeze</code>.
                </p>
              )}
              {serverOk == null && (
                <p className="text-xs text-muted-foreground" role="status">verificando servidor local…</p>
              )}
              <div className="flex flex-wrap gap-2 text-xs" role="status" aria-live="polite">
                <Badge variant="outline" className="bg-emerald-500/10">{stats.done} funcionou</Badge>
                <Badge variant="outline" className="bg-red-500/10">{stats.error} erro</Badge>
                <Badge variant="outline" className="bg-amber-500/10">{stats.skipped} pulado</Badge>
                <Badge variant="outline" className="bg-sky-500/10">{stats.running} rodando</Badge>
                {ordered.length > 0 && <Badge variant="outline" className={lastMode === "demo" ? "bg-violet-500/10 text-violet-300" : "bg-emerald-500/10"}>{lastMode === "demo" ? "modo demo (dados reais do snapshot)" : "modo ao vivo"}</Badge>}
                {ordered.length > 0 && <Badge variant="outline">{ordered.length} fontes com resultado</Badge>}
              </div>
            </section>

            {/* Índice de âncoras */}
            {ordered.length > 0 && (
              <nav className="flex flex-wrap gap-1 rounded-lg border bg-card p-3" aria-label="Índice de fontes">
                <Layers3 className="h-4 w-4 text-muted-foreground" />
                {ordered.map((r) => (
                  <a
                    key={r.sourceId}
                    href={`#${anchorFor(r.sourceId)}`}
                    className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted/60"
                  >
                    {r.sourceId}
                  </a>
                ))}
              </nav>
            )}

            {/* Resultados separados por fonte */}
            {ordered.map((r) => <SourceCard key={r.sourceId} result={r} />)}

            {/* Visão unificada dos itens reais (badge de fonte) */}
            {ordered.length > 0 && <UnifiedItemsView results={ordered} />}

            {/* Resumo unificado */}
            {ordered.length > 0 && (
              <section className="rounded-lg border bg-card p-4 space-y-2">
                <h2 className="text-sm font-semibold">Resumo unificado</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{ordered.reduce((n, r) => n + r.totalItems, 0)} itens totais</Badge>
                  <Badge variant="outline">{ordered.reduce((n, r) => n + r.probes.length, 0)} probes executados</Badge>
                  <Badge variant="outline">{ordered.filter((r) => r.probes.some((p) => p.status === "done")).length} fontes que funcionaram</Badge>
                  <Badge variant="outline">{ordered.filter((r) => r.probes.every((p) => p.status === "error")).length} fontes com falha total</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Campos distintos vistos em todas as fontes (união):{" "}
                  {[...new Set(ordered.flatMap((r) => r.allFields))].sort().join(" · ") || "—"}
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
