import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Layers, Search, X } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { OneHero } from "@/components/one/OneHero";
import { OneSourceSection } from "@/components/one/OneSourceSection";
import { OneAI } from "@/components/one/OneAI";
import { ALL_ONE_SECTIONS } from "@/lib/one/oneSources";
import type { UniItem } from "@/lib/uni/types";
import "@/components/one/oneSnap.css";

/**
 * One Page (`/one`) — todas as fontes do sistema numa única página de
 * slides fullscreen com scroll snap vertical. Cada fonte é uma seção que
 * ocupa a tela inteira; o usuário roda (ou navega pelos pontos/teclado)
 * entre fontes. Busca global dispara a coleta em todas; cada seção também
 * pesquisa, configura, seleciona e salva de forma independente.
 */
export default function One() {
  const sections = useMemo(() => ALL_ONE_SECTIONS, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const runnersRef = useRef(new Map<string, (q: string) => void>());
  const [active, setActive] = useState(0);
  const [globalQuery, setGlobalQuery] = useState("");
  // Itens coletados por seção — alimentam a seção IA (cruzamento de fontes).
  const [itemsBySection, setItemsBySection] = useState<Record<string, UniItem[]>>({});
  const allItems = useMemo(() => Object.values(itemsBySection).flat(), [itemsBySection]);
  const onSectionItems = useCallback((id: string, items: UniItem[]) => {
    setItemsBySection((prev) => ({ ...prev, [id]: items }));
  }, []);
  // Seções com dados (para o resumo do catálogo no topo).
  const loadedCount = useMemo(() => Object.values(itemsBySection).filter((arr) => arr.length > 0).length, [itemsBySection]);

  // Observa qual seção está dominando a viewport (snap).
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            const idx = sectionRefs.current.indexOf(e.target as HTMLElement);
            if (idx >= 0) setActive(idx);
          }
        }
      },
      { root: container, threshold: [0.6] },
    );
    for (const el of sectionRefs.current) if (el) obs.observe(el);
    return () => obs.disconnect();
  }, [sections.length]);

  const scrollTo = useCallback((idx: number) => {
    const el = sectionRefs.current[idx];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Teclado: PageDown/PageUp/↓/↑ navegam quando o foco NÃO está num campo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "PageDown" || e.key === "ArrowDown") { e.preventDefault(); scrollTo(Math.min(active + 1, sections.length)); }
      if (e.key === "PageUp" || e.key === "ArrowUp") { e.preventDefault(); scrollTo(Math.max(active - 1, 0)); }
      if (e.key === "Home") { e.preventDefault(); scrollTo(0); }
      if (e.key === "End") { e.preventDefault(); scrollTo(sections.length); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, scrollTo, sections.length]);

  const registerRunner = useCallback((id: string, run: (q: string) => void) => {
    runnersRef.current.set(id, run);
  }, []);

  const runAll = useCallback(() => {
    const q = globalQuery.trim();
    if (!q) return;
    // Dispara a coleta nas seções que pesquisam por termo (não-URL).
    for (const def of sections) {
      if (def.caps.needsUrl) continue;
      const run = runnersRef.current.get(def.id);
      if (run) run(q);
    }
    // Leva o usuário à primeira fonte (trending) para ver o resultado.
    scrollTo(1);
  }, [globalQuery, sections, scrollTo]);

  const total = sections.length + 1; // + hero

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <AppHeader title="One Page" crumb="Todas as fontes" showSearch={false} />

      {/* Barra de busca global + progresso */}
      <div className="flex shrink-0 items-center gap-3 border-b bg-card/60 px-4 py-2 backdrop-blur sm:px-6">
        <form className="flex min-w-0 flex-1 items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); runAll(); }}>
          <label htmlFor="one-global-q" className="sr-only">Pesquisar em todas as fontes</label>
          <input
            id="one-global-q"
            type="search"
            value={globalQuery}
            onChange={(e) => setGlobalQuery(e.target.value)}
            placeholder="Pesquisar em todas as fontes… (ex.: inteligência artificial)"
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          />
          {globalQuery && (
            <button type="button" onClick={() => setGlobalQuery("")} aria-label="Limpar busca" className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary/60">
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
          <button type="submit" disabled={!globalQuery.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground outline-none hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50">
            <Search className="h-4 w-4" aria-hidden />
            Buscar em todas
          </button>
        </form>
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex" role="status" aria-live="polite">
          <Layers className="h-3.5 w-3.5" aria-hidden />
          {active + 1} / {total}
          {loadedCount > 0 && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
              {loadedCount} fonte{loadedCount !== 1 ? "s" : ""} com dados · {allItems.length} itens
            </span>
          )}
        </span>
      </div>

      {/* Container snap */}
      <div className="relative flex-1 min-h-0">
        <div ref={containerRef} className="one-snap-container" role="main" aria-label="Fontes de dados — slides">
          {/* 1 · Landing */}
          <section
            ref={(el) => { sectionRefs.current[0] = el; }}
            className="one-snap-section"
            aria-label="Apresentação"
            tabIndex={-1}
          >
            <OneHero onStart={() => scrollTo(1)} />
          </section>

          {/* 2..N · Fontes (+ seção IA) */}
          {sections.map((def, i) => (
            <section
              key={def.id}
              ref={(el) => { sectionRefs.current[i + 1] = el; }}
              className="one-snap-section"
              aria-label={def.title}
              tabIndex={-1}
            >
              {def.kind === "ai" ? (
                <OneAI items={allItems} />
              ) : (
                <OneSourceSection def={def} globalQuery={globalQuery} registerRunner={registerRunner} onItems={onSectionItems} />
              )}
            </section>
          ))}
        </div>

        {/* Snap dots (navegação) */}
        <nav
          aria-label="Navegar entre as fontes"
          className="absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 flex-col items-center gap-1 rounded-full border bg-card/80 px-1.5 py-2 backdrop-blur md:flex"
        >
          <button type="button" onClick={() => scrollTo(0)} aria-label="Voltar ao topo" className="mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:text-primary">
            <ArrowUp className="h-3 w-3" aria-hidden />
          </button>
          <ol className="flex max-h-[60vh] flex-col gap-1 overflow-y-auto">
            {[{ id: "hero", title: "Início" } as const, ...sections].map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => scrollTo(i)}
                  aria-label={`Ir para ${s.title} (seção ${i + 1} de ${total})`}
                  aria-current={active === i}
                  title={s.title}
                  className={`block h-2 w-2 rounded-full outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/60 ${active === i ? "scale-150 bg-primary" : "bg-muted-foreground/40 hover:bg-muted-foreground/70"}`}
                />
              </li>
            ))}
          </ol>
        </nav>
      </div>
    </div>
  );
}
