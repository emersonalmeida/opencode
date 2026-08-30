import { useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Layers, PanelLeftClose, Sparkles, PanelLeftOpen, HelpCircle, ArrowUpRight,
  Search, X,
} from "lucide-react";
import { RailHover } from "@/components/shared/RailHover";
import { resetOnboarding } from "@/components/OnboardingModal";
import { PageGroupsNav } from "@/components/PageGroupsNav";
import { PageMenuLink } from "@/components/PageMenuLink";
import { useFeatureFlags, isFeatureEnabled, pagePathToFlag } from "@/lib/featureFlags";
import { PAGES, pageNumber } from "@/lib/pages";

interface LeftSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/**
 * Sidebar esquerda EXTERNA — menu de páginas (navegação unificada). Conteúdo
 * fixo, nunca muda por página. Modelo das 5 colunas:
 *   [Externa: Páginas] [Interna da página] [CENTRO] [Interna da página] [Externa: IA]
 * CENTRO = conteúdo principal. As internas ficam ao lado (PageSidebarsContext).
 */
export function LeftSidebar({ collapsed, onToggle }: LeftSidebarProps) {
  useFeatureFlags(); // re-render live quando flags mudam
  const location = useLocation();
  const navigate = useNavigate();
  const [menuQuery, setMenuQuery] = useState("");
  const pages = PAGES.filter((p) => { const fk = pagePathToFlag(p.path); return !fk || isFeatureEnabled(fk); });
  const isActive = (path: string) =>
    location.pathname === path || (path !== "/" && location.pathname.startsWith(path + "/"));

  // Busca no menu: filtra por label, descrição ou path (case/acento-insensível).
  const normalizedQuery = useMemo(
    () => menuQuery.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
    [menuQuery],
  );
  const filteredPages = useMemo(() => {
    if (!normalizedQuery) return pages;
    return pages.filter((p) => {
      const hay = `${p.label} ${p.desc ?? ""} ${p.path}`
        .toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      return hay.includes(normalizedQuery);
    });
  }, [pages, normalizedQuery]);
  const searching = normalizedQuery.length > 0;

  if (collapsed) {
    return (
      <aside className="hidden md:flex h-full flex-col items-center gap-1 py-3 w-full border-r border-border/50 bg-card/40 backdrop-blur-sm overflow-y-auto">
        <RailHover
          side="right"
          label="Expandir menu de páginas"
          trigger={
            <button onClick={onToggle} aria-label="Expandir menu de páginas" className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          }
        />
        <div className="w-8 h-px bg-border/40 my-0.5" />
        {pages.map((p) => {
          const Icon = p.icon;
          return (
            <RailHover
              key={p.path}
              side="right"
              width={280}
              label={`${pageNumber(p.path)}. ${p.label}`}
              icon={<Icon className="h-3.5 w-3.5" />}
              content={
                <div className="p-3 space-y-2">
                  {p.desc && <p className="text-[11px] text-muted-foreground leading-snug">{p.desc}</p>}
                  <button
                    onClick={() => { if (p.external) { window.location.assign(p.path); } else { navigate(p.path); } }}
                    className="w-full flex items-center justify-center gap-1.5 text-[11px] font-medium px-2.5 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    Abrir página <ArrowUpRight className="h-3 w-3" />
                  </button>
                  <p className="text-[9px] text-muted-foreground/70 leading-snug">
                    Clicar no ícone abre a página e expande o menu.
                  </p>
                </div>
              }
              trigger={
                <button
                  onClick={() => { if (p.external) { window.location.assign(p.path); return; } navigate(p.path); onToggle(); }}
                  aria-label={`Ir para ${p.label}`}
                  aria-current={isActive(p.path) ? "page" : undefined}
                  className={`p-2 rounded-lg transition-colors ${isActive(p.path) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              }
            />
          );
        })}
        <div className="flex-1" />
        <RailHover
          side="right"
          label="App Intelligence"
          trigger={
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
          }
        />
      </aside>
    );
  }

  return (
    <aside className="hidden md:flex h-full flex-col w-full border-r border-border/50 bg-card/40 backdrop-blur-sm">
      {/* Brand + collapse */}
      <div className="p-3 flex items-center gap-2 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Layers className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">App Intelligence</p>
          <p className="text-[10px] text-muted-foreground truncate">Análise Apple + Google</p>
        </div>
        <button onClick={onToggle} title="Recolher" aria-label="Recolher menu de páginas" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Busca do menu — filtra as páginas por label/descrição/path. Com texto,
          mostra lista plana de resultados (sem grupos); vazia, volta ao modo
          normal (grupos ou lista plana conforme a flag). */}
      <div className="px-2 pb-1.5 flex-shrink-0" role="search">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={menuQuery}
            onChange={(e) => setMenuQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") setMenuQuery(""); }}
            placeholder="Buscar página…"
            aria-label="Buscar página no menu"
            className="w-full h-8 pl-7 pr-7 rounded-md border border-border/60 bg-background/60 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/60 placeholder:text-muted-foreground/70"
          />
          {menuQuery && (
            <button
              onClick={() => setMenuQuery("")}
              aria-label="Limpar busca do menu"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Menu de páginas — a ÚNICA lista de navegação do sistema. Com a flag
          `ui.page-groups` (default ON) organiza em grupos/workspaces
          expansíveis; desligada, cai na lista plana. */}
      <nav aria-label="Páginas do sistema" className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        <p className="px-1 pb-1.5 text-[9px] font-medium text-muted-foreground uppercase tracking-wider" role={searching ? "status" : undefined}>
          {searching ? `${filteredPages.length} resultado(s)` : "Navegação"}
        </p>
        {searching ? (
          filteredPages.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Nenhuma página corresponde a “{menuQuery}”.
            </p>
          ) : (
            filteredPages.map((p) => (
              <PageMenuLink key={p.path} page={p} active={isActive(p.path)} onClick={() => setMenuQuery("")} />
            ))
          )
        ) : isFeatureEnabled("ui.page-groups") ? (
          <PageGroupsNav isActive={isActive} />
        ) : (
          pages.map((p) => (
            <PageMenuLink key={p.path} page={p} active={isActive(p.path)} />
          ))
        )}
      </nav>

      {isFeatureEnabled("ui.onboarding-tour") && (
        <div className="p-2 border-t border-border/40 flex-shrink-0">
          <button onClick={resetOnboarding} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <HelpCircle className="h-3.5 w-3.5" /> Rever tour
          </button>
        </div>
      )}
    </aside>
  );
}
