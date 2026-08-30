/**
 * GitTopBar — barra superior minimalista e flutuante (spec §4).
 *
 * Mostra: nome do projeto, saúde derivada (§23), status de sincronização,
 * provider conectado, badge DEMO MODE (§37), online/offline (§27), troca de
 * visão (§34), sincronizar e configurações. O Canvas ocupa o resto da tela.
 */
import { Link } from "react-router-dom";
import {
  Cloud, Laptop, RefreshCw, Settings2, Wifi, WifiOff, type LucideIcon,
} from "lucide-react";
import { GIT_CANVAS_VIEWS, type GitCanvasView, type ProjectHealthReport } from "@/lib/gitCanvas/types";
import { cn } from "@/lib/utils";

export interface GitTopBarProps {
  projectName: string;
  health: ProjectHealthReport;
  syncLabel: string;
  providerLabel: string;
  demo: boolean;
  online: boolean;
  view: GitCanvasView;
  onViewChange(view: GitCanvasView): void;
  onSync(): void;
  syncing?: boolean;
  /** Botões da Parte 4 (busca/palette) e Parte 5 (agente/testes). */
  onOpenPalette?(): void;
  extraActions?: React.ReactNode;
  /** multi-repositório: nomes dos repos de upload disponíveis. */
  uploadRepos?: string[];
  /** repo de upload ativo. */
  activeUpload?: string;
  /** troca de repo de upload. */
  onSwitchUpload?(name: string): void;
}

function StatusDot({ tone }: { tone: "ok" | "warn" | "off" }) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full",
        tone === "ok" && "bg-[hsl(var(--status-success))]",
        tone === "warn" && "bg-[hsl(var(--status-warning))]",
        tone === "off" && "bg-muted-foreground/50",
      )}
    />
  );
}

function BarButton({ icon: Icon, label, onClick, href, active }: { icon: LucideIcon; label: string; onClick?: () => void; href?: string; active?: boolean }) {
  const cls = cn(
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors",
    "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
    active && "bg-accent text-foreground",
  );
  const inner = (
    <>
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </>
  );
  if (href) return <Link to={href} className={cls} aria-label={label}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls} aria-label={label}>{inner}</button>;
}

export function GitTopBar({
  projectName, health, syncLabel, providerLabel, demo, online, view, onViewChange, onSync, syncing, onOpenPalette, extraActions, uploadRepos, activeUpload, onSwitchUpload,
}: GitTopBarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col items-center gap-2 p-3">
      <div className="pointer-events-auto flex w-full max-w-5xl items-center gap-2 rounded-xl border border-border/60 bg-card/85 px-3 py-1.5 shadow-sm backdrop-blur-md">
        <span className="text-[13px] font-semibold tracking-wide">{projectName}</span>
        {uploadRepos && uploadRepos.length > 1 && activeUpload && onSwitchUpload && (
          <select
            value={activeUpload}
            onChange={(e) => onSwitchUpload(e.target.value)}
            className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/60"
            aria-label="Selecionar repositório"
          >
            {uploadRepos.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
        <span
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"
          title={health.signals.length ? health.signals.join(" · ") : "Nenhum sinal de atenção"}
        >
          <StatusDot tone={health.status === "healthy" ? "ok" : "warn"} />
          <span className="hidden md:inline">{health.status === "healthy" ? "Saudável" : "Precisa de atenção"}</span>
        </span>
        <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground lg:inline-flex" title="Sincronização remoto ↔ local">
          <Laptop className="h-3 w-3" /> {syncLabel}
        </span>
        <span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground xl:inline-flex" title="Provider conectado">
          <Cloud className="h-3 w-3" /> {providerLabel}
        </span>
        {demo && (
          <span className="rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Demo mode
          </span>
        )}
        <div className="flex-1" />
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground" title={online ? "Online" : "Offline — o Canvas continua utilizável (§27)"}>
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span className="hidden md:inline">{online ? "Online" : "Offline"}</span>
        </span>
        {onOpenPalette && (
          <button
            type="button"
            onClick={onOpenPalette}
            className="hidden items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            aria-label="Buscar e executar ações (Ctrl+K)"
          >
            ⌘K <span className="hidden md:inline">Buscar</span>
          </button>
        )}
        <BarButton icon={RefreshCw} label="Sincronizar" onClick={onSync} active={syncing} />
        {extraActions}
        <BarButton icon={Settings2} label="Configurações" href="/configuracoes" />
      </div>

      {/* Troca de visão (§34): projeções do mesmo modelo, não páginas. */}
      <div className="pointer-events-auto flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border/60 bg-card/85 p-0.5 shadow-sm backdrop-blur-md" role="tablist" aria-label="Visões do canvas">
        {GIT_CANVAS_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            role="tab"
            aria-selected={view === v.id}
            title={v.hint}
            onClick={() => onViewChange(v.id)}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              view === v.id ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
