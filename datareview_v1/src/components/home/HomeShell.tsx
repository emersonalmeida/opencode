/**
 * HomeShell — a estrutura da página Home (modelo mobile-first, responsivo):
 *
 *   ┌ STATUS BAR (topo, 100%) ┐
 *   ├ HEADER (ícone · TÍTULO · ícone) ┤
 *   ├ ABAS (SidebarTabStrip — a strip única do sistema) ┤
 *   ├ CONTEÚDO rolável (título + seções → componentes + botão full-width) ┤
 *   ├ TASK BAR (5 ícones de navegação real) ┤
 *   └ STATUS BAR (footer, 100%) ┘
 *
 * Comportamentos:
 *  - Mobile-first e CONTAINER-relacional (ResizeObserver na própria página —
 *    NÃO media query de viewport): `phone` < 640px, `tablet` < 1024px,
 *    senão `desktop`. O grid de componentes e os rótulos da task bar mudam
 *    com o modo (ver `homeModel`).
 *  - As barras (status/header/abas/task bar/footer) são fixas (`flex-shrink-0`);
 *    só o CONTEÚDO rola (`flex-1 overflow-y-auto`) — padrão de app móvel.
 *  - Abas trocam o conteúdo de verdade e a aba ativa persiste
 *    (`aso:home-tab:v1`). Botões de ação e task bar navegam para rotas reais.
 *  - A11y: status bars com role=status, header como banner, strip com
 *    role=tablist/tab, conteúdo como região principal, task bar como
 *    navigation nomeada, footer contentinfo; o botão de info de cada
 *    componente usa aria-expanded e revela a descrição inline.
 */
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { House, Info, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTabStrip } from "@/components/shared/SidebarTabStrip";
import {
  HOME_TABS, HOME_TASKBAR, contentMaxWidth, componentGridCols, getHomeTab,
  homeShellMode, loadHomeTab, saveHomeTab,
  type HomeComponentSpec, type HomeShellMode,
} from "@/lib/home/homeModel";
import { cn } from "@/lib/utils";

/** Relógio isolado — re-renderiza só a célula, nunca o shell inteiro. */
function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span className="tabular-nums" aria-label="Hora atual">
      {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}

const MODE_LABEL: Record<HomeShellMode, string> = {
  phone: "mobile",
  tablet: "tablet",
  desktop: "desktop",
};

