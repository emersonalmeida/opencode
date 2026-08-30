import { Sparkles, Database, Calculator, Settings2 } from "lucide-react";
import { ORIGIN_META, type DataOrigin } from "@/lib/dataOrigin";

const ICONS: Record<DataOrigin, typeof Database> = {
  user: Database,
  ai: Sparkles,
  derived: Calculator,
  system: Settings2,
};

/**
 * Badge de origem do dado — identificação visual obrigatória para separar
 * o que é dado do usuário (coletado) do que foi gerado por IA, derivado ou
 * configuração do sistema. Nunca depender só de cor: ícone + texto sempre.
 */
export function OriginBadge({ origin, short, className = "" }: {
  origin: DataOrigin;
  /** true = rótulo curto ("Coletado"/"IA"); false = rótulo completo. */
  short?: boolean;
  className?: string;
}) {
  const meta = ORIGIN_META[origin];
  const Icon = ICONS[origin];
  return (
    <span
      title={meta.description}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${meta.badgeClass} ${className}`}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden />
      {short ? meta.shortLabel : meta.label}
    </span>
  );
}
