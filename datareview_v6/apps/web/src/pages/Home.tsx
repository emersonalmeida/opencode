import { Link } from "react-router";
import { catalogo, grupos, ativas } from "../lib/motor";

export function Home() {
  const total = catalogo.length;
  const porGrupo = Object.entries(grupos);
  const ativasList = ativas;

  return (
    <>
      <h1>Coleta e análise multi-fonte de dados públicos</h1>
      <p className="muted" style={{ marginTop: "-0.25rem" }}>
        Front da v1 sobre o motor v6 — núcleo hexagonal sem backend. 8
        fontes públicas ativas por padrão; catálogo completo com opt-in.
      </p>

      <div className="metrics">
        <div className="metric">
          <div className="value">{total}</div>
          <div className="label">Fontes catalogadas</div>
        </div>
        <div className="metric">
          <div className="value">{ativasList.length}</div>
          <div className="label">Coletor ativo</div>
        </div>
        <div className="metric">
          <div className="value">{porGrupo.length}</div>
          <div className="label">Grupos</div>
        </div>
      </div>

      <h2 style={{ fontSize: "1rem" }}>Grupos de fontes</h2>
      <div className="row">
        {porGrupo.map(([g, n]: [string, number]) => (
          <div key={g} className="card" style={{ minWidth: "220px" }}>
            <div className="muted" style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {g}
            </div>
            <div style={{ fontWeight: 700, fontSize: "1.2rem" }}>{n}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h2>Fontes ativas por padrão</h2>
        <p>
          {ativasList.map((id) => (
            <span key={id} className="kbd" style={{ marginRight: "0.4rem" }}>{id}</span>
))}
        </p>
        <p className="muted" style={{ marginTop: "0.75rem" }}>
          Teste qualquer fonte em <Link to="/coleta"><strong>Coleta</strong></Link> ou
          veja o catálogo completo em <Link to="/fontes"><strong>Fontes</strong></Link>.
        </p>
      </div>
    </>
  );
}
