import { useState } from "react";
import { ChevronDown, FilePlus, Trash2, Copy, Upload } from "lucide-react";
import { useDesignStore } from "@/lib/designCanvas/store";

/**
 * Compact page switcher for the Design Canvas header. Lists all structured
 * pages, lets the user pick the active one, create/duplicate/delete, and
 * publish a new version (archiving the current root in history).
 */
export function PageSwitcher() {
  const pages = useDesignStore((s) => s.pages);
  const activePageId = useDesignStore((s) => s.activePageId);
  const setActivePage = useDesignStore((s) => s.setActivePage);
  const createPage = useDesignStore((s) => s.createPage);
  const duplicatePage = useDesignStore((s) => s.duplicatePage);
  const removePage = useDesignStore((s) => s.removePage);
  const renamePage = useDesignStore((s) => s.renamePage);
  const publishPageVersion = useDesignStore((s) => s.publishPageVersion);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const active = pages.find((p) => p.id === activePageId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] bg-secondary/60 hover:bg-secondary max-w-[160px]"
      >
        <span className="truncate">{active?.name ?? "Sem página"}</span>
        {active && <span className="text-[9px] text-muted-foreground">v{active.version}</span>}
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 rounded-lg border border-border/60 bg-card shadow-xl z-40 p-1.5" role="menu">
          <div className="max-h-56 overflow-y-auto">
            {pages.length === 0 && <div className="text-[11px] text-muted-foreground px-2 py-1.5">Nenhuma página ainda.</div>}
            {pages.map((p) => (
              <div key={p.id} className={`flex items-center gap-1 rounded-md px-1.5 py-1 ${p.id === activePageId ? "bg-primary/10" : "hover:bg-secondary/70"}`}>
                {renaming === p.id ? (
                  <input
                    autoFocus value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={() => { renamePage(p.id, renameVal.trim() || p.name); setRenaming(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { renamePage(p.id, renameVal.trim() || p.name); setRenaming(null); } }}
                    className="flex-1 text-[11px] bg-background border border-border rounded px-1 py-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
                  />
                ) : (
                  <button onClick={() => { setActivePage(p.id); setOpen(false); }} className="flex-1 text-left text-[11px] truncate">
                    {p.name} <span className="text-muted-foreground/70">v{p.version}</span>
                  </button>
                )}
                <button onClick={() => { setRenaming(p.id); setRenameVal(p.name); }} title="Renomear" className="p-0.5 text-muted-foreground hover:text-primary"><Copy className="h-3 w-3" /></button>
                <button onClick={() => duplicatePage(p.id)} title="Duplicar" className="p-0.5 text-muted-foreground hover:text-primary"><Upload className="h-3 w-3" /></button>
                <button onClick={() => { if (confirm(`Excluir página "${p.name}"?`)) removePage(p.id); }} title="Excluir" className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
          <div className="border-t border-border/50 mt-1 pt-1 flex gap-1">
            <button onClick={() => { createPage(); setOpen(false); }} className="flex-1 flex items-center justify-center gap-1 text-[11px] px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20">
              <FilePlus className="h-3 w-3" /> Nova
            </button>
            {active && (
              <button onClick={() => { publishPageVersion(active.id); }} title="Publicar nova versão" className="flex-1 text-[11px] px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80">
                Publicar v{active.version + 1}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
