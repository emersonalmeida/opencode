/**
 * Explorador de interação com IA — Análise vs Chat vs Canvas.
 * Cada um abre uma mini-demo inline usando primitivas reais do produto
 * (sem chamadas de IA).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, MessageSquare, Workflow, ArrowUpRight, Sparkles } from "lucide-react";
import { useDataset } from "@/hooks/useDataset";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { cn } from "@/lib/utils";
import { CaseCard, CaseLabel } from "./CaseShell";

type Mode = "analysis" | "chat" | "canvas";

const MODES: { id: Mode; label: string; icon: typeof BarChart3; relation: string; desc: string; to: string }[] = [
  { id: "analysis", label: "Análise", icon: BarChart3, relation: "Interpretação estruturada", desc: "13 seções de IA (problemas, solicitações, oportunidades, ROI…) sobre os apps selecionados. Saída com evidência.", to: "/experiments" },
  { id: "chat", label: "Chat", icon: MessageSquare, relation: "Exploração e questionamento", desc: "Conversa aberta com a IA sobre os dados coletados. Pergunte qualquer coisa; receba respostas com gráficos e citações.", to: "/chat" },
  { id: "canvas", label: "Canvas", icon: Workflow, relation: "Composição e workflow", desc: "IA como nó num fluxo: buscar → coletar → filtrar → analisar → visualizar. Execução topológica.", to: "/canvas" },
];

export function AIInteractionExplorer() {
  const [mode, setMode] = useState<Mode>("analysis");
  const dataset = useDataset();
  const navigate = useNavigate();
  const current = MODES.find((m) => m.id === mode)!;
  const aiSections = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai");
  const appCount = dataset.entries.length;
  const reviewCount = dataset.entries.reduce((s, e) => s + e.reviews.length, 0);

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="tablist" aria-label="Modos de interação com IA">
        {MODES.map((m) => {
          const Icon = m.icon;
          const isActive = m.id === mode;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setMode(m.id)}
              className={cn(
                "rounded-xl border p-4 text-left transition-all",
                isActive ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border/60 bg-card/40 hover:border-border",
              )}
            >
              <span className={cn("inline-flex h-8 w-8 items-center justify-center rounded-lg mb-2", isActive ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-sm font-semibold text-foreground">{m.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{m.relation}</p>
            </button>
          );
        })}
      </div>

      {/* Mini demo */}
      <CaseCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <CaseLabel hint="relação com a IA">{current.label}</CaseLabel>
            <p className="text-sm text-foreground/90 mt-1.5 leading-relaxed max-w-2xl">{current.desc}</p>
          </div>
          <button
            onClick={() => navigate(current.to)}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          >
            Abrir <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        {/* Inline mini-demo (no AI calls) */}
        {mode === "analysis" && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <CaseLabel hint="seções reais">13 seções de análise</CaseLabel>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {aiSections.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-secondary text-secondary-foreground">
                  <s.icon className="h-2.5 w-2.5" /> {s.label}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">
              {appCount} app(s) · {reviewCount.toLocaleString("pt-BR")} reviews no dataset. Geração é manual — clique "Gerar" em Experimentos.
            </p>
          </div>
        )}

        {mode === "chat" && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-2">
            <CaseLabel hint="exemplo de interação">Pergunta → resposta com evidência</CaseLabel>
            <div className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-foreground ml-auto max-w-[80%]">
              Quais problemas mais recorrentes aparecem nos reviews?
            </div>
            <div className="rounded-lg bg-card border border-border/40 px-3 py-2 text-xs text-muted-foreground max-w-[80%]">
              <Sparkles className="h-3 w-3 text-primary inline mr-1" />
              {reviewCount > 0 ? "Resposta com blockquotes de evidência, percentuais e citações reais." : "Selecione apps e gere uma análise para ver respostas com evidência."}
            </div>
            <p className="text-[11px] text-muted-foreground">Streaming token-a-token, cancelável, com seleção de apps.</p>
          </div>
        )}

        {mode === "canvas" && (
          <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
            <CaseLabel hint="pipeline de exemplo">Buscar → Coletar → Analisar + Gráfico</CaseLabel>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {["Buscar apps", "Coletar reviews", "Análise IA", "Gráfico de notas", "Resultado"].map((n, i, arr) => (
                <div key={n} className="flex items-center gap-1.5">
                  <span className="inline-flex items-center px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-[10px] font-medium">{n}</span>
                  {i < arr.length - 1 && <span className="text-muted-foreground/50 text-[10px]">→</span>}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-3">10 tipos de nó, execução topológica, terminal de logs. IA como componente, não só endpoint.</p>
          </div>
        )}
      </CaseCard>

      <p className="text-xs text-muted-foreground italic px-1">
        "IA pode ser um componente num workflow, não só um endpoint conversacional."
      </p>
    </div>
  );
}
