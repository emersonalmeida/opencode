/**
 * PageFrame — o componente estrutural da página `/componentes`: envolve a
 * renderização REAL de uma página do sistema num bloco expansível (3 níveis)
 * e redimensionável (largura por preset de dispositivo + altura por drag
 * handle).
 *
 * A página é renderizada num `<iframe>` same-origin apontando para a rota
 * real — a ÚNICA forma de ter a página exata (com todo o shell, router e
 * sidebars) sem conflitos: o React Router proíbe routers aninhados, e uma
 * página embutida in-place registraria suas sidebars internas no shell da
 * página hospedeira. O iframe dá isolamento total (documento próprio) com
 * o MESMO localStorage (mesma origem) — dados coletados aparecem de verdade.
 *
 * Performance: `loading="lazy"` + montagem só quando o frame sai do nível
 * recolhido — uma seção fechada não carrega nada.
 *
 * Níveis: collapsed (só header) · default (altura fixa ajustável + scroll)
 * · expanded (altura medida do conteúdo do iframe — página inteira visível).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown, ChevronsDownUp, ChevronsUpDown, ExternalLink, Info,
  Monitor, Puzzle, Smartphone, Tablet, Maximize2, FileText,
} from "lucide-react";
import { CATALOG_OPEN_EVENT, catalogEventSectionId, type PageEmbedSpec } from "@/lib/pageFrames";
import { isFeatureEnabled, pagePathToFlag, useFeatureFlags } from "@/lib/featureFlags";
import { SidebarTabStrip } from "@/components/shared/SidebarTabStrip";
import { cn } from "@/lib/utils";

export type FrameLevel = "collapsed" | "default" | "expanded";
export type FrameDevice = "full" | "desktop" | "tablet" | "mobile";
type FrameTab = "pagina" | "componentes";

const LEVEL_ORDER: FrameLevel[] = ["collapsed", "default", "expanded"];
export const FRAME_DEFAULT_HEIGHT = 560;
export const FRAME_MIN_HEIGHT = 240;
export const FRAME_MAX_HEIGHT = 1600;

const DEVICES: { id: FrameDevice; label: string; width?: number; icon: typeof Monitor }[] = [
  { id: "full", label: "Largura total", icon: Maximize2 },
  { id: "desktop", label: "Desktop (1280px)", width: 1280, icon: Monitor },
  { id: "tablet", label: "Tablet (768px)", width: 768, icon: Tablet },
  { id: "mobile", label: "Mobile (375px)", width: 375, icon: Smartphone },
];

function loadLevel(key: string): FrameLevel {
  try {
    const v = localStorage.getItem(`aso:pageframe-level:${key}`);
    return v === "collapsed" || v === "default" || v === "expanded" ? v : "collapsed";
  } catch { return "collapsed"; }
}
function loadHeight(key: string): number {
  try {
    const v = Number(localStorage.getItem(`aso:pageframe-h:${key}`));
    return Number.isFinite(v) && v >= FRAME_MIN_HEIGHT && v <= FRAME_MAX_HEIGHT ? v : FRAME_DEFAULT_HEIGHT;
  } catch { return FRAME_DEFAULT_HEIGHT; }
}
function loadDevice(key: string): FrameDevice {
  try {
    const v = localStorage.getItem(`aso:pageframe-device:${key}`);
    return v === "full" || v === "desktop" || v === "tablet" || v === "mobile" ? v : "full";
  } catch { return "full"; }
}
function loadTab(key: string): FrameTab {
  try {
    return localStorage.getItem(`aso:pageframe-tab:${key}`) === "componentes" ? "componentes" : "pagina";
  } catch { return "pagina"; }
}
function persist(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* quota */ }
}

export interface PageFrameProps {
  spec: PageEmbedSpec;
  /** Número de ordem no menu ("01", "02"…). */
  number: string;
  label: string;
  description: string;
  icon: ReactNode;
  /** id de âncora da seção (navegação pelas sidebars). */
  anchorId: string;
  /** Conteúdo da aba "Componentes" (lista dos componentes da página). */
  components?: ReactNode;
  /** Contagem para o badge da aba Componentes. */
  componentCount?: number;
}

