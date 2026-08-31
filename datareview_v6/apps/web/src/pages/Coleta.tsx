import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import type { CollectResponse, NormalizedItem } from "@v6/contracts";
import { ativas, ativaCount, coletar } from "../lib/motor";

type RunState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; items: CollectResponse[]; query: string }
  | { phase: "error"; message: string };

export function Coleta() {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState("10");
  const [fonte, setFonte] = useState("");
  const [state, setState] = useState<RunState>({ phase: "idle" });

  const fontes = useMemo(() => ativas, []);

  async function handleRun(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const alvo = fonte ? [fonte] : undefined;
    setState({ phase: "running" });
    try {
      const respostas = await coletar({ query: q, limit: Math.max(1, Math.min(Number(limit) || 10, 50)) }, alvo);
      setState({ phase: "done", items: respostas, query: q });
    } catch (err) {
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <>
      <h1>Coleta</h1>
      <p className="muted" style={{ marginTop: "-0.25rem" }}>
        {ativaCount()} fontes públicas ativas — motor v6, sem backend. 58
        Também dá pra filtrar por fonte e definir limite.
      </p>

      <form onSubmit={handleRun} className="card" style={{ marginBottom: "1.25rem" }}>
        <div className="row">
          <div className="form-field" style={{ flex: 3, minWidth: 240 }}>
            <label htmlFor="query">Query</label>
            <input id="query" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="termo de busca (ex.: typescript)" required />
          </div>
          <div className="form-field">
            <label htmlFor="fonte">Fonte (opcional)</label>
            <select id="fonte" value={fonte} onChange={(e) => setFonte(e.target.value)}>
              <option value="">todas as ativas</option>
              {fontes.map((id) => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="limit">Limite</label>
            <input id="limit" type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(e.target.value)} style={{ width: 90 }} />
          </div>
          <button type="submit" disabled={state.phase === "running" || !query.trim()}>
            {state.phase === "running" ? "Coletando…" : "Coletar"}
          </button>
        </div>
      </form>

      {state.phase === "running" && <p className="muted">Coletando "{query}" em {fonte || "todas as ativas"}…</p>}

      {state.phase === "done" && (
        <div className="card">
          <h2>Resultados: {state.query}</h2>
          {state.items.length === 0 && <p className="muted">Nenhum item retornado.</p>}
          {state.items.map((r) => (
            <section key={r.source} style={{ marginBottom: "1rem" }}>
              <h3>{r.source}{r.error ? ` · erro: ${r.error}` : ""}</h3>
              {r.items.length === 0 && !r.error && <p className="muted">Sem itens.</p>}
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {r.items.map((it: NormalizedItem) => (
                  <li key={it.id} style={{ padding: "0.4rem 0", borderBottom: "1px solid hsl(var(--border))" }}>
                    <strong>{it.title}</strong>
                    <div className="muted" style={{ fontSize: "0.8rem" }}>
                      {it.kind} · {it.source}
                      {it.author ? ` · ${it.author}` : ""}
                      {typeof it.score === "number" ? ` · score ${it.score}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
))}
        </div>
      )}

      {state.phase === "error" && (
        <div className="card" style={{ borderColor: "hsl(var(--destructive))" }}>
          <h2>Falha na coleta</h2>
          <p style={{ fontWeight: 600 }}>{state.message}</p>
        </div>
      )}
    </>
  );
}
