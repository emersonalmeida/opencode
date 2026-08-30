import { useNavigate } from "react-router-dom";
import { Menu, LayoutDashboard, Home as HomeIcon, MessageSquare, Settings2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { HeroSection } from "@/components/HeroSection";
import { TopCharts } from "@/components/TopCharts";

const MENU_LINKS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/inicio", label: "Coleta", icon: HomeIcon },
  { path: "/chat", label: "Chat", icon: MessageSquare },
  { path: "/configuracoes", label: "Configurações", icon: Settings2 },
];

/**
 * Página inicial do sistema (`/`) - duplicata ENXUTA da página de coleta
 * (`/inicio`): apenas o hero (sem o passo a passo 01-04) e a seção
 * Top Charts (top 50 por padrão). Removidas tambem "seu loop", "acesso
 * rapido" e "continue de onde parou". Header com busca e menu, e segunda
 * busca abaixo do paragrafo do hero - conforme pedido (2026-08-29).
 * A pagina de coleta original (`/inicio`) continua intocada no grupo Backup.
 */

export default function HomeLite() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Início"
        extraMenu={
          <details className="relative group">
            <summary
              className="list-none [&::-webkit-details-marker]:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors cursor-pointer"
              title="Menu de navegação"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="h-4 w-4" />
            </summary>
            <nav
              aria-label="Menu de navegação rápida"
              className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-lg p-1.5 z-40"
            >
              {MENU_LINKS.map((l) => (
                <button
                  key={l.path}
                  onClick={() => navigate(l.path)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-secondary transition-colors"
                >
                  <l.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {l.label}
                </button>
              ))}
            </nav>
          </details>
        }
      />
      <div className="w-full py-10 px-4 sm:px-6 lg:px-8 space-y-12">
        <HeroSection showSteps={false} searchBelow={<GlobalSearchBar align="left" />} />
        <TopCharts />
      </div>
    </div>
  );
}
