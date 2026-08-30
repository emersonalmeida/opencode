/**
 * AuditSourceSection — renderiza a auditoria COMPLETA de uma fonte:
 * endpoints, parâmetros, capacidades, combinações, saídas (campos com
 * presença), derivações, limites, confiabilidade e referências.
 */
import { Badge } from "@/components/ui/badge";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import {
  auditAnchor,
  AUDIT_STATUS_META,
  IMPL_STATUS_META,
  PRESENCE_META,
  sourceCounts,
  type AuditSource,
  type ImplStatus,
} from "@/lib/audit/auditModel";
import type { SourceReliability } from "@/lib/audit/auditEngine";
import { AuditEvidencePanel } from "@/components/audit/AuditEvidencePanel";
import { AuditSourceVisual } from "@/components/audit/AuditSourceVisual";
import { cn } from "@/lib/utils";
import { CheckCircle2, CircleDashed, CircleOff, Info, Link2, Activity } from "lucide-react";

const TONE_CLASS: Record<string, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  info: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  muted: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
};

function StatusBadge({ status }: { status: ImplStatus }) {
  const meta = IMPL_STATUS_META[status];
  const Icon =
    status === "implemented" ? CheckCircle2
    : status === "partial" ? CircleDashed
    : status === "available" ? Info
    : CircleOff;
  return (
    <Badge variant="outline" className={cn("gap-1 whitespace-nowrap", TONE_CLASS[meta.tone])}>
      <Icon className="h-3 w-3" /> {meta.label}
    </Badge>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</h4>;
}

function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

function ObservedPanel({ observed }: { observed: SourceReliability }) {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <div className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3" role="note">
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-sky-700 dark:text-sky-300">
        <Activity className="h-3.5 w-3.5" /> Evidência observada ({observed.observations} testes)
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        <span>sucesso <strong>{pct(observed.successRate)}</strong></span>
        <span>erro <strong>{pct(observed.errorRate)}</strong></span>
        <span>latência média <strong>{Math.round(observed.avgDurationMs)}ms</strong></span>
        <span>confiança média <strong>{pct(observed.avgConfidence)}</strong></span>
      </div>
    </div>
  );
}

