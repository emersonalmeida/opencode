/**
 * Registry canônico de releases congeladas do App Intelligence.
 *
 * Alimenta as URLs versionadas do navegador:
 *   /v0 /v1 /v2 …  → release pela abreviatura (short)
 *   /latest        → release mais recente
 *   /oldest        → release mais antiga
 *
 * Regra de resolução (ver VersionGateway):
 *   - release cuja versão é a do build em execução → redireciona para "/"
 *     (o app rodando JÁ É essa versão; nenhum artefato extra é necessário);
 *   - release com build estático presente em public/versions/<tag>/
 *     (gerado por `npm run build:version <tag>`) → redireciona para lá;
 *   - demais → painel honesto explicando como gerar o build.
 *
 * Ao congelar uma nova versão: adicionar a entrada no FIM de RELEASES
 * (ordem cronológica) e atualizar CURRENT_VERSION.
 */

export interface Release {
  /** Tag git anotada (ex.: "v1.0.0"). Baselines sem tag usam nome simbólico. */
  tag: string;
  /** Abreviatura da URL (ex.: "v1" em /v1). */
  short: string;
  /** Versão semver (ex.: "1.0.0"). */
  version: string;
  /** Data do congelamento (AAAA-MM-DD). */
  date: string;
  /** Título curto da release. */
  title: string;
  /** true quando existe tag git para buildar (baselines documentadas: false). */
  hasTag: boolean;
}

/** Versão do build em execução — sincronizada com package.json (guard em releases.test). */
export const CURRENT_VERSION = "1.1.0";

/** Releases em ordem cronológica (mais antiga primeiro). */
export const RELEASES: Release[] = [
  {
    tag: "v0.0.0",
    short: "v0",
    version: "0.0.0",
    date: "2026-08-22",
    title: "Baseline — plataforma local-first (37 páginas, canvas, pipeline)",
    hasTag: false, // baseline documentada no CHANGELOG, sem tag git para buildar
  },
  {
    tag: "v1.0.0",
    short: "v1",
    version: "1.0.0",
    date: "2026-08-24",
    title: "Chat universal + multifonte (33 fontes + custom)",
    hasTag: true,
  },
  {
    tag: "v1.1.0",
    short: "v2",
    version: "1.1.0",
    date: "2026-08-27",
    title: "Auditoria total de fontes (35 sondas) + casa em ordem",
    hasTag: true,
  },
];

export type VersionQueryKind = "short" | "latest" | "oldest";

export interface VersionQuery {
  kind: VersionQueryKind;
  /** Abreviatura quando kind === "short" (ex.: "v1"). */
  short?: string;
}

/** Extrai a consulta de versão de um pathname ("/v1" → short v1; "/latest" → latest). */
export function parseVersionQuery(pathname: string): VersionQuery | null {
  const seg = pathname.replace(/\/+$/, "").toLowerCase();
  if (seg === "/latest") return { kind: "latest" };
  if (seg === "/oldest") return { kind: "oldest" };
  const m = seg.match(/^\/(v\d+)$/);
  if (m) return { kind: "short", short: m[1] };
  return null;
}

/** Resolve a consulta para uma release concreta (ou null se não existir). */
export function resolveVersionQuery(
  query: VersionQuery,
  releases: Release[] = RELEASES,
): Release | null {
  if (releases.length === 0) return null;
  if (query.kind === "latest") return releases[releases.length - 1];
  if (query.kind === "oldest") return releases[0];
  return releases.find((r) => r.short === query.short) ?? null;
}

export type VersionTarget =
  | { kind: "current"; to: string } // o app em execução é a release → "/"
  | { kind: "build"; to: string } // build estático em /versions/<tag>/
  | { kind: "unavailable" }; // sem build disponível → painel honesto

/**
 * Decide o destino de uma release. `builds` é o conjunto de tags com build
 * estático presente (conteúdo de public/versions/index.json).
 */
export function versionTarget(
  release: Release,
  currentVersion: string = CURRENT_VERSION,
  builds: ReadonlySet<string> = new Set(),
): VersionTarget {
  if (release.version === currentVersion) return { kind: "current", to: "/" };
  if (builds.has(release.tag)) return { kind: "build", to: `/versions/${release.tag}/` };
  return { kind: "unavailable" };
}

/** Lista de tags presentes num index.json de builds (formato do build-version.mjs). */
export function parseBuildsIndex(json: unknown): Set<string> {
  if (
    json &&
    typeof json === "object" &&
    Array.isArray((json as { tags?: unknown }).tags)
  ) {
    return new Set(
      (json as { tags: unknown[] }).tags.filter(
        (t): t is string => typeof t === "string",
      ),
    );
  }
  return new Set();
}
