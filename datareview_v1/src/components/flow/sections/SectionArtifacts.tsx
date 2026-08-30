/**
 * Seção 13 — Artefatos: tudo que o sistema gerou — histórico unificado de
 * sessões (SessionsPanel real, embutido) + inventário do armazenamento local
 * (Outputs) + saídas de IA persistidas.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PackageOpen, History, ArrowRight, FileText } from "lucide-react";
import { SessionsPanel } from "@/components/SessionsPanel";
import { Panel } from "@/components/Panel";
import { FlowEmbed } from "@/components/flow/FlowEmbed";
import { inventoryOutputs, formatBytes } from "@/lib/outputs";
import { useAIOutputs } from "@/lib/aiOutputStore";

export function SectionArtifacts() {
  const outputs = useAIOutputs();
  const inventory = useMemo(() => inventoryOutputs(), []);
  const totalBytes = inventory.reduce((acc, g) => acc + g.totalBytes, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <PackageOpen className="h-3 w-3 text-primary" aria-hidden /> Armazenamento local
          </p>
          <p className="mt-0.5 text-sm font-semibold">{formatBytes(totalBytes)}</p>
          <p className="text-[10px] text-muted-foreground">
            {inventory.reduce((a, g) => a + g.entries.length, 0)} chaves ·{" "}
            <Link to="/outputs" className="text-primary hover:underline">gerenciar</Link>
          </p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <FileText className="h-3 w-3 text-primary" aria-hidden /> Saídas de IA
          </p>
          <p className="mt-0.5 text-sm font-semibold">{outputs.length}</p>
          <p className="text-[10px] text-muted-foreground">persistidas (sobrevivem a reload/pull)</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-background/60 px-3 py-2">
          <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <History className="h-3 w-3 text-primary" aria-hidden /> Sessões
          </p>
          <p className="mt-0.5 text-sm font-semibold">histórico unificado</p>
          <p className="text-[10px] text-muted-foreground">
            <Link to="/sessions" className="text-primary hover:underline">abrir página</Link>
          </p>
        </div>
      </div>

      {outputs.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Saídas de IA mais recentes
          </p>
          <ul className="space-y-1.5" aria-label="Saídas de IA recentes">
            {outputs.slice(0, 5).map((o) => (
              <li key={o.key} className="rounded-md border border-border/40 bg-background/60 px-2.5 py-2 text-xs">
                <p className="font-medium">
                  {o.section}
                  {o.provenance && <span className="ml-2 text-[10px] font-normal text-muted-foreground">{o.provenance}</span>}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">{o.markdown.slice(0, 140)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border/40 bg-background/60 p-2">
        <p className="mb-1 px-1 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Histórico unificado
        </p>
        <SessionsPanel embedded />
      </div>

      <Panel
        title="Outputs completo (armazenamento)"
        subtitle="A página Outputs inteira: inventário por chave, exportar tudo, importar backup, reset e gestão por grupo — sem sair do Fluxo."
        icon={<PackageOpen className="h-4 w-4 text-primary" />}
        defaultOpen={false}
        storageKey="aso:flow-outputs"
      >
        <FlowEmbed page="outputs" />
        <Link to="/outputs" className="mt-2 inline-block text-[11px] text-primary hover:underline">
          Abrir página dedicada ↗
        </Link>
      </Panel>
    </div>
  );
}
