import { useCallback, useRef, useState } from "react";
import { AlertCircle, ExternalLink, Link2, Loader2, Search } from "lucide-react";
import { resolveInput, type ResolvedTarget } from "@/lib/discover/discoverApi";

type Resolved = ResolvedTarget & { fanout?: string; detail?: Record<string, unknown> };

/** Extrai campos úteis do detalhe (cada API tem shape própria). */
function detailSummary(target: Resolved): { title?: string; subtitle?: string; image?: string; url?: string; stats: [string, string][] } {
  const d = target.detail ?? {};
  const stats: [string, string][] = [];
  const num = (v: unknown) => (typeof v === "number" ? v.toLocaleString("pt-BR") : undefined);
  switch (target.kind) {
    case "youtube":
      return {
        title: d.title as string,
        subtitle: d.author_name as string,
        image: d.thumbnail_url as string,
        url: `https://www.youtube.com/watch?v=${target.id}`,
        stats,
      };
    case "wikipedia":
      return {
        title: d.title as string,
        subtitle: typeof d.extract === "string" ? (d.extract as string).slice(0, 240) : undefined,
        image: (d.thumbnail as { source?: string })?.source,
        url: (d.content_urls as { desktop?: { page?: string } })?.desktop?.page,
        stats,
      };
    case "github": {
      if (d.stargazers_count != null) stats.push(["Estrelas", num(d.stargazers_count) ?? ""]);
      if (d.forks_count != null) stats.push(["Forks", num(d.forks_count) ?? ""]);
      if (d.open_issues_count != null) stats.push(["Issues abertas", num(d.open_issues_count) ?? ""]);
      if (d.language) stats.push(["Linguagem", String(d.language)]);
      return {
        title: d.full_name as string,
        subtitle: d.description as string,
        url: d.html_url as string,
        stats,
      };
    }
    case "npm": {
      if (d.version) stats.push(["Versão", String(d.version)]);
      if (d.license) stats.push(["Licença", String(d.license)]);
      return {
        title: d.name as string,
        subtitle: d.description as string,
        url: `https://www.npmjs.com/package/${target.id}`,
        stats,
      };
    }
    case "pypi": {
      const info = (d.info ?? {}) as Record<string, unknown>;
      if (info.version) stats.push(["Versão", String(info.version)]);
      if (info.license) stats.push(["Licença", String(info.license).slice(0, 40)]);
      return {
        title: info.name as string,
        subtitle: info.summary as string,
        url: (info.project_url as string) ?? `https://pypi.org/project/${target.id}`,
        stats,
      };
    }
    case "doi": {
      const m = (d.message ?? {}) as Record<string, unknown>;
      const title = Array.isArray(m.title) ? String(m.title[0]) : undefined;
      const container = Array.isArray(m["container-title"]) ? String(m["container-title"][0]) : undefined;
      if (m.isReferencedByCount != null) stats.push(["Citações", num(m.isReferencedByCount) ?? ""]);
      if (container) stats.push(["Publicado em", container]);
      return { title, subtitle: container, url: `https://doi.org/${target.id}`, stats };
    }
    case "apple-app": {
      const r = Array.isArray(d.results) ? (d.results[0] as Record<string, unknown>) : undefined;
      if (!r) return { stats };
      if (r.averageUserRating != null) stats.push(["Nota", `${Number(r.averageUserRating).toFixed(1)} ★`]);
      if (r.userRatingCount != null) stats.push(["Avaliações", num(r.userRatingCount) ?? ""]);
      if (r.version) stats.push(["Versão", String(r.version)]);
      return {
        title: r.trackName as string,
        subtitle: r.sellerName as string,
        image: r.artworkUrl100 as string,
        url: r.trackViewUrl as string,
        stats,
      };
    }
    case "steam": {
      const app = (d[target.id] as { success?: boolean; data?: Record<string, unknown> })?.data;
      if (!app) return { stats };
      return {
        title: app.name as string,
        subtitle: Array.isArray(app.developers) ? (app.developers as string[]).join(", ") : undefined,
        image: app.header_image as string,
        url: `https://store.steampowered.com/app/${target.id}`,
        stats,
      };
    }
    case "openlibrary": {
      const authors = Array.isArray(d.authors) ? `${(d.authors as unknown[]).length} autor(es)` : undefined;
      return {
        title: d.title as string,
        subtitle: authors,
        url: `https://openlibrary.org${d.key ?? ""}`,
        stats,
      };
    }
    case "mastodon": {
      const content = typeof d.content === "string" ? d.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : undefined;
      if (d.favourites_count != null) stats.push(["Favoritos", num(d.favourites_count) ?? ""]);
      if (d.reblogs_count != null) stats.push(["Boosts", num(d.reblogs_count) ?? ""]);
      return {
        title: content ? content.slice(0, 200) : undefined,
        subtitle: (d.account as { display_name?: string })?.display_name,
        url: d.url as string,
        stats,
      };
    }
    default:
      return { stats };
  }
}

