import { NavLink, Outlet, Link } from "react-router";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/fontes", label: "Fontes" },
  { to: "/auditoria", label: "Auditoria" },
  { to: "/dataset", label: "Dataset" },
];

export function Shell() {
  return (
    <div className="shell">
      <header className="shell-header">
        <Link to="/" className="shell-brand">
          DataReview <small>v4</small>
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
        núcleo hexagonal (contracts · domain · sources) + API Express + front enxuto.
        Fontes documentadas em <span className="kbd">docs/SOURCES.md</span>
      </footer>
    </div>
  );
}