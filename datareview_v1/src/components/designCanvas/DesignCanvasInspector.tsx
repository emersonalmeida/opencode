import { useMemo } from "react";
import { Trash2, RotateCcw, Save, Image, Download, Upload } from "lucide-react";
import { resolveMeta, DESIGN_TOKENS } from "@/lib/designCanvas/registry";
import type { PropSchema, DesignToken } from "@/lib/designCanvas/types";
import { useDesignStore, useVisibleNodes, useVisibleEdges } from "@/lib/designCanvas/store";
import { DATA_SOURCE_OPTIONS, appDataSourceOptions } from "@/lib/designCanvas/dataBinding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useDataset } from "@/hooks/useDataset";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { downloadFile } from "@/lib/pageFeatures";

/** dataSource picker — extracted so the useDataset hook is unconditional. */
function DataSourceControl({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const { entries } = useDataset();
  const appOpts = appDataSourceOptions(entries);
  return (
    <Select value={value as string} onValueChange={onChange}>
      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent>
        {DATA_SOURCE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        {appOpts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** A single live-editable control bound to a prop schema. */
function PropControl({ schema, value, onChange }: {
  schema: PropSchema;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (schema.type) {
    case "text":
      return (
        <Input value={value as string} placeholder={schema.placeholder} onChange={(e) => onChange(e.target.value)} />
      );
    case "textarea":
      return (
        <Textarea value={value as string} rows={3} placeholder={schema.placeholder} onChange={(e) => onChange(e.target.value)} />
      );
    case "number":
      return (
        <Input
          type="number"
          value={value as number}
          min={schema.min}
          max={schema.max}
          step={schema.step ?? 1}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case "boolean":
      return <Switch checked={value as boolean} onCheckedChange={onChange} />;
    case "select":
      return (
        <Select value={value as string} onValueChange={onChange}>
          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(schema.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case "dataSource":
      return <DataSourceControl value={value} onChange={onChange} />;
    case "color":
      return <Input type="text" value={value as string} onChange={(e) => onChange(e.target.value)} />;
    default:
      return null;
  }
}

function NodeInspector() {
  const nodes = useDesignStore((s) => s.nodes);
  const selectedId = useDesignStore((s) => s.selectedId);
  const updateNodeProps = useDesignStore((s) => s.updateNodeProps);
  const updateNodeLabel = useDesignStore((s) => s.updateNodeLabel);
  const removeNode = useDesignStore((s) => s.removeNode);
  const duplicateNode = useDesignStore((s) => s.duplicateNode);

  const node = useMemo(() => nodes.find((n) => n.id === selectedId) ?? null, [nodes, selectedId]);

  if (!node) {
    return (
      <div className="text-xs text-muted-foreground p-4 text-center">
        Selecione um nó no canvas para editar suas propriedades ao vivo.
      </div>
    );
  }

  const meta = resolveMeta(node.data.kind);
  const props = node.data.props;

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-2.5 border-b border-border/50 space-y-2">
        <div>
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Rótulo</Label>
          <Input
            value={node.data.label ?? ""}
            placeholder={meta.label}
            onChange={(e) => updateNodeLabel(node.id, e.target.value)}
            className="mt-1"
          />
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="px-1.5 py-0.5 rounded bg-secondary">{meta.layer}</span>
          <span className="font-mono">{node.id.slice(0, 12)}</span>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Propriedades</div>
        {meta.props.map((schema) => (
          <div key={schema.key} className="space-y-1">
            <Label className="text-[11px] flex items-center justify-between">
              <span>{schema.label}</span>
              {schema.help && <span className="text-muted-foreground/70 text-[9px]">{schema.help}</span>}
            </Label>
            <PropControl
              schema={schema}
              value={props[schema.key] ?? schema.default}
              onChange={(v) => updateNodeProps(node.id, { [schema.key]: v })}
            />
          </div>
        ))}
      </div>

      <div className="p-2 border-t border-border/50 flex gap-1.5">
        <Button variant="outline" size="sm" className="h-7 text-[11px] flex-1" onClick={() => duplicateNode(node.id)}>
          Duplicar
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-[11px] text-destructive hover:text-destructive" onClick={() => removeNode(node.id)}>
          <Trash2 className="h-3 w-3" /> Excluir
        </Button>
      </div>
    </div>
  );
}

function EdgeInspector() {
  const edges = useDesignStore((s) => s.edges);
  const nodes = useDesignStore((s) => s.nodes);
  const selectedEdgeId = useDesignStore((s) => s.selectedEdgeId);
  const setEdgeLabel = useDesignStore((s) => s.setEdgeLabel);
  const edge = edges.find((e) => e.id === selectedEdgeId);
  if (!edge) return null;
  const src = nodes.find((n) => n.id === edge.source);
  const tgt = nodes.find((n) => n.id === edge.target);
  return (
    <div className="p-2.5 space-y-2 text-xs">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Conexão (fluxo)</div>
      <div className="text-muted-foreground">
        {src?.data.label ?? resolveMeta(src?.data.kind ?? "note").label} → {tgt?.data.label ?? resolveMeta(tgt?.data.kind ?? "note").label}
      </div>
      <div>
        <Label className="text-[11px]">Tipo de fluxo</Label>
        <Select value={edge.label ?? "navigate"} onValueChange={(v) => setEdgeLabel(edge.id, v)}>
          <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["navigate", "open", "submit", "cancel", "hover", "focus"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function TokenInspector() {
  const tokenOverrides = useDesignStore((s) => s.tokenOverrides);
  const setTokenOverride = useDesignStore((s) => s.setTokenOverride);
  const resetTokens = useDesignStore((s) => s.resetTokens);
  const byLayer = useMemo(() => {
    const m = new Map<DesignToken["layer"], DesignToken[]>();
    for (const t of DESIGN_TOKENS) {
      const arr = m.get(t.layer) ?? [];
      arr.push(t);
      m.set(t.layer, arr);
    }
    return m;
  }, []);

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-2.5 border-b border-border/50 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Design tokens (live)</span>
        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={resetTokens} title="Restaurar padrão">
          <RotateCcw className="h-3 w-3" /> Reset
        </Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3">
        {Array.from(byLayer.entries()).map(([layer, tokens]) => (
          <div key={layer} className="space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{layer}</div>
            {tokens.map((t) => {
              const val = tokenOverrides[t.cssVar] ?? t.value;
              return (
                <div key={t.key} className="flex items-center gap-2">
                  <span
                    className="h-4 w-4 rounded border border-border/60 shrink-0"
                    style={{ background: t.layer === "color" ? `hsl(${val})` : "transparent" }}
                    title={t.description}
                  />
                  <Label className="text-[11px] w-24 truncate" title={t.label}>{t.label}</Label>
                  <Input
                    value={val}
                    onChange={(e) => setTokenOverride(t, e.target.value)}
                    className="h-7 text-[10px] font-mono flex-1"
                  />
                </div>
              );
            })}
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground/80 pt-1">
          Tokens editados aqui são aplicados apenas à prévia do board (escopo), sem alterar o tema global do app.
        </p>
      </div>
    </div>
  );
}

function BoardInspector() {
  const boards = useDesignStore((s) => s.boards);
  const activeBoard = useDesignStore((s) => s.activeBoard);
  const addBoard = useDesignStore((s) => s.addBoard);
  const renameBoard = useDesignStore((s) => s.renameBoard);
  const removeBoard = useDesignStore((s) => s.removeBoard);
  const setActiveBoard = useDesignStore((s) => s.setActiveBoard);
  const snapshots = useDesignStore((s) => s.snapshots);
  const saveSnapshot = useDesignStore((s) => s.saveSnapshot);
  const restoreSnapshot = useDesignStore((s) => s.restoreSnapshot);
  const removeSnapshot = useDesignStore((s) => s.removeSnapshot);
  const loadGraph = useDesignStore((s) => s.loadGraph);
  const clearBoard = useDesignStore((s) => s.clearBoard);
  const nodes = useVisibleNodes();
  const edges = useVisibleEdges();
  const board = boards.find((b) => b.id === activeBoard);

  const handleExport = () => {
    const payload = { version: 1, board: board?.name, nodes, edges };
    downloadFile(`${(board?.name ?? "board").replace(/\s+/g, "-").toLowerCase()}.json`, JSON.stringify(payload, null, 2));
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((txt) => {
      try {
        const parsed = JSON.parse(txt);
        if (Array.isArray(parsed.nodes)) {
          loadGraph(parsed.nodes, parsed.edges ?? []);
        }
      } catch { /* ignore malformed */ }
    });
    e.target.value = "";
  };

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-2.5 border-b border-border/50 space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Boards (frames)</div>
        <div className="space-y-1">
          {boards.map((b) => (
            <div key={b.id} className={`flex items-center gap-1 rounded-md px-1.5 py-1 ${b.id === activeBoard ? "bg-primary/10" : "hover:bg-secondary/70"}`}>
              <button onClick={() => setActiveBoard(b.id)} className="flex-1 text-left truncate text-[11px]">{b.name}</button>
              <button onClick={() => removeBoard(b.id)} disabled={boards.length <= 1} className="text-muted-foreground hover:text-destructive disabled:opacity-30" title="Remover board" aria-label={`Remover board ${b.name}`}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="h-7 w-full text-[11px]" onClick={() => addBoard(`Board ${boards.length + 1}`)}>
          + Novo board
        </Button>
      </div>

      <div className="p-2.5 border-b border-border/50">
        <Label className="text-[11px]">Nome do board</Label>
        <Input
          value={board?.name ?? ""}
          onChange={(e) => board && renameBoard(board.id, e.target.value)}
          className="mt-1"
        />
      </div>

      <div className="p-2.5 border-b border-border/50 space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Snapshots</div>
        <Button variant="outline" size="sm" className="h-7 w-full text-[11px]" onClick={() => saveSnapshot(`Snapshot ${new Date().toLocaleTimeString()}`)}>
          <Save className="h-3 w-3" /> Salvar snapshot
        </Button>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {snapshots.map((s) => (
            <div key={s.id} className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-secondary/70">
              <button onClick={() => restoreSnapshot(s.id)} className="flex-1 text-left truncate text-[11px]" title="Restaurar">
                <Image className="h-3 w-3 inline mr-1 text-muted-foreground" />{s.name}
              </button>
              <span className="text-[9px] text-muted-foreground/70">{s.nodes.length}n</span>
              <button onClick={() => removeSnapshot(s.id)} className="text-muted-foreground hover:text-destructive" title="Remover" aria-label={`Remover snapshot ${s.name}`}>
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {snapshots.length === 0 && <div className="text-[10px] text-muted-foreground/70 px-1">Nenhum snapshot.</div>}
        </div>
      </div>

      <div className="p-2.5 border-b border-border/50 space-y-1.5">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Importar / Exportar</div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" className="h-7 flex-1 text-[11px]" onClick={handleExport}>
            <Download className="h-3 w-3" /> JSON
          </Button>
          <label className="flex-1">
            <input type="file" accept="application/json" onChange={handleImport} className="hidden" />
            <span className="flex h-7 items-center justify-center gap-1 rounded-md border border-input bg-background hover:bg-accent text-[11px] cursor-pointer">
              <Upload className="h-3 w-3" /> Importar
            </span>
          </label>
        </div>
      </div>

      <div className="p-2.5 mt-auto">
        <Button variant="ghost" size="sm" className="h-7 w-full text-[11px] text-destructive hover:text-destructive" onClick={() => { if (confirm("Limpar board atual?")) clearBoard(); }}>
          <Trash2 className="h-3 w-3" /> Limpar board
        </Button>
      </div>
    </div>
  );
}

type InspectTab = "node" | "tokens" | "board" | "page";

/** Page tab — manage structured pages (create/pick/publish) + active page info. */
function PageInspector() {
  const pages = useDesignStore((s) => s.pages);
  const activePageId = useDesignStore((s) => s.activePageId);
  const setActivePage = useDesignStore((s) => s.setActivePage);
  const createPage = useDesignStore((s) => s.createPage);
  const renamePage = useDesignStore((s) => s.renamePage);
  const duplicatePage = useDesignStore((s) => s.duplicatePage);
  const removePage = useDesignStore((s) => s.removePage);
  const publishPageVersion = useDesignStore((s) => s.publishPageVersion);
  const setViewMode = useDesignStore((s) => s.setViewMode);
  const page = pages.find((p) => p.id === activePageId);

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="p-2.5 border-b border-border/50 space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Páginas (estruturadas)</div>
        <div className="space-y-1">
          {pages.map((p) => (
            <div key={p.id} className={`flex items-center gap-1 rounded-md px-1.5 py-1 ${p.id === activePageId ? "bg-primary/10" : "hover:bg-secondary/70"}`}>
              <button onClick={() => { setActivePage(p.id); setViewMode("preview"); }} className="flex-1 text-left truncate text-[11px]">{p.name} <span className="text-muted-foreground/70">v{p.version}</span></button>
              <button onClick={() => duplicatePage(p.id)} title="Duplicar" className="text-muted-foreground hover:text-primary"><Download className="h-3 w-3" /></button>
              <button onClick={() => { if (confirm(`Excluir "${p.name}"?`)) removePage(p.id); }} title="Excluir" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
          {pages.length === 0 && <div className="text-[10px] text-muted-foreground/70 px-1">Nenhuma página. Crie uma ou carregue um template.</div>}
        </div>
        <Button variant="outline" size="sm" className="h-7 w-full text-[11px]" onClick={() => createPage()}>+ Nova página</Button>
      </div>

      {page ? (
        <div className="p-2.5 space-y-2">
          <div>
            <Label className="text-[11px]">Nome da página</Label>
            <Input value={page.name} onChange={(e) => renamePage(page.id, e.target.value)} className="mt-1" />
          </div>
          <div className="text-[10px] text-muted-foreground space-y-0.5">
            <div>Versão: <b>v{page.version}</b></div>
            <div>Atualizada: {new Date(page.updatedAt).toLocaleString()}</div>
            <div>Histórico: {page.history.length} versão(ões)</div>
          </div>
          <Button variant="outline" size="sm" className="h-7 w-full text-[11px]" onClick={() => publishPageVersion(page.id)}>
            <Save className="h-3 w-3" /> Publicar v{page.version + 1}
          </Button>
          <p className="text-[10px] text-muted-foreground/80">
            Publicar arquiva a versão atual no histórico e incrementa a versão — útil para iterar sobre páginas existentes.
          </p>
        </div>
      ) : (
        <div className="p-3 text-[11px] text-muted-foreground">Selecione ou crie uma página para gerenciá-la.</div>
      )}
    </div>
  );
}

export function DesignCanvasInspector({ tab, setTab }: { tab: InspectTab; setTab: (t: InspectTab) => void }) {
  const selectedId = useDesignStore((s) => s.selectedId);
  const selectedEdgeId = useDesignStore((s) => s.selectedEdgeId);
  const hasNode = Boolean(selectedId);
  const hasEdge = Boolean(selectedEdgeId);

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-4 gap-0.5 p-1 m-1.5 rounded-lg bg-secondary/50">
        <button
          onClick={() => setTab("node")}
          className={`flex items-center justify-center text-[11px] py-1.5 rounded-md transition-colors ${tab === "node" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >Inspector</button>
        <button
          onClick={() => setTab("tokens")}
          className={`flex items-center justify-center text-[11px] py-1.5 rounded-md transition-colors ${tab === "tokens" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >Tokens</button>
        <button
          onClick={() => setTab("board")}
          className={`flex items-center justify-center text-[11px] py-1.5 rounded-md transition-colors ${tab === "board" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >Board</button>
        <button
          onClick={() => setTab("page")}
          className={`flex items-center justify-center text-[11px] py-1.5 rounded-md transition-colors ${tab === "page" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >Página</button>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "node" ? (
          hasEdge ? <EdgeInspector /> : hasNode ? <NodeInspector /> : (
            <div className="text-xs text-muted-foreground p-4 text-center">
              Selecione um nó ou conexão no canvas para editar.
            </div>
          )
        ) : tab === "tokens" ? (
          <TokenInspector />
        ) : tab === "board" ? (
          <BoardInspector />
        ) : (
          <PageInspector />
        )}
      </div>
      {hasEdge && tab === "node" && (
        <button onClick={() => setTab("node")} className="sr-only">Inspector</button>
      )}
      <Separator />
    </div>
  );
}

export type { InspectTab };
