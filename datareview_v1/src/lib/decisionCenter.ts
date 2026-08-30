/**
 * Decision Intelligence Layer — AI Decision Center.
 *
 * Cada persona tem uma "pergunta central" e 10 módulos de decisão. Cada módulo
 * tem um prompt tailored que ensina a IA a aplicar a LENTE da persona sobre
 * os mesmos dados coletados (reviews), produzindo insight + evidência +
 * contexto + impacto + confiança + recomendação (o "DNA de 6 camadas").
 *
 * As 7 personas iniciais provam a maior parte do valor (CEO, CPO, PM, UX,
 * Engineering, Marketing, Competitive Intelligence). O motor de IA é comum
 * (streamExperimentChat) — só muda a lente.
 */

import type { LucideIcon } from "lucide-react";
import {
  Crown, Compass, Target, Crosshair, Radar, Lightbulb, Trophy, TrendingUp,
  Rocket, BarChart3, Bug, Megaphone, Search, LayoutDashboard, FileText,
  ScrollText, Briefcase, Scale, GitCompare, Users, Cpu, AlertTriangle,
  Sparkles, Wrench, ClipboardList, Map, MapPin, FlaskConical, Flag, Layers,
} from "lucide-react";

export interface DecisionModule {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Pergunta de negócio que o módulo responde. */
  question: string;
  /** Prompt tailored — a IA aplica a lente da persona sobre os reviews. */
  prompt: string;
}

export interface Persona {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Pergunta central da persona. */
  centralQuestion: string;
  /** Descrição curta da lente. */
  tagline: string;
  modules: DecisionModule[];
}

/* A instrução de DNA é compartilhada por todos os prompts: força a IA a
 * estruturar toda conclusão nas 6 camadas (insight, quantificação, evidência,
 * contexto, decisão, ação) e a ser honesta sobre confiança. */
const DNA_INSTRUCTION = `

ESTRUTURE sua resposta em Markdown com as 6 camadas abaixo (use os cabeçalhos exatos):
## Insight
A conclusão principal em 1-2 frases diretas.
## Quantificação
Números concretos extraídos dos reviews (% sobre coletados, contagens, tendências). Cálculo entre parênteses.
## Evidência
3-5 citações REAIS de reviews em blockquotes (uma por linha, com "— autor, ★N, app"). Se não houver evidência suficiente, escreva "Não há evidência suficiente" explicitamente.
## Contexto
Comparação entre apps selecionados quando aplicável (tabela markdown ou bullets).
## Decisão
Uma linha: "Prioridade: ALTA|MÉDIA|BAIXA — <razão>".
## Ação
Plano de 3-5 passos numerados e acionáveis.

Regra de Evidência: NUNCA invente citações. Use blockquote apenas para texto real dos reviews. Quando faltar dado, diga.

Metodologia: Positivo=★4-5, Neutro=★3, Negativo=★1-2. % sobre reviews coletados. Nota média coletada ≠ nota da loja.`;

