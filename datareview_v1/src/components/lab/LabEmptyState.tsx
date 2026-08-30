import type { ReactNode } from "react";
import { FlaskConical, ArrowRight, Sparkles } from "lucide-react";

interface Props {
  title: string;
  description: string;
  action?: ReactNode;
  secondary?: ReactNode;
  variant?: "first" | "empty";
  icon?: ReactNode;
}

/**
 * Estado vazio do Lab — transmite a filosofia experimental. Variant "first"
 * para a primeira visita (com o ciclo Dataset→Experimento→Evidência→Produto).
 */
export function LabEmptyState({
  title,
  description,
  action,
  secondary,
  variant = "empty",
  icon,
}: Props) {
  if (variant === "first") {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4 max-w-2xl mx-auto">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-violet-500/20 mb-4">
          <FlaskConical className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          App Data Review Lab
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">{description}</p>
        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          {["Dataset", "Experimento", "Evidência", "Descoberta", "Produto"].map((s, i, arr) => (
            <span key={s} className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-md bg-secondary/70 font-medium text-foreground/80">
                {s}
              </span>
              {i < arr.length - 1 && <ArrowRight className="h-3 w-3" />}
            </span>
          ))}
        </div>
        <div className="mt-6 flex items-center gap-2">
          {action}
          {secondary}
        </div>
        <p className="mt-6 flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
          <Sparkles className="h-3 w-3" /> Ambiente experimental — ideias viram produtos.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-border rounded-xl">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary mb-3">
        {icon ?? <FlaskConical className="h-5 w-5 text-muted-foreground" />}
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground max-w-sm">{description}</p>
      {(action || secondary) && (
        <div className="mt-4 flex items-center gap-2">
          {action}
          {secondary}
        </div>
      )}
    </div>
  );
}
