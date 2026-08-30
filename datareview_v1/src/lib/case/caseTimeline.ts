/**
 * Product journey timeline — the evolution of App Data Review.
 *
 * Content sourced from AGENTS.md (the project's documented history) and the
 * real architecture. No fabricated metrics, dates, or outcomes. Each stage
 * exposes: what was explored → discovered → changed → why → artifact + link.
 */

export interface TimelineStage {
  id: string;
  index: string; // "01".."10"
  title: string;
  explored: string;
  discovered: string;
  changed: string;
  why: string;
  artifact: string;
  link?: { label: string; to: string };
}

export const CASE_TIMELINE: TimelineStage[] = [
  {
    id: "question",
    index: "01",
    title: "A pergunta",
    explored: "Começou com uma pergunta técnica, não de design: que dados dá pra coletar de verdade da App Store e do Google Play?",
    discovered: "As duas lojas expõem APIs públicas, mas com limitações profundamente diferentes — e nenhuma é simples.",
    changed: "O foco inicial deixou de ser 'qual UI?' e passou a ser 'que dados existem?'. A UI viria das limitações reais.",
    why: "Sem saber o que é coletável, qualquer design seria especulativo. A restrição técnica define o espaço de produto.",
    artifact: "Investigação em Google Colab + chamadas diretas às APIs da Apple e do Google.",
  },
  {
    id: "investigation",
    index: "02",
    title: "Investigação técnica",
    explored: "Explorar cada fonte de dados: amp-api da Apple, página web (SSR), RSS legado; e o google-play-scraper para o Google Play.",
    discovered: "A Apple deprecou o RSS público (feed.entry null). A App Store Connect API exige JWT e só retorna apps próprios. O amp-api sem token funciona via apps.apple.com.",
    changed: "Implementação de 3 fontes combinadas para a Apple (amp-api + SSR + RSS fallback) com dedupe por id.",
    why: "Nenhuma fonte isolada cobria tudo. O amp-api tem mais rendimento mas rate-limit agressivo; o SSR nunca é bloqueado.",
    artifact: "server/routes/appleReviews.ts — coleta de 3 fases, multi-país, dedupe por id.",
    link: { label: "Ver AppDetail", to: "/app/apple/814456780" },
  },
  {
    id: "discovery",
    index: "03",
    title: "Descoberta",
    explored: "Medir o rendimento real de reviews por app e por loja, com limites escaláveis.",
    discovered: "Google Play: num=5000 → 5000 reviews. Apple: maxReviews=5000 → ~2800 (Nubank). Apps regionais rendem menos. O bug 5000→100→0 existia.",
    changed: "Coleta limit-aware: só reusa cache se o dataset atender ao limite pedido; senão refetch + merge dedup.",
    why: "O bug 'config 5000 mostra só 100' vinha de 'reuse sempre que existir'. Reuso cego perde dados quando o limite cresce.",
    artifact: "src/lib/collect.ts — collectApp com dedup por reviewKey, teto 10000.",
  },
  {
    id: "prototype",
    index: "04",
    title: "Primeiro protótipo",
    explored: "Buscar um app → ver seus reviews. Fluxo linear mínimo.",
    discovered: "Ver reviews brutos sem agregação é insuficiente — não há inteligência, só lista.",
    changed: "Nasceu a ideia de um dataset local compartilhado: coletar uma vez, reutilizar em todo lugar.",
    why: "Cada página refazendo fetch criava duplicação e inconsistência. Um dataset único virou a fonte de verdade.",
    artifact: "src/lib/datasetStore.ts — DatasetEntry persistido em localStorage + pub/sub.",
    link: { label: "Ver Home", to: "/" },
  },
  {
    id: "data-system",
    index: "05",
    title: "Sistema de dados",
    explored: "Centralizar tudo: coleta → dataset → múltiplas superfícies. Princípio 'colete uma vez, reutilize sempre'.",
    discovered: "Com um dataset único, seleções por página viram subsets reutilizáveis — sem refazer rede.",
    changed: "SelectionContext como fonte única de 'quais apps estão selecionados'. collectApp como único entry point de coleta.",
    why: "Coletei 10 apps mas quero explorar 1: basta marcar 1, sem recolher. Reuso instantâneo entre páginas.",
    artifact: "src/context/SelectionContext.tsx + src/lib/collect.ts (collectApp reusa cache do dataset).",
    link: { label: "Ver Dashboard", to: "/dashboard" },
  },
  {
    id: "ai-interaction",
    index: "06",
    title: "Interação com IA",
    explored: "Como a IA deve analisar reviews? Automático após coleta? Manual? Em background?",
    discovered: "IA pode ser cara, lenta e dependente de contexto. Auto-run removia controle do usuário.",
    changed: "Geração manual (auto=false). Botão 'Gerar análise'. Empty states explicam o que falta (selecionar apps / ativar IA).",
    why: "O usuário deve controlar quando a análise acontece. Inferência local consome VRAM/GPU.",
    artifact: "AutoAIAnalysis + UnifiedComparisonAI — auto-run removido, CTA explícito.",
    link: { label: "Ver Experimentos", to: "/experiments" },
  },
  {
    id: "trust",
    index: "07",
    title: "Confiança e evidência",
    explored: "Como confiar numa afirmação de IA sem poder verificar de onde veio?",
    discovered: "Resumos genéricos não bastam. Toda afirmação precisa de evidência: citação + cálculo + 'não há evidência' honesto.",
    changed: "Regra de Evidência: blockquote com atribuição + cálculo entre parênteses + metodologia (Positivo=★4-5, Neutro=★3, Negativo=★1-2).",
    why: "Um insight de IA só é útil quando o usuário entende de onde veio. Sem fonte, é opinião.",
    artifact: "Prompt do sistema com bloco METODOLOGIA + REGRA DE EVIDÊNCIA + CHART_INSTRUCTIONS.",
    link: { label: "Inspecionar um app", to: "/app/apple/324684580" },
  },
  {
    id: "canvas",
    index: "08",
    title: "Canvas",
    explored: "Conversa é sempre a melhor interface para IA? E quando a IA é um componente num fluxo?",
    discovered: "Chat sozinho não compõe. Usuários precisam encadear: buscar → coletar → filtrar → analisar → visualizar.",
    changed: "Canvas node-based (React Flow): 10 tipos de nó, execução topológica, terminal de logs, pipeline de exemplo.",
    why: "IA pode ser um componente num workflow, não só um endpoint conversacional.",
    artifact: "src/pages/Canvas.tsx + src/lib/canvasStore.ts + nodeRegistry.ts.",
    link: { label: "Abrir Canvas", to: "/canvas" },
  },
  {
    id: "evaluation",
    index: "09",
    title: "Avaliação de IA",
    explored: "Qualidade de IA não se mede por 'soa bem'. Como avaliar citações, cobertura, precisão numérica?",
    discovered: "Não existe infraestrutura de avaliação automatizada ainda — é uma hipótese de trabalho.",
    changed: "Definição do framework de avaliação (dimensões: citação, cobertura, precisão, claims não suportadas). Marcado como 'a medir'.",
    why: "Precisar de estrutura antes de medir. Avaliar sem critério é achismo.",
    artifact: "Estrutura de avaliação definida — dados reais: 'a medir'.",
  },
  {
    id: "current",
    index: "10",
    title: "Sistema atual",
    explored: "Consolidar tudo num produto coeso: dataset → muitas superfícies → IA multi-provider → evidência.",
    discovered: "Um dataset único alimenta Dashboard, Experimentos, Chat, Canvas, Compare, Decision Center — sem duplicar dados.",
    changed: "IA multi-provider (local Ollama + cloud), dispatcher unificado em SSE OpenAI-compatível, prompt compartilhado.",
    why: "O produto é a evidência. Cada conceito explorado está implementado numa superfície real.",
    artifact: "10 páginas, 4 modos de IA, 3 fontes de coleta, 1 dataset compartilhado.",
    link: { label: "Ver Dashboard", to: "/dashboard" },
  },
];
