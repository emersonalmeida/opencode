/**
 * /teste — Test Center do sistema (FASE 1 foundation).
 * Dashboard com último run + catálogo SAFE executável via botões.
 */
import { useMemo, useState } from "react";
import { FlaskConical, Play, Trash2 } from "lucide-react";
import { recordRun, listRuns, clearRuns, summarize } from "@/lib/testCenter/historyStore";
import { SUITE_ORDER, SUITE_META, EXECUTORS, FLAG_LABEL } from "@/lib/testCenter/catalog";
import type { TestRun } from "@/lib/testCenter/types";
import { AppHeader } from "@/components/AppHeader";
import { RunsFilterBar } from "@/components/testCenter/RunsFilterBar";
import { apiBase } from "@/lib/apiBase";

const BASE_URL = apiBase();

export default function TestCenter() {
  const [runs, setRuns] = useState<TestRun[]>(() => listRuns());
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState<string>("");

  async function executeRun(mode: TestRun["mode"], suite?: string) {
    setBusy(true);
    try {
      const r = await fetch(`${BASE_URL}/functions/v1/test-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suite: suite ?? null, mode, baseUrl: BASE_URL }),
      });
      const body = (await r.json().catch(() => ({}))) as { run?: TestRun; error?: unknown };
      if (!r.ok || !body.run) throw new Error(typeof body.error === "string" ? body.error : "test-run vazio");
      const run = body.run;
      recordRun(run);
      setRuns(listRuns());
      
      setErrorMsg(null);
    } catch (error) {
      setErrorMsg(`${(error as Error)?.message ?? "erro no test-run"}`);
      // fall back already
    } finally {
      setBusy(false);
    }
  }

  const totals = useMemo(() => {
    if (!runs.length) return null;
    const last = runs[0];
    const s = summarize(last);
    const total = last.results.length;
    const passed = s.pass;
    return {
      total,
      passed,
      failed: s.fail + s.error,
      warning: s.warning,
      skipped: s.skipped + s.notConfigured,
      passRate: total ? Math.round((passed / total) * 100) : 0,
      durationMs: last.finishedAt - last.startedAt,
    };
  }, [runs]);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader title="Teste" crumb="Test Center do sistema" />
      <div className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" /> Test Center
          </h2>
          <p className="text-sm text-muted-foreground">
            Validação completa do sistema: catálogo SAFE executável por demanda.
            Sem executómado no carregamento da página.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
            onClick={() => executeRun("quick")}
            disabled={busy}
            data-testid="run-quick"
          >
            <Play className="h-4 w-4" /> Executar QUICK
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium disabled:opacity-50"
            onClick={() => executeRun("full")}
            disabled={busy}
            data-testid="run-full"
          >
            <Play className="h-4 w-4" /> Executar FULL
          </button>
          {errorMsg ? (
            <div role="alert" className="rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">
              {errorMsg}
            </div>
          ) : null}
          <button
            className="inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm text-muted-foreground disabled:opacity-50"
            onClick={() => {
              clearRuns();
              setRuns([]);
            }}
            disabled={busy}
            data-testid="clear-history"
          >
            <Trash2 className="h-4 w-4" /> Limpar histórico
          </button>
        </div>

        {totals ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" role="status">
            <StatCard label="Testes" value={String(totals.total)} />
            <StatCard label="Pass" value={String(totals.passed)} tone="ok" />
            <StatCard label="Falha" value={String(totals.failed)} tone="bad" />
            <StatCard label="Aviso" value={String(totals.warning)} tone="warn" />
            <StatCard label="Pulados" value={String(totals.skipped)} tone="muted" />
            <StatCard label="Taxa" value={`${totals.passRate}%`} tone="ok" />
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Nenhuma execução ainda. Clique em Executar QUICK para o primeiro test run.
          </div>
        )}

        <section aria-label="Suítes">
          <h3 className="text-base font-medium mb-2">Suítes ({SUITE_ORDER.length})</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {SUITE_ORDER.map((suite) => {
              const meta = SUITE_META[suite];
              const executors = EXECUTORS.filter((e) => e.definition.suite === suite);
              return (
                <div key={suite} className="rounded-md border p-3">
                  <div className="font-medium">{meta.label}</div>
                  <div className="text-sm text-muted-foreground">{meta.desc}</div>
                  <ul className="mt-2 space-y-1">
                    {executors.map((ex) => (
                      <li key={ex.definition.testId} className="flex items-center gap-2 text-sm">
                        <code className="rounded bg-muted px-1 text-xs">{ex.definition.testId}</code>
                        <span>{ex.definition.name}</span>
                        <span className="flex gap-1 ml-auto">
                          {ex.definition.requires.map((f) => (
                            <span key={f} className="rounded bg-primary/10 px-1 text-[10px] text-primary">
                              {FLAG_LABEL[f] ?? f}
                            </span>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {runs.length > 0 && (
          <section aria-label="Histórico">
            <h3 className="text-base font-medium mb-2">Histórico ({runs.length})</h3>
            <RunsFilterBar
              results={runs[0]?.results ?? []}
              statusFilter={filter}
              onStatusFilter={setFilter}
              query={query}
              onQueryChange={setQuery}
            />
            <div className="mt-2 space-y-2">
              {(filter === "all" || !query
                ? runs[0]?.results ?? []
                : runs[0]?.results?.filter((res) => res.testId.includes(query)) ?? [])
                .map((res) => (
                  <div key={res.testId} className="rounded border p-1 text-xs">
                    <div className="font-medium">{res.testId}</div>
                    <div className={res.status === "pass" ? "text-green-500" : "text-red-500"}>
                      {res.status}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{res.durationMs}ms</div>
                    {res.error ? <div className="text-[10px] text-red-500">{res.error.message}</div> : null}
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "bad" | "muted" }) {
  const toneClass =
    tone === "ok" ? "text-green-600"
    : tone === "bad" ? "text-red-600"
    : tone === "warn" ? "text-amber-600"
    : "text-muted-foreground";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold ${toneClass ?? ""}`}>{value}</div>
    </div>
  );
}
