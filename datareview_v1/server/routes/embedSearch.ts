import type { RequestHandler } from "express";
import { detectSystemProfile } from "../lib/systemProfileDetect.js";
import type { AIConfig } from "./llmStream.js";

/**
 * Busca semântica de reviews via embeddings locais (Ollama, ex.:
 * nomic-embed-text). Embed do query + dos textos dos reviews (em lotes),
 * ranqueamento por similaridade de cosseno. Retorna os índices dos reviews
 * mais relevantes — o cliente reordena/filtra sem mandar dados para fora.
 *
 * Limites: até 2000 reviews por chamada; lotes de 32 textos por request ao
 * Ollama. Se não houver modelo de embedding instalado, responde 400 com
 * instrução (`ollama pull nomic-embed-text`).
 */

const MAX_REVIEWS = 2000;
const BATCH = 32;
const TEXT_CHARS = 800;

interface EmbedReviewInput {
  rating?: number;
  title?: string;
  text?: string;
}

function reviewText(r: EmbedReviewInput): string {
  return `${r.title ?? ""} ${r.text ?? ""}`.trim().slice(0, TEXT_CHARS);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

async function embedBatch(url: string, model: string, inputs: string[]): Promise<number[][]> {
  const resp = await fetch(`${url}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: inputs }),
  });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => "");
    throw new Error(`Ollama /api/embed falhou (${resp.status}): ${msg.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { embeddings?: number[][] };
  if (!data.embeddings?.length) throw new Error("Ollama não retornou embeddings");
  return data.embeddings;
}

export const embedSearch: RequestHandler = async (req, res) => {
  try {
    const { query, reviews, ai, topK } = (req.body ?? {}) as {
      query?: string;
      reviews?: EmbedReviewInput[];
      ai?: AIConfig;
      topK?: number;
    };
    if (!query?.trim()) {
      return res.status(400).json({ error: "Query vazia" });
    }
    if (!Array.isArray(reviews) || reviews.length === 0) {
      return res.status(400).json({ error: "Nenhum review para buscar" });
    }

    const ollamaUrl = (ai?.mode === "local" && ai.local?.ollamaUrl) || process.env.OLLAMA_URL || "http://localhost:11434";
    const profile = await detectSystemProfile(ollamaUrl);
    const model = profile.embeddingModel;
    if (!model) {
      return res.status(400).json({
        error: "Nenhum modelo de embeddings instalado. Rode `ollama pull nomic-embed-text` para habilitar a busca semântica.",
      });
    }

    const subset = reviews.slice(0, MAX_REVIEWS);
    const k = Math.max(1, Math.min(topK ?? 30, subset.length));

    const [queryVec] = await embedBatch(ollamaUrl, model, [query.trim().slice(0, TEXT_CHARS)]);
    const scores: { index: number; score: number }[] = [];
    for (let i = 0; i < subset.length; i += BATCH) {
      const texts = subset.slice(i, i + BATCH).map(reviewText);
      const vectors = await embedBatch(ollamaUrl, model, texts);
      vectors.forEach((v, j) => scores.push({ index: i + j, score: cosine(queryVec, v) }));
    }
    scores.sort((a, b) => b.score - a.score);
    const results = scores.slice(0, k);

    res.json({
      model,
      searched: subset.length,
      results: results.map((r) => ({ index: r.index, score: Math.round(r.score * 1000) / 1000 })),
    });
  } catch (e) {
    console.error("embed-search error:", e);
    if (!res.headersSent) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Erro desconhecido" });
    }
  }
};
