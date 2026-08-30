/**
 * quickReplies — sugestões contextuais de próxima pergunta ("quick replies")
 * exibidas sob a última resposta da IA no chat. Antecipação de necessidade:
 * o usuário não precisa pensar no que perguntar em seguida — o sistema
 * oferece os próximos passos mais prováveis dado o CONTEÚDO da resposta.
 *
 * Lib pura (sem UI), determinística, testável. Regras por sinais do texto:
 *  - mencionou problemas/bugs → aprofundar problemas e priorizar;
 *  - mencionou oportunidades → detalhar oportunidades e esforço/impacto;
 *  - mencionou versões/regressão → comparar versões;
 *  - mencionou concorrentes → comparativo;
 *  - sempre: resumo, evidências e plano de ação como fallbacks úteis.
 */

const RULES: Array<{ pattern: RegExp; chips: string[] }> = [
  {
    pattern: /\b(bug|bugs|erro|erros|falha|falhas|problema|problemas|crash|travad|lentid)/i,
    chips: ["Priorize os problemas por impacto", "Mostre evidências dos piores problemas", "O que corrigir primeiro?"],
  },
  {
    pattern: /\b(oportunidad|potencial|melhoria|melhorias|desejo|pedido recorrente)/i,
    chips: ["Detalhe as maiores oportunidades", "Qual o esforço vs impacto de cada uma?", "Sugira um roadmap P0/P1/P2"],
  },
  {
    pattern: /\b(versão|versoes|versões|regress|atualiza|release)/i,
    chips: ["Compare a versão atual com a anterior", "Há regressão pós-atualização?", "Resuma por versão"],
  },
  {
    pattern: /\b(concorrent|competidor|benchmark|compara)/i,
    chips: ["Faça um comparativo lado a lado", "Onde perdemos para os concorrentes?", "Onde vencemos?"],
  },
  {
    pattern: /\b(sentiment|positiv|negativ|neutro|nota média|estrelas)/i,
    chips: ["O que explica as notas negativas?", "Evolução do sentimento no tempo", "Resumo executivo do sentimento"],
  },
];

const FALLBACK: string[] = [
  "Resuma em 3 pontos",
  "Quais as evidências disso?",
  "O que fazer em seguida?",
];

const MAX_CHIPS = 3;

/** Retorna até 3 sugestões de próxima pergunta para o conteúdo dado.
 *  Conteúdo vazio/curto demais → [] (não polui a UI sem contexto). */
export function suggestQuickReplies(content: string, max = MAX_CHIPS): string[] {
  const text = (content ?? "").trim();
  if (text.length < 40) return [];
  const out: string[] = [];
  for (const rule of RULES) {
    if (!rule.pattern.test(text)) continue;
    for (const chip of rule.chips) {
      if (!out.includes(chip)) out.push(chip);
      if (out.length >= max) return out;
    }
    break; // primeira regra que casa vence (sinal mais forte)
  }
  for (const chip of FALLBACK) {
    if (out.length >= max) break;
    if (!out.includes(chip)) out.push(chip);
  }
  return out.slice(0, max);
}
