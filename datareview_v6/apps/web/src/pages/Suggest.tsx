/** Página Suggest — autocomplete Google, configurável e analítica (mobile-first. **/
import { useMemo, useRef, useState } from "react";
import {
  buildSeeds,
  EXPANSION_GROUPS,
  groupStats,
  mergeObservations,
  recurring,
  rowsToMarkdown,
  seedBudget,
  suggestionTokens,
  CLIENTS,
  LANGS,
  REGIONS,
  VERTICALS,
  type GatherObservation,
  type SuggestVertical,
} from "../lib/suggestCore";
import { motor } from "../lib/motor";

const DEFAULT_GROUPS = EXPANSION_GROUPS.map((g) => g.id);

interface RunState {
  done: number;
  total: number;
  label: string;
}

export function Suggest() {
  const [term, setTerm] = useState("");
  const [region, setRegion] = useState("br");
  const [lang, setLang] = useState("");
  const [client, setClient] = useState("chrome");
  const [vertical, setVertical] = useState<SuggestVertical>("web");
  const [groupIds, setGroupIds] = useState<string[]>(DEFAULT_GROUPS);
  const [limit, setLimit] = useState(10);
  const [rows, setRows] = useState<ReturnType<typeof mergeObservations>>([]);
  const [obs, setObs] = useState<GatherObservation[]>([]);
  const [run, setRun] = useState<RunState | null>(null);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const seeds = useMemo(
    () => buildSeeds(term, EXPANSION_GROUPS.filter((g) => groupIds.includes(g.id))),
    [term, groupIds],
  );
  const orcamento = useMemo(() => seedBudget(term, groupIds), [term, groupIds]);

  const toggleGroup = (id: string) =>
    setGroupIds((prev) => prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]);

  const canRun = term.trim().length > 0 && groupIds.length > 0 && !run;

  const runColeta = async () => {
    if (!canRun) return;
    abortRef.current?.abort();
    const ab = new AbortController();
    abortRef.current = ab;
    setError("");
    const source = motor.adapters.get("suggest");
    if (!source) {
      setError("Fonte suggest não disponível neste ambiente.");
      return;
    }
    const all: GatherObservation[] = [];
    let done = 0;
    const total = seeds.length;
    setRun({ done: 0, total, label: "Iniciando…" });
    try {
for (let i =  0; i < seeds.length; i += 4) {
if (ab.signal.aborted) throw new Error("cancelado");
        const batch = seeds.slice(i, i + 4);
        setRun({ done, total, label: `${batch[0]?.seed}…` });
        const out = await Promise.all(
          batch.map(async (s) => {
            if (ab.signal.aborted) return null;
            try {
              const resp = await source.collect({
                query: s.seed,
                country: region,
                engine: vertical,
                language: lang || undefined,
                limit,
                signal: ab.signal,
              });
              return resp.items.map((it) => ({
                item: { text: it.title, relevance: it.score ?? 0 },
                seed: s.seed,
                group: s.group,
                groupLabel: s.groupLabel,
                region,
                vertical,
              }) as GatherObservation);
            } catch {
              return null;
            }
          }),
        );
        for (const o of out.flat()) {
          if (o) all.push(o);
        }
        done += batch.length;
        setRun({ done, total, label: `sondas ${done}/${total}` });
      }

const merged = mergeObservations(all);
      setObs(all);
      setRows(merged);
      setRun({ done: total, total, label: `${merged.length} sugestões únicas` });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!ab.signal.aborted) abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const stats = useMemo(() => groupStats(obs), [obs]);
  const tokens = useMemo(() => suggestionTokens(rows, 30), [rows]);
  const recorrentes = useMemo(() => recurring(rows, 2).slice(0, 8), [rows]);
  const md = useMemo(() => rowsToMarkdown(term || "suggest", rows), [rows, term]);

  const copyMd = () => {
    navigator.clipboard?.writeText(md).then(
      () => setError("Markdown copiado!"),
      () => setError("Clipboard indisponível"),
    );
  };

  return (
    <div className="stack" style={{ gap: "2rem" }}>
      <header className="stack" style={{ gap: "0.5rem" }}>
        <h1 className="fluid-display">Suggest Explorer</h1>
        <p className="muted">
          Autocomplete do Google — configure, colete no navegador e analise:, verticais, regiões e expansão de sondas.

        </p>
      </header>

      <section className="card stack" style={{ gap: "1rem" }}>
        <h2 className="fluid-title">Configuração</h2>
        <div className="form-field">
          <label htmlFor="s-term">Termo</label>
          <input id="s-term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="ex.: python, café, iphone…" />
        </div>
        <div className="grid-auto">
          <div className="form-field">
            <label htmlFor="s-region">Região</label>
            <select id="s-region" value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="s-lang">Idioma</label>
            <select id="s-lang" value={lang} onChange={(e) => setLang(e.target.value)}>
              {LANGS.map((l) => <option key={l.id || "auto"} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="s-client">Client</label>
            <select id="s-client" value={client} onChange={(e) => setClient(e.target.value)}>
              {CLIENTS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="s-vertical">Vertical</label>
            <select id="s-vertical" value={vertical} onChange={(e) => setVertical(e.target.value as SuggestVertical)}>
              {VERTICALS.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="s-limit">Limite / sonda</label>
            <input id="s-limit" type="number" min={1} max={50} value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
          </div>
        </div>

        <div>
          <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
            <span className="muted text-sm">Grupos de expansão</span>
            <span className="badge">{orcamento} sondas</span>
          </div>
          <div className="wrap" style={{ gap: "0.5rem" }}>
            {EXPANSION_GROUPS.map((g) => (
              <label key={g.id} className="badge badge-outline" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={groupIds.includes(g.id)}
                  onChange={() => toggleGroup(g.id)}
                  style={{ accentColor: "hsl(var(--primary))" }}
                />
                {g.label}
              </label>
            ))}
          </div>
        </div>

        <div className="wrap">
          <button type="button" className="btn" onClick={runColeta} disabled={!canRun}>
            {run ? `Coletando… ${run.done}/${run.total}` : `Coletar (${orcamento} sondas}`}
          </button>
          {run && (
            <button type="button" className="btn btn-secondary" onClick={stop}>Parar</button>
          )}
        </div>
        {run && (
          <div role="progressbar" aria-valuenow={run.done} aria-valuemin={0} aria-valuemax={run.total} className="proto">
            <div className="proto-bar" style={{ width: `${run.total ? (run.done / run.total) * 100 : 0}%` }} />
          </div>
        )}
        {error && <p className="muted text-sm" role="status">{error}</p>}
      </section>

      {rows.length > 0 && (
        <>
          <section className="card stack" style={{ gap: "1rem" }}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <h2 className="fluid-title">Resultados — {rows.length} únicas</h2>
              <button type="button" className="btn btn-secondary btn-sm" onClick={copyMd}>Copiar Markdown</button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Sugestão</th><th>Relev.</th><th>Recorr.</th><th>Grupos</th><th>Verticais</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={r.text}>
                      <td className="muted">{i + 1}</td>
                      <td>{r.text}</td>
                      <td>{r.relevance}</td>
                      <td>{r.occurrences}</td>
                      <td className="muted text-sm">{r.groups.slice(0, 4).join(", ")}</td>
                      <td className="muted text-sm">{r.verticals.join(", ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid-auto">
            <section className="card stack" style={{ gap: "0.75rem" }}>
              <h3>Rendimento por grupo</h3>
              {stats.map((s) => (
                <div key={s.group} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="muted text-sm">{s.label}</span>
                  <span>{s.unique} únicas · {s.seeds} sondas</span>
                </div>
              ))}
            </section>
            <section className="card stack" style={{ gap: "0.75rem" }}>
              <h3>Termos frequentes</h3>
              <div className="wrap" style={{ gap: "0.4rem" }}>
                {tokens.slice(0,  16).map((t) => (
                  <span key={t.text} className="badge" style={{ fontSize: `${Math.min(1.1, 0.75 + t.value * 0.04)}rem` }}>
                    {t.text} × {t.value}
                  </span>
                ))}
              </div>
            </section>
            <section className="card stack" style={{ gap: "0.75rem" }}>
              <h3>Recorrentes (≥2 sondas)</h3>
              {recorrentes.length === 0 && <p className="muted text-sm">Nenhuma ainda.</p>}
              {recorrentes.map((r) => (
                <div key={r.text} className="row" style={{ justifyContent: "space-between" }}>
                  <span className="text-sm">{r.text}</span>
                  <span className="muted text-sm">× {r.occurrences}</span>
                </div>
              ))}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
