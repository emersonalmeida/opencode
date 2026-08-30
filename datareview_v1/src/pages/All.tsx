/**
 * Página `/all` — TODA a jornada do usuário num só lugar: cada página do
 * sistema embutida (iframe same-origin) e enquadrada como tarefa na ordem
 * lógica do primeiro contato à gestão de resultados. Referência de
 * conteúdo/estrutura do `/case`; referência de refatoração do sistema.
 *
 * Layout: hero (o que é, como usar, níveis) → nav fixa com progresso →
 * atos (AllAct) → seções expansíveis de 3 níveis (AllSection).
 */
import { ALL_ACTS, LEVEL_META, allSections, anchorId } from "@/lib/all/allModel";
import { AllNav } from "@/components/all/AllNav";
import { AllSection } from "@/components/all/AllSection";
import { AppHeader } from "@/components/AppHeader";

export default function All() {
  const sections = allSections();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader
        backTo="/"
        title="All"
        crumb="Toda a jornada do sistema num só lugar"
      />

      {/* Hero: o que é a página e como ler. */}
      <header className="border-b border-border/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-primary/70">
            Tudo em um só lugar
          </p>
          <h1 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            A jornada completa do usuário — todas as páginas, uma por uma, na
            ordem certa.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Você está numa página que embute o sistema inteiro. Cada seção é a
            página real funcionando ao vivo, enquadrada como uma tarefa: o que
            você faz, por que faz, e o que acontece quando termina. Comece pela
            recepção, colete dados, entenda, analise, construa, apresente e
            gerencie — e marque cada tarefa como concluída no caminho.
          </p>
          <div className="mt-5 flex flex-wrap gap-2" role="list" aria-label="Níveis dos blocos">
            {LEVEL_META.map((l) => (
              <span
                key={l.id}
                role="listitem"
                className="rounded-lg border border-border/60 bg-card/60 px-2.5 py-1.5 text-[10px] text-muted-foreground"
              >
                <span className="font-semibold text-foreground">{l.label}</span> — {l.blurb}
              </span>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground">
            <strong className="text-foreground">{sections.length} seções</strong> em{" "}
            <strong className="text-foreground">{ALL_ACTS.length} atos</strong>. Serve de
            referência de refatoração: qualquer parte pode virar uma página nova.
          </p>
        </div>
      </header>

      {/* Corpo: rail de navegação + jornada. */}
      <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl xl:grid xl:grid-cols-[1fr_190px] xl:gap-10">
          <div className="min-w-0 space-y-14 sm:space-y-16">
            {ALL_ACTS.map((act) => (
              <div key={act.id} id={`all-ato-${act.id}`}>
                <header className="mb-5 sm:mb-7">
                  <span className="font-mono text-[11px] tracking-[0.2em] text-primary/70">
                    ATO {act.index}
                  </span>
                  <h2 className="mt-1 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {act.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">{act.focus}</p>
                </header>
                <div className="space-y-4">
                  {act.sections.map((s) => (
                    <AllSection key={anchorId(s.id)} def={s} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <AllNav />
        </div>
      </div>

      <footer className="border-t border-border/40 px-4 py-6 text-center text-[11px] text-muted-foreground">
        Referência viva do sistema — para refatorar, extraia a seção para uma
        página própria e registre no fluxo.
      </footer>
    </div>
  );
}
