/**
 * DataHubSection — centro de controle de dados na página Configurações:
 * inventário de TUDO que o sistema coletou/gerou (por grupo → chave), com
 * seleção individual/coletiva e ações: baixar selecionados, apagar
 * selecionados, baixar tudo, importar backup (merge/replace), apagar tudo
 * e RESET DE FÁBRICA (estado recém-instalado).
 */
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Database, Download, Trash2, Upload, RefreshCw, AlertTriangle,
  CheckSquare, Square, HardDriveDownload, FileJson, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  inventoryOutputs, formatBytes, deleteKeys, deleteKey, downloadKey,
  type GroupInventory,
} from "@/lib/outputs";
import {
  downloadExport, downloadExportSelected, importAllData, inspectBackup,
} from "@/lib/dataPortability";

export function DataHubSection() {
  const [inventory, setInventory] = useState<GroupInventory[]>(() => inventoryOutputs());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    setInventory(inventoryOutputs());
    setSelected((prev) => {
      const existing = new Set(inventoryOutputs().flatMap((g) => g.entries.map((e) => e.key)));
      return new Set([...prev].filter((k) => existing.has(k)));
    });
  }, []);

  const totalBytes = inventory.reduce((s, g) => s + g.totalBytes, 0);
  const totalKeys = inventory.reduce((s, g) => s + g.entries.length, 0);
  const exportableSelected = useMemo(
    () => [...selected].filter((k) => !inventory.some((g) => g.entries.some((e) => e.key === k && e.sensitive))),
    [selected, inventory],
  );

  const toggleKey = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const toggleGroup = (g: GroupInventory) => {
    const keys = g.entries.map((e) => e.key);
    const allIn = keys.every((k) => selected.has(k));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const k of keys) { if (allIn) next.delete(k); else next.add(k); }
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(inventory.flatMap((g) => g.entries.map((e) => e.key))));
  const selectNone = () => setSelected(new Set());

  const onDownloadSelected = () => {
    if (exportableSelected.length === 0) {
      toast.error("Nada exportável selecionado", { description: "Chaves sensíveis (credenciais) nunca são exportadas." });
      return;
    }
    downloadExportSelected(exportableSelected);
    toast.success(`Backup de ${exportableSelected.length} chave(s) baixado`);
  };

  const onDeleteSelected = () => {
    if (selected.size === 0) return;
    if (!confirm(`Apagar definitivamente ${selected.size} chave(s) selecionada(s)? Isso não pode ser desfeito.`)) return;
    const n = deleteKeys([...selected]);
    toast.success(`${n} chave(s) apagada(s)`);
    refresh();
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const preview = inspectBackup(text);
    if (!preview.ok) {
      toast.error("Backup inválido", { description: preview.error });
      return;
    }
    if (!confirm(`Importar backup com ${preview.keys} chave(s) no modo "${importMode === "merge" ? "mesclar (só adiciona o que falta)" : "substituir (sobrescreve)"}"?`)) return;
    const res = importAllData(text, importMode);
    if (!res.ok) {
      toast.error("Falha na importação", { description: res.error });
      return;
    }
    toast.success(`Importação concluída`, { description: `${res.imported} importada(s) · ${res.skipped} ignorada(s). Recarregue para aplicar tudo.` });
    refresh();
  };

  return (
    <div className="px-4 pb-4 space-y-4">
      {/* Ações globais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        <button
          onClick={() => { downloadExport(); toast.success("Backup completo baixado"); }}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90"
        >
          <HardDriveDownload className="h-3.5 w-3.5" /> Baixar tudo
        </button>
        <button
          onClick={onDownloadSelected}
          disabled={selected.size === 0}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-secondary text-secondary-foreground text-[11px] hover:bg-secondary/80 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" /> Baixar selecionados ({exportableSelected.length})
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-secondary text-secondary-foreground text-[11px] hover:bg-secondary/80"
        >
          <Upload className="h-3.5 w-3.5" /> Importar backup
        </button>
        <button
          onClick={refresh}
          className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg bg-secondary text-secondary-foreground text-[11px] hover:bg-secondary/80"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {/* Import config */}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1">
        <FileJson className="h-3 w-3 shrink-0" />
        <span>Modo de importação:</span>
        {(["merge", "replace"] as const).map((m) => (
          <button
            key={m}
            aria-pressed={importMode === m}
            onClick={() => setImportMode(m)}
            className={`px-2 py-0.5 rounded-md transition-colors ${importMode === m ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
          >
            {m === "merge" ? "Mesclar" : "Substituir"}
          </button>
        ))}
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label="Selecionar arquivo de backup"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Seleção em massa */}
      <div className="flex items-center gap-2 text-[10px] px-1" role="status">
        <Database className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">
          {totalKeys} chave(s) · {formatBytes(totalBytes)} · <strong className="text-foreground">{selected.size} selecionada(s)</strong>
        </span>
        <button onClick={selectAll} className="ml-auto px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">Todas</button>
        <button onClick={selectNone} className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80">Nenhuma</button>
        <button
          onClick={onDeleteSelected}
          disabled={selected.size === 0}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" /> Apagar sel.
        </button>
      </div>

      {/* Inventário por grupo */}
      <div className="space-y-3">
        {inventory.length === 0 && (
          <p className="text-[11px] text-muted-foreground px-1 py-3 text-center">
            Nenhum dado armazenado — o sistema está como recém-instalado.
          </p>
        )}
        {inventory.map((g) => {
          const allIn = g.entries.every((e) => selected.has(e.key));
          return (
            <div key={g.group.id} className="rounded-lg border border-border/40 bg-background overflow-hidden">
              <button
                onClick={() => toggleGroup(g)}
                aria-pressed={allIn}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/40 transition-colors text-left"
              >
                {allIn
                  ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                  : <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                <span className="text-[11px] font-semibold text-foreground">{g.group.label}</span>
                <span className="text-[9px] text-muted-foreground ml-auto">{g.entries.length} chave(s) · {formatBytes(g.totalBytes)}</span>
              </button>
              <p className="px-3 pb-1.5 text-[9px] text-muted-foreground leading-snug">{g.group.description}</p>
              <div className="border-t border-border/30 divide-y divide-border/20 max-h-56 overflow-y-auto">
                {g.entries.map((e) => (
                  <div key={e.key} className="flex items-center gap-2 px-3 py-1.5">
                    <button
                      onClick={() => toggleKey(e.key)}
                      role="checkbox"
                      aria-checked={selected.has(e.key)}
                      aria-label={`Selecionar ${e.key}`}
                      className="shrink-0"
                    >
                      {selected.has(e.key)
                        ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                        : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
                    </button>
                    <span className="font-mono text-[10px] text-foreground truncate flex-1" title={e.key}>{e.key}</span>
                    {e.sensitive && (
                      <span title="Credencial — nunca exportada" className="inline-flex items-center gap-0.5 text-[8px] text-amber-600 dark:text-amber-400 shrink-0">
                        <ShieldAlert className="h-2.5 w-2.5" /> sigilosa
                      </span>
                    )}
                    <span className="text-[9px] text-muted-foreground shrink-0">
                      {formatBytes(e.bytes)}{e.items != null ? ` · ${e.items} item(ns)` : ""}
                    </span>
                    <button
                      onClick={() => downloadKey(e.key)}
                      title="Baixar esta chave"
                      aria-label={`Baixar ${e.key}`}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm(`Apagar "${e.key}"?`)) return;
                        deleteKey(e.key);
                        refresh();
                      }}
                      title="Apagar esta chave"
                      aria-label={`Apagar ${e.key}`}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

</div>
  );
}
