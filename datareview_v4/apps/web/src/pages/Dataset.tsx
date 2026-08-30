import { useEffect, useMemo, useState } from "react";
import { getDataset, getDerive, type DatasetResponse, type DeriveResponse } from "../lib/api";
import { formatDateTime, formatScore } from "../lib/format";

export function Dataset() {
  const [data, setData] = useState<DatasetResponse | null>(null);
  const [derive, setDerive] = useState<DeriveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([getDataset(), getDerive()])
      .then(([d, dv]) => {
        if (cancelled) return;
        setData(d);
        setDerive(dv);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sources = useMemo(() => Object.entries(derive?.stats.bySource ?? {}).sort((a, b) => b[1] - a[1]), [derive]);
  const kinds = useMemo(() => Object.entries(derive?.stats.byKind ?? {}).sort((a, b) => b[1] - a[1]), [derive]);

  const entries = useMemo(() => {
    if (!data) return [];
    return data.entries.filter((e) => {
      if (sourceFilter && e.item.source !== sourceFilter) return false;
      if (!filter) return true;
      const hay = `${e.item.title} ${e.item.text ?? ""} ${e.item.author ?? ""}`.toLowerCase();
      return hay.includes(filter.toLowerCase());
    });
  }, [data, filter, sourceFilter]);

  const stats = derive?.stats;

  return (
    <>
      <h1>Dataset</h1>
      <p className="muted" style={{ marginTop: "-0.25rem" }}>
        Itens coletados (Bronze/Silver) persistidos no storage da API —{" "}
        <span className="kbd">GET /api/dataset</span>, <span className="kbd">/api/stats</span>,{" "}
        <span className="kbd">/api/derive</span>.
      </p>

      {error && <p style={{ color: "hsl(var(--destructive))" }}>Erro: {error}</p>}

      {stats && (
        <div className="metrics">
          <div className="metric">
            <div className="value">{stats.total}</div>
            <div className="label">Itens</div>
          </div>
          <div className="metric">
            <div className="value">{Object.keys(stats.bySource).length}</div>
            <div className="label">Fontes</div>
          </div>
          <div className="metric">
            <div className="value">{Object.keys(stats.byKind).length}</div>
            <div className="label">Tipos</div>
          </div>
          <div className="metric">
            <div className="value">{stats.withScore}</div>
            <div className="label">Com score</div>
          </div>
        </div>
      )}

      {(sources.length > 0 || kinds.length > 0) && (
        <div className="card" style={{ marginBottom: "1.25rem" }}>
          <div className="row">
            {sources.length > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <h2>Por fonte</h2>
                <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                  {sources.slice(0, 12).map(([s, n]) => (
                    <li key={s}>
                      {s}: <strong>{n}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {kinds.length > 0 && (
              <div style={{ flex: 1, minWidth: 200 }}>
                <h2>Por tipo</h2>
                <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
                  {kinds.slice(0, 12).map(([k, n]) => (
                    <li key={k}>
                      {k}: <strong>{n}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {derive?.hint && (
            <details style={{ marginTop: "0.75rem" }}>
              <summary className="muted">Contexto deterministico (hint p/ IA)</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>{derive.hint}</pre>
            </details>
          )}
        </div>
      )}

      {data && (
        <div className="card" style={{ padding: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por título/texto/autor…"
              style={{ flex: 1, minWidth: 180 }}
            />
            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
              <option value="">Todas as fontes</option>
              {sources.map(([s]) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span className="muted" style={{ fontSize: "0.85rem", alignSelf: "center" }}>
              {entries.length} itens
            </span>
          </div>
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {entries.slice(0, 200).map((e) => {
              const item = e.item;
              const href = item.url;
              return (
                <li key={e.key} style={{ padding: "0.55rem 0", borderBottom: "1px solid hsl(var(--border))" }}>
                  {href ? (
                    <a href={href} target="_blank" rel="noreferrer">
                      <strong>{item.title}</strong>
                    </a>
                  ) : (
                    <strong>{item.title}</strong>
                  )}
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    <span className="kbd">{item.kind}</span> · {item.source}
                    {item.author ? ` · ${item.author}` : ""} · score {formatScore(item.score)} ·{" "}
                    {formatDateTime(e.collectedAt)}
                    {item.fallback ? ` · fallback ${item.fallback.engine}` : ""}
                  </div>
                </li>
              );
            })}
            {entries.length === 0 && (
              <li className="muted" style={{ padding: "0.5rem 0" }}>
                {data.total === 0
                  ? "Dataset vazio — colete itens na página Fontes para popular."
                  : "Nenhum item corresponde aos filtros."}
              </li>
            )}
          </ul>
        </div>
      )}
    </>
  );
}