import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ChevronDown, ChevronRight, FolderOpen, Folder, Layers, Pencil, Plus,
  Trash2, Check, Search, PanelTop, Archive,
} from "lucide-react";
import {
  usePageGroups, groupPages, toggleGroupCollapsed, deleteGroup,
  createGroup, renameGroup, setGroupPaths, BACKUP_GROUP_ID,
  topLevelPages,
  type PageGroup,
} from "@/lib/pageGroups";
import { PageMenuLink } from "@/components/PageMenuLink";
import { useCustomPages, createCustomPage, deleteCustomPage } from "@/lib/customPages";
import { toastDestructive, confirmDestructive } from "@/lib/ux";
import { PAGES, type PageItem } from "@/lib/pages";
import { useFeatureFlags, isFeatureEnabled, pagePathToFlag } from "@/lib/featureFlags";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface PageGroupsNavProps {
  isActive: (path: string) => boolean;
}

/**
 * Menu de páginas em grupos ("workspaces") — cada grupo é uma seção
 * expansível/recolhível com suas páginas. O grupo builtin "Todas" lista todo
 * o registry; grupos custom são criados/editados/excluídos pelo usuário.
 * Além de grupos, o usuário cria PÁGINAS próprias (com os componentes do
 * sistema, via construtor de Layouts) — elas viram rotas reais (`/p/:id`).
 */
