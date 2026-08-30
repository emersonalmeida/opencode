/**
 * ExpandableBlock — bloco de conteúdo expansível/recolhível com 3 níveis,
 * o mesmo comportamento do AIOutputCard aplicado a QUALQUER conteúdo
 * (não só saídas de IA):
 *
 *  - collapsed → só o header (título + ações).
 *  - default   → conteúdo normal (com scroll interno quando o conteúdo é
 *    limitado pela página).
 *  - expanded  → conteúdo completo, sem clamp, com leve destaque.
 *
 * Extras padronizados: copiar/baixar o payload do bloco (JSON ou texto),
 * persistência do nível por `storageKey`, a11y (aria-expanded, região
 * nomeada), ancoragem via `id` para a aba "Seções" das sidebars internas.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronsDownUp, ChevronsUpDown, Copy, Download } from "lucide-react";
import { CATALOG_OPEN_EVENT, catalogEventSectionId } from "@/lib/pageFrames";
import { cn } from "@/lib/utils";

export type BlockLevel = "collapsed" | "default" | "expanded";
const LEVEL_ORDER: BlockLevel[] = ["collapsed", "default", "expanded"];

function loadLevel(storageKey: string | undefined, fb: BlockLevel): BlockLevel {
  if (!storageKey) return fb;
  try {
    const v = localStorage.getItem(`aso:block-level:${storageKey}`);
    return v === "collapsed" || v === "default" || v === "expanded" ? v : fb;
  } catch { return fb; }
}

export interface ExpandableBlockProps {
  /** Âncora estável (usada pela aba "Seções" + deep link). */
  id?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** Badges/ações à direita do header (ex.: contadores). */
  headerRight?: ReactNode;
  /** Persistência do nível (recomendado). */
  storageKey?: string;
  defaultLevel?: BlockLevel;
  /** Serialização p/ copiar/baixar (objeto → JSON, string → texto). */
  exportData?: () => unknown;
  exportName?: string;
  children: ReactNode;
  className?: string;
}

export function ExpandableBlock({
  id, title, subtitle, icon, headerRight, storageKey,
  defaultLevel = "default", exportData, exportName, children, className,
}: ExpandableBlockProps) {
  const [level, setLevel] = useState<BlockLevel>(() => loadLevel(storageKey, defaultLevel));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(`aso:block-level:${storageKey}`, level); } catch { /* quota */ }
  }, [level, storageKey]);

  // Navegação por âncora (sidebars): o evento global de abrir seção expande
  // o bloco se ele estiver recolhido (o scroll é feito por quem dispara).
  useEffect(() => {
    if (!id) return;
    const handler = (e: Event) => {
      if (catalogEventSectionId(e) !== id) return;
      setLevel((l) => (l === "collapsed" ? "default" : l));
    };
    window.addEventListener(CATALOG_OPEN_EVENT, handler);
    return () => window.removeEventListener(CATALOG_OPEN_EVENT, handler);
  }, [id]);

  const cycleLevel = () => {
    const i = LEVEL_ORDER.indexOf(level);
    setLevel(LEVEL_ORDER[(i + 1) % LEVEL_ORDER.length]);
  };

  const serialized = (): string | null => {
    if (!exportData) return null;
    const d = exportData();
    return typeof d === "string" ? d : JSON.stringify(d, null, 2);
  };

  const copy = async () => {
    const text = serialized();
    if (text == null) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const text = serialized();
    if (text == null) return;
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportName ?? id ?? "bloco"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const cycleLabel =
    level === "collapsed" ? "Expandir bloco"
    : level === "default" ? "Expandir totalmente"
    : "Recolher bloco";

  return (
    <section
      id={id}
      aria-label={typeof title === "string" ? title : undefined}
      className={cn(
        "rounded-xl border border-border/60 bg-card/40 overflow-hidden transition-shadow scroll-mt-4",
        level === "expanded" && "shadow-md ring-1 ring-primary/20",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-card/60">
        <button
          onClick={cycleLevel}
          aria-expanded={level !== "collapsed"}
          aria-label={cycleLabel}
          title={cycleLabel}
          className="flex items-center gap-2 min-w-0 flex-1 text-left group"
        >
          {icon}
          <span className="min-w-0">
            <span className="block text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{title}</span>
            {subtitle ? <span className="block text-[10px] text-muted-foreground truncate">{subtitle}</span> : null}
          </span>
        </button>
        {headerRight}
        {exportData && (
          <>
            <button
              onClick={copy}
              title="Copiar configurações do bloco (JSON)"
              aria-label="Copiar configurações do bloco"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={download}
              title="Baixar configurações do bloco (.json)"
              aria-label="Baixar configurações do bloco"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button
          onClick={cycleLevel}
          aria-expanded={level !== "collapsed"}
          aria-label={cycleLabel}
          title={cycleLabel}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {level === "collapsed" ? <ChevronDown className="h-3.5 w-3.5" />
            : level === "default" ? <ChevronsUpDown className="h-3.5 w-3.5" />
            : <ChevronsDownUp className="h-3.5 w-3.5" />}
        </button>
      </div>
      {level !== "collapsed" && <div>{children}</div>}
    </section>
  );
}