/**
 * Painel "termo ou URL": o usuário cola um link, o sistema detecta o tipo da
 * entidade, busca os detalhes na API pública e sugere o fan-out multi-fonte.
 */
export function UrlResolverPanel({ onFanout }: { onFanout?: (term: string) => void }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [resolved, setResolved] = useState<Resolved>();
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(async () => {
    const url = input.trim();
    if (!url) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    setError(undefined);
    setResolved(undefined);
    try {
      const res = await resolveInput(url, ac.signal);
      if (ac.signal.aborted) return;
      if (!res.ok || !res.target) {
        setError(res.error || "Não foi possível resolver esta URL");
        return;
      }
      setResolved(res.target);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError(String((err as Error)?.message || err));
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [input]);

  const summary = resolved ? detailSummary(resolved) : undefined;
  const detailError = resolved?.detail && typeof resolved.detail.error === "string" ? resolved.detail.error : undefined;

  return (
    <section id="discover-resolver" aria-labelledby="discover-resolver-title" className="scroll-mt-24 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Link2 className="h-4 w-4" aria-hidden />
        </span>
        <div>
          <h2 id="discover-resolver-title" className="text-sm font-semibold">Investigar um link</h2>
          <p className="text-xs text-muted-foreground">
            Cole uma URL (YouTube, Wikipédia, GitHub, npm, DOI, app, jogo…) — o sistema detecta o que é e busca os detalhes.
          </p>
        </div>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label htmlFor="discover-url-input" className="sr-only">URL para investigar</label>
        <input
          id="discover-url-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://github.com/facebook/react"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          Investigar
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-3 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <p className="break-words text-xs text-destructive">{error}</p>
        </div>
      )}

      {resolved && (
        <div className="mt-3 rounded-lg border bg-secondary/30 p-3" role="status">
          <p className="text-xs font-medium text-primary">{resolved.label}</p>
          {summary?.title && <p className="mt-1 text-sm font-semibold leading-snug">{summary.title}</p>}
          {summary?.subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{summary.subtitle}</p>}
          {summary && summary.stats.length > 0 && (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {summary.stats.map(([k, v]) => (
                <div key={k} className="text-xs">
                  <dt className="inline text-muted-foreground">{k}: </dt>
                  <dd className="inline font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          {detailError && (
            <p role="note" className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Tipo detectado, mas os detalhes falharam: {detailError}
            </p>
          )}
          {resolved.hint && <p className="mt-2 text-xs text-muted-foreground">{resolved.hint}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(summary?.url || (resolved.kind === "generic" ? resolved.id : undefined)) && (
              <a
                href={summary?.url ?? resolved.id}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline"
              >
                Abrir original <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            )}
            {resolved.fanout && onFanout && (
              <button
                type="button"
                onClick={() => onFanout(resolved.fanout!)}
                className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary outline-none hover:bg-primary/20 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <Search className="h-3 w-3" aria-hidden />
                Pesquisar “{resolved.fanout}” nas fontes
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
