import { Loader2 } from "lucide-react";

/**
 * Full-area loading fallback used by route-level code splitting (Suspense).
 * Accessible: announced as a live status region to screen readers.
 */
export function PageLoader({ label = "Carregando página…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="h-full min-h-[320px] w-full flex flex-col items-center justify-center gap-3 anim-fade-in"
    >
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
