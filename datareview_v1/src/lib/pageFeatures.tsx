/**
 * Utilitários, hooks e componentes compartilhados para recursos de página.
 *
 * Reutilizados em várias páginas para evitar duplicação e manter
 * acessibilidade/UX consistentes (ARIA labels, navegação por teclado, gestão
 * de foco).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy, Check, Download, Star, Pin, PinOff, RefreshCw, Search,
  ChevronUp, ChevronDown, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState as SharedEmptyState } from "@/components/shared/EmptyState";

/* ----------------------------------------------------------------- hooks --- */

/** Copy-to-clipboard with transient "copied" feedback. */
export function useCopy(timeout = 1500) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), timeout);
  }, [timeout]);
  return { copiedKey, copy };
}

/** Persist a string set in localStorage with pub/sub. */
export function usePersistedSet(key: string) {
  const [set, setSet] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  const toggle = useCallback((id: string) => {
    setSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(key, JSON.stringify([...next])); } catch { /* ignore quota */ }
      return next;
    });
  }, [key]);
  const has = useCallback((id: string) => set.has(id), [set]);
  return { set, toggle, has };
}

/** Track a persisted list of recent items (most-recent-first, capped). */
export function useRecentItems(key: string, max = 10) {
  const [items, setItems] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const add = useCallback((item: string) => {
    setItems((prev) => {
      const next = [item, ...prev.filter((x) => x !== item)].slice(0, max);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* ignore quota */ }
      return next;
    });
  }, [key, max]);
  const clear = useCallback(() => {
    setItems([]);
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }, [key]);
  return { items, add, clear };
}

/** Keyboard shortcut handler (registers on window). */
export function useHotkey(key: string, handler: () => void, deps: unknown[] = []) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === key && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
        ref.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Animated number counter (counts up to target on mount). */
export function useCountUp(target: number, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target <= 0) { setVal(0); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

/**
 * Scroll-reveal: returns a ref + boolean. Element fades/slides in once when it
 * enters the viewport. Respects prefers-reduced-motion (renders visible immediately).
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setShown(true); obs.disconnect(); }
        }
      },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, shown };
}

/* ------------------------------------------------------------- components --- */

interface IconBtnProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Accessible icon-only button with aria-label and focus-visible ring. */
export function IconBtn({ icon: Icon, label, onClick, active, disabled, className }: IconBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center justify-center h-7 w-7 rounded-md border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        active
          ? "bg-primary border-primary text-primary-foreground"
          : "bg-card/80 border-border/70 text-muted-foreground hover:border-primary/60 hover:text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/** Copy button with transient check feedback. */
export function CopyButton({ text, label = "Copiar", className }: { text: string; label?: string; className?: string }) {
  const { copiedKey, copy } = useCopy();
  const key = text.slice(0, 20);
  const done = copiedKey === key;
  return (
    <IconBtn
      icon={done ? Check : Copy}
      label={done ? "Copiado!" : label}
      onClick={() => copy(key, text)}
      active={done}
      className={className}
    />
  );
}

/** Collapsible section with accessible disclosure. */
export function Collapsible({
  title, icon: Icon, defaultOpen = true, children, badge,
}: {
  title: string; icon?: LucideIcon; defaultOpen?: boolean; children: React.ReactNode; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-secondary/40 transition-colors"
      >
        {Icon && <Icon className="h-4 w-4 text-primary shrink-0" />}
        <span className="text-sm font-semibold flex-1 truncate">{title}</span>
        {badge && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">{badge}</span>}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </section>
  );
}

/**
 * Download text as a file (no server round-trip). Feedback via toast —
 * o usuário sempre sabe que a exportação aconteceu e onde o arquivo caiu.
 * Passe `silent: true` para suprimir o toast (fluxos com feedback próprio).
 */
export function downloadFile(filename: string, content: string, mime = "text/plain", opts?: { silent?: boolean }) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  if (!opts?.silent) {
    import("sonner").then(({ toast }) => {
      toast.success("Arquivo exportado", {
        description: `${filename} · ${(blob.size / 1024).toFixed(1)} KB — salvo na pasta de downloads`,
      });
    });
  }
}

/** Small inline stat pill. */
export function StatPill({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string | number; color?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/60 text-xs">
      <Icon className="h-3 w-3" style={color ? { color } : undefined} />
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

/** Star rating row (read-only, accessible). */
export function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Nota ${rating} de 5`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(dim, s <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")}
        />
      ))}
    </span>
  );
}

/** Empty state with icon, title, description, and optional action.
 *  Delegates to the shared design-system EmptyState (single source of truth). */
export function EmptyState({
  icon = Search, title, description, action,
}: {
  icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <SharedEmptyState icon={icon} title={title} description={description} action={action} className="py-16 px-4" />
  );
}

/** Loading skeleton block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted/60", className)} />;
}

/** Sortable column header button. */
export function SortHeader({
  label, active, dir, onClick,
}: {
  label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      {active && (dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  );
}

/** Pin toggle button. */
export function PinButton({ active, onClick, label = "Fixar" }: { active: boolean; onClick: () => void; label?: string }) {
  return <IconBtn icon={active ? PinOff : Pin} label={label} onClick={onClick} active={active} />;
}

/** Refresh/regenerate button. */
export function RefreshButton({ onClick, loading, label = "Atualizar" }: { onClick: () => void; loading?: boolean; label?: string }) {
  return (
    <IconBtn
      icon={RefreshCw}
      label={label}
      onClick={onClick}
      disabled={loading}
      className={loading ? "animate-spin" : ""}
    />
  );
}

/** Download button. */
export function DownloadButton({ onClick, label = "Baixar" }: { onClick: () => void; label?: string }) {
  return <IconBtn icon={Download} label={label} onClick={onClick} />;
}
