import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Orbit, User, ChevronRight, FastForward } from "lucide-react";
import { buildHostScript, hostActionsFor, acceptanceLine, type HostAction } from "@/lib/welcome/hostScript";
import type { VisitorContext } from "@/lib/welcome/welcomeModel";

/** Lê (e observa) a preferência de movimento reduzido do sistema. */
function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}

/**
 * Linha de fala com efeito de digitação (typewriter). Com movimento reduzido
 * ou `skip`, o texto aparece inteiro imediatamente.
 */
function TypeLine({
  text, instant, onDone,
}: { text: string; instant: boolean; onDone: () => void }) {
  const [shown, setShown] = useState(instant ? text.length : 0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (instant) {
      setShown(text.length);
      if (!doneRef.current) {
        doneRef.current = true;
        onDoneRef.current();
      }
      return;
    }
    const timer = setInterval(() => {
      setShown((n) => {
        const next = Math.min(n + 2, text.length);
        if (next >= text.length) {
          clearInterval(timer);
          if (!doneRef.current) {
            doneRef.current = true;
            setTimeout(() => onDoneRef.current(), 60);
          }
        }
        return next;
      });
    }, 18);
    return () => clearInterval(timer);
  }, [text, instant]);

  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
      {text.slice(0, shown)}
      {shown < text.length && <span className="welcome-caret" aria-hidden="true" />}
    </p>
  );
}

/** Indicador "anfitrião digitando…" (três pontos pulsantes). */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" role="status" aria-label="O anfitrião está digitando">
      <span className="welcome-dot" style={{ animationDelay: "0ms" }} />
      <span className="welcome-dot" style={{ animationDelay: "160ms" }} />
      <span className="welcome-dot" style={{ animationDelay: "320ms" }} />
    </span>
  );
}

interface ChatMsg {
  id: string;
  role: "host" | "user";
  text: string;
}

/**
 * O anfitrião conversacional da página Boas-vindas: conduz o usuário em uma
 * conversa guiada (falas sequenciais com typewriter), termina oferecendo
 * quick replies REAIS — o usuário responde, o anfitrião confirma e leva.
 *
 * Heurísticas aplicadas: visibilidade de status (digitando/caret), controle
 * do usuário (pular a conversa inteira ou acelerar cada fala), correspondência
 * com o mundo real (linguagem de anfitrião, não de sistema), e prevenção de
 * erros (nenhuma ação destrutiva é oferecida aqui).
 */
export function HostGuide({ ctx }: { ctx: VisitorContext }) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const script = useMemo(() => buildHostScript(ctx), [ctx]);
  const actions = useMemo(() => hostActionsFor(ctx), [ctx]);

  const [progress, setProgress] = useState(0); // quantas falas do roteiro já completaram
  const [waiting, setWaiting] = useState(false); // pausa entre falas
  const [extras, setExtras] = useState<ChatMsg[]>([]); // falas pós-roteiro (user + aceite)
  const [skipped, setSkipped] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const instant = reduced || skipped;
  const scriptDone = progress >= script.length;
  const conversationDone = scriptDone && extras.length === 0;

  // Avança para a próxima fala após uma pequena pausa (o "respiro" do anfitrião).
  const advance = () => {
    if (instant) {
      setProgress((n) => Math.min(n + 1, script.length));
      return;
    }
    setWaiting(true);
    setTimeout(() => {
      setWaiting(false);
      setProgress((n) => Math.min(n + 1, script.length));
    }, 420);
  };

  const accept = (action: HostAction) => {
    if (leaving) return;
    setLeaving(true);
    setExtras([
      { id: `u-${action.id}`, role: "user", text: action.label },
      { id: `a-${action.id}`, role: "host", text: acceptanceLine(action.id) },
    ]);
    setTimeout(() => navigate(action.path), instant ? 350 : 1900);
  };

  // Auto-scroll simples: a conversa é curta e vive num painel com altura máxima.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [progress, waiting, extras]);

  return (
    <section
      className="w-full max-w-2xl rounded-2xl border border-border bg-card/60 shadow-sm backdrop-blur-sm"
      aria-label="Conversa com o anfitrião"
    >
      <header className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="welcome-orb-sm flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
          <Orbit className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium leading-tight">Anfitrião</p>
          <p className="text-xs text-muted-foreground">Guia do sistema — sempre presente, nunca no caminho</p>
        </div>
        {!conversationDone && !instant && (
          <button
            type="button"
            onClick={() => setSkipped(true)}
            className="interactive inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <FastForward className="h-3.5 w-3.5" aria-hidden="true" />
            Acelerar
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex max-h-[46vh] flex-col gap-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {script.slice(0, progress + (scriptDone ? 0 : 1)).map((line, i) => (
          <div key={line.id} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
              <Orbit className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-muted/60 px-3 py-2 text-left">
              {i < progress ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{line.text}</p>
              ) : (
                <TypeLine text={line.text} instant={instant} onDone={advance} />
              )}
            </div>
          </div>
        ))}

        {waiting && !instant && !scriptDone && (
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary" aria-hidden="true">
              <Orbit className="h-3 w-3" />
            </span>
            <div className="rounded-xl rounded-tl-sm bg-muted/60 px-3 py-2">
              <TypingDots />
            </div>
          </div>
        )}

        {extras.map((m, i) => (
          <div key={m.id} className={`flex items-start gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                m.role === "user" ? "bg-secondary text-secondary-foreground" : "bg-primary/15 text-primary"
              }`}
              aria-hidden="true"
            >
              {m.role === "user" ? <User className="h-3 w-3" /> : <Orbit className="h-3 w-3" />}
            </span>
            <div
              className={`min-w-0 flex-1 rounded-xl px-3 py-2 ${
                m.role === "user" ? "rounded-tr-sm bg-primary/15 text-right" : "rounded-tl-sm bg-muted/60 text-left"
              }`}
            >
              {m.role === "user" || i < extras.length - 1 || instant ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{m.text}</p>
              ) : (
                <TypeLine text={m.text} instant={instant} onDone={() => {}} />
              )}
            </div>
          </div>
        ))}

        {conversationDone && (
          <div className="mt-1 flex flex-wrap gap-2 pl-9" role="group" aria-label="Sugestões do anfitrião">
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => accept(a)}
                disabled={leaving}
                className="interactive inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-sm text-foreground hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
              >
                {a.label}
                <ChevronRight className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
