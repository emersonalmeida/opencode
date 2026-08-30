import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, Search, Layers, MessageSquare, FileText, GitBranch, Network, Map, Workflow, ArrowRight, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const KEY = "aso:onboarded";

/** Marca o onboarding como concluído (a página Boas-vindas cumpre esse papel). */
export function completeOnboarding() {
  try { localStorage.setItem(KEY, "1"); } catch { /* storage indisponível */ }
}

const SLIDES = [
  {
    icon: Sparkles,
    title: "Bem-vindo ao App Intelligence",
    body: "A plataforma reúne, em um só lugar, dados vivos da App Store e do Google Play — metadados, atualizações, reviews, sentimento e IA contextual — para transformar feedback de usuário em decisão de produto.",
    hint: "Use tudo sem cadastro. Seus dados ficam no seu navegador.",
  },
  {
    icon: Search,
    title: "Descubra e colete",
    body: "Busque qualquer app pelo nome, URL da loja ou ID direto na barra superior. Ou explore os Top 10 por categoria da sua região direto na home.",
    hint: "Cache local torna consultas repetidas instantâneas.",
  },
  {
    icon: Layers,
    title: "Compare lado a lado",
    body: "Marque um ou mais apps no dropdown de busca (ou no botão + dos Top 10). Eles vão para o painel de comparação — abra a página /compare para ver métricas, distribuições, atualizações, problemas e citações lado a lado.",
    hint: "Você pode comparar Apple ↔ Google e concorrentes de qualquer região.",
  },
  {
    icon: MessageSquare,
    title: "Converse com a IA",
    body: "O painel à direita entende onde você está. Na home ele vira uma barra de pesquisa inteligente (\"pesquise por apps de banco\", \"bipa\", \"nubank\"...). Em detalhes e comparação, responde qualquer pergunta usando os payloads brutos e reviews coletados.",
    hint: "Sugestões contextuais aparecem em toda página.",
  },
  {
    icon: FileText,
    title: "Gere artefatos de pesquisa",
    body: "Peça à IA personas, jornadas, benchmarks, oportunidades, mapa de problemas, SWOT — entregáveis prontos. Cada artefato fica salvo na aba \"Artefatos\" do painel para você revisitar quando quiser.",
    hint: "As sidebars são redimensionáveis: arraste a borda para ajustar.",
  },
  {
    icon: GitBranch,
    title: "Canvas — pipelines de IA visual",
    body: "O canvas (/canvas) conecta nós: busca → coleta → análise IA → gráfico → relatório. Use templates prontos ou monte o seu. Validação de conexões bloqueia ciclos e duplicatas.",
    hint: "Undo/redo, zoom colaborativo e auto-output após executar.",
  },
  {
    icon: Network,
    title: "Pipeline — descoberta recursiva",
    body: "O Pipeline (/pipeline) separa FATO CALCULADO (determinístico) de INTERPRETAÇÃO DE IA. Gera artefatos com linhagem (qual review valida cada anomalia) e critério honesto de parada quando nada justifica o custo.",
    hint: "Loop de descoberta autônomo: computeFacts → detectAnomalies → IA decide o próximo passo.",
  },
  {
    icon: Map,
    title: "Analysis Atlas — catálogo de métodos",
    body: "O Atlas (/atlas) é o registry das 60+ metodologias organizadas em 9 categorias (App, Review, Temporal, Geo, CrossData…). Cada módulo declara INPUT→PROCESSING→OUTPUT→EVIDENCE→SCORE.",
    hint: "Você pode compor módulos em sequência e executar por categoria.",
  },
  {
    icon: Workflow,
    title: "Fluxo — mapa de jornada",
    body: "O Fluxo (/fluxo) organiza as 16 seções da jornada (missão → descobrir/src → coletar → dados → visualizar → sinais → investigar → agentes → decidir → apresentar → monitorar). Cada seção mostra ENTRADA/PROCESSAMENTO/SAÍDA e status canônico (idle/ready/done/error).",
    hint: "Auto-avanço: concluiu uma seção? O fluxo sugere e expande a próxima automaticamente.",
  },
];

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const { pathname } = useLocation();

  useEffect(() => {
    // Na página Boas-vindas (anfitrião) e na /all (jornada de onboarding
    // completa) o modal legado não se sobrepõe — é o próprio conteúdo da rota.
    if (pathname.startsWith("/boas-vindas") || pathname.startsWith("/all")) return;
    try { if (!localStorage.getItem(KEY)) setOpen(true); } catch { /* ignore */ }
  }, [pathname]);

  const finish = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open) return null;
  const s = SLIDES[step];
  const Icon = s.icon;
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border/60 shadow-2xl overflow-hidden">
        <button
          onClick={finish}
          className="absolute right-3 top-3 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors z-10"
          title="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-8 space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
            <Icon className="h-6 w-6 text-primary-foreground" />
          </div>

          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              Passo {step + 1} de {SLIDES.length}
            </p>
            <h2 className="text-2xl font-bold text-foreground leading-tight">{s.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </div>

          <div className="text-[11px] text-primary bg-primary/5 rounded-lg px-3 py-2 border border-primary/10">
            💡 {s.hint}
          </div>

          <div className="flex items-center gap-1 pt-2">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-1.5 rounded-full transition-all ${i === step ? "w-8 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"}`}
                title={`Passo ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-border/50 bg-secondary/30">
          <Button variant="ghost" size="sm" onClick={finish} className="text-xs text-muted-foreground">
            Pular tour
          </Button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>
                <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={finish}>Começar</Button>
            ) : (
              <Button size="sm" onClick={() => setStep(s => s + 1)}>
                Próximo <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function resetOnboarding() {
  try { localStorage.removeItem(KEY); location.reload(); } catch { /* ignore */ }
}
