import type { AuditSource } from "../auditModel";

/**
 * Auditoria maximalista — GOOGLE SUGGEST (autocomplete).
 *
 * Base: docs/fontes/google-suggest-2026-08-25.md, notebooks suggest-fonte/
 * suggest-output, src/lib/suggest/suggestCore.ts, server/routes/uniSuggest.ts
 * e a documentação pública do endpoint (não oficial, amplamente observada).
 */
export const SUGGEST_AUDIT: AuditSource = {
  id: "suggest",
  order: 1,
  name: "Google Suggest (Autocomplete)",
  category: "Descoberta de intenção",
  status: "audited",
  implemented: true,
  sourceId: "suggest",
  summary:
    "Endpoint público de autocomplete do Google (suggestqueries.google.com/complete/search) — as sugestões exibidas enquanto o usuário digita. Revela intenção de busca real: dores, dúvidas, comparações e desejos em torno de um termo, marca ou app. A maximalidade vem das sondas (expansões prefixo/sufixo) × regiões × idiomas × verticais × clientes — cada combo é uma janela diferente da mesma intenção.",
  endpoints: [
    {
      label: "Autocomplete JSON (principal)",
      url: "https://suggestqueries.google.com/complete/search?client={client}&q={q}&hl={hl}&gl={gl}&ds={ds}",
      method: "GET",
      auth: "nenhuma",
      notes: "client=chrome devolve JSON com metadados extras (relevância, tipo). UA de browser evita bloqueio.",
      status: "implemented",
    },
    {
      label: "Autocomplete via google.com",
      url: "https://www.google.com/complete/search?client={client}&q={q}",
      method: "GET",
      auth: "nenhuma",
      notes: "Mesmo payload; alternativa quando o subdomínio suggestqueries está instável.",
      status: "available",
    },
    {
      label: "Autocomplete XML (toolbar)",
      url: "https://suggestqueries.google.com/complete/search?client=toolbar&output=toolbar&q={q}",
      method: "GET",
      auth: "nenhuma",
      notes: "Formato XML legado (toplevel > CompleteSuggestion) — cobre clientes antigos de toolbar.",
      status: "available",
    },
    {
      label: "Rota do sistema uni-suggest",
      url: "POST /functions/v1/uni-suggest {action: suggest|expand|gather, query, region, lang, vertical, limit, client, seeds}",
      method: "POST",
      auth: "nenhuma (servidor local)",
      notes: "Cache TTL 15min por parâmetros completos; gather em lotes de 6 com progresso.",
      status: "implemented",
    },
  ],
  parameters: [
    {
      name: "q (query)",
      type: "string",
      description: "Termo base da consulta. Obrigatório. É a semente de todas as expansões.",
      status: "implemented",
    },
    {
      name: "client",
      type: "enum",
      description: "Cliente que muda o SHAPE da resposta. chrome/firefox devolvem JSON rico; toolbar devolve XML; safari/youtube são variações observadas.",
      options: ["chrome", "firefox", "toolbar", "safari", "youtube"],
      default: "chrome",
      status: "partial",
    },
    {
      name: "gl (região)",
      type: "enum",
      description: "País da sugestão. O sistema oferece 12 regiões curadas; o endpoint aceita qualquer código ISO de país.",
      options: ["br", "us", "pt", "gb", "fr", "de", "jp", "es", "mx", "ar", "ca", "it", "…qualquer ISO"],
      default: "br",
      status: "implemented",
    },
    {
      name: "hl (idioma)",
      type: "enum",
      description: "Idioma da interface. Vazio = Auto (omite hl — honesto). Aceita qualquer idioma suportado pelo Google.",
      options: ["", "pt", "en", "es", "fr", "de", "ja", "…qualquer hl"],
      default: "",
      status: "implemented",
    },
    {
      name: "ds (vertical)",
      type: "enum",
      description: "Vertical do autocomplete. Sistema usa 4; o endpoint expõe ao menos 6 (i=imagens e b=livros ainda não coletadas).",
      options: ["(vazio)=web", "yt=youtube", "n=news", "sh=shopping", "i=imagens", "b=livros"],
      default: "(vazio)",
      status: "partial",
    },
    {
      name: "limit",
      type: "number",
      description: "Máximo de sugestões por consulta. O endpoint raramente passa de ~10 por sonda; a maximalidade vem das sondas.",
      range: "1–50",
      default: "10",
      status: "implemented",
    },
    {
      name: "seeds (sondas)",
      type: "string[]",
      description: "Sondas explícitas para a ação gather (lotes de 6, teto 500). Geradas por buildSeeds a partir dos grupos de expansão.",
      range: "1–500",
      status: "implemented",
    },
    {
      name: "output",
      type: "enum",
      description: "Formato de saída no cliente toolbar (xml) — variação de baixo valor hoje.",
      options: ["toolbar", "json"],
      status: "available",
    },
    {
      name: "jsonp / callback",
      type: "string",
      description: "Wrapper JSONP para uso em browser legado — irrelevante para coleta servidor.",
      status: "available",
    },
    {
      name: "cp (cursor position)",
      type: "number",
      description: "Posição do cursor na string da consulta (SerpApi/spec) — afina sugestões quando o termo é editado no meio.",
      status: "available",
    },
  ],
  capabilities: [
    { label: "Sugestões por termo (top ~10)", status: "implemented" },
    { label: "4 verticais multi-selecionáveis (web/youtube/news/shopping) com merge dedup", status: "implemented" },
    { label: "Expansão alfabética a–z + 0–9 (36 sondas, até 200 itens/vertical)", status: "implemented" },
    { label: "13 grupos de expansão (alfabeto, números, invertido, questões, interrogativas, preposições, comparações, verbos, adjetivos, problemas, tutoriais, intenções, temporais)", status: "implemented" },
    { label: "Matriz gather com proveniência completa (seed × grupo × vertical × região)", status: "implemented" },
    { label: "Merge multi-sonda: dedup por melhor relevância + recorrência como desempate", status: "implemented" },
    { label: "Relevância nativa do Google (google:suggestrelevance) por sugestão", status: "available", notes: "Presente no JSON com client=chrome; hoje o score é derivado da posição." },
    { label: "Tipo da sugestão (google:suggesttype: QUERY, NAVIGATION…)", status: "available", notes: "Distingue consulta de navegação direta — sinal de marca forte." },
    { label: "Verticais extras ds=i (imagens) e ds=b (livros)", status: "available" },
    { label: "Comparação temporal de sugestões (snapshot → diff de intenção)", status: "available", notes: "Viável com o rawStore atual + agendamento." },
    { label: "Monitoramento agendado de marca (alerta de nova dor)", status: "available" },
  ],
  combinations: [
    "termo × 12 regiões curadas (ou qualquer ISO) — a mesma intenção muda por país",
    "termo × 7 idiomas (ou Auto) — hl altera o ranqueamento das sugestões",
    "termo × 4 verticais (web/yt/n/sh) — merge dedup por melhor relevância",
    "termo × 13 grupos de expansão (teto 400 sondas) — orçamento exibido antes de rodar",
    "termo × cliente (chrome/firefox) — dimensão experimental de shape",
    "Matriz completa: seeds × regiões × verticais × idiomas — a UI sempre mostra seeds × combos antes de executar",
  ],
  outputs: [
    { name: "suggestion (text)", type: "string", description: "A sugestão de busca em si (intenção real do usuário).", presence: "always", status: "implemented" },
    { name: "score (relevância derivada)", type: "number", description: "Relevância derivada da posição na lista (1º = maior).", presence: "always", status: "implemented", reliability: "estável — posição é determinística por consulta" },
    { name: "google:suggestrelevance", type: "number[]", description: "Relevância NUMÉRICA nativa do Google por sugestão (ex.: 1301, 1300, 601…).", presence: "common", status: "available", reliability: "presente com client=chrome; ausente em alguns clientes" },
    { name: "google:suggesttype", type: "string[]", description: "Tipo da sugestão (QUERY, NAVIGATION…) — NAVIGATION indica intenção de ir direto a um destino.", presence: "common", status: "available" },
    { name: "google:verbatimrelevance", type: "number", description: "Relevância do termo verbatim (a própria query como sugestão).", presence: "common", status: "available" },
    { name: "vertical", type: "enum", description: "Vertical de origem (web/youtube/news/shopping) — meta de proveniência.", presence: "always", status: "implemented" },
    { name: "seed (sonda)", type: "string", description: "Sonda que originou a observação (meta de proveniência).", presence: "always", status: "implemented" },
    { name: "query/região/idioma", type: "string", description: "Parâmetros da coleta (meta de proveniência completa).", presence: "always", status: "implemented" },
    { name: "recorrência (N sondas)", type: "number", description: "Em quantas sondas a sugestão apareceu — desempate do ranking do merge.", presence: "always", status: "implemented", reliability: "derivado deterministicamente no merge" },
  ],
  derivations: [
    "Grafo de descoberta termo → sugestões → sub-termos (expansão recursiva)",
    "Ranking por recorrência × relevância (mergeObservations)",
    "Nuvem de termos e top-scored (UniTermsChart/UniTopScoredChart)",
    "Classificação de intenção por grupo de expansão (dor, comparação, tutorial, temporal)",
    "Diff temporal de intenção (snapshot periódico → novas/sumidas)",
    "Keywords de ASO/SEO na linguagem exata do usuário",
    "Benchmark de marca ('X vs Y' revela concorrentes percebidos)",
  ],
  limits: [
    "~10 sugestões por sonda; ~50 por vertical+seed — a maximalidade vem das sondas, não do limite",
    "Rate-limit não documentado; uso moderado com UA de browser (Chrome 140)",
    "Cache do servidor TTL 15min por (action, query, region, lang, vertical, limit, client)",
    "Teto de 400–500 sondas por execução (orçamento explícito na UI)",
    "Endpoint não oficial — sem SLA; mudanças de shape são possíveis",
  ],
  reliability: {
    consistency:
      "Alta no curto prazo — a mesma consulta retorna o mesmo conjunto em janelas de minutos; cache de 15min torna coletas repetidas instantâneas e idênticas.",
    stability:
      "Endpoint público não oficial, estável há anos, mas sem contrato: o Google pode mudar shape/rate-limit sem aviso.",
    risks: [
      "Bloqueio temporário por IP em coletas massivas sem intervalo",
      "Mudança de shape do JSON (clientes novos/antigos)",
      "Sugestões personalizadas/localizadas variam por IP e hl/gl",
    ],
    fallbacks: [
      "Cache TTL evita re-coleta em falhas transitórias",
      "Lotes de 6 com progresso — falha de uma sonda não derruba a matriz",
      "Erro honesto por sonda; resultado parcial é devolvido com proveniência",
    ],
  },
  references: [
    { label: "Doc da fonte no sistema", url: "docs/fontes/google-suggest-2026-08-25.md" },
    { label: "Notebook de testes (suggest-fonte)", url: "docs/fontes/notebooks/suggest-fonte.md" },
    { label: "Saídas de exemplo (suggest-output)", url: "docs/fontes/notebooks/suggest-output.md" },
    { label: "Página /suggest (extrator maximalista)", url: "/suggest" },
  ],
};
