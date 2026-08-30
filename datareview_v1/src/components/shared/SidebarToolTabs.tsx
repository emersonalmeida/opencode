/**
 * SidebarToolTabs — envolve o CONTEÚDO de ferramenta de uma sidebar interna
 * com a aba "Como funciona" como PRIMEIRA aba (ativa por padrão).
 *
 * Padrão de TODAS as sidebars internas direitas: o usuário primeiro entende
 * o que a página faz ("Como funciona") e depois usa as ferramentas. Usa a
 * strip compartilhada `SidebarTabStrip` (mesmo visual das externas).
 *
 * Uso:
 *   <PageSidebar meta={…}>
 *     <SidebarToolTabs help={{description, tips}} toolLabel="Copiloto" toolIcon={…}>
 *       <CopilotSidebar />
 *     </SidebarToolTabs>
 *   </PageSidebar>
 */
import { useState, type ReactNode } from "react";
import { HelpCircle, Wrench } from "lucide-react";
import { SidebarTabStrip } from "@/components/shared/SidebarTabStrip";
import { HelpPanel } from "@/components/pageSidebars/kit";

interface Props {
  help: { description: string; tips?: string[] };
  /** label da aba de ferramenta (ex.: "Copiloto", "Inspector"). */
  toolLabel: string;
  toolIcon?: ReactNode;
  children: ReactNode;
}

export function SidebarToolTabs({ help, toolLabel, toolIcon, children }: Props) {
  const [active, setActive] = useState<"help" | "tool">("help");
  const tabs = [
    { id: "help", label: "Como funciona", icon: <HelpCircle className="h-3 w-3" /> },
    { id: "tool", label: toolLabel, icon: toolIcon ?? <Wrench className="h-3 w-3" /> },
  ];
  return (
    <div className="flex flex-col h-full min-h-0">
      <SidebarTabStrip
        tabs={tabs}
        active={active}
        onChange={(id) => setActive(id as "help" | "tool")}
        ariaLabel="Ajuda e ferramentas"
      />
      <div role="tabpanel" hidden={active !== "help"} className="min-h-0 min-w-0 overflow-y-auto flex-1">
        <HelpPanel description={help.description} tips={help.tips} />
      </div>
      <div role="tabpanel" hidden={active !== "tool"} className="min-h-0 min-w-0 overflow-y-auto flex-1">
        {children}
      </div>
    </div>
  );
}
