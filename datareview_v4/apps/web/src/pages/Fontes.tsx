import { useEffect, useMemo, useState } from "react";
import type { NormalizedItem } from "@v4/contracts";
import { ApiError, getCatalog, runSource, type CatalogResponse, type CatalogSource } from "../lib/api";
import { statusLabel } from "../lib/format";

interface FontesProps {
  catalog: CatalogResponse | null;
}

type RunState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; sourceId: string; query: string; added: number; total: number; items: NormalizedItem[]; cached: boolean; error?: string; reason?: string }
  | { phase: "error"; message: string; detail?: string };

function itemUrl(item: NormalizedItem): string | undefined {
  return item.url;
}

export function Fontes() {
  const [catalog, setCatalog] = useState<FontesProps["catalog"]>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourceId, setSourceId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState("10");
  const [engine, setEngine] = useState("");
  const [country, setCountry] = useState("");
  const [state, setState] = useState<RunState>({ phase: "idle" });

  useEffect(() => {
    let cancelled = false;
    getCatalog()
      .then((cat) => {
        if (cancelled) return;
        setCatalog(cat);
        setSourceId((prev) => prev || (cat.sources[0]?.id ?? ""));
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = useMemo(() => catalog?.sources.find((s) => s.id === sourceId) ?? null, [catalog, sourceId]);

  const groups = useMemo(() => catalog?.byGroup ?? {}, [catalog]);
  const activeCount = catalog?.sources.filter((s) => s.status === "implemented").length ?? 0;

  async function handleRun(e: React.FormEvent) {
    e.preventDefault();
    const id = sourceId.trim();
    const q = query.trim();
    if (!id || !q) return;
    setState({ phase: "running" });
    try {
      const res = await runSource({
        source: id,
        query: q,
        limit: Math.max(1, Math.min(Number(limit) || 10, 50)),
        ...(engine ? { engine } : {}),
        ...(country ? { country } : {}),
      });
      setState({
        phase: "done",
        sourceId: id,
        query: q,
        added: res.added,
        total: res.total,
        items: res.response.items,
        cached: res.response.cached ?? false,
        error: res.response.error,
      });
    } catch (e) {
      if (e instanceof ApiError) {
        setState({
          phase: "error",
          message: e.message,
          detail:
            e.status === 501
              ? `Fonte conhecida mas sem coletor na v4 ainda (status catalogado). Portar fontes por prioridade ou registrar em docs/SOURCES.md.`
              : e.status === 404
                ? "Fonte fora do catálogo (id desconhecido)."
                : undefined,
        });
      } else {
        setState({ phase: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  return (
    <>
      <h1>Testes de fontes</h1>
      <p className="muted" style={{ marginTop: "-0.25rem" }}>
        {catalog ? (
          <>
            Catálogo: <strong>{catalog.total}</strong> fontes · <strong>{activeCount}</strong>{" "}
            com coletor ativo · grupos:{" "}
            {Object.entries(groups)
              .map(([g, n]) => `${g} (${n})`)
              .join(" · ")}
          </>
        ) : loadError ? (
          <>API indisponível: {loadError}</>
        ) : (
          "Carregando catálogo…"
        )}
      </p>

      <form onSubmit={handleRun} className="card" style={{ marginBottom: "1.25rem" }}>
        <div className="row">
          <div className="form-field" style={{ flex: 2, minWidth: 240 }}>
            <label htmlFor="source">Fonte</label>
            <select id="source" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              {catalog?.sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.id}) — {statusLabel(s.status)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field" style={{ flex: 3, minWidth: 240 }}>
            <label htmlFor="query">Query</label>
            <input
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={selected?.params.includes("query") ? "termo de busca (ex.: typescript)" : "identificador/termo"}
              required
            />
          </div>
          <div className="form-field">
            <label htmlFor="limit">Limite</label>
            <input
              id="limit"
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              style={{ width: 90 }}
            />
          </div>
        </div>
        <div className="row" style={{ marginTop: "0.75rem", alignItems: "end" }}>
          <div className="form-field">
            <label htmlFor="engine">Engine / vertical (opcional)</label>
            <input
              id="engine"
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              placeholder={selected ? (selected.params.includes("query") ? "ex.: repos, stackoverflow, yt…" : "ex.: web, youtube…") : ""}
              style={{ width: 220 }}
            />
          </div>
          <div className="form-field">
            <label htmlFor="country">País (ex.: br, us)</label>
            <input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="br"
              style={{ width: 90 }}
            />
          </div>
          <button type="submit" disabled={state.phase === "running" || !query.trim() || !sourceId}>
            {state.phase === "running" ? "Coletando…" : "Coletar"}
          </button>
        </div>
        {selected && (
          <p className="muted" style={{ margin: "0.75rem 0 0", fontSize: "0.82rem" }}>
            <span className="kbd">status {statusLabel(selected.status)}</span> ·{" "}
            <span className="kbd">método {selected.method}</span> · params: {selected.params.join(", ")} ·{" "}
            dados: {selected.data.join(", ")} {selected.tosNote ? `· ${selected.tosNote}` : ""}
          </p>
        )}
      </form>

      {state.phase === "running" && <p className="muted">Coletando “{query}” de {sourceId}…</p>}

      {state.phase === "done" && (
        <div className="card">
          <h2 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              {sourceId}: “{query}”
            </span>
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {state.total} itens{state.cached ? " · cache" : ""} · {state.added} novos
            </span>
          </h2>
          {state.error && (
            <p style={{ color: "hsl(var(--destructive))", fontWeight: 600 }}>Erro honesto da fonte: {state.error}</p>
          )}
          {state.items.length === 0 && !state.error && <p className="muted">Nenhum item retornado.</p>}
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {state.items.map((item) => {
              const href = itemUrl(item);
              return (
                <li key={item.id} style={{ padding: "0.55rem 0", borderBottom: "1px solid hsl(var(--border))" }}>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer">
                      <strong>{item.title}</strong>
                    </a>
                  ) : (
                    <strong>{item.title}</strong>
                  )}
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    {item.kind} · {item.source}
                    {item.author ? ` · ${item.author}` : ""}
                    {typeof item.score === "number" ? ` · score ${item.score}` : ""}
                    {item.fallback ? ` · fallback ${item.fallback.engine}` : ""}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {state.phase === "error" && (
        <div className="card" style={{ borderColor: "hsl(var(--destructive))" }}>
          <h2>Falha na coleta</h2>
          <p style={{ fontWeight: 600 }}>{state.message}</p>
          {state.detail && <p className="muted">{state.detail}</p>}
        </div>
      )}
    </>
  );
}

export type { CatalogSource };