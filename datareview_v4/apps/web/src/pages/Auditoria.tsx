import { useEffect, useState } from "react";
import { getAudit, type AuditResponse } from "../lib/api";

function statusBadge(status: string): { label: string; color: string } {
  switch (status) {
    case "audited":
      return { label: "AUDITADO", color: "oklch(0.6 0.18 150)" };
    case "in-progress":
      return { label: "EM PROGRESSO", color: "oklch(0.7 0.16 80)" };
    default:
      return { label: "PENDENTE", color: "hsl(var(--muted-foreground))" };
  }
}

export function Auditoria() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    getAudit()
      .then((d) => {
        if (cancelled) return;
        setData(d);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryTotals = data
    ? Object.entries(data.categories).sort((a, b) => b[1] - a[1])
    : [];

  const entries = data
    ? data.entries.filter((e) => {
        if (!filter) return true;
        const hay = [e.id, e.name, e.category, e.status, e.sourceId]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(filter.toLowerCase());
      })
    : [];

  const countBy = (pred: (s: string) => boolean) =>
    data ? data.entries.filter((e) => pred(e.status)).length : 0;

  return (
    <>
      <h1>Auditoria</h1>
      <p className="muted" style={{ marginTop: "-0.25rem" }}>
        Registry declarativo das fontes do sistema (espelho do <span className="kbd">/auditoria</span> do
        v1) — audítadas: <strong>{countBy((s) => s === "audited")}</strong> · em progresso:{" "}
        <strong>{countBy((s) => s === "in-progress")}</strong> · pendentes:{" "}
        <strong>{countBy((s) => s === "pending")}</strong>. Total:{" "}
        <strong>{data?.entries.length ?? "…"}</strong>
      </p>

      {error && <p style={{ color: "hsl(var(--destructive))" }}>Erro: {error}</p>}

      {categoryTotals.length > 0 && (
        <div className="metrics" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {categoryTotals.map(([cat, n]) => (
            <div key={cat} className="metric">
              <div className="value">{n}</div>
              <div className="label">{cat}</div>
            </div>
          ))}
        </div>
      )}

      {data && (
        <div className="card" style={{ padding: "0.75rem" }}>
          <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", marginBottom: "0.75rem" }}>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por id, nome, categoria, status…"
              style={{ flex: 1 }}
            />
            <span className="muted" style={{ fontSize: "0.85rem" }}>
              {entries.length} itens
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
            <thead>
              <tr style={{ textAlign: "left", color: "hsl(var(--muted-foreground))" }}>
                <th>#</th>
                <th>Fonte</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Coletor</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const badge = statusBadge(e.status);
                return (
                  <tr key={e.id} style={{ borderTop: "1px solid hsl(var(--border))" }}>
                    <td className="muted">{e.order}</td>
                    <td>
                      <strong>{e.name}</strong>
                      <div className="muted" style={{ fontSize: "0.78rem" }}>
                        {e.id} · {e.sourceId}
                      </div>
                    </td>
                    <td>{e.category}</td>
                    <td>
                      <span style={{ color: badge.color, fontWeight: 600 }}>{badge.label}</span>
                    </td>
                    <td>{e.implemented ? "SIM" : "—"}</td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted" style={{ paddingTop: "1rem" }}>
                    Nenhum item corresponde ao filtro.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}