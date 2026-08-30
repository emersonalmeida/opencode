/**
 * Persistent case navigation + reading-progress indicator.
 * - Top: subtle back-to-product link.
 * - Right rail: section index with active highlight (scroll-spy via IntersectionObserver).
 * - Bottom (mobile): progress bar.
 */
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CaseNavItem {
  id: string;
  label: string;
}

export function CaseNav({ items }: { items: CaseNavItem[] }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [active, setActive] = useState(items[0]?.id ?? "");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setProgress(max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    items.forEach((it) => {
      const el = document.getElementById(it.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [items]);

  return (
    <>
      {/* Top back link */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {t("case.back")}
        </button>
        <span className="text-[10px] text-muted-foreground tabular-nums">{progress}%</span>
      </div>

      {/* Right rail section index (desktop) */}
      <nav aria-label="Seções" className="hidden xl:block sticky top-24 self-start">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Etapas</p>
        <ol className="space-y-1 border-l border-border/60">
          {items.map((it, i) => (
            <li key={it.id}>
              <a
                href={`#${it.id}`}
                className={cn(
                  "block -ml-px border-l-2 pl-3 py-1 text-[11px] transition-colors",
                  active === it.id
                    ? "border-primary text-foreground font-medium"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="font-mono text-muted-foreground/60 mr-1.5">{String(i + 1).padStart(2, "0")}</span>
                {it.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Bottom progress bar (mobile) */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 h-0.5 bg-border/40 z-40" role="progressbar" aria-label={t("case.progress")} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>
    </>
  );
}