export const PERSONAS: Persona[] = [
  /* ====================================================== CEO */
  {
    id: "ceo",
    label: "CEO",
    icon: Crown,
    centralQuestion: "O que está acontecendo no negócio e quais decisões devo tomar?",
    tagline: "Lente estratégica: valor, risco, competitividade",
    modules: [
      { id: "executive-briefing", label: "Executive Briefing", icon: FileText, question: "O que mudou, o que importa, por que importa?",
        prompt: `Você é o conselheiro estratégico do CEO. Produza um EXECUTIVE BRIEFING: o que mudou recentemente, o que mais importa agora, por que importa, o impacto estimado e a recomendação executiva. Foque em valor de negócio, não em detalhe operacional.${DNA_INSTRUCTION}` },
      { id: "risk-radar", label: "Business Risk Radar", icon: AlertTriangle, question: "Onde estamos perdendo valor?",
        prompt: `Como conselheiro do CEO, opere um BUSINESS RISK RADAR. Detecte: problemas emergentes, queda de satisfação, regressões por versão, riscos competitivos e reclamações críticas. Priorize por impacto de valor.${DNA_INSTRUCTION}` },
      { id: "opportunity-radar", label: "Opportunity Radar", icon: Lightbulb, question: "Onde existe receita/crescimento escondido?",
        prompt: `Como conselheiro do CEO, opere um OPPORTUNITY RADAR. Encontre oportunidades de receita, crescimento, produto, mercado e redução de custo que emergem dos reviews. Quantifique o potencial.${DNA_INSTRUCTION}` },
      { id: "competitive-threat", label: "Competitive Threat Radar", icon: Trophy, question: "Quem está ganhando de nós e em quê?",
        prompt: `Como conselheiro do CEO, opere um COMPETITIVE THREAT RADAR. Compare os apps selecionados e identifique onde concorrentes estão superando o app principal (ou onde o app principal supera). Destaque ameaças concretas.${DNA_INSTRUCTION}` },
      { id: "product-health", label: "Product Health Score", icon: BarChart3, question: "Qual a saúde geral do produto (0-100)?",
        prompt: `Como conselheiro do CEO, calcule um PRODUCT HEALTH SCORE de 0-100 considerando satisfação, tendência, problemas, competitividade e estabilidade. Justifique cada componente e dê a nota final. Inclua um bloco chart-bar com o score por componente.${DNA_INSTRUCTION}` },
      { id: "investment-prioritizer", label: "Investment Prioritizer", icon: TrendingUp, question: "Tenho R$ 1M. Onde investir?",
        prompt: `Como conselheiro do CEO, seja um INVESTMENT PRIORIZER. Dado um orçamento hipotético de R$ 1 milhão, priorize as iniciativas que surgem dos reviews por impacto x esforço. Estime ROI relativo.${DNA_INSTRUCTION}` },
      { id: "impact-simulator", label: "Business Impact Simulator", icon: FlaskConical, question: "E se corrigirmos o problema X?",
        prompt: `Como conselheiro do CEO, seja um BUSINESS IMPACT SIMULATOR. Pegue o maior problema identificado nos reviews e simule cenários: "e se corrigirmos isso?". Mostre premissas, cenário base/otimista/pessimista e impacto esperado.${DNA_INSTRUCTION}` },
      { id: "market-intelligence", label: "Market Intelligence", icon: Compass, question: "O que o mercado diz por país/segmento?",
        prompt: `Como conselheiro do CEO, produza MARKET INTELLIGENCE. Analise países, segmentos, concorrentes e tendências que aparecem nos reviews (use o campo country quando disponível).${DNA_INSTRUCTION}` },
      { id: "emerging-trends", label: "Emerging Trends", icon: TrendingUp, question: "O que está começando a acontecer?",
        prompt: `Como conselheiro do CEO, seja um EMERGING TRENDS detector. Identifique sinais fracos — temas que aparecem pouco agora mas estão crescendo, ou que indicam mudança de comportamento. Distinga ruído de sinal.${DNA_INSTRUCTION}` },
      { id: "board-report", label: "Board Report", icon: ClipboardList, question: "O que levar ao conselho/investidores?",
        prompt: `Como conselheiro do CEO, gere um BOARD REPORT executivo pronto para apresentar ao conselho/investidores: visão geral, KPIs, principais riscos, oportunidades, e 3 decisões pedidas. Tom formal e conciso.${DNA_INSTRUCTION}` },
    ],
  },
  /* ====================================================== CPO */
  {
    id: "cpo",
    label: "CPO",
    icon: Compass,
    centralQuestion: "O que devemos construir?",
    tagline: "Lente de produto: roadmap, gaps, ROI de features",
    modules: [
      { id: "roadmap-prioritizer", label: "AI Roadmap Prioritizer", icon: Map, question: "O que construir primeiro?",
        prompt: `Você é o conselheiro de produto do CPO. Priorize o ROADMAP com base nos reviews: o que construir primeiro por impacto x esforço, fundamentado em evidência.${DNA_INSTRUCTION}` },
      { id: "problem-opportunity-map", label: "Problem Opportunity Map", icon: MapPin, question: "Onde problema vira oportunidade?",
        prompt: `Como conselheiro do CPO, mapeie PROBLEMA → OPORTUNIDADE. Para cada grande problema dos reviews, qual oportunidade de produto ele revela?${DNA_INSTRUCTION}` },
      { id: "feature-demand", label: "Feature Demand Intelligence", icon: Megaphone, question: "Quais features os usuários pedem?",
        prompt: `Como conselheiro do CPO, produza FEATURE DEMAND INTELLIGENCE: liste as funcionalidades mais pedidas nos reviews, com frequência e contexto.${DNA_INSTRUCTION}` },
      { id: "feature-roi", label: "Feature ROI Ranking", icon: TrendingUp, question: "Qual feature tem maior ROI?",
        prompt: `Como conselheiro do CPO, ranqueie features por ROI potencial: demanda x impacto x esforço estimado, com evidência.${DNA_INSTRUCTION}` },
      { id: "competitive-feature-gap", label: "Competitive Feature Gap", icon: GitCompare, question: "Quais features faltam vs concorrentes?",
        prompt: `Como conselheiro do CPO, identifique FEATURE GAPS competitivos: o que concorrentes têm (inferido dos reviews comparados) que o app principal não oferece.${DNA_INSTRUCTION}` },
      { id: "product-health-cpo", label: "Product Health", icon: BarChart3, question: "Qual a saúde do produto?",
        prompt: `Como conselheiro do CPO, avalie a saúde do produto: satisfação, tendência, estabilidade. Score 0-100 com justificativa. Inclua chart-bar dos componentes.${DNA_INSTRUCTION}` },
      { id: "release-impact", label: "Release Impact", icon: Rocket, question: "O impacto da última versão?",
        prompt: `Como conselheiro do CPO, analise RELEASE IMPACT: o que mudou após a versão mais recente (quando detectável por versão nos reviews). Regressão ou melhoria?${DNA_INSTRUCTION}` },
      { id: "emerging-problems", label: "Emerging Product Problems", icon: AlertTriangle, question: "Que problemas estão surgindo?",
        prompt: `Como conselheiro do CPO, detecte EMERGING PRODUCT PROBLEMAS: novos problemas que aparecem nos reviews recentes, antes que virem crise.${DNA_INSTRUCTION}` },
      { id: "product-strategy", label: "Product Strategy Generator", icon: Crosshair, question: "Qual estratégia de produto seguir?",
        prompt: `Como conselheiro do CPO, gere uma PRODUCT STRATEGY: 3 direções estratégicas possíveis com base nos reviews, com prós/contras e recomendação.${DNA_INSTRUCTION}` },
      { id: "evidence-roadmap", label: "Evidence-backed Roadmap", icon: ScrollText, question: "Roadmap com prova, não achismo",
        prompt: `Como conselheiro do CPO, produza um EVIDENCE-BACKED ROADMAP: 5 itens priorizados, cada um com a evidência (citações) que o justifica.${DNA_INSTRUCTION}` },
    ],
  },
  /* ====================================================== PM */
  {
    id: "pm",
    label: "Product Manager",
    icon: Target,
    centralQuestion: "Qual problema devemos resolver agora?",
    tagline: "Lente de priorização: problemas, PRDs, sprints",
    modules: [
      { id: "problem-prioritizer", label: "Problem Prioritizer", icon: Target, question: "Qual problema resolver agora?",
        prompt: `Você é o conselheiro do Product Manager. Priorize PROBLEMAS por severidade x frequência x impacto, com evidência. Top 3 primeiro.${DNA_INSTRUCTION}` },
      { id: "feature-request", label: "Feature Request Analyzer", icon: Megaphone, question: "Que features pedem?",
        prompt: `Como conselheiro do PM, analise FEATURE REQUESTS: agrupe e conte os pedidos de funcionalidades, priorize por recorrência.${DNA_INSTRUCTION}` },
      { id: "user-pain-map", label: "User Pain Map", icon: MapPin, question: "Onde dói mais?",
        prompt: `Como conselheiro do PM, construa um USER PAIN MAP: mapeie as dores dos usuários por categoria e intensidade.${DNA_INSTRUCTION}` },
      { id: "evidence-explorer", label: "Evidence Explorer", icon: ScrollText, question: "Quais as provas?",
        prompt: `Como conselheiro do PM, seja um EVIDENCE EXPLORER: organize as citações reais mais relevantes por tema, formando uma biblioteca de provas.${DNA_INSTRUCTION}` },
      { id: "competitor-gap-pm", label: "Competitor Gap", icon: GitCompare, question: "Onde concorrentes nos superam?",
        prompt: `Como conselheiro do PM, identifique COMPETITOR GAPS: onde os concorrentes (comparados nos reviews) entregam melhor.${DNA_INSTRUCTION}` },
      { id: "release-analysis", label: "Release Analysis", icon: Rocket, question: "O que a versão causou?",
        prompt: `Como conselheiro do PM, faça RELEASE ANALYSIS: impacto da versão mais recente nos reviews (quando detectável).${DNA_INSTRUCTION}` },
      { id: "prd-generator", label: "PRD Generator", icon: FileText, question: "Gere um PRD para o top problema",
        prompt: `Como conselheiro do PM, gere um PRD (Product Requirements Document) para o maior problema identificado: contexto, problema, objetivo, requisitos, critérios de aceitação e métricas.${DNA_INSTRUCTION}` },
      { id: "hypothesis", label: "Hypothesis Generator", icon: FlaskConical, question: "Quais hipóteses testar?",
        prompt: `Como conselheiro do PM, gere HIPÓTESES testáveis derivadas dos reviews: "Se fizermos X, então Y, porque Z".${DNA_INSTRUCTION}` },
      { id: "sprint-prioritizer", label: "Sprint Prioritizer", icon: Flag, question: "O que entra na próxima sprint?",
        prompt: `Como conselheiro do PM, priorize itens para a próxima SPRINT com base nos reviews: top 5 por valor x esforço.${DNA_INSTRUCTION}` },
      { id: "roadmap-assistant", label: "Roadmap Assistant", icon: Map, question: "Como estruturar o roadmap?",
        prompt: `Como conselheiro do PM, seja um ROADMAP ASSISTANT: proponha um roadmap de curto/médio/longo prazo baseado nos reviews.${DNA_INSTRUCTION}` },
    ],
  },
  /* ====================================================== UX */
  {
    id: "ux",
    label: "UX / Designer",
    icon: Users,
    centralQuestion: "Onde a experiência está falhando?",
    tagline: "Lente de UX: fricção, jornada, benchmark",
    modules: [
      { id: "ux-pain-map", label: "UX Pain Map", icon: MapPin, question: "Onde dói a experiência?",
        prompt: `Você é o conselheiro de UX. Mapeie UX PAINS: onde a experiência falha segundo os reviews, por etapa/tela quando inferível.${DNA_INSTRUCTION}` },
      { id: "journey-friction", label: "User Journey Friction", icon: Compass, question: "Onde na jornada há fricção?",
        prompt: `Como conselheiro de UX, identifique JOURNEY FRICTION: pontos da jornada do usuário (onboarding, login, pagamento, etc.) com fricção relatada.${DNA_INSTRUCTION}` },
      { id: "ux-clustering", label: "UX Problem Clustering", icon: Layers, question: "Como agrupar os problemas de UX?",
        prompt: `Como conselheiro de UX, faça UX PROBLEM CLUSTERING: agrupe problemas de experiência por tema recorrente.${DNA_INSTRUCTION}` },
      { id: "feature-experience", label: "Feature Experience Analysis", icon: Sparkles, question: "Como é a experiência por feature?",
        prompt: `Como conselheiro de UX, analise FEATURE EXPERIENCE: para features mencionadas, qual a experiência relatada (positiva/negativa)?${DNA_INSTRUCTION}` },
      { id: "competitor-ux", label: "Competitor UX Benchmark", icon: GitCompare, question: "Como nosso UX compara?",
        prompt: `Como conselheiro de UX, faça COMPETITOR UX BENCHMARK: compare a experiência entre apps selecionados.${DNA_INSTRUCTION}` },
      { id: "design-opportunity", label: "Design Opportunity Finder", icon: Lightbulb, question: "Onde melhorar o design?",
        prompt: `Como conselheiro de UX, encontre DESIGN OPPORTUNITIES: onde melhorias de design teriam mais impacto segundo os reviews.${DNA_INSTRUCTION}` },
      { id: "accessibility", label: "Accessibility Issues", icon: Wrench, question: "Há problemas de acessibilidade?",
        prompt: `Como conselheiro de UX, detecte ACCESSIBILITY ISSUES mencionados nos reviews (quando houver).${DNA_INSTRUCTION}` },
      { id: "country-ux", label: "Country-specific UX", icon: MapPin, question: "UX diferente por país?",
        prompt: `Como conselheiro de UX, identifique COUNTRY-SPECIFIC UX: diferenças de experiência relatadas por país (use o campo country quando disponível).${DNA_INSTRUCTION}` },
      { id: "ux-trend", label: "UX Trend Detection", icon: TrendingUp, question: "Que tendências de UX emergem?",
        prompt: `Como conselheiro de UX, detecte UX TRENDS: padrões de experiência que estão mudando.${DNA_INSTRUCTION}` },
      { id: "design-brief", label: "AI Design Brief", icon: FileText, question: "Gere um design brief",
        prompt: `Como conselheiro de UX, gere um DESIGN BRIEF para o maior problema de UX: contexto, problema, usuários, restrições e direção de solução.${DNA_INSTRUCTION}` },
    ],
  },
  /* ====================================================== Engineering */
  {
    id: "eng",
    label: "Engineering / QA",
    icon: Cpu,
    centralQuestion: "O que precisamos corrigir primeiro?",
    tagline: "Lente técnica: bugs, crashes, regressões, severidade",
    modules: [
      { id: "bug-detector", label: "Bug Detector", icon: Bug, question: "Quais bugs aparecem?",
        prompt: `Você é o conselheiro de Engineering/QA. Seja um BUG DETECTOR: liste bugs relatados nos reviews, agrupados por tipo, com frequência.${DNA_INSTRUCTION}` },
      { id: "crash-detector", label: "Crash Detector", icon: AlertTriangle, question: "Onde há crashes?",
        prompt: `Como conselheiro de Eng/QA, detecte CRASHES mencionados nos reviews. Severidade e contexto.${DNA_INSTRUCTION}` },
      { id: "regression-detector", label: "Regression Detector", icon: TrendingUp, question: "O que regrediu?",
        prompt: `Como conselheiro de Eng/QA, detecte REGRESSIONS: funcionalidades que pioraram (quando detectável por versão nos reviews).${DNA_INSTRUCTION}` },
      { id: "version-impact", label: "Version Impact", icon: Rocket, question: "Impacto por versão?",
        prompt: `Como conselheiro de Eng/QA, analise VERSION IMPACT: o que cada versão (quando citada) causou em satisfação.${DNA_INSTRUCTION}` },
      { id: "tech-clustering", label: "Technical Complaint Clustering", icon: Layers, question: "Como agrupar queixas técnicas?",
        prompt: `Como conselheiro de Eng/QA, faça TECHNICAL COMPLAINT CLUSTERING: agrupe queixas técnicas por categoria.${DNA_INSTRUCTION}` },
      { id: "severity-ranking", label: "Severity Ranking", icon: Scale, question: "Qual severidade de cada issue?",
        prompt: `Como conselheiro de Eng/QA, faça SEVERITY RANKING: classifique issues técnicas por severidade (crítica/alta/média/baixa).${DNA_INSTRUCTION}` },
      { id: "performance", label: "Performance Problems", icon: Cpu, question: "Problemas de performance?",
        prompt: `Como conselheiro de Eng/QA, detecte PERFORMANCE PROBLEMS: lentidão, consumo de bateria, travamentos relatados.${DNA_INSTRUCTION}` },
      { id: "release-quality", label: "Release Quality Score", icon: BarChart3, question: "Score de qualidade da release?",
        prompt: `Como conselheiro de Eng/QA, calcule um RELEASE QUALITY SCORE 0-100 com base nos reviews da versão mais recente. Inclua chart-bar dos componentes.${DNA_INSTRUCTION}` },
      { id: "bug-evidence", label: "Bug Evidence Explorer", icon: ScrollText, question: "Provas dos bugs?",
        prompt: `Como conselheiro de Eng/QA, seja um BUG EVIDENCE EXPLORER: organize citações reais de bugs para reprodução.${DNA_INSTRUCTION}` },
      { id: "issue-generator", label: "Issue Generator", icon: ClipboardList, question: "Gere issues (estilo Jira/GitHub)",
        prompt: `Como conselheiro de Eng/QA, gere ISSUES no estilo Jira/GitHub para os top bugs: título, descrição, passos para reproduzir, severidade.${DNA_INSTRUCTION}` },
    ],
  },
  /* ====================================================== Marketing */
  {
    id: "mkt",
    label: "Marketing / ASO",
    icon: Megaphone,
    centralQuestion: "Como atrair e converter melhor?",
    tagline: "Lente de marketing: voz-do-cliente, ASO, copy",
    modules: [
      { id: "voc-keywords", label: "Voice-of-Customer Keywords", icon: Search, question: "Que palavras os usuários usam?",
        prompt: `Você é o conselheiro de Marketing/ASO. Extraia VOICE-OF-CUSTOMER KEYWORDS: as palavras/frases que os usuários realmente usam nos reviews, agrupadas por tema.${DNA_INSTRUCTION}` },
      { id: "competitor-messaging", label: "Competitor Messaging", icon: GitCompare, question: "Como concorrentes se comunicam?",
        prompt: `Como conselheiro de Marketing, analise COMPETITOR MESSAGING: o que os reviews revelam sobre o posicionamento dos concorrentes.${DNA_INSTRUCTION}` },
      { id: "aso-opportunity", label: "ASO Opportunity Finder", icon: Lightbulb, question: "Onde otimizar a loja?",
        prompt: `Como conselheiro de ASO, encontre ASO OPPORTUNITIES: termos e ângulos de copy que poderiam melhorar o ranking, com base na linguagem dos usuários.${DNA_INSTRUCTION}` },
      { id: "review-to-copy", label: "Review-to-Copy Intelligence", icon: Sparkles, question: "Transformar review em copy?",
        prompt: `Como conselheiro de Marketing, faça REVIEW-TO-COPY: transforme os melhores sentimentos dos reviews em ângulos de copy prontos para a loja.${DNA_INSTRUCTION}` },
      { id: "store-listing", label: "Store Listing Analysis", icon: FileText, question: "Como está a listing?",
        prompt: `Como conselheiro de ASO, analise STORE LISTING: o que os reviews sugerem sobre clareza do nome/descrição/prints (quando inferível).${DNA_INSTRUCTION}` },
      { id: "user-language", label: "User Language Explorer", icon: Users, question: "Como o usuário se expressa?",
        prompt: `Como conselheiro de Marketing, seja um USER LANGUAGE EXPLORER: padrões de linguagem, jargão e emoção dos usuários.${DNA_INSTRUCTION}` },
      { id: "positioning", label: "Positioning Analysis", icon: Crosshair, question: "Como estamos posicionados?",
        prompt: `Como conselheiro de Marketing, faça POSITIONING ANALYSIS: como os usuários percebem o app vs concorrentes.${DNA_INSTRUCTION}` },
      { id: "country-messaging", label: "Country Messaging", icon: MapPin, question: "Mensagem diferente por país?",
        prompt: `Como conselheiro de Marketing, identifique COUNTRY MESSAGING: diferenças de percepção por país (use country quando disponível).${DNA_INSTRUCTION}` },
      { id: "creative-hypothesis", label: "Creative Hypothesis Generator", icon: FlaskConical, question: "Quais criativos testar?",
        prompt: `Como conselheiro de Marketing, gere CREATIVE HYPOTHESES: ideias de criativos/campanhas testáveis derivadas dos reviews.${DNA_INSTRUCTION}` },
      { id: "aso-strategy", label: "ASO Strategy", icon: Target, question: "Estratégia de ASO completa",
        prompt: `Como conselheiro de ASO, produza uma ASO STRATEGY completa: keywords-alvo, ângulos de título/subtítulo, e prioridades.${DNA_INSTRUCTION}` },
    ],
  },
  /* ====================================================== Competitive Intelligence */
  {
    id: "ci",
    label: "Competitive Intel",
    icon: Trophy,
    centralQuestion: "Como estamos em relação ao mercado?",
    tagline: "Lente competitiva: fraquezas, forças, gaps, ameaças",
    modules: [
      { id: "competitor-weakness", label: "Competitor Weakness Radar", icon: AlertTriangle, question: "Onde concorrentes falham?",
        prompt: `Você é o conselheiro de Competitive Intelligence. Operando um COMPETITOR WEAKNESS RADAR: identifique onde os concorrentes falham segundo seus reviews — oportunidades de ataque.${DNA_INSTRUCTION}` },
      { id: "competitor-strength", label: "Competitor Strength Radar", icon: Trophy, question: "Onde concorrentes brilham?",
        prompt: `Como conselheiro de CI, opere um COMPETITOR STRENGTH RADAR: onde os concorrentes superam, com evidência.${DNA_INSTRUCTION}` },
      { id: "feature-gap-matrix", label: "Feature Gap Matrix", icon: GitCompare, question: "Matrix de features",
        prompt: `Como conselheiro de CI, construa uma FEATURE GAP MATRIX (tabela markdown): feature × app, marcando quem tem/leva vantagem.${DNA_INSTRUCTION}` },
      { id: "market-gap", label: "Market Gap Detector", icon: Target, question: "Que gaps de mercado existem?",
        prompt: `Como conselheiro de CI, seja um MARKET GAP DETECTOR: lacunas não atendidas que emergem dos reviews comparados.${DNA_INSTRUCTION}` },
      { id: "threat-detection", label: "Threat Detection", icon: AlertTriangle, question: "Que ameaças detectamos?",
        prompt: `Como conselheiro de CI, faça THREAT DETECTION: ameaças competitivas emergentes nos reviews.${DNA_INSTRUCTION}` },
      { id: "competitor-trend", label: "Competitor Trend Analysis", icon: TrendingUp, question: "Que tendências nos concorrentes?",
        prompt: `Como conselheiro de CI, analise COMPETITOR TRENDS: para onde os concorrentes estão indo segundo os reviews.${DNA_INSTRUCTION}` },
      { id: "competitor-sentiment", label: "Competitor Sentiment", icon: BarChart3, question: "Sentimento por concorrente",
        prompt: `Como conselheiro de CI, produza COMPETITOR SENTIMENT: compare % positivo/negativo entre apps. Inclua chart-bar.${DNA_INSTRUCTION}` },
      { id: "geo-benchmark", label: "Geographic Benchmark", icon: MapPin, question: "Benchmark por país",
        prompt: `Como conselheiro de CI, faça GEOGRAPHIC BENCHMARK: compare apps por país (use country quando disponível).${DNA_INSTRUCTION}` },
      { id: "competitive-strategy", label: "Competitive Strategy", icon: Crosshair, question: "Estratégia competitiva",
        prompt: `Como conselheiro de CI, produza uma COMPETITIVE STRATEGY: 3 jogadas competitivas com base nos reviews.${DNA_INSTRUCTION}` },
      { id: "competitor-dossier", label: "Competitor Dossier", icon: FileText, question: "Dossiê do concorrente",
        prompt: `Como conselheiro de CI, gere um COMPETITOR DOSSIER para o maior concorrente: forças, fraquezas, oportunidades, ameaças (SWOT).${DNA_INSTRUCTION}` },
    ],
  },
];

