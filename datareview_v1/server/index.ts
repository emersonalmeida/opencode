import express from "express";
import cors from "cors";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { itunesProxy } from "./routes/itunesProxy.js";
import { googlePlay } from "./routes/googlePlay.js";
import { appleReviews } from "./routes/appleReviews.js";
import { rateLimitStatus } from "./routes/rateLimitStatus.js";
import { analyzeReviews } from "./routes/analyzeReviews.js";
import { compareAnalyze } from "./routes/compareAnalyze.js";
import { experimentAnalyze } from "./routes/experimentAnalyze.js";
import { testAIConnection, type AIConfig } from "./routes/llmStream.js";
import { componentSource } from "./routes/componentSource.js";
import { systemProfile } from "./routes/systemProfile.js";
import { embedSearch } from "./routes/embedSearch.js";
import { voiceStatus } from "./routes/voiceStatus.js";
import { stt } from "./routes/stt.js";
import { tts } from "./routes/tts.js";
import { githubStatus, githubProjectMap } from "./routes/github.js";
import { gitLocalSnapshot } from "./routes/gitLocal.js";
import { googleFontsCatalog } from "./routes/googleFonts.js";
import { handler as auditReliability } from "./routes/auditReliability.js";
import { auditEvidence } from "./routes/auditEvidence.js";
// Source Registry — catálogo de fontes com capabilities (foundation Phase 3).
import { listSources } from "./lib/sourceRegistry.js";
// Primeira fonte nova além das lojas: Wikipedia (discovery + article).
import { wikipedia } from "./routes/wikipedia.js";
// Fontes Uni (página /00): Google Suggest (autocomplete multi-vertical) e
// Google Trends (pytrends reimplementado em Node).
import { uniSuggest } from "./routes/uniSuggest.js";
import { uniSuggestProvider } from "./routes/uniSuggestProvider.js";
import { uniTrends } from "./routes/uniTrends.js";
import { uniTrending } from "./routes/uniTrending.js";
import { uniSerp } from "./routes/uniSerp.js";
import { uniYoutube } from "./routes/uniYoutube.js";
import { uniReddit } from "./routes/uniReddit.js";
import { uniHn } from "./routes/uniHn.js";
import { uniGdelt } from "./routes/uniGdelt.js";
import { uniArxiv } from "./routes/uniArxiv.js";
import { uniStackexchange } from "./routes/uniStackexchange.js";
import { uniGithub } from "./routes/uniGithub.js";
import { uniSemanticScholar } from "./routes/uniSemanticScholar.js";
import { uniSteam } from "./routes/uniSteam.js";
import { uniReclameAqui } from "./routes/uniReclameAqui.js";
import { uniProductHunt } from "./routes/uniProductHunt.js";
import { uniWeb } from "./routes/uniWeb.js";
import { uniSource } from "./routes/uniSource.js";
import { uniRunStream } from "./routes/uniRunStream.js";
import { uniDiscover } from "./routes/uniDiscover.js";
// Test Center: executores SAFE server-side com provenance de runs.
import { testRun } from "./routes/testRun.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.options("*", cors());

// Versão/commit do código em execução — o cliente compara com o próprio
// build (via /health) para detectar "página aberta de código antigo" e
// oferecer reload. Ambos com fallback honesto (sem git/pacote → null).
const APP_VERSION = (() => {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
})();
const GIT_COMMIT = (() => {
  try {
    return execSync("git rev-parse --short HEAD", { timeout: 3000, encoding: "utf-8" }).trim() || null;
  } catch {
    return null;
  }
})();

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: APP_VERSION,
    commit: GIT_COMMIT,
    ollama: process.env.OLLAMA_URL || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "gemma3:4b",
    gpu: true,
  });
});

/** Probe the user-configured AI backend (used by Settings "test connection"). */
// Audit Engine — métricas objetivas por fonte a partir das observações.
app.get("/functions/v1/audit-reliability", (_req, res) => {
  res.json(auditReliability());
});
app.post("/functions/v1/audit-reliability", (_req, res) => {
  res.json(auditReliability());
});
// Audit Engine — cadeia de provenance (§8): observação → run → artifact → raw.
app.get("/functions/v1/audit-evidence", auditEvidence);
app.post("/functions/v1/audit-evidence", auditEvidence);

app.post("/functions/v1/ai-test", async (req, res) => {
  const ai = (req.body ?? {}).ai as AIConfig | undefined;
  const result = await testAIConnection(ai ?? { mode: "auto" });
  res.status(result.ok ? 200 : 400).json(result);
});

/** Perfil de hardware + modelos Ollama instalados + recomendação (modo auto). */
app.get("/functions/v1/system-profile", systemProfile);
app.post("/functions/v1/system-profile", systemProfile);
// Telemetria local de rate-limit das fontes de coleta (todo.md P0).
app.get("/functions/v1/rate-limit-status", rateLimitStatus);

app.post("/functions/v1/itunes-proxy", itunesProxy);
app.post("/functions/v1/apple-reviews", appleReviews);
app.post("/functions/v1/google-play-scraper", googlePlay);
app.post("/functions/v1/analyze-reviews", analyzeReviews);
app.post("/functions/v1/compare-analyze", compareAnalyze);
app.post("/functions/v1/experiment-analyze", experimentAnalyze);
app.get("/functions/v1/component-source", componentSource);
app.post("/functions/v1/component-source", componentSource);
app.post("/functions/v1/embed-search", embedSearch);

/** Catálogo do Google Fonts (busca de fontes nas Configurações). */
app.get("/functions/v1/google-fonts", googleFontsCatalog);

/** Source Registry: catálogo de fontes com capabilities (aditivo; as rotas
 * específicas por loja continuam sendo as ativas em V0). */
