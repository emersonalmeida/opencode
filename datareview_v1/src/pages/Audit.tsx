/**
 * Página Auditoria (/auditoria) — AUDITORIA DE FONTES E DADOS.
 *
 * A primeira página do menu: tudo sobre todas as fontes, fonte a fonte —
 * endpoints, parâmetros, capacidades, variações, combinações, saídas
 * (campos com presença real), derivações, limites, confiabilidade e
 * referências. O status de cada item distingue o que o sistema JÁ coleta
 * do que a fonte OFERECE e ainda não extraímos — a resposta honesta para
 * "o que temos e o que não temos".
 */
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuditSourceSection } from "@/components/audit/AuditSourceSection";
import { AuditSchedulerCard } from "@/components/audit/AuditSchedulerCard";
import { AuditComparison } from "@/components/audit/AuditComparison";
import { AuditSnapshotsCard } from "@/components/audit/AuditSnapshotsCard";
import { AuditPlannerCard } from "@/components/audit/AuditPlannerCard";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  auditAnchor,
  auditStats,
  AUDIT_STATUS_META,
  filterAuditSources,
  sourceCounts,
} from "@/lib/audit/auditModel";
import { auditSourcesOrdered } from "@/lib/audit/auditSources";
import { fetchReliability, type SourceReliability } from "@/lib/audit/auditEngine";
import { cn } from "@/lib/utils";
import { ScanSearch, Search } from "lucide-react";

const TONE_CLASS: Record<string, string> = {
  ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  muted: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
};

export default function Audit() {
  const sources = useMemo(() => auditSourcesOrdered(), []);
  const stats = useMemo(() => auditStats(sources), [sources]);
  const [term, setTerm] = useState("");
  const [reliability, setReliability] = useState<SourceReliability[]>([]);
  const filtered = useMemo(() => filterAuditSources(sources, term), [sources, term]);

  useEffect(() => {
    let alive = true;
    fetchReliability()
      .then((r) => { if (alive) setReliability(r); })
      .catch(() => { /* best-effort: sem evidência só mostra o documentado */ });
    return () => { alive = false; };
  }, []);

  const reliabilityById = useMemo(
    () => new Map(reliability.map((r) => [r.id, r] as const)),
    [reliability],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppHeader title="Auditoria" crumb="Fontes e dados" />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="content-fluid space-y-6 py-6">
          {/* Hero */}
          <section className="space-y-3 rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2">
              <ScanSearch className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-semibold">Auditoria de fontes e dados</h1>
            </div>
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Tudo sobre todas as fontes, fonte a fonte: quais dados, quais metadados, quais
              parâmetros, quais capacidades, quais recursos, quais técnicas, quais variações,
              quais combinações — e o nível de confiabilidade e consistência de cada uma.
              Cada item é marcado como <strong>implementado</strong> (o sistema já coleta),
              <strong> parcial</strong>, <strong>disponível</strong> (a fonte oferece e ainda não
              coletamos — uma lacuna real) ou <strong>indisponível</strong>.
            </p>
            <div className="flex flex-wrap gap-2 pt-1" role="status">
              <Badge variant="outline">{stats.sources} fontes</Badge>
              <Badge variant="outline" className={TONE_CLASS.ok}>{stats.audited} auditadas</Badge>
              {stats.inProgress > 0 && (
                <Badge variant="outline" className={TONE_CLASS.warn}>{stats.inProgress} em auditoria</Badge>
              )}
              <Badge variant="outline" className={TONE_CLASS.muted}>{stats.pending} pendentes</Badge>
              <Badge variant="outline">{stats.endpoints} endpoints</Badge>
              <Badge variant="outline">{stats.parameters} parâmetros</Badge>
              <Badge variant="outline">{stats.capabilities} capacidades</Badge>
              <Badge variant="outline">{stats.fields} campos mapeados</Badge>
              {stats.fieldsAvailable > 0 && (
                <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                  {stats.fieldsAvailable} campos ainda não coletados
                </Badge>
              )}
              {reliability.length > 0 && (
                <Badge variant="outline" className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300">
                  {reliability.length} fontes com evidência observada
                </Badge>
              )}
            </div>
          </section>

          {/* Índice */}
          <section className="space-y-3" id="audit-index">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Índice de fontes ({filtered.length}/{sources.length})
              </h2>
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Filtrar fontes…"
                  className="h-8 pl-7 text-sm"
                  aria-label="Filtrar fontes da auditoria"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((s) => {
                const c = sourceCounts(s);
                const meta = AUDIT_STATUS_META[s.status];
                return (
                  <a
                    key={s.id}
                    href={`#${auditAnchor(s.id)}`}
                    className="group rounded-md border bg-card p-3 transition-colors hover:border-primary/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {String(s.order).padStart(2, "0")}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px]", TONE_CLASS[meta.tone])}>
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="mt-1 font-medium group-hover:text-primary">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.category}</div>
                    {s.status === "audited" && (
                      <div className="mt-1.5 text-[11px] text-muted-foreground">
                        {c.endpoints} endpoints · {c.parameters} parâmetros · {c.fields} campos
                        {c.gaps > 0 && (
                          <span className="text-sky-600 dark:text-sky-300"> · {c.gaps} lacunas</span>
                        )}
                      </div>
                    )}
                  </a>
                );
              })}
            </div>
          </section>

          {/* Agendador de sondas (auditoria automática em 1 clique) */}
          <AuditSchedulerCard />

          {/* Métricas observadas (tabela consolidada) */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Comparação de fontes (dashboard)</h2>
            <AuditComparison sources={filtered} />
          </section>
          {/* Snapshots versionados (datasets §7) */}
          <AuditSnapshotsCard />

          {/* Planejador de experimentos (§5) */}
          <AuditPlannerCard />

          {/* Seções por fonte */}
          <div className="space-y-4">
            {filtered.map((s) =>
              s.status === "pending" ? (
                <section
                  key={s.id}
                  id={auditAnchor(s.id)}
                  className="scroll-mt-20 rounded-lg border border-dashed bg-card/50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(s.order).padStart(2, "0")}
                    </span>
                    <h3 className="font-medium">{s.name}</h3>
                    <Badge variant="outline" className={TONE_CLASS.muted}>pendente</Badge>
                    {!s.implemented && (
                      <Badge variant="outline" className={TONE_CLASS.muted}>não implementada</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{s.summary}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auditoria completa em elaboração — esta fonte será extraída ao máximo nos
                    próximos pedaços.
                  </p>
                </section>
              ) : (
                <AuditSourceSection
                  key={s.id}
                  source={s}
                  observed={reliabilityById.get(s.id)}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