export function PageGroupsNav({ isActive }: PageGroupsNavProps) {
  const groups = usePageGroups();
  const customPages = useCustomPages();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PageGroup | null>(null);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newPageName, setNewPageName] = useState("");
  const navigate = useNavigate();

  const createPage = () => {
    const page = createCustomPage(newPageName);
    setNewPageOpen(false);
    setNewPageName("");
    navigate(`/layouts?page=${page.id}`);
  };

  const topLevel = topLevelPages();

  return (
    <div className="space-y-1">
      {/* Páginas de NÍVEL TOPO (ex.: a página inicial UI) — fora de grupos,
          sempre visíveis no topo do menu. */}
      {topLevel.map((p) => (
        <PageMenuLink key={p.path} page={p} active={isActive(p.path)} />
      ))}
      {topLevel.length > 0 && <div className="mx-1 my-1 h-px bg-border/40" aria-hidden="true" />}

      {groups.map((g) => (
        <GroupSection
          key={g.id}
          group={g}
          isActive={isActive}
          onEdit={() => { setEditing(g); setEditorOpen(true); }}
        />
      ))}

      {/* Minhas páginas (customizadas, criadas no construtor de Layouts) */}
      <div>
        <p className="flex items-center gap-1.5 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <PanelTop className="h-3 w-3 shrink-0" /> Minhas páginas
          <span className="ml-auto text-[9px] font-normal normal-case">{customPages.length}</span>
        </p>
        <div className="space-y-0.5 ml-1.5 border-l border-border/40 pl-1.5">
          {customPages.length === 0 && (
            <p className="px-2 py-1 text-[10px] text-muted-foreground/70">
              Nenhuma ainda — crie com os componentes do sistema.
            </p>
          )}
          {customPages.map((p) => (
            <div key={p.id} className="group/page flex items-center gap-0.5">
              <NavLink
                to={`/p/${p.id}`}
                title={`Página customizada — ${p.spec.columns.length} coluna(s)`}
                className={({ isActive: active }) => `flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
              >
                <PanelTop className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{p.name}</span>
              </NavLink>
              <button
                onClick={() => {
                  if (!confirmDestructive(`Excluir a página "${p.name}"?`)) return;
                  deleteCustomPage(p.id);
                  toastDestructive(`Página "${p.name}" excluída.`, { onUndo: () => createCustomPage(p.name, p.spec) });
                }}
                aria-label={`Excluir página ${p.name}`}
                title="Excluir página"
                className="p-1 rounded-md text-muted-foreground/0 group-hover/page:text-muted-foreground hover:!text-destructive hover:bg-destructive/10 transition-colors focus-visible:text-muted-foreground"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setNewPageOpen(true)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-dashed border-border/60"
        aria-label="Criar nova página customizada"
        title="Cria uma página sua com os componentes do sistema (vira rota /p/:id)"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Nova página</span>
      </button>

      <button
        onClick={() => { setEditing(null); setEditorOpen(true); }}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-dashed border-border/60"
        aria-label="Criar novo grupo de páginas"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Novo grupo</span>
      </button>

      <PageGroupDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        group={editing}
      />

      {/* Diálogo: nova página customizada */}
      <Dialog open={newPageOpen} onOpenChange={setNewPageOpen}>
        <DialogContent className="max-w-sm" aria-label="Nova página customizada">
          <DialogHeader>
            <DialogTitle>Nova página</DialogTitle>
            <DialogDescription>
              Cria uma página sua — monte-a no construtor de Layouts com os
              componentes reais do sistema (dados, gráficos, IA, pipelines…).
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); createPage(); }}
            className="space-y-3"
          >
            <input
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              placeholder="Nome da página (ex.: Monitor de reviews)"
              aria-label="Nome da nova página"
              autoFocus
              className="w-full rounded-lg border border-border/60 bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewPageOpen(false)}
                className="rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
              >
                Criar e montar
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GroupSection({
  group, isActive, onEdit,
}: {
  group: PageGroup;
  isActive: (path: string) => boolean;
  onEdit: () => void;
}) {
  useFeatureFlags(); // re-render quando flags mudam (poda páginas desligadas)
  const pages = groupPages(group);
  const [menuOpen, setMenuOpen] = useState(false);
  const FolderIcon = group.collapsed ? Folder : FolderOpen;

  return (
    <div>
      <div className="group flex items-center gap-0.5">
        <button
          onClick={() => toggleGroupCollapsed(group.id)}
          aria-expanded={!group.collapsed}
          aria-label={`${group.collapsed ? "Expandir" : "Recolher"} grupo ${group.label}`}
          className="flex-1 min-w-0 flex items-center gap-1.5 px-1.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          {group.collapsed
            ? <ChevronRight className="h-3 w-3 shrink-0" />
            : <ChevronDown className="h-3 w-3 shrink-0" />}
          {group.builtin
            ? (group.id === BACKUP_GROUP_ID
              ? <Archive className="h-3 w-3 shrink-0" />
              : <Layers className="h-3 w-3 shrink-0" />)
            : <FolderIcon className="h-3 w-3 shrink-0" />}
          <span className="truncate">{group.label}</span>
          <span className="ml-auto text-[9px] font-normal normal-case">{pages.length}</span>
        </button>
        {!group.builtin && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={`Opções do grupo ${group.label}`}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="p-1 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground hover:!text-foreground hover:bg-secondary transition-colors focus-visible:text-muted-foreground"
            >
              <Pencil className="h-3 w-3" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-border bg-popover p-1 shadow-md">
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); onEdit(); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs hover:bg-secondary"
                  >
                    <Pencil className="h-3 w-3" /> Editar grupo
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      if (window.confirm(`Excluir o grupo "${group.label}"? As páginas continuam disponíveis em "Todas".`)) {
                        deleteGroup(group.id);
                      }
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3 w-3" /> Excluir grupo
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!group.collapsed && (
        <div className="space-y-0.5 ml-1.5 border-l border-border/40 pl-1.5">
          {pages.length === 0 && (
            <p className="px-2 py-1 text-[10px] text-muted-foreground/70">
              Grupo vazio — use "Editar grupo" para escolher páginas.
            </p>
          )}
          {pages.map((p) => (
            <PageNavLink key={p.path} page={p} active={isActive(p.path)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PageNavLink({ page, active }: { page: PageItem; active: boolean }) {
  return <PageMenuLink page={page} active={active} />;
}

/** Diálogo de criar/editar grupo: nome + seleção de páginas do registry. */
function PageGroupDialog({
  open, onOpenChange, group,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: PageGroup | null; // null = criar novo
}) {
  const flags = useFeatureFlags(); // re-render + recompute quando flags mudam
  void flags;
  const enabledPages = PAGES.filter((p) => { const fk = pagePathToFlag(p.path); return !fk || isFeatureEnabled(fk); });
  const [label, setLabel] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [lastOpen, setLastOpen] = useState(false);

  // Hidrata o formulário ao abrir (criar = vazio; editar = estado do grupo).
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setLabel(group?.label ?? "");
      setSelected(new Set(group?.paths ?? []));
      setQuery("");
    }
  }

  const filtered = query.trim()
    ? enabledPages.filter((p) =>
        p.label.toLowerCase().includes(query.toLowerCase()) ||
        p.path.toLowerCase().includes(query.toLowerCase()))
    : enabledPages;

  const togglePath = (path: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  };

  const save = () => {
    if (!label.trim()) return;
    if (group) {
      renameGroup(group.id, label);
      setGroupPaths(group.id, [...selected]);
    } else {
      createGroup(label, [...selected]);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-label={group ? "Editar grupo de páginas" : "Novo grupo de páginas"}>
        <DialogHeader>
          <DialogTitle>{group ? `Editar grupo "${group.label}"` : "Novo grupo de páginas"}</DialogTitle>
          <DialogDescription>
            Grupos são workspaces do menu: escolha um nome e as páginas que aparecem nele.
            Uma página pode estar em vários grupos; "Todas" sempre lista tudo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label htmlFor="pg-name" className="text-[11px] font-medium text-muted-foreground">Nome do grupo</label>
            <input
              id="pg-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex.: Trabalho, Pesquisa, IA…"
              maxLength={28}
              autoFocus
              className="mt-1 w-full px-2.5 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground">
                Páginas ({selected.size} selecionadas)
              </label>
              <div className="flex gap-2 text-[10px]">
                <button onClick={() => setSelected(new Set(enabledPages.map((p) => p.path)))} className="text-primary hover:underline">Todas</button>
                <button onClick={() => setSelected(new Set())} className="text-muted-foreground hover:underline">Nenhuma</button>
              </div>
            </div>
            <div className="relative mt-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar páginas…"
                aria-label="Filtrar páginas"
                className="w-full pl-7 pr-2 py-1.5 rounded-md border border-border bg-background text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              />
            </div>
            <div role="group" aria-label="Páginas do grupo" className="mt-1.5 max-h-56 overflow-y-auto rounded-md border border-border/60 divide-y divide-border/40">
              {filtered.map((p) => {
                const Icon = p.icon;
                const checked = selected.has(p.path);
                return (
                  <button
                    key={p.path}
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => togglePath(p.path)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors ${checked ? "bg-primary/5 text-foreground" : "text-muted-foreground hover:bg-secondary/60"}`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0 ${checked ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                      {checked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{p.label}</span>
                    <span className="ml-auto text-[9px] text-muted-foreground/60 truncate">{p.path}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma página corresponde ao filtro.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={!label.trim()}
              className="px-3 py-1.5 rounded-md text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {group ? "Salvar" : "Criar grupo"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
