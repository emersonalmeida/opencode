/**
 * VoiceOrb — indicador visual central do Assistente: um "orb" que muda de
 * cor/animação conforme o estado (idle, ouvindo, pensando, falando). Estado
 * nunca depende só de cor: o label textual acompanha (a11y).
 */
import { Mic, Brain, Volume2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

export const ORB_STATE_META: Record<OrbState, { label: string; icon: typeof Mic; ring: string; core: string; pulse: boolean }> = {
  idle:      { label: "Pronto",    icon: Sparkles, ring: "border-border",         core: "bg-secondary text-muted-foreground", pulse: false },
  listening: { label: "Ouvindo…",  icon: Mic,      ring: "border-red-500/60",     core: "bg-red-500/15 text-red-500",        pulse: true },
  thinking:  { label: "Pensando…", icon: Brain,    ring: "border-primary/60",     core: "bg-primary/15 text-primary",        pulse: true },
  speaking:  { label: "Falando…",  icon: Volume2,  ring: "border-emerald-500/60", core: "bg-emerald-500/15 text-emerald-500", pulse: true },
};

export function VoiceOrb({ state, size = "md" }: { state: OrbState; size?: "sm" | "md" | "lg" }) {
  const meta = ORB_STATE_META[state];
  const Icon = meta.icon;
  const dims = size === "lg" ? "h-24 w-24" : size === "sm" ? "h-9 w-9" : "h-14 w-14";
  const iconCls = size === "lg" ? "h-10 w-10" : size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <div className="flex flex-col items-center gap-2" role="status" aria-live="polite" aria-label={meta.label}>
      <div className={cn("relative flex items-center justify-center rounded-full border-2", dims, meta.ring, meta.core)}>
        {meta.pulse && (
          <>
            <span className={cn("absolute inset-0 rounded-full border-2 motion-safe:animate-ping", meta.ring)} aria-hidden="true" />
            <span className={cn("absolute -inset-2 rounded-full border opacity-40 motion-safe:animate-pulse", meta.ring)} aria-hidden="true" />
          </>
        )}
        <Icon className={iconCls} aria-hidden="true" />
      </div>
      <span className="text-xs text-muted-foreground">{meta.label}</span>
    </div>
  );
}
