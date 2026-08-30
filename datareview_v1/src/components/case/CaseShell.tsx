/**
 * Case page shell primitives — reusable layout + reveal for the /case experience.
 * Reuses the existing design system (no parallel design language).
 */
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useReveal } from "@/lib/pageFeatures";

/** A vertical section of the case with an id (for nav), eyebrow label and title. */
export function CaseSection({
  id, index, eyebrow, title, children, className,
}: {
  id: string;
  index?: string;
  eyebrow?: string;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { ref, shown } = useReveal();
  return (
    <section
      id={id}
      ref={ref}
      className={cn(
        "scroll-mt-24 transition-all duration-700",
        shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6",
        className,
      )}
      aria-labelledby={title ? `${id}-title` : undefined}
    >
      {(index || eyebrow || title) && (
        <header className="mb-5 sm:mb-7">
          {index && (
            <span className="font-mono text-[11px] tracking-[0.2em] text-primary/70">{index}</span>
          )}
          {eyebrow && (
            <p className={cn("text-xs uppercase tracking-wider text-muted-foreground font-medium", index && "mt-1")}>{eyebrow}</p>
          )}
          {title && (
            <h2 id={`${id}-title`} className="text-xl sm:text-2xl font-bold text-foreground mt-1 tracking-tight">{title}</h2>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

/** Subtle bordered surface used for artifacts. */
export function CaseCard({ children, className, interactive }: { children: ReactNode; className?: string; interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm",
        interactive && "transition-colors hover:border-primary/40",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Eyebrow + label for an artifact block. */
export function CaseLabel({ children, hint, tone = "default" }: { children: ReactNode; hint?: string; tone?: "default" | "primary" | "warn" }) {
  const cls = tone === "primary" ? "text-primary" : tone === "warn" ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-[10px] uppercase tracking-wider font-semibold", cls)}>{children}</span>
      {hint && <span className="text-[10px] text-muted-foreground/70">· {hint}</span>}
    </div>
  );
}

/** Inline chip/tag. */
export function CaseTag({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "primary" | "warn" }) {
  const cls = tone === "primary" ? "bg-primary/10 text-primary" : tone === "warn" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-secondary text-secondary-foreground";
  return <span className={cn("inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium", cls)}>{children}</span>;
}
