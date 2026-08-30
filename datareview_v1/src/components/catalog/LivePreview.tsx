/**
 * LivePreview — previews ao vivo (dados reais do sistema) dos componentes
 * padronizados, compartilhado entre a coluna central do `/componentes` e a
 * aba "Componente" da sidebar direita. Módulo separado da página para
 * evitar import circular (página ↔ sidebars).
 */
import { Boxes, Layers } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { QuickCollect } from "@/components/shared/QuickCollect";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { SidebarTabStrip } from "@/components/shared/SidebarTabStrip";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";

export const PREVIEWABLE = new Set([
  "components/shared/EmptyState.tsx",
  "components/shared/QuickCollect.tsx",
  "components/shared/CopyDownloadButtons.tsx",
  "components/shared/SidebarTabStrip.tsx",
  "components/shared/ExpandableBlock.tsx",
]);

export function LivePreview({ file }: { file: string }) {
  if (file === "components/shared/EmptyState.tsx") {
    return <EmptyState icon={Boxes} title="Estado vazio" description="Exemplo do padrão EmptyState usado em todo o sistema." />;
  }
  if (file === "components/shared/QuickCollect.tsx") {
    return <div className="max-w-xl"><QuickCollect /></div>;
  }
  if (file === "components/shared/CopyDownloadButtons.tsx") {
    return <CopyDownloadButtons content="# Exemplo\n\nConteúdo de demonstração." filename="demo" compact={false} />;
  }
  if (file === "components/shared/SidebarTabStrip.tsx") {
    return (
      <SidebarTabStrip
        ariaLabel="Exemplo de abas"
        tabs={[
          { id: "a", label: "Aba A", icon: <Boxes className="h-3.5 w-3.5" /> },
          { id: "b", label: "Aba B", icon: <Layers className="h-3.5 w-3.5" />, badge: 3 },
        ]}
        active="a"
        onChange={() => {}}
      />
    );
  }
  if (file === "components/shared/ExpandableBlock.tsx") {
    return (
      <ExpandableBlock title="Bloco expansível" storageKey="catalog-demo">
        <p className="text-sm text-muted-foreground">Conteúdo de demonstração com 3 níveis de expansão.</p>
      </ExpandableBlock>
    );
  }
  return null;
}
