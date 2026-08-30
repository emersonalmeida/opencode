/**
 * UiCenter — o CENTRO da página UI (a "base" do criador de páginas).
 *
 * 3 abas centralizadas:
 *  - **Principal**: Canvas do builder (LayoutBuilder embedded) — add
 *    coluna/linha topo/rodapé, dividir, vincular componente (galeria),
 *    editar, presets, Visualizar (preview), Salvar template/página.
 *  - **Secundária**: Documentação UI do sistema (o que faz, como usar,
 *    arquitetura dos blocos/colunas, reutilização de componentes).
 *  - **Terciária**: Minhas páginas — lista as páginas customizadas
 *    salvas (customPages) com abrir/renomear/excluir.
 *
 * Sessões de scroll preservadas por aba (todas montadas, hidden inativas).
 */
import { useState } from "react";
import { PanelsTopLeft, BookOpen, FolderOpen, Trash2, Pencil, ExternalLink } from "lucide-react";
import LayoutBuilder from "@/pages/LayoutBuilder";
import { SidebarTabStrip, type SidebarTabDef } from "@/components/shared/SidebarTabStrip";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { useCustomPages, renameCustomPage, deleteCustomPage } from "@/lib/customPages";
import { toastDestructive, confirmDestructive } from "@/lib/ux";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** Documentação UI do sistema (estrutura do criador + reutilização). */
function UiDocsPanel() {
  return (
    <div className="p-3 space-y-3 max-w-3xl mx-auto">
      <ExpandableBlock storageKey="ui-docs/oque" title="O que é a página UI">
        <p className="text-xs text-muted-foreground leading-relaxed">
          A UI é a base de front-end do sistema: estrutura de layout pura
          (barras de status, toolbar, 5 colunas inteligentes, footer) +
          o criador de páginas. Tudo aqui é reutilizável por todo o
          sistema — o objetivo é padronizar componentes, colunas, blocos,
          abas, rails e menus.
        </p>
      </ExpandableBlock>
      <ExpandableBlock storageKey="ui-docs/builder" title="Criador de páginas (como usar)">
        <ol className="text-xs text-muted-foreground leading-relaxed list-decimal pl-4 space-y-1">
          <li>Na aba <strong>Principal</strong>, adicione colunas/linhas/divisões (toolbar do builder).</li>
          <li>Escolha um bloco e vincule um componente real pela galeria (grupos ou catálogo).</li>
          <li>Alterne para Visualizar para ver a tela funcional com dados de verdade.</li>
          <li>Salve como template (reaplicável) ou como <strong>página do sistema</strong> (rota /p/:id).</li>
          <li>As páginas salvas aparecem no grupo <strong>Minhas páginas</strong> do menu.</li>
        </ol>
      </ExpandableBlock>
      <ExpandableBlock storageKey="ui-docs/colunas" title="Colunas do shell (5 slots)">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Esquerda/Direita EXTERNAS e INTERNAS (internas em rail por padrão).
          Cada uma: 2 abas + blocos expansíveis, resize por drag/teclado,
          reset individual, auto-collapse quando falta espaço, overlays por
          clique nos ícones do rail (nunca expande a sidebar).
        </p>
      </ExpandableBlock>
      <ExpandableBlock storageKey="ui-docs/componentes" title="Reutilização de componentes">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Os blocos do builder aceitam componentes REAIS do catálogo
          (QuickCollect, gráficos, KPIs, chat IA, insights, atividade…).
          Organizados por origem (Grupos/Páginas/Catálogo) no seletor
          "Componente" de cada bloco.
        </p>
      </ExpandableBlock>
    </div>
  );
}

/** Lista das páginas customizadas salvas (grupo Minhas páginas). */
function UiMyPagesPanel() {
  const pages = useCustomPages();
  if (pages.length === 0) {
    return (
      <div className="p-6 text-center">
        <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground mt-2">
          Nenhuma página salva ainda. Use o criador na aba Principal e
          "Salvar como página" para publicar no menu.
        </p>
      </div>
    );
  }
  return (
    <div className="p-3 space-y-2" role="list" aria-label="Minhas páginas">
      {pages.map((page) => (
        <div key={page.id} role="listitem" className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2">
          <Link to={`/p/${page.id}`} className="min-w-0 flex-1 text-xs font-medium text-foreground truncate hover:text-primary">
            {page.name}
          </Link>
          <Link to={`/p/${page.id}`} aria-label={`Abrir ${page.name}`} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => renameCustomPage(page.id, prompt("Novo nome:", page.name) ?? page.name)}
            aria-label={`Renomear ${page.name}`}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              if (confirmDestructive("Excluir página")) deleteCustomPage(page.id);
              toastDestructive("Página excluída", { description: page.name });
            }}
            aria-label={`Excluir ${page.name}`}
            className="p-1 rounded-md text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

const CENTER_TABS: SidebarTabDef[] = [
  { id: "principal", label: "Principal", icon: <PanelsTopLeft className="h-3.5 w-3.5" /> },
  { id: "docs", label: "Documentação", icon: <BookOpen className="h-3.5 w-3.5" /> },
  { id: "paginas", label: "Minhas páginas", icon: <FolderOpen className="h-3.5 w-3.5" /> },
];

export function UiCenter() {
  const [active, setActive] = useState(CENTER_TABS[0].id);
  const panels: { id: string; panel: React.ReactNode }[] = [
    { id: "principal", panel: <LayoutBuilder embedded /> },
    { id: "docs", panel: <UiDocsPanel /> },
    { id: "paginas", panel: <UiMyPagesPanel /> },
  ];
  return (
    <main aria-label="Coluna central" className="flex-1 min-w-0 h-full flex flex-col overflow-hidden">
      <SidebarTabStrip tabs={CENTER_TABS} active={active} onChange={setActive} ariaLabel="Abas centrais" centered />
      {panels.map((p) => (
        <div
          key={p.id}
          hidden={active !== p.id}
          className={cn("flex-1 min-h-0 overflow-y-auto", p.id === "principal" && "overflow-hidden")}
        >
          {p.panel}
        </div>
      ))}
    </main>
  );
}