/** Card de componente (placeholder estrutural com botão de info). */
function ComponentCard({ spec }: { spec: HomeComponentSpec }) {
  const [infoOpen, setInfoOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center gap-1.5 border-b border-border/50 px-3 py-2">
        <span className="flex-1 min-w-0 truncate text-xs font-medium text-foreground">{spec.title}</span>
        <button
          type="button"
          onClick={() => setInfoOpen((v) => !v)}
          aria-expanded={infoOpen}
          aria-label={`Sobre o componente ${spec.title}`}
          title={`Sobre o componente ${spec.title}`}
          className={cn(
            "p-1 rounded-md transition-colors flex-shrink-0",
            infoOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary",
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {infoOpen && (
        <p className="px-3 pt-2 text-[11px] leading-relaxed text-muted-foreground">{spec.desc}</p>
      )}
      <div className="space-y-2 px-3 py-3" aria-hidden="true">
        {spec.lines.map((w, i) => (
          <div key={i} className="h-2 rounded bg-muted-foreground/20" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

export function HomeShell({ forceWidth }: { forceWidth?: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(0);
  const [tabId, setTabId] = useState(loadHomeTab);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (forceWidth != null) return;
    const el = rootRef.current;
    if (!el) return;
    setMeasured(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      setMeasured(entries[0]?.contentRect.width ?? el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [forceWidth]);

  const containerWidth = forceWidth ?? measured;
  const mode: HomeShellMode = containerWidth > 0 ? homeShellMode(containerWidth) : "phone";
  const tab = getHomeTab(tabId);

  const changeTab = (id: string) => {
    setTabId(id);
    saveHomeTab(id);
  };

  return (
    <div ref={rootRef} className="h-full min-h-0 w-full flex flex-col overflow-hidden bg-background">
      {/* STATUS BAR (topo, 100%) */}
      <div
        id="home-status"
        role="status"
        aria-label="Status da Home"
        className="h-6 flex items-center justify-between gap-2 px-3 border-b border-border/50 bg-secondary/40 text-[10px] text-muted-foreground flex-shrink-0 overflow-hidden"
      >
        <span className="truncate">Home · modelo mobile-first</span>
        <span className="truncate tabular-nums">
          {MODE_LABEL[mode]}{containerWidth > 0 && ` · ${Math.round(containerWidth)}px`} · <Clock />
        </span>
      </div>

      {/* HEADER (ícone · TÍTULO · ícone) */}
      <header className="flex items-center gap-2 px-2 py-1.5 border-b border-border/50 bg-card/50 flex-shrink-0">
        <button
          type="button"
          onClick={() => changeTab(HOME_TABS[0].id)}
          aria-label="Ir para a aba inicial"
          title="Ir para a aba inicial"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
        >
          <House className="h-4 w-4" aria-hidden="true" />
        </button>
        <h1 className="flex-1 min-w-0 text-center text-sm font-semibold text-foreground truncate">Home</h1>
        <button
          type="button"
          onClick={() => navigate("/configuracoes")}
          aria-label="Abrir Configurações"
          title="Abrir Configurações"
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      {/* ABAS (strip única do sistema; centraliza quando há espaço) */}
      <div id="home-tabs">
        <SidebarTabStrip
          tabs={HOME_TABS.map((t) => ({ id: t.id, label: t.label, icon: <t.icon className="h-3.5 w-3.5" aria-hidden="true" /> }))}
          active={tab.id}
          onChange={changeTab}
          ariaLabel="Abas da Home"
          centered={mode !== "phone"}
          className="bg-card/30"
        />
      </div>

      {/* CONTEÚDO rolável */}
      <main
        id="home-content"
        role="main"
        aria-label={`Conteúdo da aba ${tab.label}`}
        className="flex-1 min-h-0 overflow-y-auto"
      >
        <div className={cn("mx-auto w-full px-3 py-4 space-y-5", contentMaxWidth(mode))}>
          <div>
            <h2 className="text-base font-semibold text-foreground">{tab.pageTitle}</h2>
            <div className="mt-2 h-px bg-border/60" aria-hidden="true" />
          </div>

          {tab.sections.map((section) => (
            <section key={section.id} aria-labelledby={`home-sec-${section.id}`} className="space-y-2.5">
              <h3 id={`home-sec-${section.id}`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
              <div className={cn("grid gap-2.5", componentGridCols(mode))}>
                {section.components.map((c) => (
                  <ComponentCard key={c.id} spec={c} />
                ))}
              </div>
              <Button
                className="w-full"
                onClick={() => navigate(section.action.path)}
                aria-label={`${section.action.label} (seção ${section.title})`}
              >
                {section.action.label}
              </Button>
            </section>
          ))}
        </div>
      </main>

      {/* TASK BAR (5 ícones, navegação real; rótulos a partir do modo tablet) */}
      <nav
        id="home-taskbar"
        role="navigation"
        aria-label="Task bar"
        className="flex items-stretch justify-around gap-1 border-t border-border/50 bg-card/50 px-1 py-1 flex-shrink-0"
      >
        {HOME_TASKBAR.map((t) => {
          const active = t.path === "/" ? pathname === "/" : pathname.startsWith(t.path);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(t.path)}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              title={t.label}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1.5 transition-colors min-w-0",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary",
              )}
            >
              <t.icon className="h-4 w-4" aria-hidden="true" />
              {mode !== "phone" && <span className="text-[9px] leading-none truncate max-w-full">{t.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* STATUS BAR (footer, 100%) */}
      <footer className="flex-shrink-0 border-t border-border/50 bg-card/50">
        <div
          role="status"
          aria-label="Status do rodapé"
          className="h-6 flex items-center justify-between gap-2 px-3 text-[10px] text-muted-foreground overflow-hidden"
        >
          <span className="truncate">Pronto</span>
          <span className="truncate tabular-nums">
            aba {HOME_TABS.findIndex((t) => t.id === tab.id) + 1}/{HOME_TABS.length} · {MODE_LABEL[mode]}
          </span>
        </div>
      </footer>
    </div>
  );
}
