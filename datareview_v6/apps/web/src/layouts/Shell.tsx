import { NavLink, Outlet, Link } from "react-router";
import { useState } from "react";

const NAV = [
  { to: "/", label: "Home", end: true },
  { to: "/design-system", label: "Design System" },
  { to: "/suggest", label: "Suggest" },
  { to: "/coleta", label: "Coleta" },
  { to: "/fontes", label: "Fontes" },
];

export function Shell() {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <header className="shell-header">
        <Link to="/" className="shell-brand" onClick={() => setOpen(false)}>
          DataReview <small>v6</small>
        </Link>
        <button
          type="button"
          className="btn btn-ghost shell-nav-toggle"
          aria-label="Abrir menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          ☰
        </button>
        <nav className={open ? "shell-nav open" : "shell-nav"}>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} onClick={() => setOpen(false)}>
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