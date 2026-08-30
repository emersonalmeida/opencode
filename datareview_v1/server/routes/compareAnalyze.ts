import type { RequestHandler } from "express";
import { streamLLM, type AIConfig } from "./llmStream.js";

interface AppSummary {
  name: string;
  store: string;
  developer?: string;
  rating?: number;
  ratingCount?: number;
  version?: string;
  genre?: string;
  size?: string;
  contentRating?: string;
  minimumOsVersion?: string;
  downloads?: string;
  lastUpdated?: string;
  reviewsCollected: number;
  avgRatingCollected: number;
  positivePct: number;
  negativePct: number;
  neutralPct: number;
  avgReviewLength: number;
  topWords: { word: string; count: number }[];
  ratingDistribution: Record<string, number>;
  sampleReviews: { rating: number; author: string; title: string; text: string; date: string }[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Local port of the Supabase `compare-analyze` edge function. LLM backend is
 * user-selectable via `ai` in the body (none/local/cloud).
 */
export const compareAnalyze: RequestHandler = async (req, res) => {
  try {
    const body = (req.body ?? { apps: [], messages: [] }) as {
      apps: AppSummary[];
      messages: ChatMessage[];
      ai?: AIConfig;
    };
    const { apps, messages, ai } = body;

    if (!apps?.length) {
      return res.status(400).json({ error: "Nenhum app fornecido" });
    }

    const datasetSummary = apps
      .map((a: AppSummary, i: number) => {
        const ratingDist = Object.entries(a.ratingDistribution)
          .map(([s, c]) => `★${s}:${c}`)
          .join(" ");
        const topWords = a.topWords
          .slice(0, 15)
          .map((w: { word: string; count: number }) => `${w.word}(${w.count})`)
          .join(", ");
        const sampleReviews = a.sampleReviews
          .slice(0, 12)
          .map(
            (r: { rating: number; author: string; title: string; text: string; date: string }) =>
              `  [★${r.rating}] ${r.author}: ${r.title ? r.title + " - " : ""}${r.text.slice(0, 200)}`
          )
          .join("\n");

        return `### APP ${i + 1}: ${a.name} (${a.store === "apple" ? "App Store" : "Google Play"})
- Desenvolvedor: ${a.developer || "—"}
- Nota da loja: ${a.rating ?? "—"}/5 (${a.ratingCount?.toLocaleString("pt-BR") || 0} avaliações)
- Versão: ${a.version || "—"} | Gênero: ${a.genre || "—"} | Tamanho: ${a.size || "—"}
- Classificação: ${a.contentRating || "—"} | OS Mínimo: ${a.minimumOsVersion || "—"}
- Downloads: ${a.downloads || "—"} | Atualizado: ${a.lastUpdated || "—"}
- Reviews coletados: ${a.reviewsCollected} | Nota média (coletada): ${a.avgRatingCollected.toFixed(2)}
- Sentimento: ${a.positivePct}% positivo | ${a.neutralPct}% neutro | ${a.negativePct}% negativo
- Tamanho médio review: ${a.avgReviewLength} chars
- Distribuição de notas: ${ratingDist}
- Palavras-chave frequentes: ${topWords}
- Amostra de reviews:
${sampleReviews}`;
      })
      .join("\n\n");

    const systemPrompt = `Você é um analista sênior especializado em apps mobile, comparando múltiplos apps lado a lado. Responda SEMPRE em português do Brasil de forma direta, com dados concretos e use markdown (cabeçalhos, listas, **negrito**, tabelas quando útil).

Você tem acesso aos seguintes dados sobre ${apps.length} app(s) sendo comparados:

${datasetSummary}

Diretrizes:
- Quando o usuário pedir análise geral, traga análise quantitativa (notas, distribuições, %) E qualitativa (temas dos reviews, pontos fortes/fracos, bugs reportados).
- Compare os apps explicitamente quando houver mais de um.
- **SEMPRE cite evidências** para cada afirmação, mostrando de onde veio a informação:
  - Para métricas: cite o app e o valor exato entre parênteses. Ex.: "\`(Nubank: 4.7 · 12.345 reviews)\`".
  - Para insights qualitativos: cite trechos reais de reviews em blockquote com atribuição no formato: \`> "trecho da review" — Autor, ★rating, vVersão, YYYY-MM-DD\`.
  - Para tendências: cite a fonte (ex.: "distribuição de notas coletada", "histograma da loja", "release notes v3.2.1").
- Não faça afirmações sem evidência nos dados fornecidos. Se algo não estiver nos dados, diga explicitamente "não há evidência nos dados coletados".
- Quando comparar números, use tabelas markdown com a coluna "Fonte" indicando de onde veio o dado.
- Seja conciso mas completo; evite redundância.`;

    const userMessages: ChatMessage[] =
      messages.length > 0
        ? messages
        : [
            {
              role: "user",
              content:
                "Faça uma análise comparativa completa quanti e quali destes apps, com pontos fortes, fracos, principais bugs/reclamações, recomendações e ranking final.",
            },
          ];

    await streamLLM(
      [{ role: "system", content: systemPrompt }, ...userMessages],
      res,
      ai
    );
  } catch (e) {
    console.error("compare-analyze error:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
    }
  }
};
