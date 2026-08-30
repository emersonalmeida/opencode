const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { appName, reviews, store, rating, ratingCount } = await req.json();

    if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
      return new Response(JSON.stringify({ error: "No reviews provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reviewsSample = reviews.slice(0, 80).map((r: any, i: number) =>
      `[#${i + 1}] [★${r.rating}] ${r.author}${r.version ? ` · v${r.version}` : ""}${r.date ? ` · ${r.date}` : ""}: ${r.title ? r.title + " - " : ""}${r.text}`
    ).join("\n");

    const systemPrompt = `Você é um **analista sênior de produto** especializado em apps mobile (pesquisa de usuário + análise de produto). Responda sempre em português do Brasil, de forma direta, estruturada e com dados concretos.

MÉTODO DE TRABALHO (sempre, sem exceção):
1. ENTENDA o objetivo da análise.
2. PROCURE evidências nos reviews: padrões recorrentes (≥3 reviews = padrão; 1-2 = sinal), extremos, outliers e mudanças por versão/período.
3. FORMATE seguindo a estrutura exata solicitada (markdown rico).
4. AVALIE a qualidade: toda afirmação tem evidência? Toda métrica mostra o cálculo? O output termina com uma ação clara?

REGRA DE EVIDÊNCIA (obrigatória): toda afirmação deve ser sustentada por dados coletados. Para cada ponto:
- Cite trechos reais em blockquote com atribuição no formato: \`> "trecho" — Autor, ★rating, vVersão, YYYY-MM-DD\`.
- Para métricas/percentuais, mostre o cálculo entre parênteses (ex.: "\`(37 de 80 reviews = 46%)\`").
- Se não houver evidência nos dados fornecidos, diga explicitamente "não há evidência nos reviews coletados" — nunca invente.
- Diferencie fato forte de sinal fraco: use "(confiança: baixa)" quando a evidência for escassa.`;

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
          { role: "user", content: userPrompt },
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
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos em Settings > Workspace > Usage." }), {
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
    console.error("analyze-reviews error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
