import { useNavigate } from "react-router-dom";
import {
  Database, BrainCircuit, LayoutGrid, Crosshair, ArrowUpRight, Compass,
  Cpu, Wrench, GitBranch, ShieldCheck, Sparkles, Layers, RotateCcw, Boxes,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { useI18n } from "@/lib/i18n";
import { CaseNav, type CaseNavItem } from "@/components/case/CaseNav";
import { CaseSection, CaseCard, CaseLabel } from "@/components/case/CaseShell";
import { SystemDiagram } from "@/components/case/SystemDiagram";
import { CaseTimeline } from "@/components/case/CaseTimeline";
import { TechnicalDiscovery } from "@/components/case/TechnicalDiscovery";
import { EvolutionExplorer } from "@/components/case/EvolutionExplorer";
import { DecisionInspector } from "@/components/case/DecisionInspector";
import { EvidenceInspector } from "@/components/case/EvidenceInspector";
import { AIInteractionExplorer } from "@/components/case/AIInteractionExplorer";
import { SkillInspector, EvaluationPanel } from "@/components/case/SkillInspector";
import { ArchitectureMap } from "@/components/case/ArchitectureMap";
import { FailuresSection } from "@/components/case/FailuresSection";

const NAV_ITEMS: CaseNavItem[] = [
  { id: "opening", label: "Abertura" },
  { id: "question", label: "A pergunta" },
  { id: "technical", label: "Investigação técnica" },
  { id: "evolution", label: "Evolução" },
  { id: "decisions", label: "Decisões" },
  { id: "evidence", label: "Evidência" },
  { id: "ai-interaction", label: "Interação com IA" },
  { id: "skills", label: "Skills de IA" },
  { id: "evaluation", label: "Avaliação" },
  { id: "ai-dev", label: "Desenvolvimento" },
  { id: "system", label: "Sistema" },
  { id: "failures", label: "O que mudou" },
  { id: "current", label: "Produto atual" },
  { id: "explore", label: "Explorar" },
];

export default function Case() {
  const navigate = useNavigate();
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader
        backTo="/"
        title={t("nav.explore")}
        crumb="Como o produto foi construído"
      />

      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
        <div className="xl:grid xl:grid-cols-[1fr_180px] xl:gap-10 max-w-5xl mx-auto xl:max-w-[1100px]">
          <div className="min-w-0">
            {/* Top back + progress */}
            <div className="mb-6">
              <CaseNav items={NAV_ITEMS} />
            </div>

            <div className="space-y-16 sm:space-y-20">
              {/* 01 — Opening */}
              <CaseSection id="opening">
                <div className="text-center sm:text-left mb-8">
                  <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-medium mb-3">Uma exploração de produto</p>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground tracking-tight leading-tight max-w-3xl">
                    De reviews brutos a inteligência de produto.
                  </h1>
                  <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-2xl leading-relaxed">
                    Uma exploração do que acontece quando dados, IA e design de produto se tornam um fluxo contínuo.
                  </p>
                </div>
                <SystemDiagram />
              </CaseSection>

              {/* 02 — The Question */}
              <CaseSection id="question" index="02" eyebrow="O início" title="A pergunta não foi de design">
                <CaseCard className="p-5 sm:p-6">
                  <CaseLabel>Question original</CaseLabel>
                  <p className="text-lg sm:text-xl font-medium text-foreground mt-2 leading-snug">
                    "Que dados dá pra coletar de verdade da App Store e do Google Play?"
                  </p>
                  <p className="text-sm text-muted-foreground mt-4 leading-relaxed max-w-2xl">
                    A primeira pergunta não foi "qual UI?". Foi técnica. Sem saber o que é coletável,
                    qualquer design seria especulativo. A restrição técnica define o espaço de produto.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><Cpu className="h-3 w-3" /> Google Colab</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><Database className="h-3 w-3" /> APIs da Apple</span>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><LayoutGrid className="h-3 w-3" /> google-play-scraper</span>
                  </div>
                </CaseCard>
              </CaseSection>

              {/* 03 — Technical Discovery */}
              <CaseSection id="technical" index="03" eyebrow="Investigação" title="Descoberta técnica">
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl leading-relaxed">
                  Cada fonte tem um porquê, resolve um problema, e tem limitações. Toque para inspecionar.
                </p>
                <TechnicalDiscovery />
              </CaseSection>

              {/* 04 — Product Evolution */}
              <CaseSection id="evolution" index="04" eyebrow="Evolução" title="Como o produto evoluiu">
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl leading-relaxed">
                  Navegue pelas versões. Cada uma tinha uma hipótese — e cada uma mostrou o que funcionou e o que não funcionou.
                </p>
                <EvolutionExplorer />
              </CaseSection>

              {/* 05 — Design Decisions */}
              <CaseSection id="decisions" index="05" eyebrow="Julgamento" title="Decisões de design">
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl leading-relaxed">
                  Cada decisão segue: contexto → questão → opções → decisão → tradeoff → resultado.
                </p>
                <DecisionInspector />
              </CaseSection>

              {/* 06 — Trust & Evidence */}
              <CaseSection id="evidence" index="06" eyebrow="Confiança" title="A regra da evidência">
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl leading-relaxed">
                  Veja uma afirmação de IA. Clique "Mostrar evidência" e inspecione a fonte real — ou a falta dela.
                </p>
                <EvidenceInspector />
              </CaseSection>

              {/* 07 — AI Interaction */}
              <CaseSection id="ai-interaction" index="07" eyebrow="Interação" title="Três relações com a IA">
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl leading-relaxed">
                  Análise, Chat e Canvas representam relações diferentes com a IA. Explore a diferença.
                </p>
                <AIInteractionExplorer />
              </CaseSection>

              {/* 08 — AI Skills */}
              <CaseSection id="skills" index="08" eyebrow="Capacidades" title="Skills de IA">
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl leading-relaxed">
                  Cada skill é uma especificação de comportamento — input, task, output, avaliação — não um dump de prompt.
                </p>
                <SkillInspector />
              </CaseSection>

              {/* 09 — Evaluation */}
              <CaseSection id="evaluation" index="09" eyebrow="Qualidade" title="Avaliação de IA">
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl leading-relaxed">
                  Qualidade de IA não se mede por "soa bem". Estas são as dimensões — e o estado honesto da medição.
                </p>
                <EvaluationPanel />
              </CaseSection>

              {/* 10 — AI-assisted Development */}
              <CaseSection id="ai-dev" index="10" eyebrow="Construção" title="Desenvolvimento com IA">
                <CaseCard className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {[
                      { icon: Sparkles, label: "Intenção de design" },
                      { icon: Cpu, label: "Agente de IA (coding)" },
                      { icon: Wrench, label: "Implementação" },
                      { icon: ShieldCheck, label: "Teste local" },
                      { icon: GitBranch, label: "Crítica humana" },
                      { icon: RotateCcw, label: "Iteração" },
                      { icon: ArrowUpRight, label: "Ship" },
                    ].map((s, i, arr) => (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-[11px] font-medium">
                          <s.icon className="h-3 w-3" /> {s.label}
                        </span>
                        {i < arr.length - 1 && <span className="text-muted-foreground/40 text-xs">→</span>}
                      </div>
                    ))}
                  </div>
                  <CaseLabel>Princípio</CaseLabel>
                  <p className="text-sm text-foreground/90 mt-1.5 leading-relaxed max-w-2xl">
                    A IA acelerou a implementação, mas o julgamento de produto permaneceu humano.
                  </p>

                  <div className="mt-5 pt-5 border-t border-border/40 grid sm:grid-cols-2 gap-4">
                    <div>
                      <CaseLabel hint="exemplo real">Melhorar o feedback de execução do Canvas</CaseLabel>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        <span className="font-medium text-destructive">Problema:</span> o loop de onSelectionChange do React Flow causava "Maximum update depth exceeded". Sem ErrorBoundary, tela branca sem erro visível.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        <span className="font-medium text-foreground">Correção:</span> guard anti-loop (só dar set se o valor mudou) + ErrorBoundary parametrizado envolvendo a rota.
                      </p>
                    </div>
                    <div>
                      <CaseLabel hint="exemplo real">Bug 5000→100→0 na coleta</CaseLabel>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        <span className="font-medium text-destructive">Problema:</span> reuso cego de cache fazia config 5000 mostrar só 100; config 100 coletava 0.
                      </p>
                      <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                        <span className="font-medium text-foreground">Correção:</span> dedup limit-aware — só reusa se atende ao limite; senão refetch + merge por id.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-4">
                    {["Lovable", "OpenHands", "GitHub", "React/TypeScript", "tsx watch (dev local)"].map((tool) => (
                      <span key={tool} className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">{tool}</span>
                    ))}
                  </div>
                </CaseCard>
              </CaseSection>

              {/* 11 — System Thinking */}
              <CaseSection id="system" index="11" eyebrow="Arquitetura" title="Um dataset, muitas superfícies">
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl leading-relaxed">
                  O dataset único alimenta todas as superfícies de produto. Passe o mouse para ver como a informação flui.
                </p>
                <ArchitectureMap />
              </CaseSection>

              {/* 12 — Failures */}
              <CaseSection id="failures" index="12" eyebrow="Iteração" title="O que mudou minha mente">
                <p className="text-sm text-muted-foreground mb-5 max-w-2xl leading-relaxed">
                  Coisas que não funcionaram. A sofisticação vem de mostrar como as decisões evoluíram — não de uma história artificialmente perfeita.
                </p>
                <FailuresSection />
              </CaseSection>

              {/* 13 — Current Product */}
              <CaseSection id="current" index="13" eyebrow="Agora" title="O sistema atual">
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { icon: Database, label: "3 fontes de coleta", sub: "amp-api + SSR + RSS (Apple) · google-play-scraper" },
                    { icon: Layers, label: "1 dataset compartilhado", sub: "colete uma vez, reutilize em todo lugar" },
                    { icon: BrainCircuit, label: "4 modos de IA", sub: "none · local (Ollama+GPU) · cloud multi-provider" },
                    { icon: Boxes, label: "10 superfícies", sub: "Home, Detail, Compare, Dashboard, Experimentos, Chat, Canvas, Decision Center, Concept, Playground" },
                  ].map((s) => (
                    <CaseCard key={s.label} className="p-4">
                      <s.icon className="h-4 w-4 text-primary mb-2" />
                      <p className="text-sm font-semibold text-foreground">{s.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{s.sub}</p>
                    </CaseCard>
                  ))}
                </div>
              </CaseSection>

              {/* 14 — Explore */}
              <CaseSection id="explore" index="14" eyebrow="Volte ao produto" title="Tudo que você explorou está rodando aqui">
                <p className="text-sm text-muted-foreground mb-6 max-w-2xl leading-relaxed">
                  O caso não é separado do produto. O produto é a evidência.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { icon: Database, label: "Dados", sub: "Dataset local", to: "/dashboard" },
                    { icon: BrainCircuit, label: "IA", sub: "Análise & Chat", to: "/chat" },
                    { icon: LayoutGrid, label: "Interação", sub: "Canvas", to: "/canvas" },
                    { icon: Boxes, label: "Sistema", sub: "Dashboard", to: "/dashboard" },
                    { icon: ShieldCheck, label: "Evidência", sub: "Inspecionar app", to: "/app/apple/324684580" },
                    { icon: Sparkles, label: "Análise", sub: "Experimentos", to: "/experiments" },
                  ].map((c) => (
                    <button
                      key={c.label}
                      onClick={() => navigate(c.to)}
                      className="group rounded-xl border border-border/60 bg-card/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
                    >
                      <div className="flex items-center justify-between">
                        <c.icon className="h-4 w-4 text-primary" />
                        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      </div>
                      <p className="text-sm font-semibold text-foreground mt-2">{c.label}</p>
                      <p className="text-[11px] text-muted-foreground">{c.sub}</p>
                    </button>
                  ))}
                </div>

                <p className="text-center text-xs text-muted-foreground mt-10 italic">
                  Projetado e construído como uma exploração de produto independente.
                </p>
              </CaseSection>
            </div>
          </div>

          {/* Right rail nav (desktop only) */}
          <div className="hidden xl:block" />
        </div>
      </div>
    </div>
  );
}
