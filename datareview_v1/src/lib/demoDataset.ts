/**
 * Dataset demo de primeiro acesso (Onda 2.2): um app de exemplo com reviews
 * SINTÉTICAS mas realistas — para o usuário ver análise com evidência em
 * <30s, sem rede e sem configurar nada. Opt-out: botão "Remover exemplo".
 *
 * O app demo usa id com prefixo "demo:" (nunca colide com apps reais e é
 * identificável em qualquer lista via isDemoEntry). As reviews passam pelo
 * MESMO enrichment da coleta real (enrichReviews) — todos os gráficos,
 * validações e análises determinísticas funcionam sobre o demo como sobre
 * dados reais.
 */
import { upsertDataset, removeDataset, getDatasetEntry, type DatasetEntry } from "@/lib/datasetStore";
import { enrichReviews } from "@/lib/enrichment";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";

export const DEMO_STORE = "apple";
export const DEMO_APP_ID = "demo:nubank";
export const DEMO_APP_NAME = "Nubank (exemplo)";

export function isDemoEntry(entry: DatasetEntry): boolean {
  return entry.app.id.startsWith("demo:");
}

export function hasDemoDataset(): boolean {
  return !!getDatasetEntry(DEMO_STORE, DEMO_APP_ID);
}

/** Reviews sintéticas realistas (PT-BR, notas 1–5, versões, países, datas). */
const DEMO_REVIEWS: Array<[number, string, string, string, number, string, number]> = [
  // [rating, title, text, version, daysAgo, country, thumbsUp]
  [5, "Melhor banco digital", "Uso há 3 anos e nunca tive problema. O app é rápido, a interface é limpa e o atendimento resolveu minha questão em minutos pelo chat.", "9.8.2", 2, "br", 34],
  [5, "PIX instantâneo sempre", "Faço dezenas de PIX por semana e nunca caiu. A função de guardar dinheiro rendendo 100% do CDI é ótima.", "9.8.2", 5, "br", 21],
  [4, "Muito bom, mas o limite poderia ser maior", "App excelente no dia a dia. Só acho que a análise de crédito é conservadora demais para quem já é cliente há anos.", "9.8.1", 7, "br", 12],
  [5, "Interface perfeita", "Depois da atualização ficou ainda mais rápido. Consigo pagar boletos, transferir e investir sem travar nada.", "9.8.2", 9, "br", 8],
  [2, "App travando depois da atualização", "Desde a versão 9.8.0 o app congela na tela de pagamentos. Preciso fechar e abrir de novo toda hora. Era perfeito antes.", "9.8.0", 11, "br", 47],
  [1, "Não consigo acessar minha conta", "O app pede reconhecimento facial e trava na câmera. Estou há 3 dias sem acessar meu dinheiro. Inaceitável para um banco.", "9.8.0", 14, "br", 89],
  [5, "Cartão de crédito sem anuidade", "Aprovação rápida e limite justo. As notificações de compra em tempo real ajudam muito no controle.", "9.7.5", 18, "br", 15],
  [3, "Bom, mas o suporte demora", "O app em si é ótimo, mas quando precisei contestar uma compra o atendimento levou 2 dias para responder.", "9.7.5", 21, "br", 26],
  [4, "Investimentos melhoraram", "A área de investimentos ficou bem mais clara. Só falta integração melhor com a NuInvest para ver tudo num lugar só.", "9.8.1", 24, "br", 9],
  [5, "Caixinhas são ótimas", "Separar o dinheiro por objetivo mudou minha organização financeira. Rendimento automático sem pensar.", "9.8.2", 27, "br", 17],
  [2, "Cobrança duplicada não resolvida", "Fui cobrado duas vezes numa compra e o estorno demorou 15 dias. O app é bom mas a resolução de problemas falha.", "9.7.5", 30, "br", 41],
  [5, "Simplesmente funciona", "Abro o app, faço o que preciso e fecho. Sem propagandas, sem telas confusas. É assim que um banco deve ser.", "9.8.2", 33, "br", 6],
  [1, "Conta bloqueada sem aviso", "Minha conta foi bloqueada por 'análise de segurança' e não recebi nenhum aviso. Descobri na hora de pagar o mercado.", "9.8.1", 36, "br", 63],
  [4, "Ótimo para o dia a dia", "Uso para tudo: PIX, cartão virtual, caixinhas. Tiro uma estrela porque o modo escuro demora para carregar às vezes.", "9.8.2", 40, "br", 4],
  [5, "Recomendo para todo mundo", "Migrei do banco tradicional e não me arrependo. Zero tarifas e o app nunca me deixou na mão.", "9.7.0", 45, "br", 11],
  [3, "Empréstimo com juros altos", "O app é ótimo, mas a taxa do empréstimo pessoal é muito maior que a propaganda sugere. Fique atento ao CET.", "9.8.0", 48, "br", 28],
  [5, "Atendimento nota 10", "Precisei trocar o cartão virtual por segurança e em 5 minutos estava resolvido pelo chat, sem fila.", "9.8.2", 52, "br", 19],
  [2, "Notificações atrasadas", "As notificações de compra chegam minutos depois ou nem chegam. Já perdi o controle de gastos por causa disso.", "9.8.0", 55, "br", 33],
  [4, "Função débito automático ótima", "Cadastrei as contas de casa em débito e nunca mais paguei multa. Interface poderia mostrar melhor os próximos débitos.", "9.7.5", 60, "br", 7],
  [5, "O roxinho que eu amo", "Cliente desde 2016. Acompanhei o app evoluir e cada versão fica melhor. A transparência com o cliente é diferente.", "9.8.2", 66, "br", 24],
  [1, "Péssima experiência com seguros", "Contratei o seguro de celular pelo app e na hora de acionar descobri exclusões que não estavam claras. Me senti enganado.", "9.7.5", 70, "br", 52],
  [4, "Bom, com espaço para melhorar", "O cofrinho de rendimento é ótimo. Queria poder categorizar os gastos automaticamente por loja.", "9.8.1", 74, "br", 13],
  [5, "Cashback no ultravioleta vale muito", "O Ultravioleta paga 1% de cashback que rende 200% do CDI. Em um ano já tenho um valor considerável guardado.", "9.8.2", 78, "br", 31],
  [3, "App pesado no Android antigo", "No meu celular mais antigo o app demora para abrir e esquenta bastante. No novo funciona perfeitamente.", "9.8.0", 82, "br", 22],
  [5, "Portabilidade de salário fácil", "Fiz a portabilidade em 2 minutos pelo app. Receber o salário aqui deu descontos no cartão.", "9.8.1", 88, "br", 10],
  [2, "Fatura não fecha no dia certo", "O fechamento da fatura mudou sem aviso e desorganizou meu planejamento. O app deveria avisar com antecedência.", "9.7.0", 92, "br", 18],
  [4, "Open finance bem feito", "Conectei minhas outras contas e vejo tudo num lugar só. A atualização dos dados externos às vezes demora.", "9.8.2", 95, "br", 8],
  [5, "Câmbio para viagem perfeito", "Usei a conta global numa viagem e a conversão foi instantânea com taxa justa. Melhor que casa de câmbio.", "9.8.1", 100, "us", 14],
  [1, "Estorno de PIX não sai", "Fiz um PIX errado e o banco diz que não pode estornar. Entendo a regra, mas o app poderia ter um passo extra de confirmação.", "9.7.5", 105, "br", 44],
  [5, "App mais estável que nunca", "As últimas versões corrigiram os travamentos. Roda liso até no meio do mês quando o servidor ficava lento.", "9.8.2", 110, "br", 16],
  [3, "Cartão adicional confuso", "A função de cartão adicional para dependentes existe, mas a configuração de limite é escondida e pouco clara.", "9.7.0", 115, "br", 9],
  [4, "Rendimento automático transparente", "Ver o dinheiro render todo dia no extrato é muito didático. Só falta projeção de rendimento para o mês.", "9.8.2", 120, "br", 12],
  [2, "Biometria falha demais", "O reconhecimento facial falha umas 3 vezes antes de aceitar, e não oferece alternativa rápida de senha.", "9.8.0", 126, "br", 37],
  [5, "Melhor decisão financeira", "Saí de um banco que me cobrava R$ 40/mês de tarifa. Aqui pago zero e tenho mais recursos. Simples assim.", "9.8.1", 130, "br", 25],
  [4, "Comunidade Nu é um diferencial", "A área de comunidade dentro do app tem dicas boas de outros clientes. Poderia ser mais fácil de encontrar.", "9.7.5", 135, "br", 5],
  [1, "App não abre no meu celular", "Depois da atualização 9.8.0 o app fecha sozinho na abertura. Já reinstalei 4 vezes e nada. Uso um Galaxy A13.", "9.8.0", 140, "br", 58],
  [5, "Pix agendado salvou minha vida", "Agendo todos os boletos do mês no dia do salário. Nunca mais paguei juros por esquecimento.", "9.8.2", 145, "br", 20],
  [3, "Limite do cartão diminuiu do nada", "Sem aviso, meu limite caiu pela metade. O app não explica o motivo e o suporte mandou resposta genérica.", "9.7.5", 150, "br", 35],
  [4, "Recarga de celular integrada", "Faço recarga direto pelo app com desconto. Pequenas funções assim que fazem a diferença no dia a dia.", "9.8.1", 155, "br", 6],
  [5, "Transparente até no erro", "Quando o PIX caiu nacionalmente, o app avisou na hora que era problema do Banco Central e estimou o retorno. Respeito demais.", "9.8.2", 160, "br", 42],
];

