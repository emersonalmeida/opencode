/**
 * Definição das seções da página de Experimentos.
 * Cada seção tem um id (que bate com o SECTION_META do servidor), ícone,
 * título, descrição e tipo (data = apenas exibe dados coletados; ai = gera via IA).
 */
import {
  Database, FolderTree, BarChart3, MessageSquareText, Bug, Megaphone,
  Lightbulb, Target, ScrollText, Crosshair, Briefcase, TrendingUp, FileText,
  type LucideIcon,
} from "lucide-react";

export type SectionKind = "data" | "ai";

export interface SectionDef {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
  kind: SectionKind;
}

export const EXPERIMENT_SECTIONS: SectionDef[] = [
  { id: "data", label: "Dados coletados", icon: Database, description: "Relatório completo de todos os dados coletados de todos os apps de todas as lojas.", kind: "data" },
  { id: "organize", label: "Organizar dados", icon: FolderTree, description: "Estrutura e organiza os dados por app, categoria e tema.", kind: "ai" },
  { id: "quantitative", label: "Padrões quantitativos", icon: BarChart3, description: "Distribuição de notas, frequências, correlações e métricas mensuráveis.", kind: "ai" },
  { id: "qualitative", label: "Padrões qualitativos", icon: MessageSquareText, description: "Temas recorrentes, sentimento e narrativas dos usuários.", kind: "ai" },
  { id: "problems", label: "Problemas", icon: Bug, description: "Bugs, crashes, UX, performance — agrupados por categoria com frequência e severidade.", kind: "ai" },
  { id: "requests", label: "Solicitações", icon: Megaphone, description: "Pedidos de funcionalidades feitos pelos usuários, ordenados por recorrência.", kind: "ai" },
  { id: "suggestions", label: "Sugestões", icon: Lightbulb, description: "Sugestões de melhoria implícitas e explícitas com impacto esperado.", kind: "ai" },
  { id: "opportunities", label: "Oportunidades", icon: Target, description: "Oportunidades de produto e negócio priorizadas por impacto x esforço.", kind: "ai" },
  { id: "evidence", label: "Evidências", icon: ScrollText, description: "Catálogo de citações reais organizado por tema — a base de provas.", kind: "ai" },
  { id: "strategy", label: "Estratégias", icon: Crosshair, description: "Estratégias de produto e mercado fundamentadas em evidência.", kind: "ai" },
  { id: "business", label: "Negócios", icon: Briefcase, description: "Modelo de monetização, churn, disposição a pagar e oportunidades de receita.", kind: "ai" },
  { id: "roi", label: "ROI", icon: TrendingUp, description: "ROI potencial das iniciativas com tabela de priorização.", kind: "ai" },
  { id: "summary", label: "Resumo", icon: FileText, description: "Resumo executivo consolidando todas as análises.", kind: "ai" },
];
