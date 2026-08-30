/**
 * AllNav — navegação persistente da jornada `/all`: índice por atos e seções
 * com scroll-spy (IntersectionObserver), barra de progresso de leitura e
 * progresso de tarefas concluídas (checklist persistido). Mobile-first: rail
 * de índice só no desktop XL; progresso fica visível em qualquer largura.
 */
import { useEffect, useState } from "react";
import { ALL_ACTS, anchorId, allSections } from "@/lib/all/allModel";
import { doneProgress, useAllDone } from "@/lib/all/allProgress";
import { cn } from "@/lib/utils";

export function AllNav() {
  const [active, setActive] = useState(anchorId(allSections()[0]?.id ?? "boas-vindas"));
  const [readPct, setReadPct] = useState(0);
  const done = useAllDone();
  const tasksPct = Math.round(doneProgress(done) * 100);

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setReadPct(max > 0 ? Math.min(100, Math.round((h.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const ids = allSections().map((s) => anchorId(s.id));
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {/* Barra de progresso de leitura (topo do viewport). */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-0.5 bg-border/40"
        role="progressbar"
        aria-label="Progresso de leitura da página"
        aria-valuenow={readPct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-primary transition-[width] duration-150" style={{ width: `${readPct}%` }} />
      </div>

      {/* Rail de índice (desktop XL+). */}
      <nav aria-label="Jornada da página All" className="sticky top-20 hidden self-start xl:block">
        <p className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Jornada
          <span className="tabular-nums">{readPct}%</span>
        </p>
        <p
          className="mb-3 text-[10px] text-muted-foreground tabular-nums"
          role="status"
          aria-label={`Tarefas concluídas: ${done.length} de ${allSections().length}, ${tasksPct} por cento`}
        >
          {done.length}/{allSections().length} tarefas · {tasksPct}%
        </p>
        <ol className="max-h-[70vh] space-y-0.5 overflow-y-auto border-l border-border/60 pr-1">
          {ALL_ACTS.map((act) => (
            <li key={act.id}>
              <button
                type="button"
                onClick={() => go(anchorId(act.sections[0].id))}
                className="block pl-2 pt-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                {act.index}. {act.title}
              </button>
              <ul className="mt-1 space-y-0.5">
                {act.sections.map((s) => {
                  const id = anchorId(s.id);
                  const isActive = active === id;
                  const isDone = done.includes(s.id);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => go(id)}
                        aria-current={isActive ? "location" : undefined}
                        className={cn(
                          "block w-full border-l-2 py-1 pl-2 text-left text-[11px] transition-colors",
                          isActive
                            ? "border-primary font-semibold text-primary"
                            : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                        )}
                      >
                        <span className="truncate">{s.title}</span>
                        {isDone && <span className="ml-1 text-emerald-500" aria-hidden="true">✓</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
