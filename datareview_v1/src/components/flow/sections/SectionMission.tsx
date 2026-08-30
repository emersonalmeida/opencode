/**
 * Seção 00 — Missão: o objetivo da investigação + um resumo vivo da
 * configuração do sistema (região, limite de reviews, ordenação, modo de IA),
 * com atalho para as Configurações.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Settings2, Sparkles, Globe, Layers, ArrowUpDown, Target } from "lucide-react";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";
import { getMission, saveMission, subscribeMission } from "@/lib/flow/flowModel";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { getUserRegion, REGION_OPTIONS } from "@/lib/region";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";

export function SectionMission() {
  const [mission, setMission] = useState<string>(() => getMission());
  const { settings } = useCollectionSettings();
  const ai = useAISettings();
  const region = REGION_OPTIONS.find((r) => r.code === getUserRegion());

  useEffect(() => subscribeMission(() => setMission(getMission())), []);

  const aiLabel = !isAIEnabled(ai)
    ? "desativada"
    : ai.mode === "cloud"
      ? `nuvem (${ai.cloud.provider})`
      : ai.mode === "auto"
        ? "auto (detecta hardware)"
        : `local (${ai.local.model})`;

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="flow-mission" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <Target className="h-3.5 w-3.5 text-primary" aria-hidden />
          Objetivo da investigação
        </label>
        <textarea
          id="flow-mission"
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          onBlur={() => saveMission(mission)}
          placeholder="Ex.: encontrar oportunidades de melhoria do onboarding do Nubank em relação aos concorrentes…"
          rows={2}
          className="mt-2 w-full resize-y rounded-lg border border-border/60 bg-secondary/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          A missão fica salva, orienta o seu foco ao longo das 15 etapas abaixo{" "}
          e é injetada automaticamente nos prompts de IA (Investigar, Agentes,
          Decidir, Chat e até na busca semântica de seções).
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Globe, label: "Região da loja", value: region ? `${region.flag} ${region.label}` : getUserRegion() },
          { icon: Layers, label: "Limite de reviews", value: `${settings.reviewLimit.toLocaleString("pt-BR")} por app` },
          { icon: ArrowUpDown, label: "Ordenação", value: settings.reviewSort === "mixed" ? "Mista" : settings.reviewSort === "recent" ? "Recentes" : settings.reviewSort === "helpful" ? "Úteis" : "Por nota" },
          { icon: Sparkles, label: "IA", value: aiLabel },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              <item.icon className="h-3 w-3" aria-hidden />
              {item.label}
            </p>
            <p className="mt-0.5 truncate text-xs font-medium">{item.value}</p>
          </div>
        ))}
      </div>

      <Panel
        title="Configurações completas"
        subtitle="Tudo da página Configurações — aparência, IA, coleta, região, idioma, feature flags e dados locais — sem sair do Fluxo."
        icon={<Settings2 className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-config"
      >
        <FlowEmbed page="configuracoes" />
        <Link to="/configuracoes" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
