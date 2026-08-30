import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getCatalog, getStats, type CatalogResponse, type Stats } from "../lib/api";
import { statusLabel } from "../lib/format";

export function Home() {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getCatalog(), getStats()])
      .then(([cat, st]) => {
        if (cancelled) return;
        setCatalog(cat);
        setStats(st);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const implemented = catalog?.sources.filter((s) => s.status === "implemented").length ?? 0;
  const bridge = catalog ? catalog.total - implemented : 0;

  return (
    <>
      <h1>Coleta e análise multi-fonte de dados públicos</h1>
      <p className="muted" style={{ marginTop: "-0.25rem" }}>
        Núcleo hexagonal da v4: 1 interface de fonte (<span className="kbd">SourcePort</span>), N
        fontes, pipeline canônico determinístico.
      </p>

      {error && (
        <div className="card" style={{ borderColor: "hsl(var(--destructive))" }}>
          <strong>API indisponível:</strong> {error}
          <div className="muted" style={{ marginTop: "0.35rem" }}>
            Rode <span className="kbd">pnpm --filter @v4/api dev</span> (porta 8787) — em dev o
            front encaminha <span className="kbd">/api</span> via proxy do Vite.
          </div>
        </div>
      )}

      <div className="metrics">
        <div className="metric">
          <div className="value">{catalog?.total ?? "…"}</div>
          <div className="label">Fontes catalogadas</div>
        </div>
        <div className="metric">
          <div className="value">{stats?.total ?? "…"}</div>
          <div className="label">Itens no dataset</div>
        </div>
        <div className="metric">
          <div className="value">{implemented || "…"}</div>
          <div className="label">Coletor ativo</div>
        </div>
        <div className="metric">
          <div className="value">{bridge || "…"}</div>
          <div className="label">Ponte (v1)</div>
        </div>
      </div>

      {catalog && (
        <>
          <h2 style={{ fontSize: "1rem" }}>Grupos de fontes</h2>
          <div className="row">
            {Object.entries(catalog.byGroup).map(([group, count]) => (
              <div key={group} className="card" style={{ minWidth: "220px" }}>
                <div className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {group}
                </div>
                <div style={{ fontWeight: 700, fontSize: "1.2rem" }}>{count}</div>
              </div>
            ))}
          </div>

          {implemented > 0 && (
            <div className="card" style={{ marginTop: "1rem" }}>
              <h2>Fontes com coletor ativo</h2>
              <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
                {catalog.sources
                  .filter((s) => s.status === "implemented")
                  .map((s) => (
                    <li key={s.id}>
                      <strong>{s.label}</strong>{" "}
                      <span className="kbd">{statusLabel(s.status)}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <p className="muted" style={{ marginTop: "1.25rem" }}>
            Teste qualquer fonte em{" "}
            <Link to="/fontes">
              <strong>Fontes</strong>
            </Link>{" "}
            (catálogo completo, 59 fontes) ou veja o{" "}
            <Link to="/auditoria">
              <strong>audit</strong>
            </Link>
            .
          </p>
        </>
      )}
    </>
  );
}