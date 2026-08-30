/**
 * Painel de fontes customizadas da Uni (/00): o usuário adiciona fontes de
 * dados públicas (gratuitas, limitadas, com cadastro, com/sem API) via
 * URL template + mapa de campos JSON — e coleta delas como qualquer fonte.
 *
 * Inclui: formulário com validação + teste ao vivo (probe com 1 termo),
 * lista com badges de acesso/tipo, edição inline e exclusão com desfazer.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchCustomSource } from "@/lib/uni/uniApi";
import {
  ACCESS_META, API_KIND_META, CUSTOM_SOURCE_EXAMPLES, deleteCustomSource, saveCustomSource,
  slugify, useCustomSources, validateCustomSource, type CustomSourceDef, type SourceAccess, type SourceApiKind,
} from "@/lib/uni/customSources";
import { getSourceSecret, setSourceSecret, hasSourceSecret, type SourceAuthType } from "@/lib/uni/sourceSecrets";
import type { UniItemKind } from "@/lib/uni/types";
import { KIND_OPTIONS } from "@/lib/uni/types";
import { useDestructiveAction } from "@/hooks/useUx";
import { toastSuccess } from "@/lib/ux";
import { FlaskConical, Loader2, Plus, Save, Trash2, Wand2 } from "lucide-react";

const EMPTY: Omit<CustomSourceDef, "id" | "createdAt"> = {
  label: "",
  description: "",
  kind: "web-result",
  urlTemplate: "",
  listPath: "",
  fields: { title: "", text: "", url: "", author: "", date: "", score: "" },
  access: "gratuita",
  apiKind: "api-oficial",
};

/** Campo de segredo ligado ao vault local (nunca exportado). */
function SecretInput({ sourceId }: { sourceId: string }) {
  const [value, setValue] = useState(() => getSourceSecret(sourceId));
  return (
    <div className="flex items-center gap-2">
      <Input
        type="password"
        value={value}
        onChange={(e) => { setValue(e.target.value); setSourceSecret(sourceId, e.target.value); }}
        placeholder={hasSourceSecret(sourceId) ? "••••••••" : "cole a chave aqui"}
        className="font-mono text-xs"
        aria-label="Chave de API da fonte"
      />
      {hasSourceSecret(sourceId) && value === "" && (
        <span className="text-[10px] text-muted-foreground">salva</span>
      )}
    </div>
  );
}

