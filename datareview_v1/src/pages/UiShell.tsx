/**
 * Página UI — a NOVA página inicial do sistema: estrutura de layout pura
 * (sem conteúdo), mobile-first e responsiva:
 *
 *   barra de status (topo, 100%) · header/barra de ferramentas (100%) ·
 *   5 colunas (externa/interna à esquerda · centro · interna/externa à
 *   direita) expansíveis, recolhíveis, redimensionáveis e inteligentes ·
 *   footer com barra de status (100%).
 *
 * As colunas fecham sozinhas quando falta espaço e ficam funcionais mesmo
 * fechadas (overlays por clique nos ícones do rail). No mobile, viram
 * gavetas overlay. O botão "Resetar" volta ao padrão dividido em 3
 * colunas. Toda a lógica vive em `src/components/uiShell/` (componentes)
 * e `src/lib/uiShell/` (núcleo puro + store).
 */
import { UiShell } from "@/components/uiShell/UiShell";

export default function UiShellPage() {
  return (
    <div className="h-full min-h-0 w-full">
      <UiShell />
    </div>
  );
}
