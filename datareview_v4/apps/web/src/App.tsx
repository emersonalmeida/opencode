import { Navigate, Route, Routes } from "react-router";
import { Shell } from "./layouts/Shell";
import { Home } from "./pages/Home";
import { Fontes } from "./pages/Fontes";
import { NotFound } from "./pages/NotFound";

/** Rotas do front enxuto (design da v1, sem o excesso das ~63 páginas do legado).
 *  Auditoria/Dataset chegam nos próximos commits incrementais. */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="fontes" element={<Fontes />} />
        <Route path="auditoria" element={<Navigate to="/" replace />} />
        <Route path="dataset" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}