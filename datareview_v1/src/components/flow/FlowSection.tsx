/**
 * FlowSection — a casca de cada etapa da jornada (`/fluxo`).
 *
 * Três estados de visibilidade (independentes do tamanho do conteúdo):
 *  - recolhida: uma linha com número, título, status e resumo;
 *  - aberta (default): conteúdo completo; se exceder a altura visível,
 *    scroll interno (o painel nunca estoura o layout);
 *  - expandida: sem limite de altura — o conteúdo inteiro aparece.
 *
 * Altura ajustável por drag handle na borda inferior (duplo-clique = reset).
 * Estado (aberto/altura) persistido por seção. Acessível: header inteiro é
 * um botão com aria-expanded; conteúdo tem role=region + aria-labelledby.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown, ChevronUp, Maximize2, Minimize2, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FLOW_STATUS_META, type FlowSectionDef, type FlowSectionState } from "@/lib/flow/flowModel";
import { setFocusedSection } from "@/lib/flow/flowFocus";

function loadBool(key: string, fb: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fb : v === "1";
  } catch {
    return fb;
  }
}

function loadNum(key: string): number | null {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota */
  }
}

export interface FlowIO {
  /** Ex.: "8 apps · 21.432 reviews" */
  input: string;
  /** Ex.: "14 metodologias" */
  processing: string;
  /** Ex.: "37 sinais" */
  output: string;
}

interface Props {
  def: FlowSectionDef;
  state: FlowSectionState;
  /** Tríade entrada → processamento → saída (opcional). */
  io?: FlowIO;
  /** Seção seguinte (CTA "Avançar"); null na última. */
  next?: { id: string; title: string } | null;
  /** Scroll+expand para uma seção pelo id. */
  onGoTo?: (id: string) => void;
  /** Ações extras no header. */
  actions?: ReactNode;
  children: ReactNode;
}