/* Sugestões de chat contextualizadas por persona. O Copilot conhece a persona,
 * o módulo ativo e a análise já produzida. */
export function personaChatSuggestions(personaId: string): string[] {
  const common = [
    "Por que você classificou isso como alta prioridade?",
    "Mostre as evidências por trás dessa conclusão.",
    "Compare com nossos maiores concorrentes.",
  ];
  const specific: Record<string, string[]> = {
    ceo: ["Qual o impacto financeiro disso?", "Quanto vale corrigir isso?", "Gere um resumo para o conselho."],
    cpo: ["Qual feature tem maior ROI?", "O que falta vs concorrentes?", "Proponha um roadmap de 90 dias."],
    pm: ["Gere um PRD para o top problema.", "O que entra na próxima sprint?", "Quais hipóteses testar?"],
    ux: ["Onde está a maior fricção?", "Como nosso UX compara ao concorrente?", "Gere um design brief."],
    eng: ["Quais bugs são P0?", "Gere issues para o Jira.", "Qual versão causou a regressão?"],
    mkt: ["Quais keywords de ASO usar?", "Transforme reviews em copy.", "Quais criativos testar?"],
    ci: ["Qual a maior ameaça competitiva?", "Onde atacar o concorrente?", "Gere um dossiê do concorrente."],
  };
  return [...common, ...(specific[personaId] ?? [])];
}

