/**
 * URL Resolver — núcleo PURO que detecta o domínio de uma URL (ou identificador
 * solto, como um DOI) e extrai a entidade + a URL da API pública a consultar.
 *
 * A página /descoberta usa isso no fluxo "o usuário cola uma URL → o sistema
 * descobre o que é → busca os detalhes → sugere fan-out multi-fonte".
 *
 * Cobertura (todas as APIs verificadas ao vivo em 2026-08-25, sem chave):
 * youtube · wikipedia · github · npm · pypi · doi/crossref · apple app store ·
 * google play · steam · openlibrary · mastodon · reddit (parse apenas) ·
 * generic (fallback para o coletor uni-web).
 */

export type ResolvedKind =
  | "youtube"
  | "wikipedia"
  | "github"
  | "npm"
  | "pypi"
  | "doi"
  | "apple-app"
  | "google-app"
  | "steam"
  | "openlibrary"
  | "mastodon"
  | "reddit"
  | "generic";

export interface ResolvedTarget {
  kind: ResolvedKind;
  /** Identificador extraído (videoId, owner/repo, package, appId, DOI…). */
  id: string;
  /** URL da API pública que devolve os detalhes da entidade (quando há). */
  apiUrl?: string;
  /** Rótulo amigável do tipo ("Vídeo do YouTube", "Repositório GitHub"…). */
  label: string;
  /** Hint de ação quando a entidade é tratada por outra superfície do sistema. */
  hint?: string;
}

export const RESOLVED_KIND_LABELS: Record<ResolvedKind, string> = {
  youtube: "Vídeo do YouTube",
  wikipedia: "Artigo da Wikipédia",
  github: "Repositório GitHub",
  npm: "Pacote npm",
  pypi: "Pacote PyPI",
  doi: "Artigo científico (DOI)",
  "apple-app": "App da Apple App Store",
  "google-app": "App do Google Play",
  steam: "Jogo da Steam",
  openlibrary: "Livro (Open Library)",
  mastodon: "Publicação do Mastodon",
  reddit: "Publicação do Reddit",
  generic: "Página web",
};

/** Normaliza a entrada: aceita URL completa, "www." sem esquema ou DOI cru. */
export function normalizeInput(input: string): string {
  const s = input.trim();
  if (/^10\.\d{4,9}\/\S+$/i.test(s)) return `https://doi.org/${s}`;
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(s) && !s.includes("://")) return `https://${s}`;
  return s;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Detecta o tipo de entidade e monta o alvo. Retorna null se a URL é inválida. */
