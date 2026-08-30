/**
 * Runner do monitoramento agendado (Onda 3.2): verifica a cada minuto se
 * algum monitor está "due" e recoleta (collectApp — reusa o cache/merge do
 * dataset), gravando snapshot + diff determinístico e notificando. Roda só
 * com a aba visível (document.visibilityState) e no máximo 1 recoleta por
 * vez (fila serial — nunca frita as lojas).
 */
import { dueMonitors, recordMonitorRun, snapshotReviews, diffSnapshots } from "./monitor";
import { getDatasetEntry, subscribeDataset } from "./datasetStore";
import { collectApp } from "./collect";
import { logActivity } from "./activityStore";
import { toastInfo } from "./ux";
import { getUserRegion } from "./region";

const TICK_MS = 60_000;
let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/** Uma passada do scheduler (exportada para testes). */
export async function runMonitorTick(now = Date.now()): Promise<number> {
  if (running) return 0;
  const due = dueMonitors(now);
  if (due.length === 0) return 0;
  running = true;
  let ran = 0;
  try {
    for (const task of due) {
      const [store, ...idParts] = task.appKey.split(":");
      const entry = getDatasetEntry(store, idParts.join(":"));
      if (!entry) {
        // App sumiu do dataset — registra honestamente em vez de falhar em loop.
        recordMonitorRun(task.id, { at: now, reviewCount: 0, avgRating: 0, pctNegative: 0 }, null);
        logActivity("sistema", "skip", `Monitor: ${task.appName} não está mais no dataset`);
        continue;
      }
      try {
        // Reusa o cache/merge do collectApp com o limite já coletado (não
        // amplia o volume — só atualiza o que existe).
        const result = await collectApp(entry.app, getUserRegion(), Math.max(1, entry.reviews.length));
        const reviews = result?.entry?.reviews ?? entry.reviews;
        const snapshot = snapshotReviews(reviews, now);
        const diff = diffSnapshots(task.lastSnapshot, snapshot);
        recordMonitorRun(task.id, snapshot, diff);
        ran++;
        logActivity(
          "sistema",
          "done",
          `Monitor: ${task.appName} recoletado${diff ? ` — ${diff.summary}` : " (primeira coleta)"}`,
        );
        if (diff && (diff.newReviews > 0 || Math.abs(diff.ratingDelta) >= 0.3 || Math.abs(diff.pctNegativeDelta) >= 10)) {
          toastInfo(`Monitor: ${task.appName}`, { description: diff.summary });
        }
      } catch (err) {
        logActivity(
          "sistema",
          "error",
          `Monitor: falha ao recoletar ${task.appName} — ${String((err as Error)?.message || err)}`,
        );
      }
    }
  } finally {
    running = false;
  }
  return ran;
}

/** Inicia o scheduler (idempotente). Para em aba oculta, retoma ao focar. */
export function startMonitorScheduler(): () => void {
  if (timer) return stopMonitorScheduler;
  const tick = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    void runMonitorTick();
  };
  timer = setInterval(tick, TICK_MS);
  // Também reage a writes no dataset (ex.: monitor criado agora = due).
  const unsub = subscribeDataset(() => void runMonitorTick());
  return stopMonitorScheduler;

  function stopMonitorScheduler() {
    if (timer) clearInterval(timer);
    timer = null;
    unsub();
  }
}
