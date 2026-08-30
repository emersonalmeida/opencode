/**
 * Catálogo das seções da página /descoberta — cada fonte vira uma seção com
 * ícone, descrição honesta, campos de parâmetro e defaults. Puro/testável:
 * sem React, sem fetch (o fetch fica em discoverApi).
 */
import {
  BookOpen,
  CloudSun,
  Coins,
  Gamepad2,
  Github,
  Globe2,
  Landmark,
  Library,
  ListMusic,
  Newspaper,
  Package,
  Podcast,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface DiscoverFieldOption { value: string; label: string }

export interface DiscoverField {
  key: string;
  label: string;
  kind: "text" | "select" | "date" | "number";
  placeholder?: string;
  options?: DiscoverFieldOption[];
  default: string;
}

export interface DiscoverSectionDef {
  id: string;
  title: string;
  icon: LucideIcon;
  /** O que a fonte oferece (honesto, com limites). */
  description: string;
  /** Grupo visual na página. */
  group: "leitura" | "charts" | "brasil" | "tech" | "social";
  fields: DiscoverField[];
  /** Params default mesclados com os campos na coleta. */
  defaults: Record<string, unknown>;
}

export const DISCOVER_GROUP_LABELS: Record<DiscoverSectionDef["group"], string> = {
  leitura: "Leitura & conhecimento",
  charts: "Charts & tendências",
  brasil: "Brasil",
  tech: "Tecnologia",
  social: "Social & notícias",
};

export const DISCOVER_GROUP_ORDER: DiscoverSectionDef["group"][] = [
  "leitura",
  "charts",
  "brasil",
  "tech",
  "social",
];

export const DISCOVER_SECTIONS: DiscoverSectionDef[] = [
  {
    id: "wikitop",
    title: "Wikipédia — mais lidos",
    icon: BookOpen,
    description: "Os 100 artigos mais lidos da Wikipédia por dia e idioma, com número de visualizações (API oficial Wikimedia).",
    group: "leitura",
    fields: [
      {
        key: "project", label: "Idioma", kind: "select", default: "pt.wikipedia",
        options: [
          { value: "pt.wikipedia", label: "Português" },
          { value: "en.wikipedia", label: "Inglês" },
          { value: "es.wikipedia", label: "Espanhol" },
          { value: "fr.wikipedia", label: "Francês" },
          { value: "de.wikipedia", label: "Alemão" },
        ],
      },
      { key: "date", label: "Dia (vazio = ontem)", kind: "date", default: "" },
    ],
    defaults: {},
  },
  {
    id: "wikiviews",
    title: "Wikipédia — leitura de um artigo",
    icon: TrendingUp,
    description: "Série diária de visualizações de qualquer artigo da Wikipédia (7–90 dias) — mede a atenção real sobre um tema.",
    group: "leitura",
    fields: [
      { key: "article", label: "Artigo", kind: "text", placeholder: "Brasil", default: "Brasil" },
      {
        key: "days", label: "Período", kind: "select", default: "30",
        options: [
          { value: "7", label: "7 dias" },
          { value: "30", label: "30 dias" },
          { value: "90", label: "90 dias" },
        ],
      },
    ],
    defaults: {},
  },
  {
    id: "onthisday",
    title: "Neste dia",
    icon: Globe2,
    description: "Eventos, nascimentos, mortes e feriados de qualquer data, curados pela Wikipédia em português.",
    group: "leitura",
    fields: [
      {
        key: "type", label: "Tipo", kind: "select", default: "all",
        options: [
          { value: "all", label: "Tudo" },
          { value: "selected", label: "Destaques" },
          { value: "events", label: "Eventos" },
          { value: "births", label: "Nascimentos" },
          { value: "deaths", label: "Mortes" },
          { value: "holidays", label: "Feriados" },
        ],
      },
    ],
    defaults: {},
  },
  {
    id: "books",
    title: "Livros em alta",
    icon: Library,
    description: "Os livros mais acessados da Open Library por período, com capa, autor e ano da primeira publicação.",
    group: "leitura",
    fields: [
      {
        key: "period", label: "Período", kind: "select", default: "daily",
        options: [
          { value: "daily", label: "Hoje" },
          { value: "weekly", label: "Esta semana" },
          { value: "monthly", label: "Este mês" },
          { value: "yearly", label: "Este ano" },
          { value: "forever", label: "Todos os tempos" },
        ],
      },
    ],
    defaults: {},
  },
  {
    id: "crypto",
    title: "Cripto em alta",
    icon: Coins,
    description: "As moedas mais buscadas do CoinGecko agora, com rank de capitalização e variação de 24h.",
    group: "charts",
    fields: [],
    defaults: {},
  },
  {
    id: "podcasts",
    title: "Podcasts — charts",
    icon: Podcast,
    description: "Os podcasts mais ouvidos da Apple Podcasts por país, com capa, autor e gênero.",
    group: "charts",
    fields: [
      {
        key: "country", label: "País", kind: "select", default: "br",
        options: [
          { value: "br", label: "Brasil" },
          { value: "us", label: "Estados Unidos" },
          { value: "pt", label: "Portugal" },
          { value: "gb", label: "Reino Unido" },
          { value: "es", label: "Espanha" },
        ],
      },
    ],
    defaults: {},
  },
  {
    id: "music",
    title: "Música — charts & busca",
    icon: ListMusic,
    description: "Charts globais do Deezer (faixas, artistas, álbuns) e busca de faixas com prévia de 30 segundos.",
    group: "charts",
    fields: [
      {
        key: "resource", label: "Recurso", kind: "select", default: "tracks",
        options: [
          { value: "tracks", label: "Top faixas" },
          { value: "artists", label: "Top artistas" },
          { value: "albums", label: "Top álbuns" },
          { value: "search", label: "Buscar faixas" },
        ],
      },
      { key: "query", label: "Termo (só na busca)", kind: "text", placeholder: "anitta", default: "" },
    ],
    defaults: {},
  },
  {
    id: "steamtop",
    title: "Jogos — mais jogados",
    icon: Gamepad2,
    description: "Os jogos mais jogados da Steam (SteamSpy), com jogadores simultâneos, % de avaliações positivas e estimativa de donos.",
    group: "charts",
    fields: [
      {
        key: "request", label: "Ranking", kind: "select", default: "top100in2weeks",
        options: [
          { value: "top100in2weeks", label: "Últimas 2 semanas" },
          { value: "top100forever", label: "Todos os tempos" },
          { value: "top100owned", label: "Mais vendidos" },
        ],
      },
    ],
    defaults: {},
  },
  {
    id: "clima",
    title: "Clima agora",
    icon: CloudSun,
    description: "Condições atuais nas principais capitais do Brasil (Open-Meteo): temperatura, sensação, umidade, vento e condição do céu.",
    group: "brasil",
    fields: [],
    defaults: {},
  },
  {
    id: "brasil",
    title: "Brasil — dados oficiais",
    icon: Landmark,
    description: "Feriados nacionais, taxas SELIC/CDI (BrasilAPI), câmbio (BCE) e ranking de nomes do censo (IBGE).",
    group: "brasil",
    fields: [
      {
        key: "resource", label: "Recurso", kind: "select", default: "feriados",
        options: [
          { value: "feriados", label: "Feriados do ano" },
          { value: "taxas", label: "Taxas (SELIC/CDI)" },
          { value: "cambio", label: "Câmbio" },
          { value: "nomes", label: "Nomes do censo" },
        ],
      },
      {
        key: "base", label: "Moeda base (câmbio)", kind: "select", default: "USD",
        options: [
          { value: "USD", label: "Dólar (USD)" },
          { value: "EUR", label: "Euro (EUR)" },
          { value: "BRL", label: "Real (BRL)" },
        ],
      },
    ],
    defaults: {},
  },
  {
    id: "packages",
    title: "Pacotes npm — downloads",
    icon: Package,
    description: "Downloads de pacotes npm por período — compare frameworks e bibliotecas lado a lado.",
    group: "tech",
    fields: [
      { key: "packages", label: "Pacotes (vírgula)", kind: "text", placeholder: "react,vue,express", default: "react,vue,express" },
      {
        key: "period", label: "Período", kind: "select", default: "last-week",
        options: [
          { value: "last-day", label: "Último dia" },
          { value: "last-week", label: "Última semana" },
          { value: "last-month", label: "Último mês" },
          { value: "last-year", label: "Último ano" },
        ],
      },
    ],
    defaults: {},
  },
  {
    id: "github-trending",
    title: "GitHub — repositórios em alta",
    icon: Github,
    description: "Os repositórios que mais ganham estrelas no GitHub, por linguagem e período (extração da página pública).",
    group: "tech",
    fields: [
      { key: "language", label: "Linguagem (vazio = todas)", kind: "text", placeholder: "typescript", default: "" },
      {
        key: "since", label: "Período", kind: "select", default: "daily",
        options: [
          { value: "daily", label: "Hoje" },
          { value: "weekly", label: "Esta semana" },
          { value: "monthly", label: "Este mês" },
        ],
      },
    ],
    defaults: {},
  },
  {
    id: "googlenews",
    title: "Notícias por termo",
    icon: Newspaper,
    description: "Notícias recentes de qualquer termo via Google News (RSS), com veículo e data de publicação.",
    group: "social",
    fields: [
      { key: "query", label: "Termo", kind: "text", placeholder: "inteligência artificial", default: "inteligência artificial" },
    ],
    defaults: {},
  },
  {
    id: "mastodon-trends",
    title: "Mastodon — tendências",
    icon: Users,
    description: "Publicações, hashtags e links em alta numa instância Mastodon (fediverso), com favoritos e compartilhamentos.",
    group: "social",
    fields: [
      {
        key: "resource", label: "Recurso", kind: "select", default: "statuses",
        options: [
          { value: "statuses", label: "Publicações" },
          { value: "tags", label: "Hashtags" },
          { value: "links", label: "Links" },
        ],
      },
      { key: "instance", label: "Instância", kind: "text", placeholder: "mastodon.social", default: "mastodon.social" },
    ],
    defaults: {},
  },
];

export function getDiscoverSection(id: string): DiscoverSectionDef | undefined {
  return DISCOVER_SECTIONS.find((s) => s.id === id);
}

/** Mescla defaults dos campos + defaults da seção → params da coleta. */
export function sectionParams(def: DiscoverSectionDef, values: Record<string, string>): Record<string, unknown> {
  const params: Record<string, unknown> = { ...def.defaults };
  for (const f of def.fields) {
    const v = (values[f.key] ?? f.default).trim();
    if (v !== "") params[f.key] = v;
  }
  return params;
}
