import { useEffect, type ReactNode } from "react";
import { useFeatureFlags } from "@/lib/featureFlags";
import { useWM } from "@/lib/windowManager";
import { FloatingWindow } from "@/components/FloatingWindow";

/**
 * Workspace — o "desktop" do sistema.
 *
 * Quando a feature flag `ui.window-tiling` está ON, este componente renderiza
 * uma camada absoluta (acima do conteúdo normal) que contém as janelas
 * flutuantes (FloatingWindow). O usuário pode abrir janelas via
 * `useWM().open(...)`, arrastá-las, redimensioná-las, encaixá-las.
 *
 * Quando OFF, nada é renderizado — as páginas usam o layout de colunas padrão.
 *
 * Padrão: cada página pode chamar `<Workspace renderers={...}>` para declarar
 * quais "kinds" de janela ela suporta. O conteúdo de cada janela vem do
 * renderer correspondente ao `window.kind`.
 */
export interface WorkspaceProps {
  /** Mapa kind → renderizador de conteúdo. */
  renderers?: Record<string, (kind: string) => ReactNode>;
  /** Conteúdo normal da página (sob a camada de janelas). */
  children?: ReactNode;
  /** classe extra na camada de janelas. */
  className?: string;
}

export function Workspace({ renderers, children, className }: WorkspaceProps) {
  const flags = useFeatureFlags();
  const windows = useWM((s) => s.windows);
  const on = flags["ui.window-tiling"];

  // Limpa janelas órfãs quando o modo é desligado (evita janelas presas).
  useEffect(() => {
    if (!on && windows.length > 0) useWM.getState().closeAll();
  }, [on, windows.length]);

  return (
    <div className="relative h-full w-full">
      {children}
      {on && (
        <div className={className} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {windows.map((w) => (
            <div key={w.id} style={{ pointerEvents: "auto" }}>
              <FloatingWindow window={w}>
                {renderers?.[w.kind]?.(w.kind) ?? (
                  <div className="p-4 text-xs text-muted-foreground">
                    Janela “{w.title}” (kind: {w.kind}). Sem renderizador.
                  </div>
                )}
              </FloatingWindow>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
