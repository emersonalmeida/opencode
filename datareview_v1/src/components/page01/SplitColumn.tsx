/**
 * SplitColumn — divide uma coluna de sidebar em DOIS blocos verticais, cada um
 * com sua própria strip de abas, recolhível e com divisor arrastável entre eles
 * (persistido). É o "window tiling" vertical da página 01: o usuário decide
 * quanto espaço cada função ocupa.
 *
 *  - `TabsBlock`: strip de abas (role=tablist) + corpo (abas montadas, hidden
 *    quando inativas — estado preservado) + botão recolher (vira só-strip).
 *  - `SplitColumn`: top/bottom com `flexGrow` proporcional + divisor
 *    (`role="separator"`, drag, setas do teclado, duplo-clique = 50/50).
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarTabStrip } from "@/components/shared/SidebarTabStrip";

export interface SplitTab {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
}

function loadNum(key: string, fb: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : fb;
  } catch { return fb; }
}
function loadBool(key: string, fb: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fb : v === "1";
  } catch { return fb; }
}
function loadStr(key: string, fb: string): string {
  try { return localStorage.getItem(key) ?? fb; } catch { return fb; }
}

/* ------------------------------------------------------------ TabsBlock --- */

/** Bloco de abas recolhível (persiste aba ativa + aberto/fechado). */
export function TabsBlock({
  tabs, storageKey, defaultTab, defaultOpen = true, className,
}: {
  tabs: SplitTab[];
  storageKey: string;
  defaultTab?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(() => loadStr(`${storageKey}-tab`, defaultTab ?? tabs[0]?.id ?? ""));
  const [open, setOpen] = useState(() => loadBool(`${storageKey}-open`, defaultOpen));

  const pick = (id: string) => {
    setActive(id);
    try { localStorage.setItem(`${storageKey}-tab`, id); } catch { /* ignore */ }
    if (!open) toggleOpen(true);
  };
  const toggleOpen = (v: boolean) => {
    setOpen(v);
    try { localStorage.setItem(`${storageKey}-open`, v ? "1" : "0"); } catch { /* ignore */ }
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      <SidebarTabStrip
        tabs={tabs}
        active={open ? active : ""}
        onChange={pick}
        ariaLabel="Seções do painel"
        end={
          <button
            onClick={() => toggleOpen(!open)}
            title={open ? "Recolher bloco" : "Expandir bloco"}
            aria-label={open ? "Recolher bloco" : "Expandir bloco"}
            aria-expanded={open}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !open && "-rotate-90")} />
          </button>
        }
      />
      {open && tabs.map((t) => (
        <div
          key={t.id}
          role="tabpanel"
          hidden={active !== t.id}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- SplitColumn --- */

const MIN_RATIO = 15; // % mínima para cada bloco
const MAX_RATIO = 85;

/** Divide verticalmente `top`/`bottom` com divisor arrastável (persistido). */
export function SplitColumn({
  top, bottom, storageKey,
}: {
  top: ReactNode;
  bottom: ReactNode;
  storageKey: string;
}) {
  const [ratio, setRatio] = useState(() => {
    const v = loadNum(`${storageKey}-ratio`, 50);
    return Math.min(Math.max(v, MIN_RATIO), MAX_RATIO);
  });
  const dragRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const persist = useCallback((v: number) => {
    const clamped = Math.min(Math.max(v, MIN_RATIO), MAX_RATIO);
    setRatio(clamped);
    try { localStorage.setItem(`${storageKey}-ratio`, String(Math.round(clamped))); } catch { /* ignore */ }
  }, [storageKey]);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientY - rect.top) / rect.height) * 100;
      setRatio(Math.min(Math.max(pct, MIN_RATIO), MAX_RATIO));
    };
    const up = () => {
      if (!dragRef.current) return;
      dragRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      setRatio((v) => {
        try { localStorage.setItem(`${storageKey}-ratio`, String(Math.round(v))); } catch { /* ignore */ }
        return v;
      });
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [storageKey]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 4;
    if (e.key === "ArrowUp") { e.preventDefault(); persist(ratio - step); }
    else if (e.key === "ArrowDown") { e.preventDefault(); persist(ratio + step); }
    else if (e.key === "Home") { e.preventDefault(); persist(MIN_RATIO); }
    else if (e.key === "End") { e.preventDefault(); persist(MAX_RATIO); }
  };

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 overflow-hidden" style={{ flexGrow: ratio, flexBasis: 0 }}>
        {top}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Divisor entre os blocos — arraste ou use as setas"
        aria-valuenow={Math.round(ratio)}
        aria-valuemin={MIN_RATIO}
        aria-valuemax={MAX_RATIO}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => {
          e.preventDefault();
          dragRef.current = true;
          document.body.style.cursor = "row-resize";
          document.body.style.userSelect = "none";
        }}
        onDoubleClick={() => persist(50)}
        title="Arraste para redimensionar · duplo-clique para 50/50"
        className="group/split relative h-2 shrink-0 cursor-row-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border/60 transition-colors group-hover/split:bg-primary/60" />
        <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 gap-[3px] opacity-0 transition-opacity group-hover/split:opacity-100">
          <span className="h-0.5 w-0.5 rounded-full bg-primary" />
          <span className="h-0.5 w-0.5 rounded-full bg-primary" />
          <span className="h-0.5 w-0.5 rounded-full bg-primary" />
        </div>
      </div>
      <div className="min-h-0 overflow-hidden" style={{ flexGrow: 100 - ratio, flexBasis: 0 }}>
        {bottom}
      </div>
    </div>
  );
}