export function AuditSourceSection({ source, observed }: { source: AuditSource; observed?: SourceReliability }) {
  const counts = sourceCounts(source);
  const statusMeta = AUDIT_STATUS_META[source.status];
  return (
    <ExpandableBlock
      id={auditAnchor(source.id)}
      storageKey={`audit:${source.id}`}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">{String(source.order).padStart(2, "0")}</span>
          {source.name}
          <Badge variant="outline" className={TONE_CLASS[statusMeta.tone]}>{statusMeta.label}</Badge>
          {!source.implemented && (
            <Badge variant="outline" className={TONE_CLASS.muted}>não implementada</Badge>
          )}
        </span>
      }
      subtitle={source.category}
      headerRight={
        <span className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex">
          <span>{counts.endpoints} endpoints</span>·
          <span>{counts.parameters} parâmetros</span>·
          <span>{counts.fields} campos</span>
          {counts.gaps > 0 && <>·<span className="text-sky-600 dark:text-sky-300">{counts.gaps} lacunas</span></>}
        </span>
      }
      exportData={() => source}
      exportName={`auditoria-${source.id}`}
    >
      <div className="space-y-6">
        <AuditSourceVisual source={source} />
        <p className="text-sm leading-relaxed text-foreground/90">{source.summary}</p>

        {observed && <ObservedPanel observed={observed} />}

        {/* Provenance (§8): cadeia observação → run → artifact → raw. */}
        <AuditEvidencePanel sourceId={source.sourceId ?? source.id} />

        {source.endpoints.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Endpoints ({source.endpoints.length})</SectionTitle>
            <TableShell>
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs">
                  <th className="p-2 font-medium">Endpoint</th>
                  <th className="p-2 font-medium">Método</th>
                  <th className="p-2 font-medium">URL</th>
                  <th className="p-2 font-medium">Auth</th>
                  <th className="p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {source.endpoints.map((e, i) => (
                  <tr key={i} className="border-b last:border-0 align-top">
                    <td className="p-2">
                      <div className="font-medium">{e.label}</div>
                      {e.notes && <div className="text-xs text-muted-foreground">{e.notes}</div>}
                    </td>
                    <td className="p-2"><code className="text-xs">{e.method}</code></td>
                    <td className="p-2"><code className="break-all text-xs">{e.url}</code></td>
                    <td className="p-2 text-xs">{e.auth}</td>
                    <td className="p-2"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </section>
        )}

        {source.parameters.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Parâmetros e variações ({source.parameters.length})</SectionTitle>
            <TableShell>
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs">
                  <th className="p-2 font-medium">Parâmetro</th>
                  <th className="p-2 font-medium">Valores</th>
                  <th className="p-2 font-medium">Descrição</th>
                  <th className="p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {source.parameters.map((p, i) => (
                  <tr key={i} className="border-b last:border-0 align-top">
                    <td className="p-2">
                      <code className="text-xs font-semibold">{p.name}</code>
                      <div className="text-xs text-muted-foreground">{p.type}</div>
                    </td>
                    <td className="p-2 text-xs">
                      {p.options && <div className="max-w-72">{p.options.join(" · ")}</div>}
                      {p.range && <div>faixa {p.range}</div>}
                      {p.default !== undefined && <div className="text-muted-foreground">default {p.default || "(vazio)"}</div>}
                    </td>
                    <td className="p-2 text-xs">{p.description}</td>
                    <td className="p-2"><StatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </section>
        )}

        {source.capabilities.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Capacidades ({source.capabilities.length})</SectionTitle>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {source.capabilities.map((c, i) => (
                <li key={i} className="flex items-start gap-2 rounded-md border p-2 text-xs">
                  <StatusBadge status={c.status} />
                  <span>
                    {c.label}
                    {c.notes && <span className="block text-muted-foreground">{c.notes}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {source.combinations.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Combinações ({source.combinations.length})</SectionTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {source.combinations.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </section>
        )}

        {source.outputs.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Saídas — campos coletáveis ({source.outputs.length})</SectionTitle>
            <TableShell>
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs">
                  <th className="p-2 font-medium">Campo</th>
                  <th className="p-2 font-medium">Tipo</th>
                  <th className="p-2 font-medium">Descrição</th>
                  <th className="p-2 font-medium">Presença</th>
                  <th className="p-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {source.outputs.map((f, i) => {
                  const pm = PRESENCE_META[f.presence];
                  return (
                    <tr key={i} className="border-b last:border-0 align-top">
                      <td className="p-2"><code className="text-xs font-semibold">{f.name}</code></td>
                      <td className="p-2 text-xs">{f.type}</td>
                      <td className="p-2 text-xs">
                        {f.description}
                        {f.reliability && <div className="text-muted-foreground">{f.reliability}</div>}
                      </td>
                      <td className="p-2">
                        <Badge variant="outline" className={cn("whitespace-nowrap", TONE_CLASS[pm.tone])}>{pm.label}</Badge>
                      </td>
                      <td className="p-2"><StatusBadge status={f.status} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </TableShell>
          </section>
        )}

        {source.derivations.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Derivações — o que se gera a partir do bruto ({source.derivations.length})</SectionTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {source.derivations.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </section>
        )}

        {source.limits.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Limites ({source.limits.length})</SectionTitle>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {source.limits.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </section>
        )}

        {(source.reliability.consistency || source.reliability.risks.length > 0) && (
          <section className="space-y-2">
            <SectionTitle>Confiabilidade e consistência</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              {source.reliability.consistency && (
                <div className="rounded-md border p-3 text-xs">
                  <div className="mb-1 font-semibold">Consistência</div>
                  {source.reliability.consistency}
                </div>
              )}
              {source.reliability.stability && (
                <div className="rounded-md border p-3 text-xs">
                  <div className="mb-1 font-semibold">Estabilidade</div>
                  {source.reliability.stability}
                </div>
              )}
              {source.reliability.risks.length > 0 && (
                <div className="rounded-md border p-3 text-xs">
                  <div className="mb-1 font-semibold">Riscos</div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {source.reliability.risks.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {source.reliability.fallbacks.length > 0 && (
                <div className="rounded-md border p-3 text-xs">
                  <div className="mb-1 font-semibold">Fallbacks do sistema</div>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {source.reliability.fallbacks.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {source.references.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Referências</SectionTitle>
            <ul className="flex flex-wrap gap-2">
              {source.references.map((r, i) => (
                <li key={i}>
                  <a
                    href={r.url}
                    target={r.url.startsWith("http") ? "_blank" : undefined}
                    rel={r.url.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:underline"
                  >
                    <Link2 className="h-3 w-3" /> {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </ExpandableBlock>
  );
}
