/**
 * Catálogo de chaves API — fontes que pedem credenciais + IA via API.
 * "Sem a chave, a fonte fica indisponível ou com erros honestos."
 */
export interface KeySpec {
  /** nome da variável de ambiente (quando o servidor a consome) ou campo cliente. */
  id: string;
  /** label amigável. */
  label: string;
  /** grupo: sources (fontes) | ai (IA via API). */
  group: "sources" | "ai";
  /** link oficial da chave. */
  href?: string;
  /** descrição completa do propósito. */
  hint: string;
  /** onde a chave é usada. */
  usedIn?: string;
}

export const KEY_SPECS: KeySpec[] = [
  // === FONTE ===
  {
    id: "BRAVE_API_KEY",
    label: "Brave Search API",
    group: "sources",
    href: "https://api.search.brave.com/app/register",
    hint: "SERP multi-engine — motor Brave (free tier ~2.000 req/mês).",
    usedIn: "SERP (engine brave)",
  },
  {
    id: "GOOGLE_API_KEY",
    label: "Google Custom Search API",
    group: "sources",
    href: "https://console.cloud.google.com/apis/credentials",
    hint: "SERP — motor Google CSE (free 100 consultas/dia).",
    usedIn: "SERP (engine google)",
  },
  {
    id: "GOOGLE_CX",
    label: "Google Custom Search CX",
    group: "sources",
    href: "https://programmablesearchengine.google.com/controlpanel/create",
    hint: "ID do mecanismo de busca Google CSE.",
    usedIn: "SERP (engine google)",
  },
  {
    id: "YOUTUBE_API_KEY",
    label: "YouTube Data API v3",
    group: "sources",
    href: "https://console.cloud.google.com/apis/credentials",
    hint: "Statísticas exatas e commentThreads. Sem key: scraping público.",
    usedIn: "YouTube (oficial)",
  },
  {
    id: "REDDIT_CLIENT_ID",
    label: "Reddit OAuth Client ID",
    group: "sources",
    href: "https://www.reddit.com/prefs/apps",
    hint: "App tipo script (para devolvificar).",
    usedIn: "Reddit (OAuth)",
  },
  {
    id: "REDDIT_CLIENT_SECRET",
    label: "Reddit OAuth Client Secret",
    group: "sources",
    href: "https://www.reddit.com/prefs/apps",
    hint: "Segredo do app (read-only).",
    usedIn: "Reddit (OAuth)",
  },
  {
    id: "PRODUCT_HUNT_TOKEN",
    label: "Product Hunt Developer Token",
    group: "sources",
    href: "https://api.producthunt.com/v2/oauth/applications",
    hint: "Developer token com 30 req/min (votos/comentários/tópicos).",
    usedIn: "Product Hunt (GraphQL)",
  },
  {
    id: "GITHUB_TOKEN",
    label: "GitHub Token",
    group: "sources",
    href: "https://github.com/settings/tokens",
    hint: "classic com repo:read (search 30 req/min; sem 10 req/min).",
    usedIn: "GitHub (Search API)",
  },
  {
    id: "GNEWS_API_KEY",
    label: "GNews API Key",
    group: "sources",
    href: "https://gnews.io/dashboard",
    hint: "Plano grátis ~100 req/dia; janelas from/to, search_in, sortby.",
    usedIn: "Google News (API com chave)",
  },
  {
    id: "SEMANTICSCHOLAR_API_KEY",
    label: "Semantic Scholar API",
    group: "sources",
    hint: "Sem key: 429 agressivo; com key: estável.",
    usedIn: "Semantic Scholar",
  },
  // === IA VIA API (BYOK — só no browser, NUNCA no servidor) ===
  {
    id: "ai:openai",
    label: "OpenAI API Key",
    group: "ai",
    href: "https://platform.openai.com/api-keys",
    hint: "BYOK: no navegador, nunca no servidor. Modelos gpt-4o/4o-mini etc.",
    usedIn: "IA (modo cloud)",
  },
  {
    id: "ai:anthropic",
    label: "Anthropic API Key",
    group: "ai",
    href: "https://console.anthropic.com/settings/keys",
    hint: "BYOK: claude-3.5-sonnet/haiku.",
    usedIn: "IA (modo cloud)",
  },
  {
    id: "ai:gemini",
    label: "Google AI Studio (Gemini)",
    group: "ai",
    href: "https://aistudio.google.com/app/apikey",
    hint: "BYOK: gemini-1.5-pro/flash.",
    usedIn: "IA (modo cloud)",
  },
  {
    id: "ai:openai-compatible",
    label: "OpenAI-compatible (Groq, Mistral, Together)",
    group: "ai",
    hint: "BYOK com baseUrl: qualquer API OpenAI-compatível.",
    usedIn: "IA (modo cloud)",
  },
];

export function keySpecsFor(entity: "sources" | "ai"): KeySpec[] {
  return KEY_SPECS.filter((s) => s.group === entity);
}
