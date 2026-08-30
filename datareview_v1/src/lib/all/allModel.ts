/**
 * Modelo puro da página `/all` — a jornada completa do usuário por TODAS as
 * páginas do sistema, organizada em ATOs sequenciais do primeiro contato à
 * gestão dos resultados. Cada seção embute a página real (iframe same-origin)
 * e enquadra a tarefa: o que você faz → por que/quando → o que resulta.
 *
 * A página serve também como MAPA DE REFATORAÇÃO: tudo que existe no sistema
 * num só lugar, para extrair partes em novas páginas depois.
 *
 * Nenhum import de React/DOM — seguro chamar em testes puros.
 */
import { PAGES } from "@/lib/pages";

/** Nível do componente expansível (persistido por seção). */
export type AllLevel = "collapsed" | "default" | "expanded";

export const ALL_LEVELS: AllLevel[] = ["collapsed", "default", "expanded"];

/** Metadados honestos dos 3 níveis (exibidos na página e testados). */
export const LEVEL_META: { id: AllLevel; label: string; blurb: string }[] = [
  {
    id: "default",
    label: "Nível 1 · fixo",
    blurb: "altura fixa — se o conteúdo exceder, rolagem vertical dentro do bloco",
  },
  {
    id: "expanded",
    label: "Nível 2 · adaptável",
    blurb: "o bloco cresce até mostrar todo o conteúdo, sem rolagem vertical",
  },
  {
    id: "collapsed",
    label: "Nível 3 · recolhido",
    blurb: "só o título/cabeçalho — carrega nada até você expandir",
  },
];

/** Prefixo dos storages da página (nível por seção + checklist de tarefas). */
export const ALL_STORAGE_PREFIX = "aso:all:";

export interface AllSectionDef {
  /** Âncora estável (sem o prefixo `all-`). */
  id: string;
  /** Path da página embutida (registry PAGES). */
  path: string;
  title: string;
  /** Tarefa do usuário nesta etapa (uma linha). */
  task: string;
  /** Por que/quando esta etapa entra na jornada. */
  why: string;
  /** O que resulta quando a tarefa é concluída. */
  result: string;
  /** Quando a página NÃO pode ser embutida (redirect/link externo/recursão),
   *  a nota explica e o botão leva à rota real. */
  note?: string;
}

export interface AllAct {
  id: string;
  /** Número exibido ("01"…"08"). */
  index: string;
  title: string;
  /** Frase de enquadramento do ato. */
  focus: string;
  sections: AllSectionDef[];
}

