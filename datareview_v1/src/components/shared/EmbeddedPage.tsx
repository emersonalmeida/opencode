/**
 * EmbeddedPage — página REAL do sistema renderizada dentro do chat (sem
 * sair da conversa). Usa `<iframe>` same-origin apontando para a rota —
 * a única forma de ter a página exata (router + shell + sidebars) sem
 * conflitos: o React Router proíbe routers aninhados e uma página in-place
 * registraria sidebars no shell hospedeiro. Mesma origem = mesmo
 * localStorage, então os dados coletados aparecem de verdade.
 *
 * - 3 níveis (collapsed/default/expanded) persistidos por path
 *   (`aso:chat-page-level:<path>`); expanded mede a altura do documento
 *   do iframe (página inteira visível).
 * - Montagem preguiçosa: recolhido não carrega nada.
 * - Maximizar abre a página em modal; link "Abrir a página" leva à rota.
 * - Recursão honesta: se o path é a rota ATUAL, explica em vez de aninhar.
 */
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown, ChevronsDownUp, ChevronsUpDown, ExternalLink, Info, Maximize2,
} from "lucide-react";
import { FeatureModal } from "@/components/shared/FeatureModal";

export type PageLevel = "collapsed" | "default" | "expanded";
const LEVEL_ORDER: PageLevel[] = ["collapsed", "default", "expanded"];
const DEFAULT_HEIGHT = 520;

function loadLevel(key: string): PageLevel {
  try {
    const v = localStorage.getItem(`aso:chat-page-level:${key}`);
    return v === "collapsed" || v === "default" || v === "expanded" ? v : "collapsed";
  } catch { return "collapsed"; }
}
function saveLevel(key: string, level: PageLevel) {
  try { localStorage.setItem(`aso:chat-page-level:${key}`, level); } catch { /* quota */ }
}

export function EmbeddedPage({ path, label }: { path: string; label: string }) {
  const [level, setLevel] = useState<PageLevel>(() => loadLevel(path));
  const [modalOpen, setModalOpen] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(DEFAULT_HEIGHT);
  /** Recursão: o chat tenta embutir a própria rota em que está. */
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    try { setIsSelf(window.location.pathname === path); } catch { /* ignore */ }
  }, [path]);

  const cycle = () => {
    const next = LEVEL_ORDER[(LEVEL_ORDER.indexOf(level) + 1) % LEVEL_ORDER.length];
    setLevel(next);
    saveLevel(path, next);
  };

  /** Nível expanded: mede o documento do iframe para mostrar a página toda. */
  useEffect(() => {
    if (level !== "expanded") return;
    const f = iframeRef.current;
    const measure = () => {
      try {
        const doc = f?.contentDocument;
        const h = doc?.documentElement?.scrollHeight;
        if (h && h > 200) setIframeHeight(Math.min(h, 4000));
      } catch { /* cross-origin não acontece (same-origin), mas por segurança */ }
    };
    const onLoad = () => measure();
    f?.addEventListener("load", onLoad);
    measure();
    const t = setInterval(measure, 1500);
    return () => {
      f?.removeEventListener("load", onLoad);
      clearInterval(t);
    };
  }, [level]);

  const Frame = (
    <section
      role="region"
      aria-label={`Página embutida: ${label}`}
      aria-expanded={level !== "collapsed"}
      className="not-prose my-2 overflow-hidden rounded-lg border border-primary/30 bg-card/80"
    >
      {/* Header: título + nível + modal + link para a rota real. */}
      <header className="flex items-center gap-2 border-b border-border/40 bg-secondary/40 px-2.5 py-1.5">
        <button
          type="button"
          onClick={cycle}
          aria-expanded={level !== "collapsed"}
          aria-label={level === "collapsed" ? `Expandir ${label}` : `Recolher ${label}`}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {level === "collapsed" ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : level === "expanded" ? (
            <ChevronsDownUp className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="truncate text-xs font-medium">{label}</span>
          <span className="hidden shrink-0 text-[10px] text-muted-foreground sm:inline" aria-hidden="true">
            página
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button" onClick={() => setModalOpen(true)}
            title="Abrir página em tela cheia (modal)" aria-label={`Maximizar ${label}`}
            className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
          >
            <Maximize2 className="h-3 w-3" aria-hidden="true" />
          </button>
          {level !== "collapsed" && (
            <button
              type="button" onClick={() => { setLevel("collapsed"); saveLevel(path, "collapsed"); }}
              title="Recolher (só título)" aria-label={`Recolher ${label} (só título)`}
              className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <ChevronDown className="h-3 w-3 rotate-180" aria-hidden="true" />
              <span className="sr-only">Recolher</span>
            </button>
          )}
          <Link
            to={path}
            className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
            title={`Abrir ${label} na rota ${path} (sair do chat)`}
          >
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
            <span className="hidden sm:inline">{path}</span>
          </Link>
        </div>
      </header>

      {/* Corpo: a página REAL num iframe same-origin (lazy mount). */}
      {level !== "collapsed" && (
        isSelf ? (
          <div className="flex items-start gap-2 px-3 py-2.5 text-xs text-muted-foreground" role="note">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              Esta é a página em que você está — renderizá-la dentro dela mesma criaria
              recursão. Use o link no cabeçalho para navegar diretamente.
            </span>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={path}
            title={`Página ${label}`}
            loading="lazy"
            style={{ height: level === "expanded" ? iframeHeight : DEFAULT_HEIGHT }}
            className="w-full border-0 bg-background transition-[height] duration-300"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          />
        )
      )}

      {/* Status: origem dos dados + dica de uso. */}
      {level !== "collapsed" && !isSelf && (
        <footer className="flex items-center justify-between gap-2 border-t border-border/40 bg-secondary/30 px-2.5 py-1 text-[10px] text-muted-foreground">
          <span className="truncate">
            Página real e funcional — clique, colete e configure sem sair do chat.
          </span>
          <span className="shrink-0" aria-hidden="true">{path}</span>
        </footer>
      )}
    </section>
  );

  return (
    <>
      {Frame}
      <FeatureModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={label}
        size="xl"
      >
        <iframe
          src={path}
          title={`Página ${label} (tela cheia)`}
          className="h-full min-h-[70vh] w-full border-0 rounded-md bg-background"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </FeatureModal>
    </>
  );
}
