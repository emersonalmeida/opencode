/**
 * Tabela de métricas consolidada do Audit Engine (A11): para cada fonte
 * observada, exibe successRate / errorRate / avgDurationMs / avgConfidence e
 * o nº de observações. Atenção honesta: ausência de dados = estado "sem
 * evidência", nunca um score fictício.
 */
import { useEffect, useMemo, useState } from "react";
import { fetchReliability, type SourceReliability } from "@/lib/audit/auditEngine";
import { auditSourcesOrdered } from "@/lib/audit/auditSources";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Database, Gauge, Timer, TrendingUp } from "lucide-react";

const nameById = new Map(auditSourcesOrdered().map((s) => [s.id, s.name]));

function pct(v: number | undefined, observations: number): string {
  if (v == null || observations < 1) return "—";
  return `${Math.round(v * 100)}%`;
}

export function AuditOverviewTable() {
  const [reliability, setReliability] = useState<SourceReliability[]>([]);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState("");

  useEffect(() => {
    let alive = true;
    fetchReliability()
      .then((rows) => { if (alive) setReliability(rows); })
      .catch(() => { /* catálogo sem evidência — o estado abaixo explica */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return reliability
      .filter((r) => !q || r.id.toLowerCase().includes(q) || (nameById.get(r.id) ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.observations - a.observations);
  }, [reliability, term]);

  return (
    <section aria-label="Métricas observadas por fonte" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Métricas observadas ({filtered.length} fontes)
        </h2>
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Filtrar métricas…"
          className="h-8 w-56 text-sm"
          aria-label="Filtrar métricas da auditoria"
        />
      </div>

      {loading ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" role="status">
          Carregando evidências do servidor…
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground" role="status">
          Nenhuma evidência observada ainda. Rode o agendador acima ou colete nas
          fontes — a tabela preenche sozinha.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1"><Database className="h-3.5 w-3.5" />Observações</span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1"><TrendingUp className="h-3.5 w-3.5" />Sucesso</span>
                </TableHead>
                <TableHead className="text-right">Erro</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1"><Timer className="h-3.5 w-3.5" />Latência média</span>
                </TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />Confiança média</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const name = nameById.get(r.id) ?? r.id;
                const tone = r.errorRate > 0.5 ? "destructive" : r.errorRate > 0.1 ? "secondary" : "outline";
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right">{r.observations}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={tone}>{pct(r.successRate, r.observations)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{pct(r.errorRate, r.observations)}</TableCell>
                    <TableCell className="text-right">
                      {r.observations ? `${Math.round(r.avgDurationMs)}ms` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.observations ? `${Math.round(r.avgConfidence * 100)}%` : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
