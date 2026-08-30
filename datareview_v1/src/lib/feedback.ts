/**
 * feedback — sistema de feedback do usuário (página /feedback): reporte de
 * bugs, melhorias e sugestões de novas funcionalidades com evidências
 * (imagens/anexos inline em base64, contexto automático da rota/modo de IA).
 * Local-first (localStorage + pub/sub), exportável em Markdown — é assim
 * que o feedback sai do navegador para virar melhoria no sistema.
 */
export type FeedbackKind = "bug" | "improvement" | "feature";
export type FeedbackStatus = "new" | "triaged" | "planned" | "done";

export interface FeedbackAttachment {
  name: string;
  mime: string;
  /** base64 data-url (limite ~500KB por arquivo). */
  dataUrl: string;
}

export interface FeedbackItem {
  id: string;
  kind: FeedbackKind;
  title: string;
  description: string;
  page: string;
  aiMode: string;
  attachments: FeedbackAttachment[];
  status: FeedbackStatus;
  votes: number;
  createdAt: number;
  updatedAt: number;
}

export const FEEDBACK_KINDS: Array<{ id: FeedbackKind; label: string; hint: string }> = [
  { id: "bug", label: "Bug", hint: "algo quebrou ou comportamento errado" },
  { id: "improvement", label: "Melhoria", hint: "algo existe mas pode ficar melhor" },
  { id: "feature", label: "Nova funcionalidade", hint: "ideia de recurso novo" },
];

export const FEEDBACK_STATUS: Array<{ id: FeedbackStatus; label: string }> = [
  { id: "new", label: "Novo" },
  { id: "triaged", label: "Em triagem" },
  { id: "planned", label: "Planejado" },
  { id: "done", label: "Feito" },
];

const KEY = "aso:feedback:v1";
const MAX_ITEMS = 100;
const MAX_ATTACHMENT_BYTES = 500 * 1024;

let cached: FeedbackItem[] | null = null;
// Contador torna o id único mesmo com criações no mesmo milissegundo.
let idCounter = 0;
const listeners = new Set<() => void>();
/** Limite de tamanho por anexo (bytes do base64). */
export const ATTACHMENT_LIMIT = MAX_ATTACHMENT_BYTES;

function load(): FeedbackItem[] {
  if (cached) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as FeedbackItem[]) : [];
  } catch { cached = []; }
  return cached;
}
function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(load())); } catch { /* quota */ }
  listeners.forEach((l) => l());
}
export function listFeedback(): FeedbackItem[] {
  return [...load()].sort((a, b) => b.createdAt - a.createdAt);
}

export function addFeedback(input: Omit<FeedbackItem, "id" | "status" | "votes" | "createdAt" | "updatedAt">): FeedbackItem {
  const now = Date.now();
  const item: FeedbackItem = {
    ...input,
    // timestamp + contador (id único mesmo com criações no mesmo ms).
    id: `fb-${now.toString(36)}-${(idCounter++).toString(36)}`,
    status: "new", votes: 0, createdAt: now, updatedAt: now,
  };
  cached = [item, ...load()].slice(0, MAX_ITEMS);
  persist();
  return item;
}

export function updateFeedbackStatus(id: string, status: FeedbackStatus): void {
  cached = load().map((f) => (f.id === id ? { ...f, status, updatedAt: Date.now() } : f));
  persist();
}
export function voteFeedback(id: string): void {
  cached = load().map((f) => (f.id === id ? { ...f, votes: f.votes + 1, updatedAt: Date.now() } : f));
  persist();
}
export function deleteFeedback(id: string): void {
  cached = load().filter((f) => f.id !== id);
  persist();
}
export function clearFeedback(): void {
  cached = [];
  persist();
}
export function subscribeFeedback(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Markdown exportável com indexação e filtro por status/kind. */
export function feedbackToMarkdown(items: FeedbackItem[]): string {
  const head = [
    `# Feedback do usuário (${items.length} item${items.length === 1 ? "" : "s"})`,
    "",
  ];
  const body = items.flatMap((f) => [
    `## [${FEEDBACK_STATUS.find((s) => s.id === f.status)?.label ?? f.status}] ${kindLabel(f.kind)}: ${f.title}`,
    "",
    `- Página: ${f.page || "não informada"}`,
    `- Modo de IA: ${f.aiMode || "não informado"}`,
    `- Votos: ${f.votes}`,
    `- Anexos: ${f.attachments.length > 0 ? f.attachments.map((a) => a.name).join(", ") : "nenhum"}`,
    `- Em: ${new Date(f.createdAt).toLocaleString("pt-BR")}`,
    "",
    f.description.trim(),
    "",
  ]);
  return [...head, ...body].join("\n");
}

function kindLabel(kind: FeedbackKind): string {
  return FEEDBACK_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

/** Filtro determinístico por kind/status (componente). */
export function filterFeedback(items: FeedbackItem[], kind: FeedbackKind | "all", status: FeedbackStatus | "all"): FeedbackItem[] {
  return items.filter((f) => (kind === "all" || f.kind === kind) && (status === "all" || f.status === status));
}
