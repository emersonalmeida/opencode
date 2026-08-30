/**
 * Case IA (/case-ia) — a IA gera um CASE completo sobre os dados coletados,
 * na lente de QUALQUER perfil de profissional (CEO, PM, UX, Eng, PO,
 * Marketing, Pesquisa, Suporte, Competitiva).
 *
 * Fluxo da página (mesmo padrão das páginas do sistema):
 *  1. escopo = seleção global (vazio = dataset inteiro) — sem dados,
 *     QuickCollect inline (pesquisa → coleta → seleção sem sair);
 *  2. Preparação determinística (computeFacts + anomalias) — a IA escreve
 *     sobre números computados, não inventa (regra de evidência do prompt);
 *  3. Geração via streamExperiment (seção "case-ia") com AIOutputCard —
 *     regenerável, voz, zoom, persistida em aiOutputStore.
 *  4. Cases salvos em "Minhas páginas" (customPages) para virar apresentação.
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Loader2, Sparkles, Save } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { QuickCollect } from "@/components/shared/QuickCollect";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled, getAISettings } from "@/lib/aiSettings";
import { computeFacts, factsToMarkdown } from "@/lib/pipeline/facts";
import { detectAnomalies } from "@/lib/pipeline/anomalies";
import { CASE_PROFILES, buildCasePrompt, caseTitle, type CaseProfile } from "@/lib/caseIa";
import { createCustomPage } from "@/lib/customPages";
import { toastSuccess, toastError } from "@/lib/ux";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import { cn } from "@/lib/utils";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";

export default function CaseIa() {
  const navigate = useNavigate();
  const { entries } = useDataset();
  const { selected } = useSelection();
  const aiSettings = useAISettings();
  const [profileId, setProfileId] = useState(CASE_PROFILES[0].id);
  const [generating, setGenerating] = useState(false);
  const [live, setLive] = useState("");
  const [done, setDone] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const scoped = useMemo(() => {
    const sel = entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)));
    return sel.length > 0 ? sel : entries;
  }, [entries, selected]);

  const profile = CASE_PROFILES.find((p) => p.id === profileId) ?? CASE_PROFILES[0];
  const aiOk = isAIEnabled(aiSettings);
  const hasData = scoped.length > 0;

  const run = async () => {
    if (!aiOk) { toastError("Ative a IA em Configurações → IA (modo auto funciona sozinho)."); return; }
    if (!hasData) { toastError("Colete apps primeiro — sem dados não há evidência para o case."); return; }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setGenerating(true);
    setLive("");
    setDone("");
    // Preparação determinística: a IA escreve sobre números computados.
    const facts = computeFacts(scoped);
    const names = Object.fromEntries(scoped.map((e) => [entryKey(e.app.store, e.app.id), e.app.name]));
    const prepared = factsToMarkdown(facts, names)
      + (() => {
          const anomalies = detectAnomalies(scoped, facts);
          return anomalies.length > 0
            ? "\n\nAnomalias detectadas:\n" + anomalies.map((a) => `- ${a.title}: ${a.detail}`).join("\n")
            : "";
        })();
    try {
      await streamExperimentChat(
        scoped,
        [{ role: "user", content: buildCasePrompt(profile, prepared) }],
        {
          onToken: (text) => setLive(text),
          onDone: (full) => { setDone(full); setLive(""); setGenerating(false); },
          onError: (err) => { toastError(`Falha na geração: ${err}`); setGenerating(false); },
        },
        ctrl.signal,
        getAISettings(),
        "custom",
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") toastError(`Falha na geração: ${e instanceof Error ? e.message : "erro"}`);
      setGenerating(false);
    }
  };

  const saveAsPage = () => {
    if (!done.trim()) { toastError("Gere o case antes de salvar."); return; }
    const page = createCustomPage(caseTitle(done, profile.label));
    toastSuccess(`Case "${page.name}" salvo em Minhas páginas.`);
    navigate(`/p/${page.id}`);
  };

  return (
    <ErrorBoundary title="Erro ao renderizar o Case IA">
      <div className="flex h-full min-h-0 flex-col">
        <AppHeader title="Case IA" crumb="IA gera o case por perfil profissional sobre os dados" showSearch={false} />
        <main id="content" className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-4xl space-y-4">
            {/* 1. Escopo de dados */}
            <ExpandableBlock
              id="case-scope" storageKey="case-scope"
              title={`Dados em escopo · ${scoped.length} app(s) · ${scoped.reduce((s, e) => s + e.reviews.length, 0)} reviews`}
              subtitle={selected.size > 0 ? "seleção global" : "dataset inteiro (seleção vazia)"}
              icon={<Briefcase className="h-4 w-4 text-primary" />}
              exportName="case-escopo"
              exportData={() => scoped.map((e) => ({ app: e.app.name, loja: e.app.store, reviews: e.reviews.length }))}
            >
              {hasData ? (
                <ul className="grid gap-1.5 p-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Apps em escopo">
                  {scoped.map((e) => (
                    <li key={entryKey(e.app.store, e.app.id)} className="flex items-center gap-2 rounded-lg border border-border/50 bg-card/60 px-2 py-1.5 text-xs">
                      {e.app.icon ? <img src={e.app.icon} alt="" className="h-6 w-6 rounded" loading="lazy" /> : <span className="h-6 w-6 rounded bg-secondary" />}
                      <span className="min-w-0 flex-1 truncate font-medium">{e.app.name}</span>
                      <span className="text-[10px] text-muted-foreground">{e.reviews.length} reviews</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="p-3">
                  <EmptyState
                    icon={Briefcase}
                    title="Sem dados coletados"
                    description="Pesquise e colete apps (com reviews) aqui mesmo — a IA gera o case com base nessa evidência."
                    collect
                  />
                </div>
              )}
            </ExpandableBlock>

            {/* 2. Perfil */}
            <ExpandableBlock
              id="case-profile" storageKey="case-profile"
              title="Perfil profissional"
              subtitle={profile.lens}
              exportName="case-perfil"
              exportData={() => ({ perfil: profile.label, lente: profile.lens, perguntas: profile.questions })}
            >
              <div className="grid gap-1.5 p-3 sm:grid-cols-3" role="radiogroup" aria-label="Perfil do case">
                {CASE_PROFILES.map((p) => {
                  const Icon = p.icon;
                  const active = profileId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setProfileId(p.id)}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border p-2.5 text-left text-xs",
                        active ? "border-primary/60 bg-primary/5" : "border-border/50 hover:border-primary/30",
                      )}
                    >
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-medium">{p.label}</span>
                        <span className="block text-[10px] text-muted-foreground">{p.lens}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </ExpandableBlock>

            {/* 3. Gerar */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={run}
                disabled={generating || !aiOk || !hasData}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                {generating ? "Gerando o case…" : `Gerar case com olhar de ${profile.label}`}
              </button>
              {generating && (
                <button
                  type="button"
                  onClick={() => abortRef.current?.abort()}
                  className="rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:border-destructive/50 hover:text-destructive"
                >
                  Parar
                </button>
              )}
              {done.trim() && (
                <button
                  type="button"
                  onClick={saveAsPage}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary"
                >
                  <Save className="h-3.5 w-3.5" aria-hidden /> Salvar como página
                </button>
              )}
{!aiOk && <AIDisabledNotice compact />}
              {!hasData && (
                <p className="text-[11px] text-muted-foreground">
                  Sem dados — colete apps na seção acima para a IA ter evidência.
                </p>
              )}
            </div>

            {/* 4. Saída (AIOutputCard com voz, zoom, persistência) */}
            {(done || live) && (
              <AIOutputCard
                content={done || live}
                streaming={generating}
                filename={`case-${profile.id}`}
                storageKey={`case-ia-${profile.id}`}
                onRegenerate={!generating ? () => void run() : undefined}
              />
            )}

            {!done && !live && hasData && aiOk && (
              <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                Escolha o perfil e clique em "Gerar case" — a IA estrutura o case sobre os dados com evidência honesta.
              </p>
            )}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
