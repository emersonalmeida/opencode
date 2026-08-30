import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — YOUTUBE.
 *
 * Base: docs/fontes/youtube-2026-08-25.md, server/routes/uniYoutube.ts
 * (scraping público ytInitialData + Innertube /youtubei/v1/next),
 * notebooks youtube-fonte/youtube-output (YouTube Data API v3 +
 * youtube-search-python + youtube-comment-downloader) e a documentação
 * oficial da Data API v3.
 */
export const YOUTUBE_AUDIT: AuditSource = {
  id: "youtube",
  order: 4,
  name: "YouTube",
  category: "Vídeo",
  status: "audited",
  implemented: true,
  sourceId: "youtube",
  summary:
    "A maior plataforma de vídeo: reviews em vídeo, tutoriais, comparativos e discussões sobre apps. O sistema opera SEM API key — busca pela página pública (/results → ytInitialData → videoRenderer) e comentários pelo cliente interno Innertube (/youtubei/v1/next com paginação por continuação, até 10 páginas por vídeo). A Data API v3 oficial (com YOUTUBE_API_KEY) é o caminho de maior confiabilidade e volume, usada no notebook de referência.",
  endpoints: [
    {
      label: "Busca pública (scraping)",
      url: "https://www.youtube.com/results?search_query={q}&sp={ORDER_SP}",
      method: "GET",
      auth: "nenhuma",
      notes: "ytInitialData → videoRenderer; sp é protobuf base64 (relevance='', date, views, rating).",
      status: "implemented",
    },
    {
      label: "Comentários (Innertube)",
      url: "GET /watch?v={id} → token → POST /youtubei/v1/next?key=INNERTUBE_API_KEY",
      method: "GET+POST",
      auth: "nenhuma (chave pública do cliente web)",
      notes: "Paginação por continuation token; sistema lê até 10 páginas por vídeo.",
      status: "implemented",
    },
    {
      label: "YouTube Data API v3 — search",
      url: "GET https://www.googleapis.com/youtube/v3/search?part=snippet&q={q}&type=video",
      method: "GET",
      auth: "YOUTUBE_API_KEY",
      notes: "Oficial; 10.000 unidades/dia de cota grátis (search custa 100 unidades!).",
      status: "available",
    },
    {
      label: "Data API v3 — videos/channels/commentThreads/playlists",
      url: "https://www.googleapis.com/youtube/v3/{recurso}?part=snippet,statistics,contentDetails",
      method: "GET",
      auth: "YOUTUBE_API_KEY",
      notes: "statistics (views/likes/comments exatos), contentDetails (duração ISO 8601), canais com inscritos.",
      status: "available",
    },
    {
      label: "oEmbed",
      url: "https://www.youtube.com/oembed?url={watch-url}&format=json",
      method: "GET",
      auth: "nenhuma",
      notes: "Título/autor/thumbnail de um vídeo — já usado no resolvedor de URLs da Descoberta.",
      status: "implemented",
    },
    {
      label: "Suggest do YouTube",
      url: "https://suggestqueries.google.com/complete/search?ds=yt&q={q}",
      method: "GET",
      auth: "nenhuma",
      notes: "Autocomplete do YouTube — já coberto pela fonte Suggest (vertical yt).",
      status: "implemented",
    },
  ],
  parameters: [
    { name: "query", type: "string", description: "Termo de busca de vídeos.", status: "implemented" },
    { name: "videoId (comments)", type: "string", description: "Vídeo alvo dos comentários sob demanda.", status: "implemented" },
    { name: "region (gl)", type: "string", description: "País da busca.", default: "BR", status: "implemented" },
    { name: "lang (hl)", type: "string", description: "Idioma da interface/resultados.", default: "pt-BR", status: "implemented" },
    { name: "order", type: "enum", description: "Ordenação mapeada para o parâmetro sp (protobuf).", options: ["relevance", "date", "views", "rating"], default: "relevance", status: "implemented" },
    { name: "limit", type: "number", description: "Máximo de vídeos/comentários; comentários paginam até 10 páginas por vídeo.", status: "implemented" },
    { name: "sp — filtros", type: "bitfield", description: "Upload date (hora/dia/semana/mês/ano), tipo (vídeo/canal/playlist/live), duração (<4min/4–20/>20), features (4K, legendas, live) — codificáveis no sp.", status: "implemented" },
    { name: "pageToken (Data API)", type: "string", description: "Paginação oficial de search/commentThreads (50/página).", status: "available" },
    { name: "order da Data API", type: "enum", description: "relevance, date, rating, title, videoCount, viewCount.", options: ["relevance", "date", "rating", "title", "videoCount", "viewCount"], status: "available" },
    { name: "chart=mostPopular", type: "enum", description: "Trending de vídeos por região/categoria (videos.list).", status: "available" },
    { name: "videoCategoryId", type: "string", description: "Categorias oficiais (ex.: 27=Educação, 28=Ciência/Tec).", status: "available" },
  ],
  capabilities: [
    { label: "Vídeos por termo sem API key (views, duração, canal, thumb)", status: "implemented" },
    { label: "Comentários sob demanda por vídeo (autor, texto, likes, data)", status: "implemented" },
    { label: "4 ordenações (relevância, data, views, rating)", status: "implemented" },
    { label: "oEmbed de um vídeo (título/autor/thumb)", status: "implemented" },
    { label: "Autocomplete YouTube via fonte Suggest (ds=yt)", status: "implemented" },
    { label: "Data API v3: statistics exatas (viewCount/likeCount/commentCount)", status: "available", notes: "Scraping devolve views arredondadas ('12 mil'); a API devolve o número exato." },
    { label: "Data API v3: canais como entidade (inscritos, vídeos, playlists)", status: "available" },
    { label: "Data API v3: commentThreads com respostas (replies)", status: "available" },
    { label: "Legendas/transcrição (captions — ouro para análise de conteúdo)", status: "available", notes: "Sem key: timedtext público; com key: captions.list/download." },
    { label: "Trending por região (chart=mostPopular)", status: "available" },
    { label: "Filtros de busca por sp (upload date, duração, 4K, live, legendas)", status: "available" },
    { label: "Paginação profunda de busca (continuation além da 1ª página)", status: "available" },
  ],
  combinations: [
    "query × 4 ordenações × região × idioma — a recepção muda por mercado",
    "vídeos × comentários — do vídeo ao sentimento da audiência",
    "YouTube × Suggest (ds=yt) — a intenção de busca em vídeo",
    "YouTube × Trends (gprop=youtube) — demanda de busca em vídeo ao longo do tempo",
    "busca × filtros sp (data/duração/live) — recortes editoriais precisos",
  ],
  outputs: [
    { name: "videoId", type: "string", description: "ID estável do vídeo (embed/transcrição são extensões naturais).", presence: "always", status: "implemented" },
    { name: "title", type: "string", description: "Título do vídeo.", presence: "always", status: "implemented" },
    { name: "channel (author)", type: "string", description: "Nome do canal.", presence: "always", status: "implemented" },
    { name: "published (date)", type: "string", description: "Data relativa no scraping ('há 3 dias'); ISO exata na Data API.", presence: "always", status: "implemented", reliability: "scraping = texto relativo; API = timestamp exato" },
    { name: "views", type: "string", description: "Visualizações arredondadas ('12 mil'); exatas só na Data API.", presence: "common", status: "partial" },
    { name: "duration", type: "string", description: "Duração mm:ss (scraping) / ISO 8601 (API).", presence: "common", status: "implemented" },
    { name: "thumb", type: "url", description: "Thumbnail (várias resoluções disponíveis por convenção de URL).", presence: "common", status: "implemented" },
    { name: "description", type: "string", description: "Descrição/snippet do vídeo.", presence: "common", status: "partial" },
    { name: "comment: author/text/likes/published", type: "objeto", description: "Comentário com autor, texto, curtidas e data relativa.", presence: "always", status: "implemented" },
    { name: "statistics exatas (view/like/commentCount)", type: "number", description: "Contadores exatos — só Data API v3.", presence: "always", status: "available" },
    { name: "channel: subscriberCount/videoCount", type: "number", description: "Inscritos e volume do canal — só Data API v3.", presence: "always", status: "available" },
    { name: "transcrição (captions)", type: "texto", description: "Legenda completa do vídeo — análise de conteúdo profunda.", presence: "conditional", status: "available", reliability: "só vídeos com legendas; auto-geradas têm erros" },
    { name: "replies de comentários", type: "objeto", description: "Respostas a comentários (commentThreads).", presence: "common", status: "available" },
    { name: "tags do vídeo", type: "string[]", description: "Tags editoriais — só Data API v3 (snippet.tags).", presence: "common", status: "available" },
  ],
  derivations: [
    "Sentimento da audiência (comentários × likes)",
    "Ranking de criadores que cobrem o app/tema",
    "Alcance estimado (views × recência)",
    "Temas dominantes nos vídeos (títulos/descrições/tags)",
    "Análise de conteúdo via transcrição (quando disponível)",
  ],
  limits: [
    "Scraping: parsing frágil a mudanças do ytInitialData; comentários paginam até 10 páginas/vídeo",
    "Data API v3: cota de 10.000 unidades/dia; search custa 100 unidades (100 buscas/dia)",
    "Views/likes no scraping são arredondados e localizados",
    "Comentários podem estar desativados por vídeo (erro honesto)",
  ],
  reliability: {
    consistency:
      "Comentários e contagens mudam constantemente (natureza da fonte); a estrutura de vídeo (título/canal/duração) é estável.",
    stability:
      "Scraping depende do markup do YouTube (muda sem aviso); Innertube é interno mas estável na prática; Data API v3 é oficial e versionada.",
    risks: [
      "Quebra de parsing em atualização do YouTube",
      "Rate-limit/bloqueio por IP em scraping intenso",
      "Cota diária da Data API esgota rápido (search = 100 unidades)",
    ],
    fallbacks: [
      "PlaylistItems (1 unité) é uma substituição mais barata que search.list (100 unités) para scraping limitado",
      "Dois caminhos independentes: scraping sem key ↔ Data API com key",
      "Erro honesto quando comentários estão desativados",
      "oEmbed como leitura mínima garantida de um vídeo",
    ],
  },
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/youtube-2026-08-25.md" },
    { label: "Notebook de testes (youtube-fonte)", url: "docs/fontes/notebooks/youtube-fonte.md" },
    { label: "Saídas de exemplo (youtube-output)", url: "docs/fontes/notebooks/youtube-output.md" },
    { label: "YouTube Data API v3 (oficial)", url: "https://developers.google.com/youtube/v3/docs" },
  ],
};
