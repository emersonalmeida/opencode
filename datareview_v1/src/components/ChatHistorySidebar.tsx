import { useState } from "react";
import {
  Plus, MessageSquare, Trash2, Pencil, Check, X, History, Download,
} from "lucide-react";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useDestructiveAction } from "@/hooks/useUx";
import { shareChatSession } from "@/lib/share";
import {
  renameSession, deleteSession, restoreSessions, getSession, listSessions,
} from "@/lib/chatHistoryStore";
import type { ChatSession } from "@/lib/chatHistoryStore";

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return "agora";
  if (diff < hr) return `${Math.floor(diff / min)}min atrás`;
  if (diff < day) return `${Math.floor(diff / hr)}h atrás`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d atrás`;
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function ChatHistorySidebar({
  activeId,
  onNew,
  onSelect,
  onClose,
  embedded = false,
}: {
  activeId: string | null;
  onNew: () => void;
  onSelect: (s: ChatSession) => void;
  onClose?: () => void;
  /** When true, the component is rendered inside a tabbed sidebar and omits its
   *  own header (the tab strip already labels it). */
  embedded?: boolean;
}) {
  const sessions = useChatHistory();
  const destroy = useDestructiveAction();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [originFilter, setOriginFilter] = useState<"all" | "chat" | "files" | "voice">("all");
  const filtered = sessions.filter((s) => originFilter === "all" || (s.origin ?? "chat") === originFilter);
  const origins = new Set(sessions.map((s) => s.origin ?? "chat"));

  const startEdit = (s: ChatSession) => {
    setEditingId(s.id);
    setEditText(s.title);
  };
  const commitEdit = () => {
    if (editingId) renameSession(editingId, editText);
    setEditingId(null);
  };

  return (
    <div className="h-full flex flex-col bg-card">
      {!embedded && (
        <div className="p-3 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Histórico</h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Recolher histórico"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="p-2">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 text-sm px-3 py-2 rounded-lg border border-border/60 bg-background hover:bg-primary/5 hover:border-primary/40 transition-colors"
        >
          <Plus className="h-4 w-4 text-primary" />
          <span className="font-medium">Nova conversa</span>
        </button>
      </div>

      {origins.size > 1 && (
        <div className="px-2 pb-1 flex flex-wrap gap-1" role="group" aria-label="Filtrar por origem">
          {(["all", "chat", "files", "voice"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setOriginFilter(o)}
              aria-pressed={originFilter === o}
              className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${originFilter === o ? "bg-primary/10 text-primary border-primary/30" : "border-border/50 text-muted-foreground hover:bg-secondary/60"}`}
            >
              {o === "all" ? "Todas" : o === "chat" ? "Chat" : o === "files" ? "Arquivos" : "Voz"}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {filtered.length === 0 && (
          <p className="text-[11px] text-muted-foreground text-center py-6 px-3">
            {sessions.length === 0
              ? "Nenhuma conversa salva ainda. As conversas aparecem aqui automaticamente."
              : "Nenhuma conversa desta origem."}
          </p>
        )}
        {filtered.map((s) => {
          const active = s.id === activeId;
          const editing = editingId === s.id;
          return (
            <div
              key={s.id}
              className={`group relative rounded-lg border transition-colors ${
                active
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/40 hover:bg-secondary/50"
              }`}
            >
              {editing ? (
                <div className="flex items-center gap-1 p-1.5">
                  <input
                    autoFocus
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitEdit();
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 min-w-0 text-xs px-2 py-1 rounded bg-background border border-border/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={commitEdit}
                    className="p-1 rounded text-muted-foreground hover:text-primary"
                    title="Salvar"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive"
                    title="Cancelar"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onSelect(s)}
                  className="w-full flex items-start gap-2 p-2 text-left"
                >
                  <MessageSquare className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${active ? "text-primary" : "text-foreground"}`}>
                      {s.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {fmtRelative(s.updatedAt)} · {s.messages.filter((m) => m.role === "user").length} msgs
                    </p>
                  </div>
                </button>
              )}

              {!editing && (
                <div className="absolute top-1 right-1 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); shareChatSession(s.id); }}
                    className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-secondary"
                    title="Compartilhar (baixar JSON importável)"
                  >
                    <Download className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                    className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-secondary"
                    title="Renomear"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      destroy({
                        confirm: "Excluir esta conversa?",
                        detail: `"${s.title}"${s.messages.length ? ` · ${s.messages.length} mensagens` : ""}`,
                        toast: "Conversa excluída",
                        action: () => {
                          const backup = getSession(s.id);
                          deleteSession(s.id);
                          return () => { if (backup) restoreSessions([backup]); };
                        },
                      });
                    }}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary"
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
