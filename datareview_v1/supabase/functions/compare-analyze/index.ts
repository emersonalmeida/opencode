const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { apps, messages } = await req.json() as { apps: AppSummary[]; messages: ChatMessage[] };
    if (!apps?.length) {
      return new Response(JSON.stringify({ error: "Nenhum app fornecido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const datasetSummary = apps.map((a, i) => {
      const ratingDist = Object.entries(a.ratingDistribution).map(([s, c]) => `★${s}:${c}`).join(" ");
      const topWords = a.topWords.slice(0, 15).map(w => `${w.word}(${w.count})`).join(", ");
      const sampleReviews = a.sampleReviews.slice(0, 12).map(r =>
        `  [★${r.rating}] ${r.author}: ${r.title ? r.title + " - " : ""}${r.text.slice(0, 200)}`
      ).join("\n");

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
    }).join("\n\n");

    const systemPrompt = `Você é um analista sênior especializado em apps mobile, comparando múltiplos apps lado a lado. Responda SEMPRE em português do Brasil de forma direta, com dados concretos e use markdown (cabeçalhos, listas, **negrito**, tabelas quando útil).

Você tem acesso aos seguintes dados sobre ${apps.length} app(s) sendo comparados:

${datasetSummary}

MÉTODO DE TRABALHO (sempre, sem exceção):
1. ENTENDA o objetivo da comparação.
2. PROCURE evidências nos dados: padrões recorrentes (≥3 reviews = padrão; 1-2 = sinal), diferenças significativas entre apps, tendências por versão/período.
3. FORMATE em markdown rico (cabeçalhos, listas, **negrito**, tabelas quando útil).
4. AVALIE a qualidade: toda afirmação tem evidência? Toda comparação mostra a fonte? O output termina com uma ação clara?

Diretrizes:
- Quando o usuário pedir análise geral, traga análise quantitativa (notas, distribuições, %) E qualitativa (temas dos reviews, pontos fortes/fracos, bugs reportados).
- Compare os apps explicitamente quando houver mais de um.
- **SEMPRE cite evidências** para cada afirmação, mostrando de onde veio a informação:
  - Para métricas: cite o app e o valor exato entre parênteses. Ex.: "\`(Nubank: 4.7 · 12.345 reviews)\`".
  - Para insights qualitativos: cite trechos reais de reviews em blockquote com atribuição no formato: \`> "trecho da review" — Autor, ★rating, vVersão, YYYY-MM-DD\`.
  - Para tendências: cite a fonte (ex.: "distribuição de notas coletada", "histograma da loja", "release notes v3.2.1").
- Não faça afirmações sem evidência nos dados fornecidos. Se algo não estiver nos dados, diga explicitamente "não há evidência nos dados coletados".
- Diferencie fato forte de sinal fraco: use "(confiança: baixa)" quando a evidência for escassa.
- Quando comparar números, use tabelas markdown com a coluna "Fonte" indicando de onde veio o dado.
- Seja conciso mas completo; evite redundância; termine sugerindo 1-2 ações concretas.`;

    const userMessages = messages.length > 0
      ? messages
      : [{ role: "user" as const, content: "Faça uma análise comparativa completa quanti e quali destes apps, com pontos fortes, fracos, principais bugs/reclamações, recomendações e ranking final." }];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...userMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("compare-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
