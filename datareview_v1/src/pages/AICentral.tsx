/**
 * Central de IA (`/ia`) — TUDO sobre a IA do sistema em um só lugar:
 *
 *   1. Visão geral — modo/modelo/contexto ao vivo + contadores do que a IA gerou.
 *   2. Como funciona — o pipeline de IA de ponta a ponta, explicado.
 *   3. Configuração — as mesmas opções das Configurações (modo, modelo,
 *      comportamento, prompts editáveis) embutidas aqui.
 *   4. Capacidades — o que a IA lê, o que gera e seus limites (honesto).
 *   5. Análises & pipelines — catálogo executável (12 seções + 7 agentes).
 *   6. Playground — chat livre com a IA sobre os apps selecionados.
 *   7. O que a IA já fez — gerações, saídas persistidas e insights.
 *
 * Escopo = seleção global (aba Apps da sidebar direita); vazio = dataset inteiro.
 */
import { useMemo, useRef, useState } from "react";
import {
  BrainCircuit, Sparkles, Cpu, Settings2, Layers, Zap, Play, Loader2,
  Square, Send, History, Database, Workflow, BookOpenCheck, AlertCircle,
  CheckCircle2, FileText, Lightbulb, Eye, ShieldAlert,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { AIChatShortcuts } from "@/components/shared/AIChatShortcuts";
import { AISettingsPanel } from "@/components/AISettingsPanel";
import { AIBehaviorToggles, PromptsEditor } from "@/components/SettingsPanel";
import { useDataset } from "@/hooks/useDataset";
import { useSelection } from "@/context/SelectionContext";
import { useAISettings, isAIEnabled, PROVIDER_META } from "@/lib/aiSettings";
import { useSystemProfile } from "@/lib/systemProfile";
import { useGenerations } from "@/hooks/useSessions";
import { useAIOutputs } from "@/lib/aiOutputStore";
import { useInsights } from "@/lib/insightStore";
import { EXPERIMENT_SECTIONS, type SectionDef } from "@/lib/experimentSections";
import { PIPELINE_SHORTCUTS, type PipelineShortcut } from "@/lib/aiChatShared";
import { METHODOLOGIES } from "@/lib/methodologies";
import { PERSONAS } from "@/lib/decisionCenter";
import { streamExperiment } from "@/lib/experimentApi";
import { streamExperimentChat } from "@/lib/experimentChatApi";
import { entryKey } from "@/context/SelectionContext";
import { Link } from "react-router-dom";

interface ChatMsg { role: "user" | "assistant"; content: string; }

export default function AICentral() {
  const { entries } = useDataset();
  const { selected } = useSelection();
  const ai = useAISettings();
  const aiEnabled = isAIEnabled(ai);
  const { profile } = useSystemProfile();
  const generations = useGenerations();
  const outputs = useAIOutputs();
  const insights = useInsights();

  const scopedEntries = useMemo(
    () => (selected.size === 0 ? entries : entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)))),
    [entries, selected],
  );
  const totalReviews = useMemo(() => scopedEntries.reduce((s, e) => s + e.reviews.length, 0), [scopedEntries]);
  const scopedKeys = useMemo(() => scopedEntries.map((e) => entryKey(e.app.store, e.app.id)), [scopedEntries]);

  const aiGenerations = useMemo(() => generations.filter((g) => g.type !== "collect"), [generations]);
  const collectGenerations = useMemo(() => generations.filter((g) => g.type === "collect"), [generations]);

  // ---------- execução (análises, pipelines, playground) ----------
  const [output, setOutput] = useState("");
  const [outputTitle, setOutputTitle] = useState("");
  const [running, setRunning] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const [lastSectionId, setLastSectionId] = useState<SectionDef | null>(null);
  const [lastPipeline, setLastPipeline] = useState<PipelineShortcut | null>(null);

  const stop = () => { abortRef.current?.abort(); setRunning(""); };

  const guard = (): boolean => {
    if (!aiEnabled) { setError("A IA está desativada. Configure-a no bloco Configuração abaixo."); return false; }
    if (scopedEntries.length === 0) { setError("Nenhum app no escopo. Colete apps (busca na sidebar esquerda) ou selecione na aba Apps."); return false; }
    setError("");
    return true;
  };

  const runSection = async (section: SectionDef) => {
    if (running || !guard()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(section.id);
    setLastSectionId(section);
    setLastPipeline(null);
    setOutputTitle(`⚡ ${section.label}`);
    setOutput("");
    await streamExperiment(
      section.id,
      scopedEntries,
      {
        onToken: setOutput,
        onDone: setOutput,
        onError: (err) => setError(err),
      },
      controller.signal,
      ai,
    );
    setRunning("");
  };

  const runPipeline = async (pipeline: PipelineShortcut) => {
    if (running || !guard()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(pipeline.id);
    setLastPipeline(pipeline);
    setLastSectionId(null);
    setOutputTitle(`🔁 Pipeline: ${pipeline.label}`);
    setOutput("");
    for (let i = 0; i < pipeline.steps.length; i++) {
      if (controller.signal.aborted) break;
      const step = pipeline.steps[i];
      const header = `${i > 0 ? "\n\n---\n\n" : ""}## Etapa ${i + 1}/${pipeline.steps.length} — ${step.label}\n\n`;
      setOutput((prev) => prev + header);
      const append = (full: string) =>
        setOutput((prev) => prev.slice(0, prev.lastIndexOf(header)) + header + full);
      if (step.section === "custom" && step.prompt) {
        await streamExperimentChat(
          scopedEntries,
          [{ role: "user", content: step.prompt }],
          { onToken: append, onDone: append, onError: setError },
          controller.signal,
          ai,
        );
      } else {
        await streamExperiment(
          step.section,
          scopedEntries,
          { onToken: append, onDone: append, onError: setError },
          controller.signal,
          ai,
        );
      }
    }
    setRunning("");
  };

  // ---------- playground ----------
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatAbort = useRef<AbortController | null>(null);

  const sendChat = async (text?: string) => {
    const t = (text ?? chatInput).trim();
    if (!t || chatLoading) return;
    if (!aiEnabled) { setError("A IA está desativada. Configure-a no bloco Configuração."); return; }
    if (scopedEntries.length === 0) { setError("Nenhum app no escopo — o playground precisa de ao menos um app coletado/selecionado."); return; }
    setError("");
    const next: ChatMsg[] = [...chat, { role: "user", content: t }];
    const assistantIdx = next.length;
    setChat([...next, { role: "assistant", content: "" }]);
    setChatInput("");
    setChatLoading(true);
    chatAbort.current?.abort();
    const controller = new AbortController();
    chatAbort.current = controller;
    const write = (full: string) =>
      setChat((prev) => {
        const nxt = [...prev];
        nxt[assistantIdx] = { role: "assistant", content: full };
        return nxt;
      });
    await streamExperimentChat(
      scopedEntries,
      next,
      { onToken: write, onDone: write, onError: setError },
      controller.signal,
      ai,
    );
    setChatLoading(false);
  };

  const modeLabel = ai.mode === "auto" ? "Automático" : ai.mode === "local" ? "Local (Ollama)" : ai.mode === "cloud" ? `Cloud (${PROVIDER_META[ai.cloud.provider]?.label ?? ai.cloud.provider})` : "Desativada";
  const modelLabel = ai.mode === "cloud" ? ai.cloud.model : ai.local.model === "auto" ? (profile?.recommended?.model ?? "auto") : ai.local.model;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        backTo="/"
        title="Central de IA"
        crumb="Tudo sobre a inteligência artificial do sistema"
      />
      <main className="content-fluid py-6 space-y-4">
        {/* ---------- 1. Visão geral ---------- */}
        <ExpandableBlock
          id="ia-visao-geral"
          title="Visão geral"
          subtitle="Estado atual da IA e o que ela já produziu"
          icon={<BrainCircuit className="h-4 w-4" />}
          storageKey="ia:visao-geral"
          exportName="ia-visao-geral"
          exportData={() => ({
            modo: ai.mode, modelo: modelLabel,
            escopo: { apps: scopedEntries.length, reviews: totalReviews },
            geracoes: generations.length, saidasPersistidas: outputs.length, insights: insights.length,
            hardware: profile ? { tier: profile.tier, modeloRecomendado: profile.recommended?.model, numCtx: profile.recommended?.numCtx } : null,
          })}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Modo" value={modeLabel} icon={<Sparkles className="h-4 w-4 text-violet-500" />} />
            <KpiCard label="Modelo" value={modelLabel || "—"} icon={<Cpu className="h-4 w-4 text-primary" />} />
            <KpiCard label="Escopo" value={`${scopedEntries.length} apps · ${totalReviews} reviews`} icon={<Database className="h-4 w-4 text-emerald-500" />} />
            <KpiCard label="Gerações" value={String(aiGenerations.length)} icon={<Zap className="h-4 w-4 text-amber-500" />} />
            <KpiCard label="Saídas salvas" value={String(outputs.length)} icon={<FileText className="h-4 w-4 text-sky-500" />} />
            <KpiCard label="Insights" value={String(insights.length)} icon={<Lightbulb className="h-4 w-4 text-rose-500" />} />
          </div>
          {profile && (
            <div className="mt-3 rounded-lg border border-border/50 bg-secondary/30 p-3 text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5" />
                Hardware detectado: <strong className="text-foreground">{profile.tier}</strong>
              </span>
              {profile.recommended && (
                <span>
                  Recomendado: <strong className="text-foreground">{profile.recommended.model}</strong> · ctx {profile.recommended.numCtx.toLocaleString()} tokens
                </span>
              )}
              <span>{collectGenerations.length} coletas registradas</span>
            </div>
          )}
        </ExpandableBlock>

        {/* ---------- 2. Como funciona ---------- */}
        <ExpandableBlock
          id="ia-como-funciona"
          title="Como a IA funciona"
          subtitle="O pipeline de ponta a ponta, do review ao insight"
          icon={<Workflow className="h-4 w-4" />}
          storageKey="ia:como-funciona"
          exportName="ia-como-funciona"
          exportData={() => COMO_FUNCIONA.join("\n")}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {COMO_FUNCIONA.map((step, i) => (
              <div key={i} className="rounded-lg border border-border/50 bg-card p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">Etapa {i + 1}</p>
                <p className="text-sm font-medium mb-1.5">{step.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-border/50 bg-secondary/30 p-3 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Garantias de confiabilidade:</strong> toda análise segue a regra de
            evidência (citações reais em blockquote + cálculos explícitos), marca "(confiança: baixa)" quando o dado
            é fraco, e nunca inventa números — se não há evidência, a IA diz explicitamente. Os prompts são
            metodológicos (objetivo → método → formato de saída → critério de qualidade) e você pode editá-los no
            bloco Configuração.
          </div>
        </ExpandableBlock>

        {/* ---------- 3. Configuração ---------- */}
        <ExpandableBlock
          id="ia-config"
          title="Configuração da IA"
          subtitle="Modo, modelo, comportamento e prompts — tudo editável, efeito imediato"
          icon={<Settings2 className="h-4 w-4" />}
          storageKey="ia:config"
        >
          <AISettingsPanel />
          <div className="mt-4 space-y-3">
            <AIBehaviorToggles />
            <PromptsEditor />
          </div>
        </ExpandableBlock>

        {/* ---------- 4. Capacidades ---------- */}
        <ExpandableBlock
          id="ia-capacidades"
          title="Capacidades e limites"
          subtitle="O que a IA lê, o que gera — e o que ela NÃO faz"
          icon={<Eye className="h-4 w-4" />}
          storageKey="ia:capacidades"
          exportName="ia-capacidades"
          exportData={() => ({ le: CAPACIDADES_LE, gera: CAPACIDADES_GERA, limites: LIMITES })}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CapabilityCard title="O que a IA lê" icon={<Database className="h-4 w-4 text-emerald-500" />} items={CAPACIDADES_LE} />
            <CapabilityCard title="O que a IA gera" icon={<Sparkles className="h-4 w-4 text-violet-500" />} items={CAPACIDADES_GERA} />
            <CapabilityCard title="Limites honestos" icon={<ShieldAlert className="h-4 w-4 text-amber-500" />} items={LIMITES} />
          </div>
        </ExpandableBlock>

        {/* ---------- 5. Análises & pipelines ---------- */}
        <ExpandableBlock
          id="ia-analises"
          title="Análises e pipelines"
          subtitle={`Catálogo executável — ${EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai").length} análises · ${PIPELINE_SHORTCUTS.length} pipelines de agentes · ${METHODOLOGIES.length} metodologias · ${PERSONAS.length} personas`}
          icon={<Layers className="h-4 w-4" />}
          storageKey="ia:analises"
        >
          <AIChatShortcuts
            entries={scopedEntries}
            disabled={!!running}
            onRunSection={runSection}
            onRunPipeline={runPipeline}
            onSuggestion={(s) => void sendChat(s)}
            maxSuggestions={4}
          />
          {(running || output || error) && (
            <div className="mt-3">
              {running && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando — acompanhe ao vivo…
                  <button onClick={stop} className="inline-flex items-center gap-1 text-destructive hover:underline" aria-label="Parar geração">
                    <Square className="h-3 w-3" /> Parar
                  </button>
                </div>
              )}
              <AIOutputCard
                title={outputTitle || "Resultado"}
                content={output}
                streaming={!!running}
                storageKey="ia:analises:output"
                onRegenerate={
                  running || !aiEnabled
                    ? undefined
                    : lastSectionId
                      ? () => void runSection(lastSectionId)
                      : lastPipeline
                        ? () => void runPipeline(lastPipeline)
                        : undefined
                }
              />
            </div>
          )}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
            <p className="rounded-lg border border-border/40 bg-secondary/20 p-2.5">
              <BookOpenCheck className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
              <strong className="text-foreground">{METHODOLOGIES.length} metodologias</strong> de pesquisa/UX/produto/negócio ficam na página <Link to="/metodologias" className="text-primary hover:underline">Metodologias</Link>.
            </p>
            <p className="rounded-lg border border-border/40 bg-secondary/20 p-2.5">
              <BrainCircuit className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
              <strong className="text-foreground">{PERSONAS.length} personas de decisão</strong> (CEO a Engenharia) ficam no <Link to="/decision-center" className="text-primary hover:underline">Decision Center</Link>.
            </p>
          </div>
        </ExpandableBlock>

        {/* ---------- 6. Playground ---------- */}
        <ExpandableBlock
          id="ia-playground"
          title="Playground de IA"
          subtitle="Teste a IA livremente sobre os apps selecionados — com evidências"
          icon={<Play className="h-4 w-4" />}
          storageKey="ia:playground"
        >
          {chat.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {scopedEntries.length > 0
                  ? `Escopo atual: ${scopedEntries.length} app(s) · ${totalReviews} reviews. Pergunte qualquer coisa — a IA responde com citações reais dos reviews.`
                  : "Colete apps (busca na sidebar esquerda) para conversar com a IA sobre eles."}
              </p>
              {scopedEntries.length > 0 && (
                <AIChatShortcuts
                  entries={scopedEntries}
                  disabled={chatLoading}
                  onRunSection={runSection}
                  onRunPipeline={runPipeline}
                  onSuggestion={(s) => void sendChat(s)}
                  showSuggestions
                  maxSuggestions={4}
                />
              )}
            </div>
          ) : (
            <div className="space-y-3" role="log" aria-live="polite" aria-label="Conversa do playground">
              {chat.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-xl rounded-br-sm bg-primary/10 border border-primary/25 px-3 py-2 text-sm">{m.content}</div>
                  </div>
                ) : (
                  <AIOutputCard
                    key={i}
                    title={`IA${i === chat.length - 1 && chatLoading ? " · gerando…" : ""}`}
                    content={m.content}
                    streaming={chatLoading && i === chat.length - 1}
                    storageKey={`ia:playground:${i}`}
                  />
                ),
              )}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando…
                  <button onClick={() => { chatAbort.current?.abort(); setChatLoading(false); }} className="text-destructive hover:underline">parar</button>
                </div>
              )}
            </div>
          )}
          {scopedEntries.length > 0 && (
            <div className="mt-3 flex gap-2 items-end">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
                placeholder="Pergunte sobre os apps selecionados…"
                rows={2}
                disabled={chatLoading}
                className="flex-1 resize-none text-sm bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                aria-label="Mensagem para o playground de IA"
              />
              <Button onClick={() => void sendChat()} disabled={chatLoading || !chatInput.trim()} aria-label="Enviar">
                {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </ExpandableBlock>

        {/* ---------- 7. O que a IA já fez ---------- */}
        <ExpandableBlock
          id="ia-historico"
          title="O que a IA já fez"
          subtitle={`${aiGenerations.length} gerações · ${outputs.length} saídas salvas · ${insights.length} insights`}
          icon={<History className="h-4 w-4" />}
          storageKey="ia:historico"
        >
          {aiGenerations.length === 0 && outputs.length === 0 && insights.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Nada gerado ainda. Rode uma análise acima ou em qualquer página — tudo aparece aqui.
            </div>
          ) : (
            <div className="space-y-3">
              {outputs.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Saídas persistidas ({outputs.length})</p>
                  <div className="space-y-2">
                    {outputs.slice(0, 8).map((o) => (
                      <AIOutputCard
                        key={o.key}
                        title={`${o.section} · ${new Date(o.updatedAt).toLocaleString("pt-BR")}`}
                        content={o.markdown}
                        provenance={o.provenance}
                        storageKey={`ia:out:${o.key}`}
                      />
                    ))}
                  </div>
                </div>
              )}
              {insights.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Insights recentes ({insights.length})</p>
                  <div className="space-y-2">
                    {insights.slice(0, 5).map((ins) => (
                      <AIOutputCard
                        key={ins.id}
                        title={`${ins.section} · ${new Date(ins.generatedAt).toLocaleString("pt-BR")}`}
                        content={ins.markdown}
                        provenance={ins.provenance}
                        storageKey={`ia:ins:${ins.id}`}
                      />
                    ))}
                  </div>
                </div>
              )}
              {aiGenerations.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-2">Gerações registradas ({aiGenerations.length})</p>
                  <div className="space-y-1.5">
                    {aiGenerations.slice(0, 10).map((g) => (
                      <div key={g.id} className="rounded-lg border border-border/40 bg-card px-3 py-2 flex items-center gap-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        <span className="flex-1 truncate font-medium">{g.title}</span>
                        <span className="text-muted-foreground shrink-0">{g.type}</span>
                        <span className="text-muted-foreground/70 shrink-0">{new Date(g.createdAt).toLocaleString("pt-BR")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ExpandableBlock>

        {error && (
          <p className="text-sm text-destructive flex items-center gap-2" role="alert">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}
      </main>
    </div>
  );
}

/* ------------------------------------------------------------ helpers --- */

function KpiCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-3 min-w-0">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-wider truncate">{label}</span>
      </div>
      <p className="text-sm font-semibold truncate" title={value}>{value}</p>
    </div>
  );
}

function CapabilityCard({ title, icon, items }: { title: string; icon: React.ReactNode; items: string[] }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-3">
      <p className="text-sm font-medium flex items-center gap-2 mb-2">{icon}{title}</p>
      <ul className="space-y-1.5">
        {items.map((it) => (
          <li key={it} className="text-xs text-muted-foreground leading-relaxed flex gap-1.5">
            <span className="text-primary mt-0.5">•</span>{it}
          </li>
        ))}
      </ul>
    </div>
  );
}

const COMO_FUNCIONA = [
  { title: "Coleta", text: "Reviews reais são coletados das lojas (Apple: amp-api + SSR + RSS; Google: scraper multi-sort), com dedup por id e enriquecimento determinístico (sentimento por nota, tamanho, flags)." },
  { title: "Dataset local", text: "Tudo fica no seu navegador (localStorage) — nada sai da máquina. A seleção global (aba Apps) define o escopo de cada análise; vazio = dataset inteiro." },
  { title: "Prompt metodológico", text: "Cada análise usa um prompt profissional: objetivo → método → formato de saída → critério de qualidade, com regra de evidência obrigatória (citações reais + cálculos). Você pode editá-los." },
  { title: "Geração + persistência", text: "A resposta chega em streaming (você acompanha ao vivo) e fica salva localmente (saídas, insights, gerações) — reload nunca apaga o que a IA produziu." },
];

const CAPACIDADES_LE = [
  "Dataset completo: todos os apps e reviews coletados (com metadados, notas, datas, versões, países, thumbsUp)",
  "Agregados calculados sobre o total coletado (distribuição de notas, % sentimento) — não só a amostra",
  "O que já foi gerado: saídas, insights, gerações e artefatos anteriores",
  "Estado vivo do sistema: página atual, tarefas em execução, contadores",
  "Configuração de IA (modo, modelo) e o perfil de hardware detectado",
];

const CAPACIDADES_GERA = [
  "12 seções de análise (resumo, problemas, solicitações, oportunidades, ROI, evidências…)",
  "Chat com evidências: citações reais em blockquote + cálculos explícitos",
  "Pipelines de agentes (sequências de análises por segmento: Produto, UX, Engenharia…)",
  "Decisões por persona (CEO, CPO, PM, UX, Engenharia, Marketing, Competitiva)",
  "Apresentações, artefatos de pesquisa, relatórios no Canvas, metodologias",
];

const LIMITES = [
  "Opera SOMENTE sobre o que foi coletado — não acessa a internet nem as lojas diretamente",
  "Não executa código nem altera dados — apenas lê e gera texto/markdown",
  "Marca (confiança: baixa) quando a evidência é escassa — e diz quando não há evidência",
  "Amostragem estratificada quando o volume excede o contexto (agregados sempre do total)",
  "Sem IA ativada, o sistema segue funcional com análises determinísticas (gráficos, KPIs, anomalias)",
];
