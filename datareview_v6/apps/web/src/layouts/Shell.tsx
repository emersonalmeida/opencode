import { NavLink, Outlet, Link } from "react-router";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/coleta", label: "Coleta" },
  { to: "/fontes", label: "Fontes" },
];

export function Shell() {
  return (
    <div className="shell">
      <header className="shell-header">
        <Link to="/" className="shell-brand">
          DataReview <small>v6</small>
        </Link>
        <nav className="shell-nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="shell-main">
        <Outlet />
      </main>
      <footer className="shell-footer">
        front da v1 sobre o motor v6 — núcleo hexagonal (contracts · domain · sources) sem backend.
        Fontes públicas ativas por padrão; demais no catálogo via opt-in.

      </footer>
    </div>
  );
}