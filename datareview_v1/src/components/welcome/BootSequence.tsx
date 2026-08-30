import { useEffect, useRef, useState } from "react";
import { Check, FastForward, Orbit } from "lucide-react";
import { BOOT_STEPS, bootProgress } from "@/lib/welcome/welcomeModel";

/**
 * Sequência de entrada ("boot") da página Boas-vindas: um loading fictício em
 * etapas que dá a sensação de ENTRAR num sistema — e não de abrir um site.
 *
 * Princípios:
 * - Sempre pulável (botão + Esc) — controle do usuário acima de tudo.
 * - `prefers-reduced-motion`: a sequência completa quase instantaneamente,
 *   sem animações (o kill switch global do CSS já neutraliza as transições).
 * - Acessível: role="status" + aria-live anuncia a etapa atual; a barra é um
 *   progressbar com aria-valuenow.
 */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0); // índice da etapa em exibição
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    for (let i = 0; i < BOOT_STEPS.length; i++) {
      elapsed += reduced ? 40 : BOOT_STEPS[i].minMs;
      const idx = i + 1;
      timers.push(setTimeout(() => setStep(idx), elapsed));
    }
    timers.push(
      setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDoneRef.current();
        }
      }, elapsed + (reduced ? 40 : 380)),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };

  // Esc pula a apresentação (controle do usuário).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = Math.min(step, BOOT_STEPS.length - 1);
  const progress = bootProgress(step);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6"
      role="status"
      aria-live="polite"
      aria-label="Preparando o sistema"
    >
      {/* Orbe animado — a "respiração" do sistema acordando */}
      <div className="relative mb-10 flex items-center justify-center" aria-hidden="true">
        <span className="welcome-ring absolute h-28 w-28 rounded-full border border-primary/25" />
        <span className="welcome-ring welcome-ring-late absolute h-28 w-28 rounded-full border border-primary/20" />
        <span className="welcome-orb flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Orbit className="h-7 w-7" />
        </span>
      </div>

      <p className="text-lg font-medium tracking-tight text-foreground sm:text-xl">
        App Intelligence
      </p>
      <p className="mt-1 min-h-6 text-sm text-muted-foreground">
        {step < BOOT_STEPS.length ? BOOT_STEPS[current].label : "Tudo pronto — bem-vindo"}
      </p>

      {/* Barra de progresso */}
      <div
        className="mt-6 h-1 w-56 overflow-hidden rounded-full bg-muted sm:w-72"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label="Progresso da inicialização"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Etapas já concluídas (micro-história do boot) */}
      <ul className="mt-6 flex h-20 flex-col items-center gap-1 text-xs text-muted-foreground" aria-hidden="true">
        {BOOT_STEPS.slice(0, step).slice(-3).map((s) => (
          <li key={s.id} className="anim-row-in flex items-center gap-1.5">
            <Check className="h-3 w-3 text-primary" />
            {s.label}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={finish}
        className="interactive mt-4 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <FastForward className="h-3.5 w-3.5" />
        Pular apresentação
        <kbd className="ml-1 rounded border border-border px-1 text-[10px]">Esc</kbd>
      </button>
    </div>
  );
}
