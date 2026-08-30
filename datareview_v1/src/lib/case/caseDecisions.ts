/**
 * Decisões de design — contexto → questão → opções → decisão → tradeoff → resultado.
 *
 * Cada decisão demonstra julgamento de produto. O conteúdo reflete a arquitetura
 * real documentada no AGENTS.md; nenhum resultado fabricado.
 */

export interface DecisionOption {
  label: string;
  description: string;
  chosen?: boolean;
}

export interface DesignDecision {
  id: string;
  question: string;
  context: string;
  options: DecisionOption[];
  decision: string;
  tradeoff: string;
  result: string;
}

export const DESIGN_DECISIONS: DesignDecision[] = [
  {
    id: "local-ai",
    question: "Por que IA local?",
    context: "Análise de reviews envia texto potencialmente sensível para um servidor. Latência e custo importam.",
    options: [
      { label: "A. Cloud apenas", description: "Rápido de configurar, mas envia dados do usuário e depende de chave paga." },
      { label: "B. Local apenas", description: "Privado e sem custo recorrente, mas exige hardware e é mais lento." },
      { label: "C. Híbrido", chosen: true, description: "Local como padrão (Ollama + GPU), cloud opcional com chave do usuário." },
    ],
    decision: "Local como padrão, cloud opcional.",
    tradeoff: "Exige que o usuário tenha Ollama configurado. Cloud exige chave própria. Nada é automático.",
    result: "Modo none/local/cloud. Badge de status no header. Nenhuma chamada de IA dispara sem ação explícita.",
  },
  {
    id: "shared-dataset",
    question: "Por que um dataset compartilhado?",
    context: "Cada página precisando de dados refazia fetch, criando duplicação e inconsistência.",
    options: [
      { label: "A. Cada página busca própria", description: "Simples de implementar, mas duplica rede e diverge entre páginas." },
      { label: "B. Cache por página", description: "Reduz rede mas ainda é isolado. Apps coletados numa página não aparecem em outra." },
      { label: "C. Dataset único", chosen: true, description: "Fonte de verdade: colete uma vez, reutilize em todas as superfícies." },
    ],
    decision: "Dataset único (aso:dataset:v1) com pub/sub.",
    tradeoff: "Estado global exige cuidado com consistência. Limite cresce em merge, nunca diminui.",
    result: "Um app coletado na Home aparece instantaneamente em Dashboard, Chat, Canvas, Compare. Reuso sem rede.",
  },
  {
    id: "manual-ai",
    question: "A IA deve analisar automaticamente após a coleta?",
    context: "Inferência local consome VRAM/GPU e pode levar minutos. Auto-run tiraria controle do usuário.",
    options: [
      { label: "A. Automático", description: "Menos cliques, mas gasta recursos sem consentimento e pode gerar antes de o usuário querer." },
      { label: "B. Manual", chosen: true, description: "Usuário decide quando gerar. Empty state explica o que falta." },
      { label: "C. Background", description: "Filas invisíveis. Esconde o custo e dificulta depuração." },
    ],
    decision: "Geração manual.",
    tradeoff: "Interação mais explícita. Menos automação.",
    result: "Botão 'Gerar análise' em toda superfície de IA. Nenhum auto-run.",
  },
  {
    id: "evidence-ai",
    question: "Como confiar numa afirmação de IA?",
    context: "Resumos genéricos não permitem verificação. Usuário não sabe se a IA inventou.",
    options: [
      { label: "A. Sem evidência", description: "Texto corrido. Rápido, mas não auditável." },
      { label: "B. Citações soltas", description: "Melhor, mas sem cálculo de frequência nem metodologia." },
      { label: "C. Evidência estruturada", chosen: true, description: "Cada afirmação com citação + cálculo + 'não há evidência' honesto." },
    ],
    decision: "Regra de Evidência obrigatória no prompt.",
    tradeoff: "Saída mais longa e às vezes mais cautelosa. IA pode dizer 'não há evidência'.",
    result: "Blockquote com atribuição + percentual entre parênteses + metodologia documentada (★4-5 positivo, ★1-2 negativo).",
  },
  {
    id: "ai-modes",
    question: "Por que múltiplos modos de interação com IA?",
    context: "Perguntas diferentes exigem interfaces diferentes. Chat não resolve tudo.",
    options: [
      { label: "A. Só chat", description: "Flexível, mas não compõe fluxos nem estrutura saída." },
      { label: "B. Só análise", description: "Estruturada, mas não explora nem itera." },
      { label: "C. Análise + Chat + Canvas", chosen: true, description: "Três relações diferentes com a IA, cada uma com propósito." },
    ],
    decision: "Análise (estruturada), Chat (exploração), Canvas (composição).",
    tradeoff: "Mais superfícies para manter. Cada uma precisa de seu próprio empty state e fluxo.",
    result: "Experimentos (13 seções), Chat (com seleção de apps), Canvas (workflow node-based).",
  },
  {
    id: "canvas",
    question: "Por que um Canvas node-based?",
    context: "Conversa é linear. Encadear operações (buscar → coletar → filtrar → analisar → visualizar) é difícil num chat.",
    options: [
      { label: "A. Apenas chat", description: "Contexto se perde em mensagens longas." },
      { label: "B. Scripts manuais", description: "Poderoso mas exige código do usuário." },
      { label: "C. Canvas visual", chosen: true, description: "IA como nó num workflow, não só endpoint. Execução topológica." },
    ],
    decision: "Canvas React Flow com 10 tipos de nó.",
    tradeoff: "Complexidade de UX. Curva de aprendizado. Precisa de exemplo pronto.",
    result: "Pipeline de exemplo (buscar → coletar → analisar + gráfico). Terminal de logs. Status por nó.",
  },
  {
    id: "streaming",
    question: "Por que streaming?",
    context: "Inferência local pode levar dezenas de segundos. Esperar o todo pronto parece travado.",
    options: [
      { label: "A. Requisição única", description: "Simples, mas UI parece morta durante a geração." },
      { label: "B. Polling", description: "Adiciona latência e complexidade de estado." },
      { label: "C. Streaming SSE", chosen: true, description: "Token a token, feedback imediato, cursor de digitação." },
    ],
    decision: "Streaming SSE OpenAI-compatível em todos os providers.",
    tradeoff: "Conversão de formatos por provider (NDJSON do Ollama, event-stream da Anthropic).",
    result: "Cursor de streaming. Cancelamento possível a qualquer momento. Mesmo formato no cliente.",
  },
  {
    id: "cancellation",
    question: "Por que permitir cancelar a geração?",
    context: "Modelo pode alucinar, entrar em loop, ou o usuário mudou de ideia. Sem abort, espera-se até o fim.",
    options: [
      { label: "A. Sem cancelamento", description: "Menos código, mas prende o usuário num generation ruim." },
      { label: "B. Cancelar só no fim", description: "Inútil — o custo já aconteceu." },
      { label: "C. AbortController", chosen: true, description: "Cancela a requisição HTTP imediatamente, libera o modelo." },
    ],
    decision: "AbortController por superfície.",
    tradeoff: "Estado parcial precisa ser tratado (mensagem incompleta descartada ou mantida).",
    result: "Botão parar em Chat e geração de análises. Abort sinalizado ao servidor e ao provider.",
  },
  {
    id: "multi-provider",
    question: "Por que multi-provider de IA?",
    context: "Trancar num único provider cria dependência e custo. Usuários têm preferências e chaves próprias.",
    options: [
      { label: "A. Só Ollama", description: "Simples, mas exclui quem quer cloud." },
      { label: "B. Só OpenAI", description: "Amplamente compatível, mas custo e dependência." },
      { label: "C. Dispatcher unificado", chosen: true, description: "Local + OpenAI + Anthropic + Gemini + OpenAI-compatible, todos no mesmo formato." },
    ],
    decision: "streamLLM dispatcher com 4 backends.",
    tradeoff: "Manter conversão de cada formato. Testar cada provider.",
    result: "Usuário escolhe em Config. Badge no header mostra o modo ativo. Chave cloud não sai do browser.",
  },
  {
    id: "local-persistence",
    question: "Por que persistência local-first?",
    context: "Dados coletados são o ativo do usuário. Servidor cloud criaria dependência e privacidade.",
    options: [
      { label: "A. Banco cloud", description: "Compartilhável, mas hosting, custo, privacidade." },
      { label: "B. Sem persistência", description: "Dados se perdem ao recarregar." },
      { label: "C. localStorage + pub/sub", chosen: true, description: "Dados ficam com o usuário. Reativo entre abas." },
    ],
    decision: "localStorage como store reativo.",
    tradeoff: "Limite de ~5MB por origem. Apps pesados podem encher. Sem sync entre dispositivos.",
    result: "Dataset, histórico, seleção, chats, canvas — tudo persistido localmente e reativo.",
  },
];
