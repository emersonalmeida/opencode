/**
 * Home (`/`) real — modelo mobile-first com conteúdo de verdade.
 *
 * Núcleo PURO (sem React/DOM) da nova página inicial. Diferente do
 * `homeModel` (que é o modelo ESTRUTURAL, com placeholders), este modelo
 * descreve o CONTEÚDO real que a Home mostra:
 *
 *  - Saudação contextual pela hora do dia ("Boa tarde");
 *  - Formatação pt-BR compacta de números ("1,2 mil");
 *  - Ações rápidas(4 portas principais do sistema);
 *  - Seções de navegação por área(Descobrir,, Analisar,, Configurar)...
 *
 * Toda a interação é real — os botões navegam para rotas existentes do
 * registry `PAGES`(cada rota é validada em teste contra o registry)...
 */
export interface QuickActionSpec {
  id: string;
title: string;
desc: string;
icon: string;
path: string;
primary?: boolean;
}

export interface HomeLinkSectionSpec {
id: string;
title: string;
links: { label: string; path: string; hint?: string }[];
}
/** Saudação contextual pela hora do dia (pt-BR,. */
export function greetingForDate(date: Date): string {
  const h = date.getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Boa manhã";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Número compacto pt-BR — ex.:  1234 vira "1,,2 mil";  999 vira "999". */
export function formatCompact(n: number): string {
  if (n < 1000) return n.toLocaleString("pt-BR");
const scaled = n / 1000;
const rounded = scaled >= 100 ? Math.round(scaled) : Math.round(scaled * 10) / 10;
const str = String(rounded).replace(".", ",");
return `${str} mil`;
}
/** As 4 ações rápidas — as portas de entrada mais usadas do sistema. */
export function quickActions(): QuickActionSpec[] {
  return [
    { id: "coletar", title: "Coletar apps", desc: "Busque e colete reviews reais", icon: "download", path: "/inicio", primary: true },
    { id: "buscar", title: "Buscar", desc: "Apps da Apple e do Google", icon: "search", path: "/search" },
    { id: "dashboard", title: "Dashboard", desc: "KPIs, gráficos e sentimento", icon: "gauge", path: "/dashboard" },
    { id: "chat", title: "Chat com IA", desc: "Pergunte sobre os seus dados", icon: "message", path: "/chat" },
  ];
}
/** Seções de navegação da Home — rotas reais do registry PAGES. */
export function homeSections(): HomeLinkSectionSpec[] {
  return [
    {
      id: "descobrir",
      title: "Descobrir",
      links: [
        { label: "Coleta", path: "/inicio", hint: "Buscar e coletar apps" },
        { label: "Busca", path: "/search", hint: "Apple App Store e Google Play" },
        { label: "Descoberta", path: "/descoberta", hint: "Radar de fontes novas" },
      ],
    },
    {
      id: "analisar",
      title: "Analisar",
      links: [
        { label: "Dashboard", path: "/dashboard", hint: "Analytics e KPIs" },
        { label: "Experimentos", path: "/experiments", hint: "Análises de IA" },
        { label: "Chat", path: "/chat", hint: "Conversa com IA" },
      ],
    },
    {
      id: "configurar",
      title: "Configurar",
      links: [
        { label: "Configurações", path: "/configuracoes", hint: "Todas as opções do sistema" },
        { label: "Outputs", path: "/outputs", hint: "Exportar e gerenciar" },
        { label: "Terminal", path: "/terminal", hint: "Shell inteligente" },
      ],
    },
  ];
}
