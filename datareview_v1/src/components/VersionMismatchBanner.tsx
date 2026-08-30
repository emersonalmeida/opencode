/**
 * Banner global de divergência de versão — aparece quando o build aberto no
 * navegador é de um commit DIFERENTE do que o servidor local está rodando
 * (ex.: usuário deu git pull mas a página continua com o bundle antigo).
 * Overlay fixo: não altera o layout; some ao recarregar.
 */
import { RefreshCw } from "lucide-react";
import { useVersionMismatch, clientBuildInfo, getServerHealth } from "@/lib/serverHealth";

export function VersionMismatchBanner() {
  const mismatch = useVersionMismatch();
  if (!mismatch) return null;
  const client = clientBuildInfo();
  const serverCommit = getServerHealth().serverCommit;
  return (
    <div
      role="alert"
      className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-amber-950 shadow-md"
    >
      <span>
        Uma versão nova do sistema está rodando no servidor
        {serverCommit ? ` (${serverCommit})` : ""} — esta página é de um build
        antigo{client.commit ? ` (${client.commit})` : ""}.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1 rounded-md bg-amber-950/10 px-2 py-0.5 font-semibold hover:bg-amber-950/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-950/60"
      >
        <RefreshCw className="h-3 w-3" aria-hidden />
        Recarregar agora
      </button>
    </div>
  );
}
