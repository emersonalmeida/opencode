import { Route, Routes } from "react-router";
import { Shell } from "./layouts/Shell";
import { Home } from "./pages/Home";
import { Fontes } from "./pages/Fontes";
import { Auditoria } from "./pages/Auditoria";
import { Dataset } from "./pages/Dataset";
import { NotFound } from "./pages/NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="fontes" element={<Fontes />} />
        <Route path="auditoria" element={<Auditoria />} />
        <Route path="dataset" element={<Dataset />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}