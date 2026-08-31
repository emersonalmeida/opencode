import { Link } from "react-router";

export function NotFound() {
  return (
    <div className="card">
      <h1>Página não encontrada</h1>
      <p className="muted">A rota não existe no front da v6.</p>
      <p><Link to="/"><strong>Voltar para a Home</strong></Link></p>
    </div>
  );
}