export function resolveUrl(rawInput: string): ResolvedTarget | null {
  const input = normalizeInput(rawInput);
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  const host = hostOf(input);
  const path = u.pathname;
  const kind = (k: ResolvedKind, id: string, apiUrl?: string, hint?: string): ResolvedTarget => ({
    kind: k, id, apiUrl, label: RESOLVED_KIND_LABELS[k], hint,
  });

  // YouTube: watch?v=, youtu.be/, /shorts/, /live/
  if (host === "youtu.be") {
    const id = path.slice(1).split("/")[0];
    if (id) return kind("youtube", id, `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`);
  }
  if (host.endsWith("youtube.com")) {
    const v = u.searchParams.get("v") ?? /^\/(shorts|live|embed)\/([\w-]+)/.exec(path)?.[2];
    if (v) return kind("youtube", v, `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${v}`)}&format=json`);
  }

  // Wikipédia: /wiki/Título (qualquer idioma)
  const wiki = /^([a-z-]+)\.(?:m\.)?wikipedia\.org$/.exec(host);
  if (wiki && path.startsWith("/wiki/")) {
    const title = decodeURIComponent(path.slice(6)).replace(/_/g, " ");
    if (title) {
      return kind("wikipedia", title, `https://${wiki[1]}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(path.slice(6))}`);
    }
  }

  // GitHub: /owner/repo (ignora rotas do site: trending, explore, settings…)
  if (host === "github.com") {
    const m = /^\/([\w.-]+)\/([\w.-]+)\/?$/.exec(path);
    const reserved = new Set(["trending", "explore", "settings", "marketplace", "pricing", "features", "topics", "collections", "sponsors", "login", "signup", "notifications", "search", "orgs", "users"]);
    if (m && !reserved.has(m[1].toLowerCase())) {
      return kind("github", `${m[1]}/${m[2]}`, `https://api.github.com/repos/${m[1]}/${m[2]}`);
    }
  }

  // npm: /package/name ou /package/@scope/name
  if (host === "npmjs.com" || host === "www.npmjs.com") {
    const m = /^\/package\/(@[\w.-]+\/[\w.-]+|[\w.-]+)/.exec(path);
    if (m) return kind("npm", m[1], `https://registry.npmjs.org/${encodeURIComponent(m[1])}/latest`);
  }

  // PyPI: /project/name
  if (host === "pypi.org") {
    const m = /^\/project\/([\w.-]+)/.exec(path);
    if (m) return kind("pypi", m[1], `https://pypi.org/pypi/${encodeURIComponent(m[1])}/json`);
  }

  // DOI: doi.org/10.xxxx/...
  if (host === "doi.org") {
    const doi = decodeURIComponent(path.slice(1));
    if (/^10\.\d{4,9}\/\S+$/i.test(doi)) {
      return kind("doi", doi, `https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    }
  }

  // Apple App Store: /app/.../id123456
  if (host === "apps.apple.com") {
    const m = /\/id(\d+)/.exec(path);
    if (m) {
      return kind("apple-app", m[1], `https://itunes.apple.com/lookup?id=${m[1]}&country=br`,
        "Apps têm coleta completa de reviews na página do app e na busca global.");
    }
  }

  // Google Play: /store/apps/details?id=pkg
  if (host === "play.google.com") {
    const id = u.searchParams.get("id");
    if (id) {
      return kind("google-app", id, undefined,
        "Apps têm coleta completa de reviews na página do app e na busca global.");
    }
  }

  // Steam: /app/12345
  if (host === "store.steampowered.com") {
    const m = /^\/app\/(\d+)/.exec(path);
    if (m) return kind("steam", m[1], `https://store.steampowered.com/api/appdetails?appids=${m[1]}&l=portuguese&cc=br`);
  }

  // Open Library: /isbn/X, /works/OL…W, /books/OL…M
  if (host === "openlibrary.org") {
    const m = /^\/(isbn|works|books)\/([\w-]+)/.exec(path);
    if (m) return kind("openlibrary", m[2], `https://openlibrary.org/${m[1]}/${m[2]}.json`);
  }

  // Mastodon: /<@user>/<id> em qualquer instância conhecida por padrão de path
  const masto = /^\/@([\w.-]+)\/(\d+)\/?$/.exec(path);
  if (masto) {
    return kind("mastodon", `${host}/@${masto[1]}/${masto[2]}`, `https://${host}/api/v1/statuses/${masto[2]}`);
  }

  // Reddit: /r/sub/comments/id/... (parse apenas — API pública bloqueia alguns IPs)
  if (host.endsWith("reddit.com")) {
    const m = /^\/r\/([\w-]+)\/comments\/([\w-]+)/.exec(path);
    if (m) {
      return kind("reddit", `${m[1]}/${m[2]}`, undefined,
        "A API pública do Reddit pode bloquear por IP; use a fonte Reddit da Uni com o subreddit.");
    }
  }

  return kind("generic", input, undefined, "Páginas genéricas são coletadas pela fonte Web da Uni (extrai título, texto e links).");
}

/** Termo sugerido para fan-out multi-fonte a partir do alvo resolvido. */
export function fanoutTerm(target: ResolvedTarget): string {
  switch (target.kind) {
    case "github":
      return target.id.split("/")[1] ?? target.id;
    case "wikipedia":
      return target.id;
    case "npm":
    case "pypi":
      return target.id.replace(/^@/, "").split("/").pop() ?? target.id;
    case "apple-app":
    case "google-app":
    case "steam":
    case "youtube":
    case "doi":
    case "openlibrary":
    case "mastodon":
      // O título real só vem depois do fetch dos detalhes — o cliente refaz o
      // fan-out com o título quando ele chega.
      return "";
    default:
      return "";
  }
}