export function PageFrame({ spec, number, label, description, icon, anchorId, components, componentCount = 0 }: PageFrameProps) {
  useFeatureFlags(); // reage a mudanças de flag ao vivo
  const [level, setLevel] = useState<FrameLevel>(() => loadLevel(anchorId));
  const [height, setHeight] = useState(() => loadHeight(anchorId));
  const [device, setDevice] = useState<FrameDevice>(() => loadDevice(anchorId));
  const [tab, setTab] = useState<FrameTab>(() => loadTab(anchorId));
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const flag = pagePathToFlag(spec.path);
  const disabled = !!flag && !isFeatureEnabled(flag);

  useEffect(() => persist(`aso:pageframe-level:${anchorId}`, level), [level, anchorId]);
  useEffect(() => persist(`aso:pageframe-h:${anchorId}`, String(height)), [height, anchorId]);
  useEffect(() => persist(`aso:pageframe-device:${anchorId}`, device), [device, anchorId]);
  useEffect(() => persist(`aso:pageframe-tab:${anchorId}`, tab), [tab, anchorId]);

  // Navegação pelas sidebars: abrir (o scroll é feito pelo openCatalogSection).
  // O evento pode pedir uma aba interna (ex.: "componentes").
  useEffect(() => {
    const handler = (e: Event) => {
      const id = catalogEventSectionId(e);
      if (id !== anchorId) return;
      setLevel((l) => (l === "collapsed" ? "default" : l));
      const detail = (e as CustomEvent<{ tab?: FrameTab }>).detail;
      if (detail && typeof detail === "object" && (detail.tab === "pagina" || detail.tab === "componentes")) {
        setTab(detail.tab);
      }
    };
    window.addEventListener(CATALOG_OPEN_EVENT, handler);
    return () => window.removeEventListener(CATALOG_OPEN_EVENT, handler);
  }, [anchorId]);

  const cycleLevel = () => {
    const i = LEVEL_ORDER.indexOf(level);
    setLevel(LEVEL_ORDER[(i + 1) % LEVEL_ORDER.length]);
  };
  const cycleLabel =
    level === "collapsed" ? "Expandir página"
    : level === "default" ? "Expandir totalmente (altura livre)"
    : "Recolher página";

  // Nível expanded: mede a altura real do documento do iframe (mesma origem)
  // para a página aparecer INTEIRA, sem scroll interno.
  const measureContent = () => {
    try {
      const doc = iframeRef.current?.contentDocument;
      if (!doc) return;
      const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
      if (h > 0) setContentHeight(Math.min(h, 12000));
    } catch { /* cross-origin não acontece (mesma origem), guard defensivo */ }
  };

  // Drag de altura (pointer + teclado), com clamp e reset no duplo-clique.
  const dragState = useRef<{ startY: number; startH: number } | null>(null);
  const onHandlePointerDown = (e: React.PointerEvent) => {
    dragState.current = { startY: e.clientY, startH: height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onHandlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return;
    const next = dragState.current.startH + (e.clientY - dragState.current.startY);
    setHeight(Math.min(FRAME_MAX_HEIGHT, Math.max(FRAME_MIN_HEIGHT, Math.round(next))));
  };
  const onHandlePointerUp = () => {
    dragState.current = null;
    setDragging(false);
  };
  const onHandleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 80 : 24;
    if (e.key === "ArrowDown") { setHeight((h) => Math.min(FRAME_MAX_HEIGHT, h + step)); e.preventDefault(); }
    if (e.key === "ArrowUp") { setHeight((h) => Math.max(FRAME_MIN_HEIGHT, h - step)); e.preventDefault(); }
    if (e.key === "Home") { setHeight(FRAME_MIN_HEIGHT); e.preventDefault(); }
    if (e.key === "End") { setHeight(FRAME_MAX_HEIGHT); e.preventDefault(); }
  };

  const deviceDef = DEVICES.find((d) => d.id === device) ?? DEVICES[0];
  const mounted = level !== "collapsed";
  const frameHeight = level === "expanded" ? (contentHeight ?? 2400) : height;

  const pageViewport = spec.note ? (
    <p className="flex items-start gap-2 rounded-md border border-dashed border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>{spec.note}</span>
    </p>
  ) : disabled ? (
    <p className="flex items-start gap-2 rounded-md border border-dashed border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>
        Página desativada nas feature flags. Ative em{" "}
        <Link to="/configuracoes" className="text-primary hover:underline">Configurações</Link>{" "}
        para visualizá-la aqui.
      </span>
    </p>
  ) : (
    <div className="rounded-lg border border-border/60 bg-background overflow-hidden">
      <div
        className={cn("mx-auto", device !== "full" && "border-x border-dashed border-border/50")}
        style={deviceDef.width ? { width: deviceDef.width, maxWidth: "100%" } : undefined}
      >
        <iframe
          ref={iframeRef}
          src={spec.path}
          title={`Página ${label} (${spec.path})`}
          loading="lazy"
          onLoad={measureContent}
          className="w-full border-0 block bg-background"
          style={{ height: frameHeight }}
        />
      </div>
    </div>
  );

  const heightHandle = (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={`Altura do frame (${height}px)`}
      aria-valuenow={height}
      aria-valuemin={FRAME_MIN_HEIGHT}
      aria-valuemax={FRAME_MAX_HEIGHT}
      tabIndex={0}
      title="Arraste para ajustar a altura · duplo-clique redefine"
      onPointerDown={onHandlePointerDown}
      onPointerMove={onHandlePointerMove}
      onPointerUp={onHandlePointerUp}
      onKeyDown={onHandleKeyDown}
      onDoubleClick={() => setHeight(FRAME_DEFAULT_HEIGHT)}
      className={cn(
        "group flex items-center justify-center h-4 -my-1 cursor-row-resize rounded-md transition-colors",
        dragging ? "bg-primary/15" : "hover:bg-secondary/60",
      )}
    >
      <span className="h-1 w-10 rounded-full bg-border group-hover:bg-primary/60 transition-colors" />
    </div>
  );

  return (
    <section
      id={anchorId}
      aria-label={`${number}. ${label}`}
      className={cn(
        "rounded-xl border border-border/60 bg-card/40 overflow-hidden scroll-mt-4",
        level === "expanded" && "shadow-md ring-1 ring-primary/20",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-card/60 flex-wrap">
        <button
          onClick={cycleLevel}
          aria-expanded={mounted}
          aria-label={cycleLabel}
          title={cycleLabel}
          className="flex items-center gap-2 min-w-0 flex-1 text-left group"
        >
          <span className="text-[10px] font-mono text-muted-foreground shrink-0 w-6">{number}</span>
          <span className="text-primary shrink-0">{icon}</span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
              {label}
              <code className="ml-2 text-[10px] font-normal text-muted-foreground">{spec.path}</code>
            </span>
            <span className="block text-[10px] text-muted-foreground truncate">{description}</span>
          </span>
        </button>

        {/* Largura (preset de dispositivo) */}
        {!spec.note && (
          <div className="flex items-center gap-0.5 rounded-md border border-border/50 p-0.5" role="group" aria-label="Largura do frame">
            {DEVICES.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  onClick={() => setDevice(d.id)}
                  aria-pressed={device === d.id}
                  title={d.label}
                  aria-label={d.label}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    device === d.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              );
            })}
          </div>
        )}

        <Link
          to={spec.path}
          title="Abrir a página real"
          aria-label={`Abrir a página ${label}`}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
        <button
          onClick={cycleLevel}
          aria-expanded={mounted}
          aria-label={cycleLabel}
          title={cycleLabel}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {level === "collapsed" ? <ChevronDown className="h-3.5 w-3.5" />
            : level === "default" ? <ChevronsUpDown className="h-3.5 w-3.5" />
            : <ChevronsDownUp className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Corpo (lazy mount) */}
      {mounted && (
        <div className="p-3 space-y-3">
          {components ? (
            <>
              <SidebarTabStrip
                ariaLabel="Aba da seção"
                tabs={[
                  { id: "pagina", label: "Página", icon: <FileText className="h-3.5 w-3.5" /> },
                  { id: "componentes", label: "Componentes", icon: <Puzzle className="h-3.5 w-3.5" />, badge: componentCount || undefined },
                ]}
                active={tab}
                onChange={(id) => setTab(id === "componentes" ? "componentes" : "pagina")}
              />
              <div hidden={tab !== "pagina"} className="space-y-3">
                {pageViewport}
                {!spec.note && !disabled && level === "default" && heightHandle}
              </div>
              <div hidden={tab !== "componentes"}>{components}</div>
            </>
          ) : (
            <>
              {pageViewport}
              {!spec.note && !disabled && level === "default" && heightHandle}
            </>
          )}
        </div>
      )}
    </section>
  );
}
