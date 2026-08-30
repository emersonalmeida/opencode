/**
 * Zona de perigo — RESET TOTAL. Fica no FIM da página /configuracoes e do
 * SettingsPanel: apaga TODO o storage local (localStorage + sessionStorage)
 * via factoryReset() — nada escapa, nem chaves fora do prefixo aso:* — e
 * recarrega a página, deixando o sistema exatamente como no primeiro acesso
 * (tour de onboarding reaparece, tema/idioma voltam ao padrão, dataset
 * esvaziado). Confirmação via AlertDialog acessível; oferece baixar um
 * backup completo antes.
 */
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Bomb, HardDriveDownload, ShieldAlert } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { inventoryOutputs, factoryReset, formatBytes, countLocalRecords } from "@/lib/outputs";
import { downloadExport } from "@/lib/dataPortability";

export function TotalResetSection() {
  const [busy, setBusy] = useState(false);
  // Inventário leve (chaves aso:*); o reset em si apaga TUDO.
  const summary = useMemo(() => {
    const groups = inventoryOutputs();
    const keys = countLocalRecords();
    const bytes = groups.reduce((acc, g) => acc + g.totalBytes, 0);
    return { keys, bytes };
  }, []);

  const doReset = () => {
    setBusy(true);
    const n = factoryReset();
    toast.success(`Reset total concluído — ${n} registro(s) removidos`, {
      description: "O sistema reinicia como no primeiro acesso.",
    });
    // Pequena espera para o toast aparecer antes do reload.
    setTimeout(() => window.location.reload(), 700);
  };

  return (
    <section
      aria-label="Zona de perigo"
      className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 space-y-3"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="h-4 w-4 text-destructive mt-0.5 shrink-0" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-destructive">Zona de perigo</h2>
          <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
            O <strong>RESET TOTAL</strong> apaga TUDO do armazenamento local — dados coletados,
            reviews, análises e saídas de IA, históricos de chat e sessões, projetos do Canvas/Design,
            decks, pipelines, configurações, aparência, idioma e região — e recarrega o sistema
            como se fosse o primeiro acesso. Nada é enviado a servidores; só dados locais são apagados.
          </p>
          <p className="text-[10px] text-muted-foreground/80 mt-1.5" role="status">
            Armazenamento atual: {summary.keys} chave(s) · {formatBytes(summary.bytes)}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-6">
        <button
          type="button"
          onClick={() => downloadExport()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-[11px] font-medium hover:bg-secondary/80"
        >
          <HardDriveDownload className="h-3.5 w-3.5" aria-hidden="true" /> Baixar backup antes
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-[11px] font-semibold hover:bg-destructive/90 disabled:opacity-60"
            >
              <Bomb className="h-3.5 w-3.5" aria-hidden="true" /> RESET TOTAL
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar TUDO e voltar ao primeiro acesso?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação é irreversível: apaga todo o armazenamento local do sistema
                (dados, gerações, projetos e configurações) e recarrega a página.
                Baixe um backup antes se quiser manter algo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={doReset}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Apagar tudo e reiniciar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
