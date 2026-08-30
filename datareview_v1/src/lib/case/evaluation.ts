/**
 * AI evaluation framework.
 *
 * Honest about state: there is NO automated evaluation pipeline yet.
 * Define o *framework* (dimensões + rubrica) para que a UI o apresente como
 * "a medir", em vez de fabricar pontuações.
 */

export interface EvaluationDimension {
  id: string;
  name: string;
  description: string;
  /** How a pass would be determined — observable, not subjective. */
  passCriteria: string;
}

export const EVALUATION_DIMENSIONS: EvaluationDimension[] = [
  {
    id: "citation-validity",
    name: "Validade da citação",
    description: "Toda afirmação citada remete a um review real do dataset.",
    passCriteria: "Citação existe verbatim em algum review coletado; atribuição (autor) confere.",
  },
  {
    id: "evidence-coverage",
    name: "Cobertura de evidência",
    description: "Os temas identificados cobrem a massa relevante de reviews, não só um subconjunto conveniente.",
    passCriteria: "Temas principais capturam ≥70% dos reviews com conteúdo (working hypothesis).",
  },
  {
    id: "numeric-accuracy",
    name: "Precisão numérica",
    description: "Percentuais, contagens e médias declaradas pela IA batem com o cálculo direto do dataset.",
    passCriteria: "Cálculo reproduzível a partir dos reviews; diferença < 2 pontos percentuais.",
  },
  {
    id: "unsupported-claims",
    name: "Claims não suportadas",
    description: "Afirmações sem citação são explicitamente marcadas como 'não há evidência'.",
    passCriteria: "Zero afirmações categóricas sem evidência; 'não há evidência' usado honestamente.",
  },
  {
    id: "thematic-consistency",
    name: "Consistência temática",
    description: "Temas não se sobrepõem de forma confusa; categorização é estável entre execuções.",
    passCriteria: "Re-execução no mesmo dataset produz conjuntos de temas comparáveis.",
  },
  {
    id: "output-structure",
    name: "Estrutura da saída",
    description: "Formato obedece ao contrato (blockquotes de evidência, gráficos fenced, metodologia).",
    passCriteria: "Toda evidência em blockquote; charts em fenced code blocks; metodologia declarada.",
  },
];

export interface EvalSample {
  id: string;
  claim: string;
  expected: string;
  status: "framework" | "to-measure";
  note: string;
}

/**
 * Illustrative evaluation set — NOT real measured results.
 * Demonstra o *formato* do framework: afirmação → esperado → passa/falha.
 * O status é explicitamente "framework" até existir um runner real.
 */
export const EVALUATION_SAMPLES: EvalSample[] = [
  {
    id: "s1",
    claim: "“Usuários frequentemente reclamam do onboarding.”",
    expected: "≥N reviews mencionam 'onboarding'/'cadastro'; % sobre o total; citação de exemplo.",
    status: "framework",
    note: "Estrutura de checagem: contagem de menções + citação literal + percentual.",
  },
  {
    id: "s2",
    claim: "“A nota média coletada é 4.2.”",
    expected: "Média aritmética das notas dos reviews coletados ≠ nota da loja.",
    status: "framework",
    note: "Cálculo reproduzível: soma(rating)/count. Distinção nota coletada vs. nota da loja.",
  },
  {
    id: "s3",
    claim: "“O bug de login foi corrigido na v3.2.”",
    expected: "Reviews de versões ≥3.2 não mencionam o bug; <3.2 mencionam.",
    status: "to-measure",
    note: "Requer filtro por versão e janela temporal — ainda não automatizado.",
  },
];
