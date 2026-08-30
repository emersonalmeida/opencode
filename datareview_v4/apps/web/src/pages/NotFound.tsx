export function NotFound() {
  return (
    <div className="card">
      <h2>Página não encontrada</h2>
      <p className="muted">
        A rota pedida não existe no front enxuto da v4. Volte para a{" "}
        <a href="/">Home</a>.
      </p>
    </div>
  );
}