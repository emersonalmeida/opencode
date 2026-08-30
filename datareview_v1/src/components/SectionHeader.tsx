import type { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

/**
 * Standardized section header — used across detail/compare/search to give
 * every block a clear title, secondary explanation and optional actions.
 * Mantém a arquitetura de informação consistente ao longo da jornada de descoberta.
 */
export function SectionHeader({ eyebrow, title, description, actions, className = "" }: Props) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-primary/80 mb-1">
            {eyebrow}
          </p>
        )}
        <h2 className="text-base sm:text-lg font-semibold text-foreground leading-tight">{title}</h2>
        {description && (
          <p className="text-xs sm:text-[13px] text-muted-foreground mt-1 max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
