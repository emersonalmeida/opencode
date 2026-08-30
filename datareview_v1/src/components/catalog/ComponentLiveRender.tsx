/**
 * ComponentLiveRender — renderiza QUALQUER componente do inventário de forma
 * genérica e segura (lazy import + ErrorBoundary), para visualização ao vivo
 * no catálogo, layouts, design canvas e páginas customizadas.
 *
 * Estratégia de export: prefere o export com o MESMO nome do arquivo
 * (convenção do sistema), senão o `default`, senão o primeiro export de
 * componente (capitalizado). Re-renderiza quando `file` muda.
 *
 * Honestidade: componentes que exigem props/contextos específicos mostram o
 * erro real (nunca simulam conteúdo); módulos de utilidades (sem export de
 * componente) mostram aviso claro.
 */
import { Component, useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { COMPONENT_MODULES, type ComponentModule } from "@/lib/componentModules.generated";

function pickExport(mod: ComponentModule, file: string): { name: string; comp: unknown } | null {
  const base = file.split("/").pop()?.replace(/\.(tsx|ts)$/, "");
  const preferred = base && mod[base] ? base : mod.default ? "default" : null;
  const name = preferred ?? Object.keys(mod).find((k) => k !== "default" && /^[A-Z]/.test(k)) ?? (base && mod[base] ? base : null);
  const comp = name === "default" ? mod.default : name ? mod[name] : null;
  if (typeof comp === "function") return { name: name === "default" ? "default" : (name as string), comp };
  return null;
}

interface BoundaryProps { children: ReactNode; file: string }

class RenderBoundary extends Component<BoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch() { /* render genérico é propositalmente exploratório */ }
  render() {
    if (this.state.error) {
      return (
        <p className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400" role="alert">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Este componente precisa de props ou contexto específico para renderizar
            — por isso ele vive dentro das páginas, não numa vitrine genérica.
            <code className="block mt-1 text-[10px] opacity-70">{this.state.error.message}</code>
          </span>
        </p>
      );
    }
    return this.props.children;
  }
}

export function ComponentLiveRender({ file }: { file: string }) {
  const [state, setState] = useState<{ status: "loading" | "ok" | "empty"; node: ReactNode }>({ status: "loading", node: null });

  useEffect(() => {
    let cancelled = false;
    const loader = COMPONENT_MODULES[file];
    if (!loader) {
      setState({ status: "empty", node: null });
      return;
    }
    setState({ status: "loading", node: null });
    loader()
      .then((mod) => {
        if (cancelled) return;
        const picked = pickExport(mod, file);
        if (!picked) {
          setState({
            status: "empty",
            node: (
              <p className="text-[11px] text-muted-foreground">
                Módulo de utilidades/tipos — não há componente renderizável aqui.
              </p>
            ),
          });
          return;
        }
        const C = picked.comp as (props: Record<string, unknown>) => ReactNode;
        setState({
          status: "ok",
          node: (
            <RenderBoundary file={file}>
              <C />
            </RenderBoundary>
          ),
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          status: "empty",
          node: (
            <p className="text-[11px] text-destructive" role="alert">
              Falha ao carregar o módulo: {String(err?.message ?? err)}
            </p>
          ),
        });
      });
    return () => { cancelled = true; };
  }, [file]);

  if (state.status === "loading") {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando render…
      </p>
    );
  }
  return <div className="[&_*]:max-w-full">{state.node}</div>;
}
