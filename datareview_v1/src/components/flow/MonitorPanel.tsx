/**
 * MonitorPanel — monitoramento agendado (Onda 3.2): recoleta periódica dos
 * apps do dataset com diff automático (novos reviews, variação de nota e de
 * % negativos). Lista, adicionar, intervalo, ativar/desativar, rodar agora.
 */
import { useSyncExternalStore, useState } from "react";
import { BellPlus, Play, Trash2 } from "lucide-react";
import {
  MONITOR_INTERVALS, addMonitor, listMonitors, nextRunLabel, removeMonitor,
  setMonitorEnabled, subscribeMonitors,
} from "@/lib/monitor";
import { runMonitorTick } from "@/lib/monitorRunner";
import { useDataset } from "@/hooks/useDataset";
import { toastSuccess } from "@/lib/ux";
import { Button } from "@/components/ui/button";
import { useDestructiveAction } from "@/hooks/useUx";

export function MonitorPanel() {
  const monitors = useSyncExternalStore(subscribeMonitors, listMonitors);
  const { entries } = useDataset();
  const destroy = useDestructiveAction();
  const [appKey, setAppKey] = useState("");
  const [intervalMin, setIntervalMin] = useState<number>(1440);
  const [running, setRunning] = useState(false);

  const add = () => {
    const entry = entries.find((e) => `${e.app.store}:${e.app.id}` === appKey);
    if (!entry) return;
    addMonitor({ appKey, appName: entry.app.name, intervalMin });
    toastSuccess("Monitor adicionado", { description: `${entry.app.name} — recoleta ${MONITOR_INTERVALS.find((i) => i.min === intervalMin)?.label}` });
    setAppKey("");
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const ran = await runMonitorTick();
      toastSuccess(ran > 0 ? `${ran} monitor(es) executados` : "Nenhum monitor na hora de rodar");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Recoleta periódica com diff automático: o sistema avisa quando o app
        ganha reviews novos ou muda de recepção. Tudo local, sem servidor.
      </p>

      {/* Adicionar */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">App do dataset</span>
          <select
            className="border-input bg-background h-9 rounded-md border px-2 text-xs"
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
            aria-label="App a monitorar"
          >
            <option value="">Escolha um app coletado…</option>
            {entries.map((e) => (
              <option key={`${e.app.store}:${e.app.id}`} value={`${e.app.store}:${e.app.id}`}>
                {e.app.name} ({e.reviews.length})
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Frequência</span>
          <select
            className="border-input bg-background h-9 rounded-md border px-2 text-xs"
            value={intervalMin}
            onChange={(e) => setIntervalMin(Number(e.target.value))}
            aria-label="Frequência de recoleta"
          >
            {MONITOR_INTERVALS.map((i) => (
              <option key={i.min} value={i.min}>{i.label}</option>
            ))}
          </select>
        </label>
        <Button size="sm" onClick={add} disabled={!appKey} className="gap-1.5">
          <BellPlus className="h-3.5 w-3.5" aria-hidden /> Monitorar
        </Button>
      </div>

      {/* Lista */}
      {monitors.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">
          Nenhum monitor ainda — escolha um app acima para começar a acompanhar.
        </p>
      ) : (
        <ul className="space-y-1.5" role="list" aria-label="Monitores ativos">
          {monitors.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-2.5 py-2 text-xs"
            >
              <button
                onClick={() => setMonitorEnabled(m.id, !m.enabled)}
                role="switch"
                aria-checked={m.enabled}
                aria-label={`${m.enabled ? "Desativar" : "Ativar"} monitor de ${m.appName}`}
                className={`relative h-4 w-8 rounded-full transition-colors ${m.enabled ? "bg-primary" : "bg-muted"}`}
              >
                <span className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${m.enabled ? "left-4" : "left-0.5"}`} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{m.appName}</p>
                <p className="text-[10px] text-muted-foreground">
                  {MONITOR_INTERVALS.find((i) => i.min === m.intervalMin)?.label ?? `${m.intervalMin}min`} · próxima: {nextRunLabel(m)}
                  {m.lastSnapshot && ` · ${m.lastSnapshot.reviewCount} reviews`}
                </p>
                {m.lastDiff && (
                  <p className="text-[10px] text-primary" role="status">{m.lastDiff.summary}</p>
                )}
              </div>
              <button
                onClick={() =>
                  destroy({
                    confirm: `Remover o monitor de "${m.appName}"?`,
                    action: () => removeMonitor(m.id),
                    toast: "Monitor removido",
                    undo: () => addMonitor({ appKey: m.appKey, appName: m.appName, intervalMin: m.intervalMin }),
                  })
                }
                aria-label={`Remover monitor de ${m.appName}`}
                className="rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {monitors.some((m) => m.enabled) && (
        <Button size="sm" variant="outline" onClick={runNow} disabled={running} className="gap-1.5">
          <Play className="h-3.5 w-3.5" aria-hidden /> {running ? "Executando…" : "Rodar agora"}
        </Button>
      )}
    </div>
  );
}