/** Monta a entry demo completa (reviews enriquecidas como na coleta real). */
export function buildDemoEntry(now = Date.now()): DatasetEntry {
  const app: AppInfo = {
    id: DEMO_APP_ID,
    store: DEMO_STORE,
    name: DEMO_APP_NAME,
    icon: "",
    developer: "Nu Pagamentos S.A. (dados de exemplo)",
    rating: 4.2,
    ratingCount: 2400000,
    price: "Grátis",
    genre: "Finanças",
    description:
      "App de exemplo com reviews sintéticas para explorar o sistema sem coletar nada: " +
      "gráficos, validações, pipeline determinístico e análises de IA funcionam sobre estes dados. " +
      "Remova quando quiser (Configurações → Dados).",
    version: "9.8.2",
    releaseDate: "2016-04-01",
    currentVersionReleaseDate: "2026-08-10",
    screenshots: [],
    url: "",
  };
  const reviews: ReviewEntry[] = DEMO_REVIEWS.map(([rating, title, text, version, daysAgo, country, thumbsUp], i) => ({
    id: `demo-review-${i + 1}`,
    store: DEMO_STORE,
    appId: DEMO_APP_ID,
    appName: DEMO_APP_NAME,
    author: `Cliente exemplo ${i + 1}`,
    rating,
    title,
    text,
    date: new Date(now - daysAgo * 86400000).toISOString(),
    version,
    country,
    thumbsUp,
    developerReply: rating <= 2 && i % 3 === 0
      ? "Olá! Sentimos muito pela experiência. Nossa equipe está investigando — por favor, atualize para a versão mais recente e fale conosco pelo chat do app."
      : undefined,
  }));
  return { app, reviews: enrichReviews(reviews, now) as ReviewEntry[], collectedAt: now };
}

/** Carrega o dataset demo (idempotente — não duplica se já existe). */
export function loadDemoDataset(): void {
  if (hasDemoDataset()) return;
  upsertDataset(buildDemoEntry());
}

/** Remove o dataset demo (opt-out). */
export function removeDemoDataset(): void {
  removeDataset(DEMO_STORE, DEMO_APP_ID);
}
