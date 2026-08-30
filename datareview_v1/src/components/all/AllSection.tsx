/**
 * AllSection — seção da jornada `/all`: enquadra a tarefa (o que você faz →
 * por que → o que resulta) e embute a PÁGINA REAL via iframe same-origin
 * (mesma origem = mesmo localStorage = dados reais).
 *
 * 3 níveis inteligentes (persistidos por seção, `aso:all:level:<id>`):
 *  - N1 default: altura fixa com rolagem vertical dentro do bloco.
 *  - N2 expanded: o bloco cresce até o documento do iframe todo (sem scroll).
 *  - N3 collapsed: só o cabeçalho — nada carrega até expandir (lazy).
 *
 * Seções com `note` (redirect/link externo) não embutem: nota honesta + link.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, ExternalLink, Info,
  Maximize2,
} from "lucide-react";
import { PAGES } from "@/lib/pages";
import {
  ALL_LEVELS, ALL_STORAGE_PREFIX, anchorId, sectionIndex,
  type AllLevel, type AllSectionDef,
} from "@/lib/all/allModel";
import { toggleDone, useAllDone } from "@/lib/all/allProgress";
import { FeatureModal } from "@/components/shared/FeatureModal";
import { cn } from "@/lib/utils";

const DEFAULT_HEIGHT = 560;

function loadLevel(id: string): AllLevel {
  try {
    const v = localStorage.getItem(`${ALL_STORAGE_PREFIX}level:${id}`);
    return ALL_LEVELS.includes(v as AllLevel) ? (v as AllLevel) : "collapsed";
  } catch { return "collapsed"; }
}

export function AllSection({ def }: { def: AllSectionDef }) {
  const [level, setLevel] = useState<AllLevel>(() => loadLevel(def.id));
  const [modalOpen, setModalOpen] = useState(false);
  const done = useAllDone();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(DEFAULT_HEIGHT);

  const page = PAGES.find((p) => p.path === def.path);
  const isDone = done.includes(def.id);
  const index = sectionIndex(def.id);

  // Recursão: a página /all tenta embutir a si mesma via teste — honesta.
  const cycle = () => {
    const next = ALL_LEVELS[(ALL_LEVELS.indexOf(level) + 1) % ALL_LEVELS.length];
    setLevel(next);
    try { localStorage.setItem(`${ALL_STORAGE_PREFIX}level:${def.id}`, next); } catch { /* quota */ }
  };

  /** N2 expanded: mede o documento e cresce até mostrar tudo, sem scroll. */
  useEffect(() => {
    if (level !== "expanded") return;
    const f = iframeRef.current;
    const measure = () => {
      try {
        const doc = f?.contentDocument;
        const h = doc?.documentElement?.scrollHeight;
        if (h && h > 200) setIframeHeight(Math.min(h, 6000));
      } catch { /* same-origin; guarda por paranoia */ }
    };
    const onLoad = () => measure();
    f?.addEventListener("load", onLoad);
    measure();
    const t = setInterval(measure, 2000);
    return () => {
      f?.removeEventListener("load", onLoad);
      clearInterval(t);
    };
  }, [level]);

  const cycleLabel =
    level === "collapsed" ? `Expandir ${def.title}`
    : level === "expanded" ? `Recolher ${def.title} (ciclo de níveis)`
    : `Expandir ${def.title} (página inteira)`;

  return (
    <section
      id={anchorId(def.id)}
      aria-label={`Seção: ${def.title}`}
      aria-expanded={level !== "collapsed"}
      className="overflow-hidden rounded-xl border border-border/60 bg-card/50 scroll-mt-24"
    >
      {/* Cabeçalho: tarefa + níveis + ações. */}
      <header className="flex items-start gap-3 border-b border-border/50 bg-secondary/30 px-4 py-3">
        <button
          type="button"
          onClick={cycle}
          aria-expanded={level !== "collapsed"}
          aria-label={cycleLabel}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-[11px] font-bold text-primary">
            {String(index).padStart(2, "0")}
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              {level === "collapsed" ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : level === "expanded" ? (
                <ChevronsDownUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="text-sm font-bold text-foreground">{def.title}</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{def.path}</code>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              <span className="font-medium text-foreground/80">Tarefa:</span> {def.task}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          {!def.note && (
            <button
              type="button"
              onClick={() => toggleDone(def.id)}
              role="checkbox"
              aria-checked={isDone}
              title={isDone ? "Marcar como pendente" : "Concluir esta tarefa"}
              aria-label={isDone ? `Marcar ${def.title} como pendente` : `Concluir a tarefa ${def.title}`}
              className={cn(
                "rounded px-2 py-1 text-[10px] font-medium transition-colors",
                isDone
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Check className="mr-1 inline h-3 w-3" aria-hidden="true" />
              {isDone ? "Concluída" : "Concluir"}
            </button>
          )}
          <button
            type="button" onClick={() => setModalOpen(true)}
            title="Abrir página em tela cheia (modal)" aria-label={`Maximizar ${def.title}`}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <Link
            to={def.path}
            className="flex items-center gap-1 rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
            title={`Abrir ${def.title} na rota ${def.path}`}
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">Abrir</span>
          </Link>
        </div>
      </header>

      {/* Corpo: enquadramento (por que/resulta) + página real embutida. */}
      {level !== "collapsed" && (
        <div className={cn(def.note ? "p-4" : "")}>
          <div className="grid gap-2 border-b border-border/40 px-4 py-2.5 sm:grid-cols-2">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground/80">Por que/quando:</span> {def.why}
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground/80">O que resulta:</span> {def.result}
            </p>
          </div>
          {def.note ? (
            <div className="flex items-start gap-2 px-4 pb-4 pt-3 text-xs text-muted-foreground" role="note">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span>{def.note}</span>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={def.path}
              title={`Página ${def.title}`}
              loading="lazy"
              style={{ height: level === "expanded" ? iframeHeight : DEFAULT_HEIGHT }}
              className="w-full border-0 bg-background transition-[height] duration-300"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          )}
        </div>
      )}

      {/* Modal tela cheia com a página real. */}
      <FeatureModal open={modalOpen} onOpenChange={setModalOpen} title={def.title} size="xl">
        {def.note ? (
          <p className="text-sm text-muted-foreground">{def.note}</p>
        ) : (
          <iframe
            src={def.path}
            title={`Página ${def.title} (tela cheia)`}
            className="h-full min-h-[70vh] w-full rounded-md border-0 bg-background"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        )}
      </FeatureModal>
    </section>
  );
}