/* O prompt do "Challenge this conclusion" — obriga a IA a procurar evidências
 * contrárias, vieses e incertezas. */
export const CHALLENGE_PROMPT = `Desafie a conclusão anterior. Procure ATIVAMENTE:
1. Evidências contrárias nos reviews que contradizem a conclusão.
2. Dados insuficientes (o que falta saber para ter certeza?).
3. Vieses possíveis (seleção, sobrevivente, recência).
4. Explicações alternativas para o mesmo fenômeno.
5. Apps/períodos que contradizem.

Estruture:
## Confiança revisada
X% (justifique)
## Evidências favoráveis
(contagem + resumo)
## Evidências contrárias
(contagem + citações reais)
## Principais incertezas
(bullets)
## Viés potencial
(o que pode estar distorcendo)`;

/* O prompt do "Why?" — explica o raciocínio por trás de uma conclusão. */
export const WHY_PROMPT = `Explique o PORQUÊ da conclusão anterior de forma estruturada:
## Conclusão
(restate brevemente)
## Por quê?
- Liste cada razão com ✓ e a evidência quantitativa
## Confiança
X%
## Evidências
(contagem de reviews que sustentam)`;

/* O prompt do "What should I do?" — transforma análise em plano. */
export const ACTION_PROMPT = `Transforme a análise anterior em um PLANO DE AÇÃO:
## Recomendação
(passos numerados e acionáveis)
## Impacto esperado
Alto|Médio|Baixo
## Esforço
Alto|Médio|Baixo
## Prioridade
P0|P1|P2
## Métricas para monitorar
(3 KPIs derivados dos reviews)`;
