import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { QuickCollect } from "@/components/shared/QuickCollect";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional call-to-action (button/link) rendered below the description. */
  action?: ReactNode;
  /**
   * Embeda o QuickCollect (buscar → coletar → selecionar inline) — use nas
   * páginas que precisam de dados coletados para que elas funcionem sozinhas.
   */
  collect?: boolean;
  /** Compact variant for narrow panels/sidebars. */
  compact?: boolean;
  className?: string;
}

/**
 * Consistent empty state used across all pages: icon + title + description +
 * optional action. Replaces ad-hoc empty states so every "nothing here yet"
 * moment looks and reads the same.
 */
export function EmptyState({ icon: Icon, title, description, action, collect, compact, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center anim-fade-in",
        compact ? "gap-2 py-6 px-3" : "gap-3 py-12 px-6",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-full bg-muted/60 flex items-center justify-center",
          compact ? "h-10 w-10" : "h-14 w-14",
        )}
      >
        <Icon className={cn("text-muted-foreground", compact ? "h-5 w-5" : "h-7 w-7")} aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <h3 className={cn("font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{title}</h3>
        {description && (
          <p className={cn("text-muted-foreground max-w-sm", compact ? "text-xs" : "text-sm")}>{description}</p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
      {collect && (
        <div className="pt-2 w-full max-w-xl">
          <QuickCollect />
        </div>
      )}
    </div>
  );
}
