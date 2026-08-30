import { useEffect, useMemo, useState } from "react";
import { Orbit, Sparkles, CloudOff, Cpu, Zap } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { BootSequence } from "@/components/welcome/BootSequence";
import { HostGuide } from "@/components/welcome/HostGuide";
import { WelcomeLiveStats, WelcomeCapabilityTour } from "@/components/welcome/WelcomeSections";
import { useDataset } from "@/hooks/useDataset";
import { useAISettings } from "@/lib/aiSettings";
import { useSetAIContext } from "@/context/AIContext";
import { greetingFor, aiHintFor, hasVisited, markVisited } from "@/lib/welcome/welcomeModel";
import { completeOnboarding } from "@/components/OnboardingModal";

/**
 * Boas-vindas (`/boas-vindas`) — a porta de entrada do sistema.
 *
 * Boot fictício pulável → saudação adaptativa → anfitrião conversacional que
 * guia o usuário etapa a etapa (quick replies reais). Tudo determinístico:
 * funciona completo sem IA.
 */
export default function Welcome() {
  const dataset = useDataset();
  const ai = useAISettings();
  const [booted, setBooted] = useState(false);

  // visita registrada UMA vez por montagem (a saudação do próximo acesso muda)
  const [returning] = useState(() => hasVisited());
  useEffect(() => {
    markVisited();
    // A página de boas-vindas É o onboarding do sistema: quem passa por ela
    // já foi recebido e guiado — o modal legado não precisa se sobrepor.
    completeOnboarding();
  }, []);

  const totalReviews = useMemo(
    () => dataset.entries.reduce((s, e) => s + e.reviews.length, 0),
    [dataset.entries],
  );

  const visitorCtx = {
    returning,
    apps: dataset.entries.length,
    reviews: totalReviews,
    aiMode: ai.mode,
  };
  const greeting = greetingFor(visitorCtx);

  const aiStatus = ai.mode === "none" ? { label: "IA desligada", icon: CloudOff }
    : ai.mode === "local" ? { label: "IA local", icon: Cpu }
    : ai.mode === "cloud" ? { label: "IA cloud", icon: Zap }
    : { label: "IA automática", icon: Sparkles };
  const AIIcon = aiStatus.icon;

  useSetAIContext({ scope: "home", title: "Boas-vindas", apps: [] }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!booted && <BootSequence onDone={() => setBooted(true)} />}
      <AppHeader title="Boas-vindas" crumb="A porta de entrada" />
      <main className="content-fluid flex flex-1 flex-col items-center gap-10 py-10 text-center">
        <div id="welcome-hero" className="scroll-mt-20">
          <div
            className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"
            aria-hidden="true"
          >
            <Orbit className="h-7 w-7" />
          </div>
          <h1 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            {greeting.headline}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
            {greeting.subline}
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <AIIcon className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {aiStatus.label} · {aiHintFor(ai.mode)}
          </p>
        </div>

        <div id="welcome-host" className="flex w-full justify-center scroll-mt-20">
          <HostGuide ctx={visitorCtx} />
        </div>

        <WelcomeLiveStats />
        <WelcomeCapabilityTour />
      </main>
    </div>
  );
}
