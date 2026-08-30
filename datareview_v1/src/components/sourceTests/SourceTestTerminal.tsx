/**
 * Terminal ao vivo do teste de fontes (sidebar direita interna).
 * Mostra TODOS os eventos do runner sem omitir: blocos por probe com
 * timestamp, status, contagens e payload JSON truncado (nunca os números).
 */
import { useEffect, useRef, useState } from "react";
import { listTestLog, subscribeTestLog, snapshotTestLog, type TestLogEntry } from "@/lib/sourceTests/sourceTestLog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearTestLog } from "@/lib/sourceTests/sourceTestLog";
import { Trash2 } from "lucide-react";

const LEVEL_TONE: Record<TestLogEntry["level"], string> = {
  info: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  error: "bg-red-500/10 text-red-700 dark:text-red-300",
};

const LEVEL_LABEL: Record<TestLogEntry["level"], string> = {
  info: "info", success: "ok", warn: "aviso", error: "erro",
};

function time(at: number): string {
  return new Date(at).toLocaleTimeString("pt-BR", { hour12: false });
}

function LogBlock({ entry }: { entry: TestLogEntry }) {
  const [open, setOpen] = useState(false);
  const hasData = entry.data && Object.keys(entry.data).length > 0;
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-xs" data-level={entry.level}>
      <button
        type="button"
        className="flex w-full items-start gap-2 text-left"
        onClick={() => hasData && setOpen(!open)}
        aria-expanded={open}
      >
        <span className="shrink-0 font-mono text-muted-foreground">{time(entry.at)}</span>
        <Badge variant="outline" className={LEVEL_TONE[entry.level]}>{LEVEL_LABEL[entry.level]}</Badge>
        <span className="shrink-0 font-medium">{entry.sourceId}</span>
        <span className="text-muted-foreground">· {entry.label}</span>
        <span className="min-w-0 flex-1 break-words">{entry.message}</span>
      </button>
      {hasData && open && (
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-background p-2 text-[10px] leading-relaxed">
          {JSON.stringify(entry.data, null, 1)}
        </pre>
      )}
    </div>
  );
}

export function SourceTestTerminal() {
  const [log, setLog] = useState<TestLogEntry[]>(() => snapshotTestLog());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setLog([...listTestLog()]);
    const unsub = subscribeTestLog(update);
    return unsub;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [log.length]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground" role="status">{log.length} eventos</span>
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => clearTestLog()}>
          <Trash2 className="h-3 w-3" /> Limpar
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1" role="log" aria-live="polite">
        {log.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
            O terminal mostra ao vivo cada probe: início, fim, erro, skip com contagens e campos vistos.
          </p>
        )}
        {log.map((e) => <LogBlock key={e.id} entry={e} />)}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
