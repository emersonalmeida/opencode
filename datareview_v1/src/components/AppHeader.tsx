import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, GitCompare, FileJson, FileSpreadsheet, FileText, Printer, Cpu, Cloud, CloudOff, Sparkles } from "lucide-react";
import { SystemStatusIndicator } from "@/components/SystemStatusIndicator";
import { Button } from "@/components/ui/button";
import { GlobalSearchBar } from "@/components/GlobalSearchBar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAISettings } from "@/lib/aiSettings";
import { useAIReadiness, readinessDot } from "@/lib/aiReadiness";

interface Props {
  /** Optional back button (shows arrow + label) */
  backTo?: string | -1;
  /** Contextual page title shown in the header (e.g. "Dashboard", "Chat com IA"). */
  title?: string;
  /** Optional label crumb shown next to the title (e.g. "Nubank") */
  crumb?: string;
  /** Compare button config; when omitted the button is hidden */
  compare?: { count: number; onOpen: () => void };
  /** Export handlers; when omitted the export button is hidden */
  onExportJSON?: () => void;
  onExportCSV?: () => void;
  onExportMD?: () => void;
  onExportXLSX?: () => void;
  onExportPDF?: () => void;
  /** Extra actions rendered in the right cluster */
  extraMenu?: ReactNode;
  /** Show the global search bar in the header center (default true). */
  showSearch?: boolean;
}

const AI_BADGE = {
  auto: { icon: Sparkles, label: "IA auto", cls: "text-violet-600 dark:text-violet-400 bg-violet-500/10" },
  none: { icon: CloudOff, label: "IA desativada", cls: "text-muted-foreground bg-muted/50" },
  local: { icon: Cpu, label: "IA local", cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  cloud: { icon: Cloud, label: "IA na nuvem", cls: "text-sky-600 dark:text-sky-400 bg-sky-500/10" },
} as const;

/**
 * Minimal ChatGPT-style header. No logo (the brand lives in the left sidebar),
 * no global search (it lives in the left sidebar Apps tab) and no settings
 * dropdown (system config lives in the left sidebar Config tab). Keeps a
 * contextual title/breadcrumb, quick nav, compare and optional page export.
 */
export function AppHeader({ backTo, title, crumb, compare, onExportJSON, onExportCSV, onExportMD, onExportXLSX, onExportPDF, extraMenu, showSearch = true }: Props) {
  const navigate = useNavigate();
  const hasExport = onExportJSON || onExportCSV || onExportMD || onExportXLSX || onExportPDF;
  const ai = useAISettings();
  const badge = AI_BADGE[ai.mode];
  const BadgeIcon = badge.icon;
  // Readiness da IA: ponto verde = pronta e testada; âmbar = configurada mas
  // ainda não verificada/indisponível (o tooltip explica a razão).
  const readiness = useAIReadiness(ai);
  const dot = readinessDot(ai, readiness);
  const badgeTitle =
    dot === "ok" ? `IA pronta (${badge.label}) — testada nesta sessão. Abrir a Central de IA.`
    : dot === "warn" ? `IA em modo ${badge.label}, mas ${readiness ? `não respondeu: ${readiness.message}` : "ainda não verificada"}. Abrir a Central de IA.`
    : `Modo de IA: ${badge.label}. Abrir a Central de IA.`;

  // Container-aware density: the header spans the center column, whose width
  // depends on how many sidebars are open — viewport breakpoints can't see
  // that. When the center gets tight, drop secondary elements (crumb, AI
  // badge) instead of letting the search collapse or overlap the actions.
  const headerRef = useRef<HTMLElement>(null);
  const [tight, setTight] = useState(false);
  useEffect(() => {
    const el = headerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => setTight(entry.contentRect.width < 720));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-6 py-2.5">
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          {backTo !== undefined ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => (backTo === -1 ? (window.history.length > 1 ? navigate(-1) : navigate("/")) : navigate(backTo))}
              title="Voltar"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          {title && (
            <h1 className="text-sm font-semibold text-foreground truncate hidden md:block">{title}</h1>
          )}
          {crumb && crumb !== title && !tight && (
            <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground ml-1 max-w-[200px]">
              {title && <ChevronRight className="h-3 w-3 shrink-0" />}
              <span className="truncate">{crumb}</span>
            </div>
          )}
        </div>

        {showSearch && (
          <div className="flex-1 min-w-0 flex justify-center">
            <GlobalSearchBar compact />
          </div>
        )}
        {!showSearch && <div className="flex-1" />}

        <div className="flex items-center gap-1.5 shrink-0">
          {extraMenu}

          <SystemStatusIndicator />

          {!tight && (
            <button
              onClick={() => navigate("/ia")}
              className={`hidden lg:inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full transition-colors hover:ring-1 hover:ring-primary/40 ${badge.cls}`}
              title={badgeTitle}
              aria-label={`Abrir Central de IA (modo: ${badge.label}${dot === "ok" ? ", pronta" : dot === "warn" ? ", indisponível" : ""})`}
            >
              <BadgeIcon className="h-3 w-3" />
              {badge.label}
              {dot !== "none" && (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${dot === "ok" ? "bg-emerald-500" : "bg-amber-500"}`}
                  aria-hidden="true"
                />
              )}
            </button>
          )}

          {hasExport && (
            <div className="flex items-center gap-0.5">
              {onExportJSON && (
                <Button variant="ghost" size="icon" onClick={onExportJSON} title="Exportar JSON" aria-label="Exportar JSON" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <FileJson className="h-3.5 w-3.5" />
                </Button>
              )}
              {onExportCSV && (
                <Button variant="ghost" size="icon" onClick={onExportCSV} title="Exportar CSV" aria-label="Exportar CSV" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                </Button>
              )}
              {onExportMD && (
                <Button variant="ghost" size="icon" onClick={onExportMD} title="Exportar Markdown" aria-label="Exportar Markdown" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <FileText className="h-3.5 w-3.5" />
                </Button>
              )}
              {onExportXLSX && (
                <Button variant="ghost" size="icon" onClick={onExportXLSX} title="Exportar XLSX (Excel)" aria-label="Exportar XLSX" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                </Button>
              )}
              {onExportPDF && (
                <Button variant="ghost" size="icon" onClick={onExportPDF} title="Exportar PDF (diálogo de impressão)" aria-label="Exportar PDF" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Printer className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}

          {compare && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs relative" onClick={compare.onOpen} title="Painel de comparação">
              <GitCompare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Comparar</span>
              {compare.count > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                  {compare.count}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