export function CustomSourcesPanel() {
  const defs = useCustomSources();
  const [form, setForm] = useState<typeof EMPTY>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [probe, setProbe] = useState<{ loading: boolean; result?: string }>({ loading: false });
  const destroy = useDestructiveAction();

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setField = (k: keyof CustomSourceDef["fields"], v: string) =>
    setForm((f) => ({ ...f, fields: { ...f.fields, [k]: v } }));

  const save = () => {
    const errs = validateCustomSource(form);
    setErrors(errs);
    if (errs.length) return;
    const res = saveCustomSource(form, editId ?? undefined);
    if ("errors" in res) { setErrors(res.errors); return; }
    toastSuccess(editId ? "Fonte atualizada" : "Fonte adicionada", { description: res.label });
    setForm(EMPTY); setEditId(null); setErrors([]);
  };

  const test = async () => {
    const errs = validateCustomSource(form);
    setErrors(errs);
    if (errs.length) return;
    setProbe({ loading: true });
    const term = "teste";
    const res = await fetchCustomSource({ ...form, id: "probe", createdAt: 0 } as CustomSourceDef, term, 3);
    if (res.ok) {
      const first = res.items[0];
      setProbe({ loading: false, result: `OK — ${res.items.length} itens. Ex.: "${first?.title?.slice(0, 80)}"` });
    } else {
      setProbe({ loading: false, result: `Falhou: ${res.error}` });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h3 className="text-sm font-semibold">Fontes customizadas</h3>
        <p className="text-muted-foreground text-xs">
          Adicione qualquer API JSON pública: cole a URL com <code>{"{q}"}</code> (termo) e mapeie os campos.
          Fica salva neste navegador e aparece como fonte coletável.
        </p>
      </div>

      {defs.length > 0 && (
        <ul className="space-y-1.5" role="list" aria-label="Fontes customizadas salvas">
          {defs.map((d) => (
            <li key={d.id} className="border-border/60 flex items-center gap-2 rounded-md border px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{d.label}</span>
                  <span className="bg-muted rounded px-1 py-0.5 text-[10px]">{ACCESS_META[d.access].label}</span>
                  <span className="bg-muted rounded px-1 py-0.5 text-[10px]">{API_KIND_META[d.apiKind].label}</span>
                </div>
                <p className="text-muted-foreground truncate text-xs">{d.urlTemplate}</p>
              </div>
              <Button size="sm" variant="ghost" aria-label={`Editar ${d.label}`}
                onClick={() => { setForm({ ...EMPTY, ...d, fields: { ...EMPTY.fields, ...d.fields } }); setEditId(d.id); }}>
                Editar
              </Button>
              <Button size="sm" variant="ghost" aria-label={`Excluir ${d.label}`}
                onClick={() => destroy({
                  confirm: `Excluir a fonte "${d.label}"?`,
                  action: () => deleteCustomSource(d.id),
                  toast: `Fonte "${d.label}" excluída`,
                  undo: () => { saveCustomSource({ ...d }, d.id); },
                })}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-border/60 space-y-2 rounded-md border p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{editId ? "Editar fonte" : "Nova fonte"}</span>
          <div className="flex gap-1">
            {CUSTOM_SOURCE_EXAMPLES.map((ex) => (
              <Button key={ex.label} size="sm" variant="outline" className="h-6 text-[10px]"
                onClick={() => setForm({ ...EMPTY, ...ex, fields: { ...EMPTY.fields, ...ex.fields } })}>
                <Wand2 className="mr-1 h-3 w-3" />{ex.label.split(" ")[0]}
              </Button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Nome *</span>
            <Input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="ex.: Minha API" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Tipo do item</span>
            <select className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={form.kind}
              onChange={(e) => set("kind", e.target.value as UniItemKind)}>
              {KIND_OPTIONS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs">URL template * (use {"{q}"} e opcional {"{limit}"})</span>
          <Input value={form.urlTemplate} onChange={(e) => set("urlTemplate", e.target.value)}
            placeholder="https://api.exemplo.com/search?q={q}&limit={limit}" className="font-mono text-xs" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Caminho da lista (dot-path)</span>
            <Input value={form.listPath} onChange={(e) => set("listPath", e.target.value)} placeholder="results (vazio = raiz)" className="font-mono text-xs" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Título * (dot-path no item)</span>
            <Input value={form.fields.title} onChange={(e) => setField("title", e.target.value)} placeholder="title" className="font-mono text-xs" />
          </label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {(["text", "url", "author", "date", "score"] as const).map((k) => (
            <label key={k} className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">{k}</span>
              <Input value={form.fields[k] ?? ""} onChange={(e) => setField(k, e.target.value)} placeholder={k} className="font-mono text-xs" />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Acesso</span>
            <select className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={form.access}
              onChange={(e) => set("access", e.target.value as SourceAccess)}>
              {Object.entries(ACCESS_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Método</span>
            <select className="border-input bg-background h-9 rounded-md border px-2 text-sm" value={form.apiKind}
              onChange={(e) => set("apiKind", e.target.value as SourceApiKind)}>
              {Object.entries(API_KIND_META).map(([id, m]) => <option key={id} value={id}>{m.label}</option>)}
            </select>
          </label>
        </div>
        {/* Autenticação (Onda 4.3): tipo + nome da chave na def; o VALOR vai
            para o vault local (sourceSecrets) e nunca é exportado. */}
        <details className="rounded-lg border border-border/50 p-2.5">
          <summary className="cursor-pointer text-xs font-medium">
            Autenticação (opcional — APIs com chave)
          </summary>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">Tipo</span>
              <select
                className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                value={form.auth?.type ?? ""}
                onChange={(e) => {
                  const t = e.target.value;
                  set("auth", t ? { type: t as SourceAuthType, key: form.auth?.key ?? (t === "header" ? "X-Api-Key" : t === "query" ? "apiKey" : "") } : undefined);
                }}
                aria-label="Tipo de autenticação"
              >
                <option value="">Sem autenticação</option>
                <option value="header">Header HTTP</option>
                <option value="query">Parâmetro na URL</option>
                <option value="bearer">Bearer token</option>
              </select>
            </label>
            {form.auth && form.auth.type !== "bearer" && (
              <label className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">{form.auth.type === "header" ? "Nome do header" : "Nome do parâmetro"}</span>
                <Input
                  value={form.auth.key}
                  onChange={(e) => set("auth", { ...form.auth!, key: e.target.value })}
                  placeholder={form.auth.type === "header" ? "X-Api-Key" : "apiKey"}
                  className="font-mono text-xs"
                />
              </label>
            )}
            {form.auth && (
              <label className="col-span-2 flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">
                  Chave / token (fica só neste navegador, nunca exportada)
                </span>
                <SecretInput
                  sourceId={editId ?? slugify(form.label || "nova-fonte")}
                />
              </label>
            )}
          </div>
        </details>
        {errors.length > 0 && (
          <ul className="text-destructive space-y-0.5 text-xs" role="alert">
            {errors.map((e) => <li key={e}>• {e}</li>)}
          </ul>
        )}
        {probe.result && <p className="text-muted-foreground text-xs" role="status">{probe.result}</p>}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={test} disabled={probe.loading}>
            {probe.loading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="mr-1 h-3.5 w-3.5" />}
            Testar
          </Button>
          <Button size="sm" onClick={save}>
            {editId ? <Save className="mr-1 h-3.5 w-3.5" /> : <Plus className="mr-1 h-3.5 w-3.5" />}
            {editId ? "Salvar alterações" : "Adicionar fonte"}
          </Button>
          {editId && <Button size="sm" variant="ghost" onClick={() => { setForm(EMPTY); setEditId(null); setErrors([]); }}>Cancelar</Button>}
        </div>
      </div>
    </div>
  );
}
