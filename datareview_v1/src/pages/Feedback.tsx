/**
 * Feedback (/feedback) — o usuário ajuda a melhorar o PRÓPRIO sistema:
 * reporta bugs, sugere melhorias e propõe funcionalidades novas com
 * evidências (anexos de imagem/texto), título, descrição e contexto
 * automático (rota atual + modo de IA). Lista filtrável com votos e
 * workflow de status; export em Markdown (a ponte para a evolução).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Bug, Lightbulb, Sparkles, Send, Paperclip, X, Download, ThumbsUp,
  Trash2, MessageSquarePlus,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { useAISettings } from "@/lib/aiSettings";
import {
  addFeedback, listFeedback, updateFeedbackStatus, voteFeedback, deleteFeedback,
  clearFeedback, filterFeedback, feedbackToMarkdown, subscribeFeedback,
  FEEDBACK_KINDS, FEEDBACK_STATUS, ATTACHMENT_LIMIT,
  type FeedbackKind, type FeedbackStatus, type FeedbackItem, type FeedbackAttachment,
} from "@/lib/feedback";
import { downloadFile } from "@/lib/pageFeatures";
import { confirmDestructive, toastSuccess, toastError, toastDestructive } from "@/lib/ux";

import { cn } from "@/lib/utils";

const KIND_ICONS = { bug: Bug, improvement: Lightbulb, feature: Sparkles } as const;

function useFeedback(): FeedbackItem[] {
  const [items, setItems] = useState<FeedbackItem[]>(() => listFeedback());
  useEffect(() => subscribeFeedback(() => setItems(listFeedback())), []);
  return items;
}

export default function Feedback() {
  const location = useLocation();
  const ai = useAISettings();
  const items = useFeedback();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<FeedbackAttachment[]>([]);
  const [kindFilter, setKindFilter] = useState<FeedbackKind | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");

  const filtered = useMemo(() => filterFeedback(items, kindFilter, statusFilter), [items, kindFilter, statusFilter]);

  const readFiles = (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files).slice(0, 4)) {
      if (f.size > ATTACHMENT_LIMIT) {
        toastError(`"${f.name}" tem ${(f.size / 1024).toFixed(0)}KB — o limite é ${(ATTACHMENT_LIMIT / 1024).toFixed(0)}KB por arquivo.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments((prev) => [...prev, { name: f.name, mime: f.type || "application/octet-stream", dataUrl: String(reader.result ?? "") }]);
      };
      reader.readAsDataURL(f);
    }
  };

  const submit = () => {
    const t = title.trim();
    const d = description.trim();
    if (!t) { toastError("Dê um título ao seu feedback."); return; }
    if (!d) { toastError("Descreva o que aconteceu (quanto mais detalhes, mais útil)."); return; }
    addFeedback({
      kind, title: t, description: d,
      page: location.pathname,
      aiMode: ai.mode,
      attachments,
    });
    setTitle(""); setDescription(""); setAttachments([]);
    toastSuccess("Feedback registrado — obrigado por ajudar a melhorar o sistema!");
  };

  const exportAll = () => {
    downloadFile("feedback.md", feedbackToMarkdown(items), "text/markdown");
  };

  const wipe = () => {
    if (!confirmDestructive("Apagar TODO o feedback registrado?", `${items.length} itens serão removidos deste navegador.`)) return;
    const before = items;
    clearFeedback();
    toastDestructive("Feedback apagado.", { onUndo: () => before.forEach((f) => addFeedback(f)) });
  };

  return (
    <ErrorBoundary title="Erro ao renderizar o Feedback">
      <div className="flex h-full min-h-0 flex-col">
        <AppHeader title="Feedback" crumb={`${items.length} itens · reporte bugs, sugira melhorias, proponha features`} showSearch={false} />
        <main id="content" className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {/* Formulário */}
            <section aria-label="Enviar feedback" className="rounded-xl border border-border/60 bg-card/60 p-4 space-y-3">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <MessageSquarePlus className="h-4 w-4 text-primary" aria-hidden />
                Reporte um bug, sugira uma melhoria ou proponha uma funcionalidade
              </p>
              <div role="group" aria-label="Tipo de feedback" className="flex flex-wrap gap-1.5">
                {FEEDBACK_KINDS.map((k) => {
                  const Icon = KIND_ICONS[k.id];
                  return (
                    <button
                      key={k.id}
                      type="button"
                      onClick={() => setKind(k.id)}
                      aria-pressed={kind === k.id}
                      title={k.hint}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs",
                        kind === k.id ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden /> {k.label}
                    </button>
                  );
                })}
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título curto (ex.: chat corta na 4ª resposta)"
                aria-label="Título do feedback"
                className="h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva com detalhes: o que você esperava, o que aconteceu, como reproduzir…"
                aria-label="Descrição do feedback"
                rows={4}
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {/* Anexos (prints/evidências) */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
                >
                  <Paperclip className="h-3.5 w-3.5" aria-hidden /> Anexar evidência (imagem/texto ≤ {(ATTACHMENT_LIMIT / 1024).toFixed(0)}KB)
                </button>
                <input ref={fileRef} type="file" multiple accept="image/*,text/*,.md,.txt,.json,.log" className="hidden" onChange={(e) => readFiles(e.target.files)} />
                {attachments.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[10px]">
                    {a.mime.startsWith("image/") ? <img src={a.dataUrl} alt="" className="h-4 w-4 rounded object-cover" /> : <Paperclip className="h-3 w-3" />}
                    {a.name}
                    <button type="button" onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remover anexo ${a.name}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] text-muted-foreground">
                  Contexto automático anexado: página {location.pathname} · IA {ai.mode}.
                </p>
                <button
                  type="button"
                  onClick={submit}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  <Send className="h-4 w-4" aria-hidden /> Enviar feedback
                </button>
              </div>
            </section>

            {/* Lista */}
            <section aria-label="Feedback registrado" className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold">Feedback registrado · {filtered.length}</h2>
                <span className="flex-1" />
                {(["all", "bug", "improvement", "feature"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setKindFilter(k)}
                    aria-pressed={kindFilter === k}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px]",
                      kindFilter === k ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground",
                    )}
                  >
                    {k === "all" ? "Todos" : FEEDBACK_KINDS.find((x) => x.id === k)?.label}
                  </button>
                ))}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as FeedbackStatus | "all")}
                  aria-label="Filtrar por status"
                  className="h-7 rounded-md border border-border/60 bg-background px-2 text-[11px]"
                >
                  <option value="all">Todos os status</option>
                  {FEEDBACK_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <button type="button" onClick={exportAll} disabled={items.length === 0} title="Exportar em Markdown"
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[11px] text-muted-foreground hover:text-primary disabled:opacity-40">
                  <Download className="h-3 w-3" /> Exportar .md
                </button>
                <button type="button" onClick={wipe} disabled={items.length === 0} title="Limpar tudo"
                  className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-[11px] text-destructive disabled:opacity-40">
                  <Trash2 className="h-3 w-3" /> Limpar
                </button>
              </div>

              {filtered.length === 0 && (
                <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  {items.length === 0
                    ? "Nenhum feedback ainda — o primeiro formulário acima é o caminho."
                    : "Nada neste filtro — ajuste tipo/status."}
                </p>
              )}

              {filtered.map((f) => {
                const Icon = KIND_ICONS[f.kind];
                return (
                  <article key={f.id} className="rounded-xl border border-border/50 bg-card/60 p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                        <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                        {FEEDBACK_KINDS.find((k) => k.id === f.kind)?.label}
                      </span>
                      <h3 className="min-w-0 flex-1 text-sm font-medium">{f.title}</h3>
                      <button
                        type="button"
                        onClick={() => voteFeedback(f.id)}
                        title="Votar nesta ideia"
                        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground hover:border-primary/50 hover:text-primary"
                      >
                        <ThumbsUp className="h-3 w-3" aria-hidden /> {f.votes}
                      </button>
                      <select
                        value={f.status}
                        onChange={(e) => updateFeedbackStatus(f.id, e.target.value as FeedbackStatus)}
                        aria-label={`Status de ${f.title}`}
                        className="h-7 rounded-md border border-border/60 bg-background px-1.5 text-[10px]"
                      >
                        {FEEDBACK_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => confirmDestructive("Apagar este feedback?", f.title) && deleteFeedback(f.id)}
                        aria-label={`Apagar feedback ${f.title}`}
                        className="rounded-md border border-destructive/40 p-1 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden />
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{f.description}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground/80">
                      <span>página {f.page}</span>
                      <span>· IA {f.aiMode}</span>
                      <span>· {new Date(f.createdAt).toLocaleString("pt-BR")}</span>
                      {f.attachments.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="h-3 w-3" aria-hidden />
                          {f.attachments.map((a) => a.name).join(", ")}
                        </span>
                      )}
                    </div>
                    {f.attachments.some((a) => a.mime.startsWith("image/")) && (
                      <div className="flex flex-wrap gap-2">
                        {f.attachments.filter((a) => a.mime.startsWith("image/")).map((a, i) => (
                          <img key={i} src={a.dataUrl} alt={`Evidência: ${a.name}`} className="max-h-32 rounded-md border border-border/40" />
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
