import { useState } from "react";
import { Paperclip, FileText, Trash2, Download, Loader2 } from "lucide-react";
import { OriginBadge } from "@/components/shared/OriginBadge";
import {
  useUserFiles, fileToUserFile, addUserFile, removeUserFile, type UserFile,
} from "@/lib/userFiles";

/**
 * Painel "Arquivos do usuário" — upload (drag&drop ou clique), lista com
 * badges e remoção. Usado na aba Apps e na página /chat-arquivos.
 */
export function FilesPanel() {
  const files = useUserFiles();
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = async (list: FileList | File[]) => {
    setBusy(true);
    try {
      for (const f of Array.from(list)) addUserFile(await fileToUserFile(f));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-2 space-y-2">
      <div
        role="button"
        tabIndex={0}
        aria-label="Solte arquivos aqui ou clique para escolher"
        onClick={() => {
          const inp = document.createElement("input");
          inp.type = "file";
          inp.multiple = true;
          inp.onchange = () => void addFiles(inp.files ?? []);
          inp.click();
        }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); void addFiles(e.dataTransfer.files); }}
        className={`rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-primary/5" : "border-border/60 hover:border-primary/40"}`}
      >
        {busy ? <Loader2 className="h-5 w-5 mx-auto animate-spin text-primary" /> : <Paperclip className="h-5 w-5 mx-auto text-muted-foreground" />}
        <p className="text-[11px] mt-1.5 font-medium">Arraste arquivos ou clique</p>
        <p className="text-[9px] text-muted-foreground mt-0.5">CSV, TXT, MD, JSON têm o texto extraído para a IA</p>
      </div>

      {files.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-3" role="status">Nenhum arquivo anexado ainda.</p>
      ) : (
        <ul className="space-y-1" aria-label="Arquivos do usuário">
          {files.map((f) => <FileRow key={f.id} file={f} />)}
        </ul>
      )}
    </div>
  );
}

function FileRow({ file }: { file: UserFile }) {
  return (
    <li className="group flex items-center gap-2 rounded-lg border border-border/40 px-2 py-1.5">
      <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium truncate flex items-center gap-1.5">
          {file.name}
          <OriginBadge origin="user" short />
        </p>
        <p className="text-[9px] text-muted-foreground truncate">
          {Math.max(1, Math.round(file.size / 1024))} KB
          {file.text ? ` · ${file.text.length.toLocaleString("pt-BR")} chars de texto` : ""}
          {file.note ? ` · ${file.note}` : ""}
        </p>
      </div>
      {file.text && (
        <button
          onClick={() => {
            const blob = new Blob([file.text ?? ""], { type: "text/plain" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = file.name.replace(/\.[^.]+$/, "") + ".txt";
            a.click();
            URL.revokeObjectURL(a.href);
          }}
          className="p-1 rounded text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity"
          title="Baixar texto extraído"
          aria-label={`Baixar texto extraído de ${file.name}`}
        >
          <Download className="h-3 w-3" />
        </button>
      )}
      <button
        onClick={() => removeUserFile(file.id)}
        className="p-1 rounded text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remover arquivo"
        aria-label={`Remover ${file.name}`}
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </li>
  );
}