app.get("/functions/v1/sources", (_req, res) => {
  res.json({ sources: listSources() });
});

// Conector Wikipedia (discovery de candidatos + artigo). Aditivo — as rotas
// das lojas permanecem intocadas.
app.post("/functions/v1/wikipedia", wikipedia);

/** Uni (/00): Google Suggest — autocomplete web/YouTube/News/Shopping +
 * expansão alfabética para mineração de demanda. */
app.post("/functions/v1/uni-suggest", uniSuggest);

/** Uni (/00): multi-provedor de autocomplete (Bing, DuckDuckGo, Brave, Yahoo,
 * Yandex, Baidu, Naver, Amazon, eBay, Wikipedia. */
app.post("/functions/v1/uni-suggest-provider", uniSuggestProvider);

/** Uni (/00): Google Trends — interesse no tempo, por região e queries
 * relacionadas (top/rising). Fluxo do pytrends em Node puro. */
app.post("/functions/v1/uni-trends", uniTrends);

/** Trending (/trending): Google Trends "Em alta" — extrator da página
 * trending?geo=XX via feed RSS público (matriz horas × categorias ×
 * ordenações com dedup e proveniência). */
app.post("/functions/v1/uni-trending", uniTrending);

/** Uni (/00): SERP multi-engine (Bing scrape / DDG / Brave / Google CSE) +
 * extração de conteúdo de páginas (scrap_conteudo). */
app.post("/functions/v1/uni-serp", uniSerp);

/** Uni (/00): YouTube — busca de vídeos (scraping ytInitialData) + comentários
 * (youtubei continuation), sem API key. */
app.post("/functions/v1/uni-youtube", uniYoutube);

/** Uni (/00): Reddit — posts + comentários. JSON público ou OAuth
 * (REDDIT_CLIENT_ID/SECRET no env) quando o IP é de datacenter. */
app.post("/functions/v1/uni-reddit", uniReddit);

/** Uni (/00): Hacker News — stories + comentários via API Algolia oficial
 * (pública, sem auth). */
app.post("/functions/v1/uni-hackernews", uniHn);

/** Uni (/00): GDELT — notícias globais (API pública, sem auth; idioma via
 * operador sourceLang: na query). */
app.post("/functions/v1/uni-gdelt", uniGdelt);

/** Uni (/00): arXiv — artigos científicos (preprints) via API Atom pública. */
app.post("/functions/v1/uni-arxiv", uniArxiv);

/** Uni (/00): StackExchange — perguntas + respostas (API 2.3 pública). */
app.post("/functions/v1/uni-stackexchange", uniStackexchange);

/** Uni (/00): GitHub — repositórios + issues (Search API; GITHUB_TOKEN opcional). */
app.post("/functions/v1/uni-github", uniGithub);

/** Uni (/00): Semantic Scholar — artigos acadêmicos com citações (backoff 429). */
app.post("/functions/v1/uni-semanticscholar", uniSemanticScholar);

/** Uni (/00): Steam — busca de jogos (scrape) + reviews públicos (JSON). */
app.post("/functions/v1/uni-steam", uniSteam);
app.post("/functions/v1/uni-reclameaqui", uniReclameAqui);

/** Uni (/00): Product Hunt — lançamentos do dia via feed Atom público; GraphQL oficial com PRODUCT_HUNT_TOKEN. */
app.post("/functions/v1/uni-producthunt", uniProductHunt);

/** Descoberta (/descoberta): fontes novas (wikitop, wikiviews, onthisday, googlenews, podcasts, crypto, steamtop). */
app.post("/functions/v1/uni-discover", uniDiscover);

/** Uni (/00): coletores universais — qualquer URL/página, PDF, feed RSS/Atom, texto colado. */
app.post("/functions/v1/uni-web", uniWeb);

/** Uni (/00): fontes declarativas do motor uniConnectors (GET ?list=1 lista). */
app.get("/functions/v1/uni-source", uniSource);
app.post("/functions/v1/uni-source", uniSource);

/** Uni (/00): stream SSE dos eventos de coleta (aba "Output" em tempo real). */
app.get("/functions/v1/uni-runs/stream", uniRunStream);

// Test Center: execução server-side de testes SAFE (health/sources/api).
app.post("/functions/v1/test-run", testRun);

/** Git Canvas: provider GitHub real (token no servidor) + ponte git local. */
app.get("/functions/v1/github/status", githubStatus);
app.post("/functions/v1/github/status", githubStatus);
app.post("/functions/v1/github/project-map", githubProjectMap);

/** Git Canvas: snapshot do repositório git local (cwd do servidor), sob demanda. */
app.get("/functions/v1/git-local/snapshot", gitLocalSnapshot);
app.post("/functions/v1/git-local/snapshot", gitLocalSnapshot);

/** Voz local: capacidades (voice-status), voz -> texto (stt), texto -> voz (tts). */
app.get("/functions/v1/voice-status", voiceStatus);
app.post("/functions/v1/voice-status", voiceStatus);
// STT recebe áudio bruto (webm/ogg/wav) — express.json NÃO parseia content-type
// de áudio, então o raw handler é registrado na própria rota.
app.post("/functions/v1/stt", express.raw({ limit: "25mb", type: ["audio/*", "application/octet-stream"] }), stt);
app.post("/functions/v1/tts", tts);

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`\n[local-edge] rodando em http://localhost:${PORT}`);
  console.log(`[local-edge] Ollama (fallback): ${process.env.OLLAMA_URL || "http://localhost:11434"}`);
  console.log(`[local-edge] Modelo (fallback): ${process.env.OLLAMA_MODEL || "gemma3:4b"}`);
  console.log(`[local-edge] IA configuravel via Configuracoes -> Inteligencia Artificial\n`);
});
