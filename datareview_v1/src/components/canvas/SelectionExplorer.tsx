import { useEffect, useRef, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useCanvasStore } from "@/lib/canvasStore";

/**
 * Envolve a saída renderizada de um nó: quando o usuário seleciona um trecho
 * de texto dentro dela, surge um botão flutuante "Explorar seleção". Clicar
 * cria um nó `prompt` downstream semeado com o trecho selecionado e a
 * instrução escolhida, conecta-o ao nó atual e o executa automaticamente —
 * a IA aprofunda/explora exatamente aquele trecho usando o dataset + saídas
 * anteriores.
 *
 * O botão segue a seleção e some ao clicar ou quando a seleção é limpa.
 */
export function SelectionExplorer({ nodeId, children }: { nodeId: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<string>("");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const exploreSelection = useCanvasStore((s) => s.exploreSelection);
  const running = useCanvasStore((s) => s.running);

  // Track the live text selection while the pointer is within this output.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!text || text.length < 3) {
        setSelection("");
        setMenu(null);
        return;
      }
      // Only react if the selection is anchored inside this node's output.
      if (!sel || !sel.anchorNode || !el.contains(sel.anchorNode)) {
        setMenu(null);
        return;
      }
      setSelection(text);
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      setMenu({ x: rect.left + rect.width / 2, y: rect.top });
    };
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, []);

  const handleExplore = (instruction?: string) => {
    if (!selection) return;
    exploreSelection(nodeId, selection, instruction);
    setSelection("");
    setMenu(null);
    window.getSelection()?.removeAllRanges();
  };

  return (
    <div ref={ref} className="relative">
      {children}
      {menu && selection && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full flex items-center gap-1 bg-card border border-border/60 rounded-lg shadow-lg p-1"
          style={{ left: menu.x, top: menu.y - 6 }}
        >
          <button
            onClick={() => handleExplore()}
            disabled={running}
            className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            title="Aprofundar o trecho selecionado com IA"
          >
            <Sparkles className="h-3 w-3" /> Explorar seleção
          </button>
          <button
            onClick={() => { setSelection(""); setMenu(null); window.getSelection()?.removeAllRanges(); }}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
            title="Fechar"
            aria-label="Fechar"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
