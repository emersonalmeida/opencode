/**
 * CustomPageView (`/p/:id`) — renderiza uma página customizada criada no
 * construtor `/layouts` como uma página REAL do sistema: tela funcional em
 * tela cheia (modo "sistema"), sem o chrome do construtor.
 *
 * Ajustes ao vivo (recolher coluna/bloco, nível de expansão, altura) são
 * persistidos de volta na página customizada.
 */
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PencilRuler, LayoutTemplate } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { LayoutSpecView } from "@/components/layoutBuilder/LayoutSpecView";
import {
  getCustomPage, updateCustomPageSpec, useCustomPages,
} from "@/lib/customPages";
import type { LayoutSpec } from "@/lib/layoutTemplates";
import { setDocumentTitle } from "@/lib/ux";

export default function CustomPageView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useCustomPages(); // re-render ao editar
  const page = id ? getCustomPage(id) : undefined;

  useEffect(() => {
    if (page) setDocumentTitle(page.name);
  }, [page]);

  if (!page) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Página não encontrada" backTo="/layouts" />
        <main id="content" className="content-fluid py-8">
          <EmptyState
            icon={LayoutTemplate}
            title="Página customizada não encontrada"
            description="Ela pode ter sido excluída. Crie uma nova no construtor de Layouts."
            action={
              <button
                onClick={() => navigate("/layouts")}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Abrir Layouts
              </button>
            }
          />
        </main>
      </div>
    );
  }

  const onSpecChange = (spec: LayoutSpec) => updateCustomPageSpec(page.id, spec);

  return (
    <div className="flex h-screen flex-col">
      <AppHeader
        title={page.name}
        crumb="Página customizada"
        extraMenu={
          <Link
            to={`/layouts?page=${page.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
            title="Editar esta página no construtor de Layouts"
          >
            <PencilRuler className="h-3.5 w-3.5" /> Editar
          </Link>
        }
      />
      <main id="content" className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
        <ErrorBoundary title={`Erro ao renderizar a página ${page.name}`}>
          <LayoutSpecView spec={page.spec} mode="preview" onSpecChange={onSpecChange} fillHeight />
        </ErrorBoundary>
      </main>
    </div>
  );
}
