import { useState } from "react";
import { Blocks, Layers, Lightbulb, HelpCircle, Workflow, Sparkles } from "lucide-react";
import { CanvasPalette } from "@/components/canvas/CanvasPalette";
import { PIPELINE_TEMPLATES } from "@/components/canvas/pipelineTemplates";
import { useCanvasStore } from "@/lib/canvasStore";
import { NODE_PALETTE } from "@/components/canvas/nodeRegistry";

type ToolsTab = "nodes" | "templates" | "exemplos" | "ajuda";

/**
 * Ferramentas do Canvas na sidebar — sub-abas: Nós (paleta), Templates
 * (pipelines prontos, carregam inline), Exemplos (pipeline didático) e Ajuda
 * (como o canvas funciona). Antes tudo era uma lista única misturada.
 */
export function CanvasToolsPanel({ onOpenGallery }: { onOpenGallery?: () => void }) {
  const [sub, setSub] = useState<ToolsTab>("nodes");
  const loadTemplate = useCanvasStore((s) => s.loadTemplate);
  const loadExample = useCanvasStore((s) => s.loadExample);
  const nodes = useCanvasStore((s) => s.nodes);

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/50 flex-shrink-0" role="tablist" aria-label="Ferramentas do canvas">
        {([
          { key: "nodes" as const, label: "Nós", icon: Blocks },
          { key: "templates" as const, label: "Templates", icon: Layers },
          { key: "exemplos" as const, label: "Exemplos", icon: Lightbulb },
          { key: "ajuda" as const, label: "Ajuda", icon: HelpCircle },
        ]).map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={sub === t.key}
            onClick={() => setSub(t.key)}
            className={`flex items-center gap-1 text-[10px] px-1.5 py-1 rounded-md transition-colors ${sub === t.key ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="h-3 w-3" /> {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {sub === "nodes" && <CanvasPalette onOpenGallery={onOpenGallery} />}

        {sub === "templates" && (
          <div className="p-2 space-y-1.5">
            <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
              Pipelines prontos para carregar direto (se o canvas não estiver vazio, será substituído com confirmação).
            </p>
            {PIPELINE_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  if (nodes.length > 0 && !confirm("Substituir o canvas atual pelo template?")) return;
                  loadTemplate(t.build());
                }}
                className="w-full text-left p-2 rounded-lg border border-border/50 bg-card hover:border-primary/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <t.icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-[11px] font-medium text-foreground">{t.name}</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        )}

        {sub === "exemplos" && (
          <div className="p-2 space-y-2">
            <p className="text-[10px] text-muted-foreground leading-relaxed px-1">
              Um pipeline didático que mostra IA encadeada: busca → coleta → análise → refinamento → apresentação + gráficos.
            </p>
            <button
              onClick={() => {
                if (nodes.length > 0 && !confirm("Substituir o canvas atual pelo exemplo?")) return;
                loadExample();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-primary/30 bg-primary/5 text-primary text-[11px] font-medium hover:bg-primary/10 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" /> Carregar pipeline de exemplo
            </button>
          </div>
        )}

        {sub === "ajuda" && (
          <div className="p-3 space-y-2.5 text-[10px] text-muted-foreground leading-relaxed">
            <HelpItem title="1. Monte o fluxo" text="Adicione nós da aba Nós (ou Templates/Exemplos) e conecte-os arrastando pelos pontos laterais." />
            <HelpItem title="2. Configure" text="Clique no ⚙ do nó para editar campos. A aba Canvas (nesta sidebar) mostra as opções do nó selecionado com mais espaço." />
            <HelpItem title="3. Execute" text="Botão Executar (toolbar/terminal) roda todos os nós ativos. O ▶ do nó executa só ele. Nó desativado (⚡ Power) é pulado." />
            <HelpItem title="4. Veja a saída" text="Nós de processamento mostram só o resumo. Conecte um nó Saída renderizada (ou deixe a auto-criação) para ver markdown/gráficos." />
            <HelpItem title="5. Acompanhe" text="O Terminal (aba ao lado) mostra logs exatos do canvas + do sistema + recursos (CPU/RAM/GPU) em tempo real." />
            <div className="pt-1 border-t border-border/40">
              <p className="text-[10px] font-medium text-foreground mb-1">Status dos nós</p>
              <ul className="space-y-0.5">
                <li>● Parado — aguardando execução.</li>
                <li>⟳ Executando/Gerando — processando agora.</li>
                <li>✓ Concluído — saída pronta.</li>
                <li>✕ Erro — veja o terminal.</li>
                <li>⊘ Pulado — desativado, não executa.</li>
              </ul>
            </div>
            <p className="text-[9px]">{NODE_PALETTE.length} tipos de nó disponíveis, encadeáveis (IA analisa o que IA gerou).</p>
          </div>
        )}
      </div>
    </div>
  );
}

function HelpItem({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-foreground flex items-center gap-1">
        <Workflow className="h-3 w-3 text-primary shrink-0" /> {title}
      </p>
      <p>{text}</p>
    </div>
  );
}
