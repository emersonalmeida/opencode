/**
 * AI Skills Inspector + Evaluation Panel — structured behavior specs (not prompt dumps)
 * and the evaluation framework (honestly labeled "to be measured").
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, FlaskRound, Gauge } from "lucide-react";
import { AI_SKILLS } from "@/lib/case/aiSkills";
import { EVALUATION_DIMENSIONS, EVALUATION_SAMPLES } from "@/lib/case/evaluation";
import { cn } from "@/lib/utils";
import { CaseCard, CaseLabel, CaseTag } from "./CaseShell";

export function SkillInspector() {
  const [activeId, setActiveId] = useState(AI_SKILLS[0].id);
  const navigate = useNavigate();
  const active = AI_SKILLS.find((s) => s.id === activeId) ?? AI_SKILLS[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
      <ol className="space-y-1">
        {AI_SKILLS.map((s) => {
          const isActive = s.id === activeId;
          return (
            <li key={s.id}>
              <button
                onClick={() => setActiveId(s.id)}
                className={cn(
                  "w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors",
                  isActive ? "bg-primary/5 text-foreground" : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                )}
              >
                <FlaskRound className={cn("h-3.5 w-3.5", isActive ? "text-primary" : "text-muted-foreground/60")} />
                <span className="text-xs font-medium leading-tight">{s.name}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <CaseCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="text-sm font-semibold text-foreground">{active.name}</h3>
          {active.sectionId && (
            <button
              onClick={() => navigate("/experiments")}
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
            >
              Ver em Experimentos <ArrowUpRight className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <CaseLabel>Input</CaseLabel>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{active.input}</p>
          </div>
          <div>
            <CaseLabel>Task</CaseLabel>
            <p className="text-xs text-foreground/80 mt-1 leading-relaxed">{active.task}</p>
          </div>
          <div>
            <CaseLabel>Output</CaseLabel>
            <ul className="mt-1.5 grid sm:grid-cols-2 gap-1.5">
              {active.outputs.map((o) => (
                <li key={o.label} className="rounded-md border border-border/50 bg-card/40 px-2 py-1.5">
                  <p className="text-[11px] font-semibold text-foreground">{o.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-snug">{o.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <CaseLabel>Avaliação</CaseLabel>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {active.evaluation.map((e) => <CaseTag key={e} tone="warn">{e}</CaseTag>)}
            </div>
          </div>
        </div>
      </CaseCard>
    </div>
  );
}

export function EvaluationPanel() {
  return (
    <div className="space-y-4">
      {/* Honest status banner */}
      <CaseCard className="p-4 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-2.5">
          <Gauge className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <span className="font-semibold">Status: framework definido, sem medição automatizada.</span>{" "}
            Não inventamos resultados. As dimensões abaixo descrevem <em>como</em> a IA seria avaliada;
            a infraestrutura de execução ainda não existe.
          </p>
        </div>
      </CaseCard>

      {/* Dimensions */}
      <CaseCard className="p-5 sm:p-6">
        <CaseLabel hint="critérios observáveis, não subjetivos">Dimensões de avaliação</CaseLabel>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          {EVALUATION_DIMENSIONS.map((d) => (
            <div key={d.id} className="rounded-lg border border-border/50 bg-card/40 p-3">
              <p className="text-xs font-semibold text-foreground">{d.name}</p>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{d.description}</p>
              <p className="text-[10px] text-muted-foreground/80 mt-2"><span className="font-medium">Critério de aprovação:</span> {d.passCriteria}</p>
            </div>
          ))}
        </div>
      </CaseCard>

      {/* Illustrative samples */}
      <CaseCard className="p-5 sm:p-6">
        <CaseLabel hint="estrutura da checagem">Conjunto de exemplos</CaseLabel>
        <div className="space-y-3 mt-3">
          {EVALUATION_SAMPLES.map((s) => (
            <div key={s.id} className="rounded-lg border border-border/50 bg-card/40 p-3">
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <p className="text-xs font-medium text-foreground italic">{s.claim}</p>
                <CaseTag tone={s.status === "framework" ? "default" : "warn"}>
                  {s.status === "framework" ? "framework" : "a medir"}
                </CaseTag>
              </div>
              <p className="text-[11px] text-muted-foreground"><span className="font-medium">Esperado:</span> {s.expected}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">{s.note}</p>
            </div>
          ))}
        </div>
      </CaseCard>
    </div>
  );
}
