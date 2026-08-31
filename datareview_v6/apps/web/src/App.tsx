import { Route, Routes } from "react-router";
import { Shell } from "./layouts/Shell";
import { Home } from "./pages/Home";
import { Coleta } from "./pages/Coleta";
import { Fontes } from "./pages/Fontes";
import { DesignSystem } from "./pages/DesignSystem";
import { Suggest } from "./pages/Suggest";
import { NotFound } from "./pages/NotFound";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="design-system" element={<DesignSystem />} />
        <Route path="suggest" element={<Suggest />} />
        <Route path="coleta" element={<Coleta />} />
        <Route path="fontes" element={<Fontes />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
