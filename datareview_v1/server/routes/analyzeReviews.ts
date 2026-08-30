import type { RequestHandler } from "express";
import { streamLLM, type AIConfig } from "./llmStream.js";

interface ReviewInput {
  rating: number;
  author: string;
  title?: string;
  text: string;
  date?: string;
  version?: string;
}

/**
 * Local port of the Supabase `analyze-reviews` edge function. Same prompt,
 * same request body; the LLM backend is user-selectable via `ai` in the body
 * (none/local/cloud). Output is the OpenAI-compatible SSE stream the frontend
 * already parses.
 */
export const analyzeReviews: RequestHandler = async (req, res) => {
  try {
    const { appName, reviews, store, rating, ratingCount, ai } = (req.body ?? {}) as { appName: string; reviews: ReviewInput[]; store: string; rating: number; ratingCount: number; ai?: AIConfig };

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ error: "No reviews provided" });
    }

    const reviewsSample = reviews
      .slice(0, 80)
      .map((r, i) =>
        `[#${i + 1}] [★${r.rating}] ${r.author}${r.version ? ` · v${r.version}` : ""}${r.date ? ` · ${r.date}` : ""}: ${r.title ? r.title + " - " : ""}${r.text}`
      )
      .join("\n");

    const systemPrompt = `Você é um analista especialista em apps mobile. Responda sempre em português do Brasil. Seja direto, use dados concretos e bullet points.

REGRA DE EVIDÊNCIA (obrigatória): toda afirmação deve ser sustentada por dados coletados. Para cada ponto:
- Cite trechos reais em blockquote com atribuição no formato: \`> "trecho" — Autor, ★rating, vVersão, YYYY-MM-DD\`.
- Para métricas/percentuais, mostre o cálculo entre parênteses (ex.: "\`(37 de 80 reviews = 46%)\`").
- Se não houver evidência nos dados fornecidos, diga explicitamente "não há evidência nos reviews coletados" — nunca invente.`;

    const userPrompt = `Analise os reviews do app "${appName}" (${store === "apple" ? "App Store" : "Google Play"}).
Nota média da loja: ${rating}/5 (${ratingCount} avaliações totais).
Total de reviews coletados: ${reviews.length}.

Reviews coletados (indexados por #):
${reviewsSample}

Gere uma análise completa com:

1. **Resumo Executivo** (2-3 frases sobre o sentimento geral, com % baseado na amostra)
2. **Pontos Fortes** (o que os usuários mais elogiam — cite pelo menos 2 reviews como evidência)
3. **Pontos Fracos** (principais reclamações — cite pelo menos 2 reviews como evidência)
4. **Bugs/Problemas Técnicos** reportados (cite reviews com versão quando possível)
5. **Funcionalidades Mais Solicitadas** pelos usuários (cite reviews)
6. **Análise de Sentimento** (% positivo/neutro/negativo com o número absoluto entre parênteses)
7. **Tendências** (padrões temporais ou temas recorrentes — cite reviews)
8. **Recomendações** para o desenvolvedor (3-5 ações prioritárias, cada uma ancorada em evidência)

Use markdown para formatar. NÃO faça afirmações sem citar evidência dos reviews acima.`;

    await streamLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      res,
      ai
    );
  } catch (e) {
    console.error("analyze-reviews error:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Unknown error" });
    }
  }
};
