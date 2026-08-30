import { useEffect, useMemo, useState } from "react";
import { ThemeProvider, useTheme } from "./components/atoms/ThemeProvider";
import { HomeTemplate } from "./components/templates/HomeTemplate";
import { SuggestPage } from "./components/pages/SuggestPage";
import { DesignSystemPage } from "./components/pages/DesignSystemPage";
import { AUDIT_REGISTRY, sourceStats } from "@v3/sources/audit";

const SOURCES = AUDIT_REGISTRY.map((e) => ({
  key: e.id,
  name: e.name,
  status: e.status === "audited" ? "Auditada" : e.status,
  category: e.category,
  summary: e.summary,
}));

const STATS = sourceStats(AUDIT_REGISTRY);

function Shell() {
  const { theme, toggleTheme } = useTheme();
  const [route, setRoute] = useState(() => window.location.hash);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const filtered = useMemo(
    () => SOURCES.filter((s) => s.name.toLowerCase().includes(query.toLowerCase())),
    [query],
  );
  const stats = { audited: STATS.audited, implemented: STATS.implemented, partial: STATS.inProgress };
  if (route.startsWith("#/suggest")) {
    return <SuggestPage />;
  }
  if (route.startsWith("#/design-system")) {
    return <DesignSystemPage theme={theme} onToggleTheme={toggleTheme} />;
  }
  return (
    <HomeTemplate
      theme={theme}
      onToggleTheme={toggleTheme}
      sources={filtered}
      stats={stats}
      onStartToSources={() => {
        document.getElementById("fontes")?.scrollIntoView({ behavior: "smooth" });
      }}
      onSuggest={() => {
        window.location.hash = "#/suggest";
        setRoute(window.location.hash);
      }}
      query={query}
      onQueryChange={setQuery}
    />
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <a className="skip-link" href="#main">P para o conteúdo</a>
      <Shell />
    </ThemeProvider>
  );
}
