/**
 * Seção 12 — Experimentar: as três superfícies de prototipagem COMPLETAS,
 * embutidas sem sair do Fluxo — Canvas (pipeline node-based), Design Canvas
 * (page builder) e Playground (protótipos). Templates de pipeline carregam
 * direto no Canvas embutido (sem navegação).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Workflow, Shapes, Lightbulb, Check } from "lucide-react";
import { useCanvasStore } from "@/lib/canvasStore";
import { useDesignStore } from "@/lib/designCanvas/store";
import { PIPELINE_TEMPLATES } from "@/components/canvas/pipelineTemplates";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";

export function SectionExperiment() {
  const nodes = useCanvasStore((s) => s.nodes);
  const loadTemplate = useCanvasStore((s) => s.loadTemplate);
  const pages = useDesignStore((s) => s.pages);
  const [loadedId, setLoadedId] = useState<string | null>(null);

  const load = (id: string) => {
    const t = PIPELINE_TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    loadTemplate(t.build());
    setLoadedId(id);
    // abre o painel do Canvas embutido (mesma chave do Panel abaixo)
    try {
      localStorage.setItem("aso:flow-exp-canvas-open", "1");
    } catch {
      /* ignore */
    }
    document.getElementById("flow-exp-canvas")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Workflow className="h-3 w-3 text-primary" aria-hidden /> Canvas
          </p>
          <p className="mt-0.5 text-sm font-semibold">{nodes.length} nó(s)</p>
          <p className="text-[10px] text-muted-foreground">pipeline visual atual</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Shapes className="h-3 w-3 text-primary" aria-hidden /> Design Canvas
          </p>
          <p className="mt-0.5 text-sm font-semibold">{pages.length} página(s)</p>
          <p className="text-[10px] text-muted-foreground">page builder com dados reais</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Lightbulb className="h-3 w-3 text-primary" aria-hidden /> Playground
          </p>
          <p className="mt-0.5 text-sm font-semibold">protótipos</p>
          <p className="text-[10px] text-muted-foreground">resposta a review, benchmark, ASO</p>
        </div>
      </div>

      <div id="flow-exp-canvas">
        <Panel
          title="Canvas completo (pipeline visual)"
          subtitle="A página Canvas inteira: 38 tipos de nó, IA encadeada, undo/redo, templates, validação de conexões, terminal de logs — sem sair do Fluxo."
          icon={<Workflow className="h-4 w-4 text-primary" />}
          defaultOpen={false}
          storageKey="aso:flow-exp-canvas"
        >
          <FlowEmbed page="canvas" />
          <Link to="/canvas" className="mt-2 inline-block text-[11px] text-primary hover:underline">
            Abrir página dedicada ↗
          </Link>
        </Panel>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Templates de pipeline ({PIPELINE_TEMPLATES.length}) — carregam no Canvas acima
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_TEMPLATES.map((t) => {
            const Icon = t.icon;
            const loaded = loadedId === t.id;
            return (
              <li key={t.id}>
                <button
                  onClick={() => load(t.id)}
                  aria-label={`Carregar template ${t.name} no Canvas`}
                  className="flex w-full items-start gap-2.5 rounded-lg border border-border/60 bg-background/60 p-3 text-left hover:border-primary/40 hover:bg-primary/5"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{t.name}</span>
                    <span className="line-clamp-2 text-[10px] text-muted-foreground">{t.description}</span>
                  </span>
                  {loaded && <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-success" aria-hidden />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Panel
        title="Design Canvas completo (page builder)"
        subtitle="Monte páginas reais com os componentes do design system + organismos ligados ao dataset — Design, Preview responsivo e Código."
        icon={<Shapes className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-exp-design"
      >
        <div className="h-[560px]">
          <FlowEmbed page="design" />
        </div>
        <Link to="/design" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>

      <Panel
        title="Playground completo"
        subtitle="Protótipos funcionais: gerador de resposta a review, score competitivo e extrator de keywords ASO."
        icon={<Lightbulb className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-exp-playground"
      >
        <FlowEmbed page="playground" />
        <Link to="/playground" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
