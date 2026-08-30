/**
 * SessionsPanel — histórico unificado de tudo que foi coletado e gerado.
 *
 * Mostra duas seções:
 *  1. **Gerações**: log de todas as coletas + análises de IA (atlas, canvas,
 *     chat). Cada item mostra tipo, título, resumo, data e (para IA) permite
 *     ver o markdown completo. Tudo persistido — nada se perde.
 *  2. **Snapshots do canvas**: sessões salvas do canvas (nodes/edges/outputs).
 *     Salvar a sessão atual, restaurar (carrega o grafo + outputs de volta),
 *     renomear, excluir.
 *
 * Princípio: "tudo que o usuário fizer e gerar será salvo em sessões com
 * históricos, de forma inteligente" — sem precisar recarregar nem refazer.
 */
import { useMemo, useState } from "react";
import {
  History, Sparkles, MessageSquare, Database, Workflow,
  Save, RotateCcw, Trash2, Pencil, Check, X, FileText, Search, Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { shareGeneration } from "@/lib/share";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import {
  useGenerations, useSnapshots,
} from "@/hooks/useSessions";
import {
  deleteGeneration,
  saveCanvasSnapshot, deleteSnapshot, renameSnapshot, getSnapshot,
  type GenerationType,
} from "@/lib/sessionStore";
import { useCanvasStore } from "@/lib/canvasStore";

const TYPE_META: Record<GenerationType, { icon: typeof Database; label: string; color: string }> = {
  collect: { icon: Database, label: "Coleta", color: "text-sky-500" },
  "atlas-run": { icon: Sparkles, label: "Atlas", color: "text-fuchsia-500" },
  "canvas-run": { icon: Workflow, label: "Canvas", color: "text-emerald-500" },
  chat: { icon: MessageSquare, label: "Chat", color: "text-indigo-500" },
  "ai-section": { icon: Sparkles, label: "IA", color: "text-amber-500" },
};

function fmtDate(ts: number): string {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `hoje ${time}`;
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `ontem ${time}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + ` ${time}`;
}

/** Componente reutilizável — pode ser embutido no Canvas ou em uma página. */
export function SessionsPanel({ embedded = false }: { embedded?: boolean }) {
  const generations = useGenerations();
  const snapshots = useSnapshots();
  const { nodes, edges, output, status, loadGraph } = useCanvasStore();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<GenerationType | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingSnap, setEditingSnap] = useState<string | null>(null);
  const [snapTitle, setSnapTitle] = useState("");

  const filteredGen = useMemo(() => {
    const q = query.trim().toLowerCase();
    return generations.filter((g) => {
      if (typeFilter !== "all" && g.type !== typeFilter) return false;
      if (q && !g.title.toLowerCase().includes(q) && !(g.summary ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [generations, query, typeFilter]);

  const hasCanvas = nodes.length > 0;

  const saveSnapshot = () => {
    const title = snapTitle.trim() || `Sessão ${new Date().toLocaleString("pt-BR")}`;
    saveCanvasSnapshot(title, nodes, edges, output, status);
    setEditingSnap(null);
    setSnapTitle("");
  };

  const restoreSnapshot = (id: string) => {
    const snap = getSnapshot(id);
    if (!snap) return;
    // loadGraph loads nodes/edges; restore outputs+status into the store so
    // the rendered results come back too.
    loadGraph(snap.nodes, snap.edges);
    useCanvasStore.setState({ output: snap.outputs ?? {}, status: (snap.status ?? {}) as Record<string, "idle" | "running" | "done" | "error"> });
  };

  return (
    <div className={cn("flex flex-col h-full text-xs", embedded ? "" : "p-3")}>
      {!embedded && (
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Sessões</h2>
          <span className="text-[10px] text-muted-foreground">{generations.length} gerações · {snapshots.length} snapshots</span>
        </div>
      )}

      {/* Canvas snapshot save */}
      <div className="rounded-md border border-border/60 bg-card/40 p-2 mb-2">
        {editingSnap ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={snapTitle}
              onChange={(e) => setSnapTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveSnapshot(); if (e.key === "Escape") setEditingSnap(null); }}
              placeholder="Nome da sessão…"
              className="flex-1 text-xs px-2 py-1 rounded border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button onClick={saveSnapshot} className="p-1 rounded hover:bg-secondary text-emerald-500" aria-label="Salvar"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => setEditingSnap(null)} className="p-1 rounded hover:bg-secondary text-muted-foreground" aria-label="Cancelar"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button
            onClick={() => { setEditingSnap("new"); setSnapTitle(""); }}
            disabled={!hasCanvas}
            className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] font-medium px-2 py-1.5 rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 transition-colors"
          >
            <Save className="h-3.5 w-3.5" /> Salvar sessão do canvas atual
          </button>
        )}
        {!hasCanvas && <p className="text-[10px] text-muted-foreground mt-1 text-center">Canvas vazio — adicione nós para salvar.</p>}
      </div>

      {/* Saved snapshots */}
      {snapshots.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1 px-1">Snapshots salvos</p>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {snapshots.map((s) => (
              <div key={s.id} className="rounded-md border border-border/60 bg-card/40 p-2">
                {editingSnap === s.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={snapTitle}
                      onChange={(e) => setSnapTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { renameSnapshot(s.id, snapTitle || s.title); setEditingSnap(null); } if (e.key === "Escape") setEditingSnap(null); }}
                      className="flex-1 text-xs px-2 py-1 rounded border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button onClick={() => { renameSnapshot(s.id, snapTitle || s.title); setEditingSnap(null); }} className="p-1 rounded hover:bg-secondary text-emerald-500" aria-label="Confirmar"><Check className="h-3 w-3" /></button>
                    <button onClick={() => setEditingSnap(null)} className="p-1 rounded hover:bg-secondary text-muted-foreground" aria-label="Cancelar"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5">
                      <Workflow className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium truncate flex-1">{s.title}</span>
                    </div>
                    <div className="flex items-center gap-0.5 mt-1">
                      <span className="text-[10px] text-muted-foreground mr-auto">{s.nodes.length} nós · {fmtDate(s.createdAt)}</span>
                      <button onClick={() => restoreSnapshot(s.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-primary" title="Restaurar" aria-label="Restaurar snapshot"><RotateCcw className="h-3 w-3" /></button>
                      <button onClick={() => { setEditingSnap(s.id); setSnapTitle(s.title); }} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground" title="Renomear" aria-label="Renomear snapshot"><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => deleteSnapshot(s.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" title="Excluir" aria-label="Excluir snapshot"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation log search + filter */}
      <div className="flex items-center gap-1 mb-1.5">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar no histórico…"
            className="w-full pl-6 pr-2 py-1 text-xs rounded-md border border-border/60 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Buscar no histórico"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as GenerationType | "all")}
          className="text-[10px] px-1 py-1 rounded-md border border-border/60 bg-background"
          aria-label="Filtrar por tipo"
        >
          <option value="all">Todos</option>
          <option value="collect">Coletas</option>
          <option value="atlas-run">Atlas</option>
          <option value="canvas-run">Canvas</option>
          <option value="chat">Chat</option>
          <option value="ai-section">IA</option>
        </select>
      </div>

      {/* Generation log */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {filteredGen.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-8 gap-2">
            <History className="h-6 w-6 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground max-w-[220px]">
              {generations.length === 0
                ? "Nenhuma geração ainda. Colete apps ou rode análises — tudo aparece aqui, salvo e pesquisável."
                : "Nenhuma geração corresponde ao filtro."}
            </p>
          </div>
        ) : (
          filteredGen.map((g) => {
            const meta = TYPE_META[g.type];
            const Icon = meta.icon;
            const isOpen = expanded === g.id;
            const hasMd = !!g.markdown;
            return (
              <div key={g.id} className="rounded-md border border-border/60 bg-card/40">
                <button
                  onClick={() => hasMd && setExpanded(isOpen ? null : g.id)}
                  className={cn("w-full flex items-center gap-1.5 p-2 text-left", hasMd && "hover:bg-secondary/50")}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", meta.color)} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{g.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {g.summary ?? meta.label} · {fmtDate(g.createdAt)}
                    </p>
                  </div>
                  {hasMd && <FileText className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform", isOpen && "rotate-90")} />}
                  <button
                    onClick={(e) => { e.stopPropagation(); shareGeneration(g.id); }}
                    className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary shrink-0"
                    aria-label="Compartilhar (baixar JSON importável)"
                    title="Compartilhar (baixar JSON importável)"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteGeneration(g.id); }}
                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="Excluir geração"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </button>
                {isOpen && hasMd && g.markdown && (
                  <div className="px-2 pb-2 border-t border-border/40 pt-2 relative">
                    <AIOutputCard bare content={g.markdown} filename={`sessao-${g.id}`} storageKey={`sessao-${g.id}`} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
