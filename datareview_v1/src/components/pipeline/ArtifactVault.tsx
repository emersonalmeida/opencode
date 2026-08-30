/**
 * ArtifactVault — o vault de conhecimento do pipeline.
 *
 * Lista todos os artefatos gerados (fatos, anomalias, temas, descobertas,
 * decisões) agrupados por estágio, com badges de motor (determinístico/IA),
 * confiança e lineage. Clicar seleciona para inspeção no centro.
 */
import { Archive, Cpu, Sparkles, Trash2 } from "lucide-react";
import {
  KIND_LABEL, STAGE_META, STAGE_ORDER, type PipelineArtifact,
} from "@/lib/pipeline/types";
import { cn } from "@/lib/utils";

interface Props {
  artifacts: PipelineArtifact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const CONF_COLOR: Record<string, string> = {
  alta: "text-emerald-500",
  "média": "text-amber-500",
  baixa: "text-muted-foreground",
};

function relTime(ts: number) {
  const min = Math.round((Date.now() - ts) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}

export function ArtifactVault({ artifacts, selectedId, onSelect, onRemove, onClear }: Props) {
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 flex-shrink-0">
        <Archive className="h-4 w-4 text-primary" />
        <h3 className="text-xs font-bold text-foreground">Vault de artefatos</h3>
        <span className="text-[10px] text-muted-foreground">{artifacts.length}</span>
        {artifacts.length > 0 && (
          <button
            onClick={onClear}
            className="ml-auto text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Limpar
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3">
        {artifacts.length === 0 && (
          <div className="text-center py-8 px-3">
            <Archive className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">
              Nenhum artefato ainda. Execute a camada determinística ou o loop de descoberta —
              cada etapa gera um artefato com lineage.
            </p>
          </div>
        )}
        {STAGE_ORDER.filter((s) => s !== "data").map((stage) => {
          const list = artifacts.filter((a) => a.stage === stage);
          if (list.length === 0) return null;
          const meta = STAGE_META[stage];
          const Icon = meta.icon;
          return (
            <div key={stage}>
              <div className="flex items-center gap-1.5 px-1 mb-1">
                <Icon className={cn("h-3 w-3", meta.textColor)} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {meta.label}
                </span>
                <span className="text-[9px] text-muted-foreground/60">{list.length}</span>
              </div>
              <div className="space-y-1">
                {list.map((a) => (
                  <div
                    key={a.id}
                    className={cn(
                      "group w-full text-left rounded-md border px-2 py-1.5 transition-colors cursor-pointer",
                      selectedId === a.id
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/50 bg-card/60 hover:border-border hover:bg-secondary/40",
                    )}
                    onClick={() => onSelect(a.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(a.id); }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {a.engine === "ai"
                        ? <Sparkles className="h-3 w-3 text-violet-500 flex-shrink-0" aria-label="IA" />
                        : <Cpu className="h-3 w-3 text-sky-500 flex-shrink-0" aria-label="determinístico" />}
                      <span className="text-[11px] font-medium text-foreground truncate flex-1">{a.title}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemove(a.id); }}
                        aria-label={`Remover ${a.title}`}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-destructive transition-all flex-shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[9px] text-muted-foreground">
                      <span>{KIND_LABEL[a.kind]}</span>
                      <span aria-hidden>·</span>
                      <span>{relTime(a.createdAt)}</span>
                      {a.inputIds.length > 0 && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{a.inputIds.length} input(s)</span>
                        </>
                      )}
                      {a.confidence && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={CONF_COLOR[a.confidence]}>conf. {a.confidence}</span>
                        </>
                      )}
                    </div>
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