export const ALL_ACTS: AllAct[] = [
  {
    id: "conhecer",
    index: "01",
    title: "Primeiro contato",
    focus: "Entenda o que é o sistema antes de qualquer tarefa.",
    sections: [
      {
        id: "boas-vindas", path: "/boas-vindas", title: "Boas-vindas",
        task: "Deixe o anfitrião te apresentar o sistema.",
        why: "É a porta de entrada para quem nunca viu nada do produto.",
        result: "Você entende o que o sistema faz e recebe os primeiros passos.",
      },
      {
        id: "auditoria", path: "/auditoria", title: "Auditoria",
        task: "Conheça cada fonte a fundo: endpoints, parâmetros, capacidades, saídas, limites e confiabilidade.",
        why: "Antes de coletar, saiba exatamente o que cada fonte oferece — e o que ainda não extraímos dela.",
        result: "Você sabe o que temos e o que não temos em cada fonte — nenhum dado é surpresa.",
      },
      {
        id: "chaves", path: "/chaves", title: "Chaves API",
        task: "Configure as chaves das fontes e da IA (BYOK) com links oficiais de criação.",
        why: "Sem chave, parte das fontes responde com lacuna honesta — aqui você destrava o máximo.",
        result: "Todas as fontes com chave disponível passam a coletar o máximo.",
      },
      {
        id: "testes-fontes", path: "/testes-fontes", title: "Testes de fontes",
        task: "Digite um termo e teste TODAS as fontes ao vivo — separado por probe e unificado.",
        why: "A auditoria documenta; o teste confirma o que de fato funciona hoje, por variação.",
        result: "Você vê raw, contagens e campos reais por probe — e o que falha/pula honestamente.",
      },
      {
        id: "demo", path: "/demo", title: "Demo",
        task: "Veja o sistema funcionando com dados de exemplo.",
        why: "Em 90s você vê a coleta → análise → resultado sem criar nada.",
        result: "Você sabe o formato do resultado antes de coletar seus dados.",
      },
      {
        id: "case", path: "/case", title: "Explorar (Case)",
        task: "Entenda como o produto foi construído e por que decisões foram tomadas.",
        why: "A leitura do caso enquadra o modelo mental do sistema inteiro.",
        result: "Você sabe o que cada camada faz — nada é caixa-preta.",
      },
      {
        id: "inicio-lite", path: "/", title: "Início",
        task: "Veja a página inicial do sistema: hero com busca, Top Charts ao vivo e menu de navegação.",
        why: "É a porta de entrada diária para pesquisar e acompanhar os apps das duas lojas.",
        result: "Você entende a anatomia da nova página inicial — hero, busca e Top Charts.",
      },
      {
        id: "home", path: "/home", title: "Home",
        task: "Veja o modelo mobile-first da página inicial (abas, seções, task bar).",
        why: "A página inicial mobile-first veio de um modelo estrutural real.",
        result: "Você entende a anatomia mobile-first antes de navegar.",
      },
    ],
  },
  {
    id: "coletar",
    index: "02",
    title: "Coletar dados",
    focus: "O fundamento: sem dados, o resto do sistema não tem o que analisar.",
    sections: [
      {
        id: "inicio", path: "/inicio", title: "Coleta",
        task: "Busque apps na App Store/Google Play e colete reviews.",
        why: "É a coleta clássica — o primeiro dado do seu dataset.",
        result: "Apps e reviews entram no dataset local e alimentam tudo.",
      },
      {
        id: "search", path: "/search", title: "Busca",
        task: "Pesquise apps nas duas lojas com ranking e top charts.",
        why: "Ajuda a encontrar os apps certos antes de coletar.",
        result: "Você escolhe os alvos certos sem coletar o que não serve.",
      },
      {
        id: "uni", path: "/00", title: "Uni",
        task: "Pesquise e colete em 30+ fontes (Suggest, Trends, YouTube, Reddit…).",
        why: "O universo de dados é maior que as lojas de apps.",
        result: "Coleções multi-fonte prontas para organizar e analisar.",
      },
      {
        id: "suggest", path: "/suggest", title: "Suggest",
        task: "Expanda um termo por regiões, verticais e grupos de autocomplete.",
        why: "Descobre como o mundo procura — a camada de discovery de termos.",
        result: "Grafo de termos com proveniência para orientar a pesquisa.",
      },
      {
        id: "trending", path: "/trending", title: "Trending",
        task: "Extraia o Google Trends “Em alta” por região e janela.",
        why: "Captura o que está crescendo agora — insumos de oportunidade.",
        result: "Lista de trends com volume, crescimento e notícias vinculadas.",
      },
      {
        id: "descoberta", path: "/descoberta", title: "Descoberta",
        task: "Varra fontes novas sem chave e investigue qualquer URL.",
        why: "Radar de dados públicos que nenhuma fonte central cobre.",
        result: "Itens de fontes novas resolvidos e salvos na Uni.",
      },
      {
        id: "pipeline-multifonte", path: "/pipeline-multifonte", title: "Pipeline Multifonte",
        task: "Automatize a coleta em várias fontes de uma vez.",
        why: "Quando a busca manual já sabe o que quer, a automação escala.",
        result: "Documento gerado com análise determinística + IA das fontes.",
      },
    ],
  },
  {
    id: "entender",
    index: "03",
    title: "Entender os dados",
    focus: "Antes de analisar: o que foi coletado, em que qualidade, e como flui.",
    sections: [
      {
        id: "dados", path: "/dados", title: "Dados brutos",
        task: "Abra cada app e cada review exatamente como vieram das lojas.",
        why: "Confiança nasce de ver o dado bruto sem amostragem.",
        result: "Você conhece o conteúdo real do seu dataset.",
      },
      {
        id: "pipeline-dados", path: "/pipeline-dados", title: "Pipeline de dados",
        task: "Valide o dataset com os 8 checks de auditoria.",
        why: "Análise sobre dado quebrado gera decisão quebrada.",
        result: "Você sabe a qualidade e os limites honestos da coleta.",
      },
      {
        id: "fluxo-dados", path: "/fluxo-dados", title: "Fluxo de dados",
        task: "Veja o mapa macro: busca → coleta → tratamento → IA → artefatos.",
        why: "O mapa responde “onde meu dado está em cada estágio”.",
        result: "Você entende o pipeline e audita qualquer estágio.",
      },
      {
        id: "dashboard", path: "/dashboard", title: "Dashboard",
        task: "Leia KPIs, gráficos e distribuições do dataset inteiro.",
        why: "É a primeira síntese visual dos seus dados.",
        result: "Você vê padrões (notas, sentimento, versões, timeline) de uma vez.",
      },
    ],
  },
  {
    id: "analisar",
    index: "04",
    title: "Conversar e analisar",
    focus: "Com dados no lugar, a IA completa o raciocínio — mas tudo funciona sem ela.",
    sections: [
      {
        id: "ia", path: "/ia", title: "Central de IA",
        task: "Configure a IA e entenda o que ela pode fazer por você.",
        why: "A IA é opcional — e quando existe, precisa estar bem configurada.",
        result: "Modo de IA definido (auto/local/cloud/none) e testado.",
      },
      {
        id: "chat", path: "/chat", title: "Chat",
        task: "Converse com a IA sobre os apps — ou comande o sistema por texto.",
        why: "É a interface universal: analisa, navega, coleta e mostra componentes.",
        result: "Respostas com evidência e ações executadas sem sair da conversa.",
      },
      {
        id: "chat-voz", path: "/chat-voz", title: "Chat com voz",
        task: "Fale e ouça: o mesmo chat, operado por voz.",
        why: "Mãos livres com STT/TTS locais (Whisper/Piper).",
        result: "A jornada inteira operável em conversa falada.",
      },
      {
        id: "chat-arquivos", path: "/chat-arquivos", title: "Chat com arquivos",
        task: "Anexe CSV/TXT/MD/JSON e pergunte sobre eles.",
        why: "Seu conhecimento externo entra no contexto da IA.",
        result: "Análises que misturam reviews com seus documentos.",
      },
      {
        id: "conversa", path: "/conversa", title: "Conversa",
        task: "Use a tela só-chat: o sistema inteiro via conversa.",
        why: "Alternativa minimalista ao chat completo.",
        result: "Comandos e análises no fluxo mais direto possível.",
      },
      {
        id: "experiments", path: "/experiments", title: "Experimentos",
        task: "Rode as 12 seções de análise de IA sobre os apps selecionados.",
        why: "É o laboratório principal: resumo, problemas, oportunidades…",
        result: "Análises estruturadas com charts e evidência, salváveis.",
      },
      {
        id: "metodologias", path: "/metodologias", title: "Metodologias",
        task: "Aplique métodos de pesquisa/UX/negócio como pipelines de IA.",
        why: "24 metodologias prontas passam rigor ao improviso.",
        result: "Artefatos por método, com pipelines salvos reexecutáveis.",
      },
      {
        id: "pipeline", path: "/pipeline", title: "Pipeline",
        task: "Deixe o motor descobrir sozinho: fatos → anomalias → análises sugeridas.",
        why: "Conhecimento recursivo: fatos calculados alimentam a próxima IA.",
        result: "Cadeia de artefatos com lineage até os reviews originais.",
      },
      {
        id: "atlas", path: "/atlas", title: "Analysis Atlas",
        task: "Navegue o catálogo de análises e componha pipelines.",
        why: "Cada módulo declara o contrato INPUT→SCORE — escolha consciente.",
        result: "Análises executadas e pipelines enviadas ao Canvas.",
      },
      {
        id: "agentes", path: "/agentes", title: "Agentes",
        task: "Execute agentes por segmento (Produto, UX, Marketing, Suporte…).",
        why: "Cada agente é um pipeline de trabalho com etapas determinísticas.",
        result: "Pipelines de especialista rodados sobre seus dados.",
      },
      {
        id: "decision-center", path: "/decision-center", title: "Decision Center",
        task: "Troque a lente: a mesma realidade por 7 personas.",
        why: "CEO, CPO, PM, UX, Engenharia, Marketing e Competitiva decidem diferente.",
        result: "Decisões estruturadas por persona + síntese do conselho.",
      },
      {
        id: "lab", path: "/lab", title: "Lab",
        task: "Transforme achados em experimentos e candidatos a produto.",
        why: "Descoberta → evidência → validação → produto candidato.",
        result: "Findings validados anti-alucinação e Kanban de candidatos.",
      },
    ],
  },
  {
    id: "construir",
    index: "05",
    title: "Construir",
    focus: "Do insight à criação: pipelines visuais, telas e protótipos.",
    sections: [
      {
        id: "canvas", path: "/canvas", title: "Canvas",
        task: "Monte pipelines visuais de nós — com e sem IA.",
        why: "O construtor de fluxos: dados entram, análises e artefatos saem.",
        result: "Pipelines executáveis com 38 tipos de nó e templates prontos.",
      },
      {
        id: "design", path: "/design", title: "Design Canvas",
        task: "Monte páginas funcionais com componentes reais do sistema.",
        why: "Page builder em que todo bloco liga a dados de verdade.",
        result: "Páginas montadas, publicadas e exportadas em JSON.",
      },
      {
        id: "layouts", path: "/layouts", title: "Layouts",
        task: "Construa telas: linhas, colunas e blocos com componentes reais.",
        why: "O builder estrutural de telas customizadas.",
        result: "Templates e páginas funcionais salvas em “Minhas páginas”.",
      },
      {
        id: "estrutura", path: "/estrutura", title: "Estrutura",
        task: "Desenhe a estrutura de uma página sem conteúdo primeiro.",
        why: "Rascunho de layout com presets de colunas e blocos.",
        result: "Esqueletos de página prontos para virar telas reais.",
      },
      {
        id: "playground", path: "/playground", title: "Playground",
        task: "Teste ideias novas sobre o dataset (resposta a review, benchmark…).",
        why: "O estacionamento de ideias que ainda não viraram páginas.",
        result: "Protótipos funcionais validados com seus dados.",
      },
      {
        id: "concept", path: "/concept", title: "Conceito",
        task: "Use o workspace de 3 colunas que junta tudo num só lugar.",
        why: "Coletar → visualizar → analisar → decidir sem trocar de página.",
        result: "O caminho completo em uma única tela de trabalho.",
      },
      {
        id: "hub01", path: "/01", title: "Hub 01",
        task: "Trabalhe no hub com colunas divididas e chat completo embutido.",
        why: "Workspace analítico com pesquisa, config, chat e pipelines juntos.",
        result: "Tudo do sistema organizado em 3 colunas funcionais.",
      },
    ],
  },
  {
    id: "apresentar",
    index: "06",
    title: "Apresentar",
    focus: "Do resultado à comunicação: decks e cases.",
    sections: [
      {
        id: "apresentacoes", path: "/apresentacoes", title: "Apresentações",
        task: "Gere decks profissionais do dataset e apresente em tela cheia.",
        why: "Decks com KPIs, charts e quotes reais — exportáveis.",
        result: "Apresentação pronta (HTML/Markdown) para qualquer público.",
      },
      {
        id: "case-ia", path: "/case-ia", title: "Case IA",
        task: "Peça à IA um case completo por perfil profissional.",
        why: "O mesmo dataset vira narrativa de CEO, PM, UX, Marketing…",
        result: "Cases com resposta e evidência, salváveis como páginas.",
      },
    ],
  },
  {
    id: "gerenciar",
    index: "07",
    title: "Gerenciar resultados",
    focus: "Nada se perde: históricos, saídas e artefatos ficam com você.",
    sections: [
      {
        id: "sessions", path: "/sessions", title: "Sessões",
        task: "Navegue o histórico unificado de coletas e gerações de IA.",
        why: "Toda coleta e toda análise gerada ficam registradas.",
        result: "Você revisita, reutiliza e recupera qualquer trabalho.",
      },
      {
        id: "outputs", path: "/outputs", title: "Outputs",
        task: "Inventarie, exporte, importe e gerencie tudo que o sistema gerou.",
        why: "É o cofre dos artefatos: decks, análises, coleções, templates.",
        result: "Backup completo, portabilidade e limpeza com segurança.",
      },
    ],
  },
  {
    id: "sistema",
    index: "08",
    title: "Sistema e referência",
    focus: "Domine as superfícies avançadas e as referências do próprio sistema.",
    sections: [
      {
        id: "fluxo", path: "/fluxo", title: "Fluxo",
        task: "Percorra a jornada guiada do sistema em 16 seções.",
        why: "O System Flow é o mapa de capacidades com status ao vivo.",
        result: "Você sabe o que falta e o que já está pronto em cada etapa.",
      },
      {
        id: "jornada", path: "/jornada", title: "Jornada",
        task: "Execute o pipeline guiado: descobrir → apresentar.",
        why: "A trilha de tarefas recomendada em sequência.",
        result: "Um ciclo completo executado com acompanhamento.",
      },
      {
        id: "one", path: "/one", title: "One Page",
        task: "Slide a slide, toda fonte na tela inteira.",
        why: "Os 52 painéis de fontes com scroll snap — uma por tela.",
        result: "Busca global em todas as fontes sem sair da página.",
      },
      {
        id: "os", path: "/os", title: "Nexus OS",
        task: "Opere o sistema por CLI, views e memória de aprendizado.",
        why: "O OS dentro do app: comandos, agentes e 5 regiões de trabalho.",
        result: "Você comanda tudo por texto com aprendizado progressivo.",
      },
      {
        id: "terminal", path: "/terminal", title: "Terminal",
        task: "Use o shell com tabs, splits e IA embutida.",
        why: "O terminal completo do sistema (tty/tmux com IA).",
        result: "Operação avançada por comandos e output em panes.",
      },
      {
        id: "nucleo", path: "/nucleo", title: "Núcleo",
        task: "Veja sinais, pipeline do Fluxo e memória do sistema num painel só.",
        why: "A Core Page agrega o pulso do sistema.",
        result: "Leitura instantânea do estado e dos próximos passos.",
      },
      {
        id: "git", path: "/git", title: "Git",
        task: "Veja o mapa vivo do repositório: branches, commits, PRs, CI/CD.",
        why: "O Visual Git Canvas torna o desenvolvimento navegável.",
        result: "Você entende o projeto como um mapa operável.",
      },
      {
        id: "uso", path: "/uso", title: "Uso do sistema",
        task: "Veja a telemetria local: páginas, comandos e cobertura de análises.",
        why: "Dados reais de uso orientam poda e consolidação.",
        result: "Decisões de produto sustentadas por evidência de uso.",
      },
      {
        id: "design-system", path: "/design-system", title: "Design System",
        task: "Consulte tokens, componentes e padrões com previews ao vivo.",
        why: "É a referência visual viva do sistema inteiro.",
        result: "Qualquer padrão de UI encontrado e editável em segundos.",
      },
      {
        id: "componentes", path: "/componentes", title: "Componentes",
        task: "Navegue o catálogo vivo de componentes por página.",
        why: "Mostra repetições, reuso e previews de cada componente.",
        result: "Você reutiliza em vez de recriar — e mede o reuso.",
      },
      {
        id: "inventario", path: "/inventario", title: "Inventário",
        task: "Veja TODOS os componentes renderizados ao vivo por similaridade.",
        why: "O inventário completo do sistema com badge de padronização.",
        result: "Duplicatas expostas e componentes inspecionáveis ao vivo.",
      },
      {
        id: "feedback", path: "/feedback", title: "Feedback",
        task: "Reporte bugs, sugira melhorias e proponha features com evidências.",
        why: "O canal estruturado para evoluir o sistema.",
        result: "Reports rastreáveis com workflow e exportação Markdown.",
      },
      {
        id: "teste", path: "/teste", title: "Test Center",
        task: "Valide o sistema ponta a ponta com baterias de testes.",
        why: "O centro de validação guiada das rotas e fluxos.",
        result: "Você confirma que o sistema está íntegro antes de confiar.",
      },
      {
        id: "configuracoes", path: "/configuracoes", title: "Configurações",
        task: "Ajuste TUDO: páginas, IA, aparência, dados, layout e resets.",
        why: "Todas as opções do sistema num só lugar, por jornada.",
        result: "O sistema configurado exatamente do seu jeito.",
      },
      {
        id: "ui", path: "/ui", title: "UI (estrutura pura)",
        task: "Veja a estrutura de layout do sistema sem conteúdo.",
        why: "O shell de 5 colunas que toda página herda (arquivada do grupo Backup).",
        result: "Você entende o esqueleto visual do app inteiro.",
      },
      {
        id: "compare", path: "/compare", title: "Comparar",
        task: "Compare apps lado a lado a partir da seleção global.",
        why: "O comparativo competitivo de apps com métricas.",
        result: "Decisões de benchmark sobre os mesmos dados.",
        note: "Rota de redirecionamento: abre o picker de apps e mostra o comparativo dentro do detalhe do app. Use o botão Comparar do header global.",
      },
      {
        id: "frontend-starter", path: "/frontend-starter/", title: "Frontend Starter",
        task: "Abra o design system reutilizável (outro app na mesma origem).",
        why: "A base de componentes compartilhada entre projetos.",
        result: "Você reaproveita o starter em qualquer frontend novo.",
        note: "Link externo para outro app nesta origem — abre fora desta página.",
      },
    ],
  },
];

