/**
 * Seção 01 — Descobrir: busca Apple + Google com coleta/seleção inline
 * (reusa StageDiscover da Jornada) + explorador de top charts das duas
 * lojas (TopCharts completo, sob demanda para não disparar rede no load).
 */
import { Link } from "react-router-dom";
import { Panel } from "@/components/Panel";
import { TrendingUp } from "lucide-react";
import { StageDiscover } from "@/components/journey/StageDiscover";
import { TopCharts } from "@/components/TopCharts";

export function SectionDiscover() {
  return (
    <div className="space-y-5">
      <StageDiscover />
      <Panel
        title="Top charts das lojas"
        subtitle="Os apps mais baixados/arrecadadores por categoria, país e feed — colete direto do ranking."
        icon={<TrendingUp className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-topcharts"
      >
        <TopCharts />
      </Panel>
      <div className="flex flex-wrap gap-x-4 gap-y-1" role="navigation" aria-label="Atalhos de descoberta">
        <Link to="/search" className="text-[11px] text-primary hover:underline">Busca completa ↗</Link>
        <Link to="/" className="text-[11px] text-primary hover:underline">Página inicial ↗</Link>
      </div>
    </div>
  );
}
