/**
 * SourcesSection — catálogo de fontes do Source Registry (capabilities,
 * método preferido, regiões e limitações declaradas). Lê GET
 * /functions/v1/sources do servidor local. Seção visível em /configuracoes.
 */
import { useSources } from "@/lib/sourcesClient";
import { useServerOnline } from "@/lib/serverHealth";
import type { SourceMeta } from "@/lib/sourcesClient";
import { Badge } from "@/components/ui/badge";
import { Globe, Check, Loader2, AlertTriangle } from "lucide-react";

const CAP_LABELS: Record<string, string> = {
  search: "busca",
  lookup: "detalhes",
  reviews: "reviews/menções",
  topCharts: "top charts",
  healthCheck: "health check",
};

function CapabilityBadges({ src }: { src: SourceMeta }) {
  const caps = Object.entries(src.capabilities).filter(([, v]) => v);
  return (
    <div className="flex flex-wrap gap-1">
      {caps.map(([cap]) => (
        <Badge key={cap} variant="secondary" className="text-[10px] px-1.5 py-0">
          <Check className="h-2.5 w-2.5 mr-0.5" />
          {CAP_LABELS[cap] ?? cap}
        </Badge>
      ))}
    </div>
  );
}

function SourceCard({ src }: { src: SourceMeta }) {
  return (
    <div className="rounded-md border p-3 space-y-1.5 text-xs" data-testid={`source-card-${src.id}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-primary" />
          {src.label}
          <span className="text-muted-foreground font-mono text-[10px]">({src.id})</span>
        </span>
        <div className="flex gap-1 items-center">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{src.kind}</Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">auth: {src.auth}</Badge>
        </div>
      </div>
      <CapabilityBadges src={src} />
      {src.method && <p className="text-muted-foreground">método: {src.method}</p>}
      {src.rateLimit && (
        <p className="text-muted-foreground">
          rate-limit: {src.rateLimit.rps} req/s{src.rateLimit.burst ? ` (burst ${src.rateLimit.burst})` : ""}
        </p>
      )}
      {src.regions?.length ? <p className="text-muted-foreground">regiões: {src.regions.join(", ")}</p> : null}
      {src.tosNote && <p className="text-muted-foreground italic">{src.tosNote}</p>}
    </div>
  );
}

export function SourcesSection() {
  const { sources, loading, error } = useSources();
  const serverOnline = useServerOnline();

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" /> Consultando o catálogo de fontes…
      </div>
    );
  }
  if (error || !sources) {
    return (
      <div className="flex items-center gap-2 text-sm py-4" role="alert">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        {serverOnline === false
          ? "Servidor local offline — suba com `npm run dev:server` e a lista aparece sozinha."
          : `Não foi possível consultar o servidor local (${error ?? "sem resposta"}).`}
      </div>
    );
  }
  return (
    <div className="space-y-2" role="list" aria-label="Fontes de dados registradas">
      {sources.map((src) => (
        <SourceCard key={src.id} src={src} />
      ))}
    </div>
  );
}