/** Todas as seções em ordem de jornada (atos achatados). */
export function allSections(): AllSectionDef[] {
  return ALL_ACTS.flatMap((a) => a.sections);
}

/** Paths das seções na ordem. */
export function allSectionPaths(): string[] {
  return allSections().map((s) => s.path);
}

/** Ato dono de uma seção (ou undefined). */
export function actOfSection(sectionId: string): AllAct | undefined {
  return ALL_ACTS.find((a) => a.sections.some((s) => s.id === sectionId));
}

/** Seção por id (âncora). */
export function sectionById(sectionId: string): AllSectionDef | undefined {
  return allSections().find((s) => s.id === sectionId);
}

/** Cobertura do registry: quais PAGES estão / faltam na jornada. */
export function allCoverage(): { covered: string[]; missing: string[]; extrac: string[] } {
  const registry = PAGES.map((p) => p.path);
  const journeys = new Set(allSectionPaths());
  const covered = registry.filter((p) => journeys.has(p));
  const missing = registry.filter((p) => !journeys.has(p));
  const extrac = allSectionPaths().filter((p) => !registry.includes(p));
  return { covered, missing, extrac };
}

/** âncora de seção com prefixo (evita colisão com ids de páginas internas). */
export function anchorId(sectionId: string): string {
  return `all-${sectionId.replace(/\W+/g, "-").replace(/^-+|-+$/g, "")}`;
}

/** Índice sequencial da seção (1..N) para o cabeçalho numerado. */
export function sectionIndex(sectionId: string): number {
  const i = allSections().findIndex((s) => s.id === sectionId);
  return i < 0 ? 0 : i + 1;
}

/** Total de tarefas = seções embutíveis (nota = navegação honesta, sem tarefa). */
export function totalTasks(): number {
  return allSections().filter((s) => !s.note).length;
}
