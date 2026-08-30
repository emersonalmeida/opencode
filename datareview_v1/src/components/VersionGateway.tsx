import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { History, ExternalLink, ArrowRight, PackageOpen } from "lucide-react";
import {
  RELEASES,
  parseVersionQuery,
  resolveVersionQuery,
  versionTarget,
  parseBuildsIndex,
  type Release,
} from "@/lib/releases";
import { PageLoader } from "@/components/shared/PageLoader";

// Cache de módulo do índice de builds estáticos (public/versions/index.json,
// gerado por `npm run build:version <tag>`). 404/ausente = nenhum build.
let buildsCache: Set<string> | null = null;
let buildsInflight: Promise<Set<string>> | null = null;

function loadBuilds(): Promise<Set<string>> {
  if (buildsCache) return Promise.resolve(buildsCache);
  if (buildsInflight) return buildsInflight;
  buildsInflight = fetch("/versions/index.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      buildsCache = parseBuildsIndex(json);
      return buildsCache;
    })
    .catch(() => {
      buildsCache = new Set();
      return buildsCache;
    });
  return buildsInflight;
}

/** Apenas para testes: reseta o cache de builds. */
export function __resetBuildsCache() {
  buildsCache = null;
  buildsInflight = null;
}

function ReleaseRow({ release, builds }: { release: Release; builds: Set<string> }) {
  const target = versionTarget(release, undefined, builds);
  const status =
    target.kind === "current"
      ? { label: "versão em execução", cls: "bg-primary/10 text-primary" }
      : target.kind === "build"
        ? { label: "build disponível", cls: "bg-status-success/15 text-status-success" }
        : { label: "sem build", cls: "bg-muted text-muted-foreground" };
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border/60 px-3 py-2">
      <span className="font-mono text-sm font-semibold w-10">{release.short}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm truncate">{release.title}</p>
        <p className="text-xs text-muted-foreground">
          {release.tag} · {release.date}
        </p>
      </div>
      <span className={`text-[11px] px-2 py-0.5 rounded-full ${status.cls}`}>
        {status.label}
      </span>
      {target.kind === "current" && (
        <a href="/" className="text-primary hover:underline text-xs inline-flex items-center gap-1">
          Abrir <ArrowRight className="h-3 w-3" />
        </a>
      )}
      {target.kind === "build" && (
        <a href={target.to} className="text-primary hover:underline text-xs inline-flex items-center gap-1">
          Abrir <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </li>
  );
}

/**
 * Gateway das URLs versionadas (/v0 /v1 /v2 …, /latest, /oldest).
 *
 * - versão em execução → Navigate para "/" (o app rodando JÁ É a release);
 * - versão com build estático em /versions/<tag>/ → navegação full-page
 *   (é outro build do app, fora do SPA — <Navigate> cairia no 404);
 * - sem build → painel honesto com a lista de releases e o comando para
 *   gerar o build localmente.
 */
export default function VersionGateway() {
  const location = useLocation();
  const [builds, setBuilds] = useState<Set<string> | null>(buildsCache);

  useEffect(() => {
    let alive = true;
    loadBuilds().then((b) => {
      if (alive) setBuilds(b);
    });
    return () => {
      alive = false;
    };
  }, []);

  const query = parseVersionQuery(location.pathname);
  const release = query ? resolveVersionQuery(query) : null;

  if (builds === null) return <PageLoader label="Resolvendo versão…" />;

  if (release) {
    const target = versionTarget(release, undefined, builds);
    if (target.kind === "current") return <Navigate to="/" replace />;
    if (target.kind === "build") {
      // Outro build do app: sai do SPA com navegação completa.
      window.location.replace(target.to);
      return <PageLoader label={`Abrindo ${release.tag}…`} />;
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 elev-2">
        <div className="flex items-center gap-2 mb-1">
          <History className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Versões do App Intelligence</h1>
        </div>
        {release ? (
          <p className="text-sm text-muted-foreground mb-4" role="status">
            {release.hasTag ? (
              <>
                A versão <strong>{release.tag}</strong> não tem build estático
                disponível nesta instalação. Gere com{" "}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  npm run build:version {release.tag}
                </code>{" "}
                e recarregue.
              </>
            ) : (
              <>
                A versão <strong>{release.tag}</strong> é uma baseline
                documentada no CHANGELOG — não existe tag git para gerar um
                build navegável. A mais antiga com build é a{" "}
                <strong>{RELEASES.find((r) => r.hasTag)?.tag}</strong>.
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground mb-4" role="status">
            Versão não encontrada para{" "}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
              {location.pathname}
            </code>
            . Versões disponíveis abaixo — use /vN, /latest ou /oldest.
          </p>
        )}
        <ul className="space-y-2" aria-label="Releases disponíveis">
          {RELEASES.map((r) => (
            <ReleaseRow key={r.tag} release={r} builds={builds} />
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground inline-flex items-center gap-1.5">
          <PackageOpen className="h-3.5 w-3.5" />
          Builds estáticos ficam em public/versions/&lt;tag&gt;/ (artefatos
          locais, não versionados).
        </p>
      </div>
    </div>
  );
}
