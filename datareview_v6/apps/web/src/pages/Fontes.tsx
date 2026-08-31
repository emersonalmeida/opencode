import { catalogo, grupos } from "../lib/motor";
import type { SourceCatalogEntry } from "@v6/sources";

const GRUPOS: Record<string, string> = {
  uni: "Coleta direta (rotas uni-*",
  connectors: "Conectores declarativos",
  discover: "Descoberta — sub-fontes sem chave",
  stores: "Lojas de apps e reviews",
  knowledge: "Enciclopédias/conhecimento",
};

function Badge({ children, tone }: { children: string; tone: "ok" | "auth" | "muted" }) {
  return <span className={"badge badge-" + tone}>{children}</span>;
}

export function Fontes() {
  const total = catalogo.length;
  const ativasCount = catalogo.filter((f) => f.enabledByDefault).length;

  return (
    <>
      <h1>Fontes — catálogo do motor v6</h1>
      <p className="muted" style={{ marginTop: "-0.25rem" }}>
        {total} fontes catalogadas · {ativasCount} ativas por padrão · grupos: uni (17) ·
        connectors (17) · discover (17) · stores (3) · knowledge (5).
      </p>
      <div className="metrics">
        <div className="metric">
          <div className="value">{total}</div>
          <div className="label">Fontes no catálogo</div>
        </div>
        <div className="metric">
          <div className="value">{ativasCount}</div>
          <div className="label">Coletor ativo (padrão)</div>
        </div>
        <div className="metric">
          <div className="value">{Object.keys(grupos).length}</div>
          <div className="label">Grupos</div>
        </div>
      </div>
      {Object.entries(grupos).map(([g, n]) => (
        <section key={g} className="card" style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.35rem" }}>{g} <small className="muted">· {GRUPOS[g]} · {n} fontes</small></h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr> <th>Fonte</th> <th>Auth</th> <th>Método</th> <th>Status</th> </tr>
            </thead>
            <tbody>
              {catalogo.filter((f: SourceCatalogEntry) => f.group === g).map((f) => (
                <tr key={f.id} style={{ borderTop: "1px solid hsl(var(--border))" }}>
                  <td>
                    <strong>{f.label}</strong>
                    <div className="muted" style={{ fontSize: "0.75rem" }}>
                      {f.id}
                    </div>
                  </td>
                  <td><Badge tone={f.auth === "none" ? "ok" : f.auth === "byok" ? "auth" : "muted"}>{f.auth}</Badge></td>
                  <td className="muted">{f.method}</td>
                  <td><Badge tone={f.status === "implemented" ? "ok" : "muted"}>{f.status}</Badge></td>
                </tr>
))}
            </tbody>
          </table>
        </section>
))}
    </>
  );
}
