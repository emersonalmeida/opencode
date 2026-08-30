import { ArrowDown, Compass, Layers, ShieldCheck, Zap } from "lucide-react";
import { ALL_ONE_SECTIONS } from "@/lib/one/oneSources";

/**
 * Seção 1 da One Page — landing de conversão (clareza + relevância +
 * confiança + baixa fricção). Sem exageros: fala o que o sistema faz de
 * verdade, com os números reais das fontes.
 */
export function OneHero({ onStart }: { onStart: () => void }) {
  const total = ALL_ONE_SECTIONS.length;
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Compass className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="mt-6 max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
        Todas as fontes de dados do sistema,{" "}
        <span className="text-primary">numa única página</span>
      </h1>
      <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
        Pesquise, colete, visualize, analise com IA, salve e gere artefatos em{" "}
        <strong className="text-foreground">{total} fontes públicas</strong> — do Google
        Trends ao GitHub, da Wikipédia ao clima. Sem sair da página, sem fricção.
      </p>

      <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <dt className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Layers className="h-3.5 w-3.5" aria-hidden /> Fontes
          </dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums">{total}</dd>
          <dd className="text-xs text-muted-foreground">uma por slide, com scroll snap</dd>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <dt className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Zap className="h-3.5 w-3.5" aria-hidden /> Fricção
          </dt>
          <dd className="mt-1 text-2xl font-bold">Zero</dd>
          <dd className="text-xs text-muted-foreground">busca global + roda p/ próxima fonte</dd>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <dt className="flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Confiança
          </dt>
          <dd className="mt-1 text-2xl font-bold">100%</dd>
          <dd className="text-xs text-muted-foreground">dados reais, limites honestos</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onStart}
        className="mt-10 inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        Começar a explorar
        <ArrowDown className="h-4 w-4 animate-bounce" aria-hidden />
      </button>
      <p className="mt-3 text-xs text-muted-foreground">
        Role para baixo — cada fonte ocupa a tela inteira.
      </p>
    </div>
  );
}
