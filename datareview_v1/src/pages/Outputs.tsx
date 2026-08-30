import { useMemo, useRef, useState, useCallback } from "react";
import {
  Database, Sparkles, FileStack, Settings2, Boxes, Cpu,
  Download, Upload, Trash2, Eye, ChevronDown, ChevronRight,
  HardDrive, ShieldAlert, RotateCcw, AlertTriangle,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Panel";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  inventoryOutputs, formatBytes, downloadKey, deleteKey, deleteGroup,
  resetAllLocalData, type GroupInventory, type OutputGroupId,
} from "@/lib/outputs";
import { downloadExport, importAllData } from "@/lib/dataPortability";
import { OriginBadge } from "@/components/shared/OriginBadge";
import { originForOutputGroup } from "@/lib/dataOrigin";

const GROUP_ICON: Record<OutputGroupId, typeof Database> = {
  base: Database,
  noai: Cpu,
  ia: Sparkles,
  projetos: FileStack,
  sistema: Settings2,
  outros: Boxes,
};

function KeyRow({
  entry, onChanged,
}: {
  entry: GroupInventory["entries"][number];
  onChanged: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const raw = preview ? (localStorage.getItem(entry.key) ?? "") : "";
  const previewText = raw.length > 4000 ? raw.slice(0, 4000) + "\n… (truncado)" : raw;

  return (
    <li className="rounded-lg border border-border/40 bg-card/40">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <code className="text-[11px] font-mono text-foreground truncate flex-1 min-w-0" title={entry.key}>
          {entry.key}
        </code>
        <span className="text-[10px] text-muted-foreground shrink-0">{formatBytes(entry.bytes)}</span>
        {entry.items != null && (
          <span className="text-[10px] text-muted-foreground shrink-0">{entry.items} itens</span>
        )}
        {entry.sensitive && (
          <span className="text-[10px] text-amber-500 flex items-center gap-0.5 shrink-0" title="Contém credenciais — não entra em exportações">
            <ShieldAlert className="h-3 w-3" /> sensível
          </span>
        )}
        <button
          onClick={() => setPreview((p) => !p)}
          aria-expanded={preview}
          aria-label={preview ? "Ocultar conteúdo" : "Ver conteúdo"}
          title={preview ? "Ocultar" : "Ver conteúdo"}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          {preview ? <ChevronDown className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={() => downloadKey(entry.key)}
          aria-label={`Baixar ${entry.key}`}
          title="Exportar esta chave (JSON)"
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => {
            if (window.confirm(`Apagar "${entry.key}" (${formatBytes(entry.bytes)})? Esta ação não pode ser desfeita.`)) {
              deleteKey(entry.key);
              onChanged();
            }
          }}
          aria-label={`Apagar ${entry.key}`}
          title="Apagar"
          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {preview && (
        <pre className="mx-2.5 mb-2 max-h-64 overflow-auto rounded-md bg-background/60 p-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
          {previewText || "(vazio)"}
        </pre>
      )}
    </li>
  );
}

export default function Outputs({ embedded = false }: { embedded?: boolean }) {
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const groups = useMemo(() => inventoryOutputs(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState("");

  const totalBytes = groups.reduce((s, g) => s + g.totalBytes, 0);
  const totalKeys = groups.reduce((s, g) => s + g.entries.length, 0);
  const totalItems = groups.reduce((s, g) => s + g.entries.reduce((a, e) => a + (e.items ?? 0), 0), 0);

  const onImportFile = async (file: File, mode: "merge" | "replace") => {
    const text = await file.text();
    const res = importAllData(text, mode);
    setImportMsg(
      res.ok
        ? `Importação (${mode}) concluída: ${res.imported} chave(s) importadas, ${res.skipped} ignoradas. Recarregue a página para refletir em todas as superfícies.`
        : `Falha na importação: ${res.error}`
    );
    refresh();
  };

  return (
    <div className="min-h-full">
      {!embedded && <AppHeader title="Outputs" crumb="Entrada, processamento e saída de dados" />}
      <div className="content-fluid py-6 space-y-5">
        {/* resumo + ações globais */}
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">Armazenamento local</p>
              <p className="text-[11px] text-muted-foreground">
                {totalKeys} chave(s) · {totalItems} registro(s) · {formatBytes(totalBytes)} no total — tudo no seu navegador (local-first).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <Button size="sm" variant="outline" onClick={downloadExport} className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> Exportar tudo (JSON)
            </Button>
            <Button
              size="sm" variant="outline" className="gap-1.5 text-xs"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" /> Importar backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              aria-label="Arquivo de backup para importar"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const mode = window.confirm("OK = mesclar (só adiciona o que falta) · Cancelar = perguntar de novo para substituir.\n\nClique OK para MESCLAR.") ? "merge" : null;
                if (mode === "merge") { void onImportFile(f, "merge"); }
                else if (window.confirm("SUBSTITUIR os dados locais pelos do arquivo? Chaves existentes serão sobrescritas.")) {
                  void onImportFile(f, "replace");
                }
                e.target.value = "";
              }}
            />
            <Button
              size="sm" variant="destructive" className="gap-1.5 text-xs"
              onClick={() => {
                if (window.confirm(`Resetar TUDO? Isso apaga as ${totalKeys} chaves (${formatBytes(totalBytes)}): dataset, análises, chats, canvas, configurações — incluindo credenciais de IA salvas. Exporte um backup antes, se necessário.`)) {
                  const n = resetAllLocalData();
                  setImportMsg(`${n} chave(s) apagadas. O sistema voltou ao estado inicial.`);
                  refresh();
                }
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Resetar tudo
            </Button>
          </div>
        </div>

        {importMsg && (
          <div role="status" className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-foreground flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            {importMsg}
          </div>
        )}

        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60">
            <EmptyState
              icon={Database}
              title="Nada armazenado ainda"
              description="Colete apps aqui mesmo ou gere análises para ver os outputs aqui."
              collect
            />
          </div>
        ) : (
          groups.map((g) => {
            const Icon = GROUP_ICON[g.group.id];
            return (
              <Panel
                key={g.group.id}
                storageKey={`outputs:${g.group.id}`}
                title={
                  <span className="inline-flex items-center gap-2">
                    {`${g.group.label} (${g.entries.length})`}
                    <OriginBadge origin={originForOutputGroup(g.group.id)} short />
                  </span>
                }
                subtitle={`${g.group.description} · ${formatBytes(g.totalBytes)}`}
                icon={<Icon className="h-4 w-4 text-primary" />}
                actions={
                  <button
                    onClick={() => {
                      if (window.confirm(`Apagar o grupo "${g.group.label}" inteiro (${g.entries.length} chaves, ${formatBytes(g.totalBytes)})?`)) {
                        deleteGroup(g.group.id);
                        refresh();
                      }
                    }}
                    aria-label={`Apagar grupo ${g.group.label}`}
                    title="Apagar grupo inteiro"
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                }
              >
                <ul className="space-y-1.5" aria-label={`Chaves de ${g.group.label}`}>
                  {g.entries.map((e) => (
                    <KeyRow key={e.key} entry={e} onChanged={refresh} />
                  ))}
                </ul>
              </Panel>
            );
          })
        )}

        <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1.5">
          <ChevronRight className="h-3 w-3" />
          Exportações nunca incluem a chave <code className="font-mono">aso:ai-settings:v1</code> (credenciais de IA ficam neste dispositivo).
        </p>
      </div>
    </div>
  );
}