export function FlowSection({ def, state, io, next, onGoTo, actions, children }: Props) {
  const Icon = def.icon;
  const baseKey = `aso:flow-section:${def.id}`;
  const [open, setOpen] = useState<boolean>(() => loadBool(`${baseKey}-open`, def.id === "missao"));
  const [expanded, setExpanded] = useState(false);
  const [height, setHeight] = useState<number | null>(() => loadNum(`${baseKey}-h`));
  const meta = FLOW_STATUS_META[state.status];
  const MetaIcon = meta.icon;
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const maxH = height ?? Math.floor((typeof window === "undefined" ? 600 : window.innerHeight) * 0.72);

  const toggleOpen = () => {
    setOpen((v) => {
      persist(`${baseKey}-open`, !v ? "1" : "0");
      if (!v) setFocusedSection(def.id);
      return !v;
    });
  };

  const onDragStart = useCallback((e: React.PointerEvent) => {
    dragRef.current = true;
    startY.current = e.clientY;
    startH.current = bodyRef.current?.offsetHeight ?? maxH;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [maxH]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const h = Math.max(140, Math.min(1600, startH.current + (e.clientY - startY.current)));
    setHeight(h);
  }, []);

  const onDragEnd = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = false;
    if (bodyRef.current) persist(`${baseKey}-h`, String(Math.round(bodyRef.current.offsetHeight)));
  }, [baseKey]);

  const resetHeight = () => {
    setHeight(null);
    try {
      localStorage.removeItem(`${baseKey}-h`);
    } catch {
      /* ignore */
    }
  };

  // Navegação por âncora: o page/navigator dispara "flow:open" e a seção alvo
  // se expande (respeitando a persistência) antes do scrollIntoView.
  useEffect(() => {
    const onOpen = (e: Event) => {
      if ((e as CustomEvent<string>).detail === def.id) {
        setOpen(true);
        persist(`${baseKey}-open`, "1");
      }
    };
    window.addEventListener("flow:open", onOpen);
    return () => window.removeEventListener("flow:open", onOpen);
  }, [def.id, baseKey]);

  return (
    <section
      id={`flow-${def.id}`}
      data-flow-section={def.id}
      aria-labelledby={`flow-${def.id}-title`}
      className="rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm scroll-mt-28"
    >
      {/* Header — o botão principal expande/recolhe a seção */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <button
          onClick={toggleOpen}
          aria-expanded={open}
          aria-controls={`flow-${def.id}-body`}
          className="flex flex-1 min-w-0 items-start gap-3 text-left group"
        >
          <span
            aria-hidden
            className={cn(
              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold tabular-nums",
              state.status === "done"
                ? "border-status-success/40 bg-status-success/10 text-status-success"
                : state.status === "ready"
                  ? "border-status-info/40 bg-status-info/10 text-status-info"
                  : "border-border bg-secondary text-muted-foreground",
            )}
          >
            {def.num}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 flex-wrap">
              <Icon className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <h2 id={`flow-${def.id}-title`} className="text-sm font-semibold tracking-tight">
                {def.title}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  meta.chip,
                )}
              >
                <MetaIcon className="h-3 w-3" aria-hidden />
                {meta.label}
              </span>
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground truncate">
              {open ? def.subtitle : `${def.subtitle} — ${state.detail}`}
            </span>
          </span>
          {open ? (
            <ChevronUp className="h-4 w-4 mt-1 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 mt-1 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
          )}
        </button>
      </div>

      {open && (
        <div id={`flow-${def.id}-body`} role="region" aria-labelledby={`flow-${def.id}-title`}>
          {/* Tríade entrada → processamento → saída + ações */}
          <div className="px-4 pb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground border-b border-border/40">
            {io && (
              <span className="inline-flex items-center gap-1.5 flex-wrap" aria-label="Entrada, processamento e saída">
                <span className="font-medium text-foreground/80">Entrada:</span> {io.input}
                <ArrowRight className="h-3 w-3" aria-hidden />
                <span className="font-medium text-foreground/80">Processamento:</span> {io.processing}
                <ArrowRight className="h-3 w-3" aria-hidden />
                <span className="font-medium text-foreground/80">Saída:</span> {io.output}
              </span>
            )}
            <span className="flex-1" />
            {actions}
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-pressed={expanded}
              aria-label={expanded ? `Reduzir ${def.title}` : `Expandir ${def.title} sem limite de altura`}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-secondary text-muted-foreground hover:text-foreground"
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" aria-hidden /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden />}
              {expanded ? "Reduzir" : "Expandir"}
            </button>
            {def.deepLinks.map((l) => (
              <Link
                key={l.path + l.label}
                to={l.path}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-secondary text-primary hover:underline"
              >
                Abrir {l.label}
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            ))}
          </div>

          {/* Conteúdo — expandido: sem limite; normal: altura ajustável c/ scroll */}
          <div
            ref={bodyRef}
            style={expanded ? undefined : { maxHeight: maxH }}
            className={cn("p-4", !expanded && "overflow-y-auto")}
          >
            {children}
          </div>

          {!expanded && (
            <button
              onPointerDown={onDragStart}
              onPointerMove={onDragMove}
              onPointerUp={onDragEnd}
              onDoubleClick={resetHeight}
              title="Arraste para ajustar a altura · duplo-clique para redefinir"
              aria-label={`Ajustar altura da seção ${def.title}`}
              className="block h-3 w-full cursor-row-resize border-t border-border/40 hover:bg-primary/5 group"
            >
              <span className="mx-auto mt-1 block h-0.5 w-10 rounded-full bg-border group-hover:bg-primary/50" />
            </button>
          )}

          {/* CTA da próxima etapa */}
          {next && onGoTo && (
            <div className="px-4 py-3 border-t border-border/40">
              <button
                onClick={() => onGoTo(next.id)}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                Avançar: {next.title}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
