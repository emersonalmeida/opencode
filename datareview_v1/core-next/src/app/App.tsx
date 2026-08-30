import { useEffect, useMemo, useState } from "react";
import { api } from "../core/apiClient.js";
import { dataset, type DatasetEntry } from "../core/dataset/store.js";
import { computeStats } from "../core/dataset/derive.js";
import type { SourceDescriptor } from "@shared/contracts.js";

/**
 * Página inicial mínima (mobile-first): pesquisa → seleciona fontes →
 * coleta → resultado → dataset persistido. Sem design system.
 */
export function App(): JSX.Element {
  const [sources, setSources] = useState<SourceDescriptor[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [entries, setEntries] = useState<DatasetEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api.sources().then(
      ({ sources: s }) => alive && setSources(s),
      (e: unknown) => alive && setError(e instanceof Error ? e.message : "falha ao carregar fontes"),
    );
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const unsub = dataset.subscribe(() => setEntries(dataset.list()));
    setEntries(dataset.list());
    return unsub;
  }, []);

  const stats = useMemo(() => computeStats(entries), [entries]);

  function toggle(id: string, on: boolean): void {
    setSelected((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  }

  async function run(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const q = query.trim();
    if (!q || selected.length === 0) return;
    setError(null);
    setStatus("coletando…");
    const results = await Promise.allSettled(
      selected.map((id) => api.collect(id, q)),
    );
    let added = 0;
    let failed = 0;
    for (const r of results) {
      if (r.status === "fulfilled") {
        added += dataset.insertMany(r.value.items ?? []);
        if (r.value.error) failed++;
      } else failed++;
    }
    setStatus(
      `pronto: ${added} novo(s) no dataset${failed ? ` · ${failed} fonte(s) falharam (parcial OK)` : ""}`,
    );
  }

  return (
    <main>
      <h1>Core Next</h1>
      <p className="sub">pesquisa → coleta → dataset → IA (núcleo; UI mínima)</p>

      <form onSubmit={run} className="search">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="pesquisar…"
          required
          minLength={2}
          aria-label="Consulta"
        />
        <button type="submit">coletar</button>
      </form>

      <details open>
        <summary>Fontes ({sources.length})</summary>
        <ul className="sources" role="group" aria-label="Fontes disponíveis">
          {sources.map((s) => (
            <li key={s.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(s.id)}
                  onChange={(e) => toggle(s.id, e.target.checked)}
                />
                <span>
                  {s.label} <small>({s.kind})</small>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </details>

      {status && <p role="status" className="status">{status}</p>}
      {error && <p role="alert" className="error">{error}</p>}

      <section aria-label="Dataset">
        <h2>
          Dataset <small>{stats.total} itens</small>
        </h2>
        <ul className="entries">
          {entries.slice(0, 25).map((e) => (
            <li key={e.key}>
              <strong>{e.item.title}</strong>
              <span className="meta">
                {e.item.source}/{e.item.kind}
                {e.item.author ? ` · ${e.item.author}` : ""}
                {typeof e.item.score === "number" ? ` · ${e.item.score}` : ""}
              </span>
              {e.item.url && (
                <a href={e.item.url} target="_blank" rel="noreferrer noopener">
                  abrir
                </a>
              )}
            </li>
          ))}
        </ul>
        {entries.length > 25 && (
          <p className="meta">(mostrando 25 de {entries.length})</p>
        )}
      </section>
    </main>
  );
}
