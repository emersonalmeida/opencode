/**
 * UnifiedChatPanel — o componente de chat PADRONIZADO do sistema.
 *
 * Um único painel de conversa que funciona COM e SEM IA, em qualquer
 * superfície (página, sidebar, modal, embutido):
 *
 *   - SEM IA: detecta intenção em linguagem natural (chatCommands) e AGE —
 *     exibe componentes reais do sistema na conversa (EmbeddedSurface),
 *     coleta apps, pesquisa em todas as fontes Uni, gera relatório
 *     determinístico do dataset. "ajuda" lista as capacidades.
 *   - COM IA: streaming via streamExperimentChat com concorrência paralela
 *     (chatStream) ou fila sequencial, igual à página Chat.
 *   - Toda saída usa AIOutputCard (padrão do sistema) — copiar/baixar, voz,
 *     escala, componentes embutidos (fence ```component) na resposta da IA.
 *   - Composer padronizado (ChatComposer) com ditado por voz.
 *   - Sugestões rápidas configuráveis + hint de IA desativada.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrainCircuit, Sparkles } from "lucide-react";
import { ChatMessageBlock } from "@/components/shared/ChatMessageBlock";
import { ChatScrollGroup } from "@/components/shared/ChatScrollGroup";
import { suggestQuickReplies } from "@/lib/quickReplies";
import { ChatComposer } from "@/components/shared/ChatComposer";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { getAISettings, isAIEnabled, isParallelIA, useAISettings } from "@/lib/aiSettings";
import { appendPlaceholder, patchIndex } from "@/lib/chatStream";

import { detectChatIntent, CHAT_COMMANDS_HELP, type ChatAction } from "@/lib/chatCommands";
import { useDataset } from "@/hooks/useDataset";
import { useSelection, entryKey } from "@/context/SelectionContext";
import type { DatasetEntry } from "@/lib/datasetStore";
import { searchApps } from "@/lib/appStoreApi";
import { searchGooglePlayApps } from "@/lib/googlePlayApi";
import { collectAndSelect } from "@/lib/collectAndSelect";
import { collectFromSource } from "@/lib/uni/sourceRunner";
import { saveCollection } from "@/lib/uni/uniStore";
import { UNI_SOURCE_META } from "@/lib/uni/types";
import { computeKPIs, computePerAppStats } from "@/lib/dashboardAnalytics";
import { recordGeneration } from "@/lib/sessionStore";
import { logActivity } from "@/lib/activityStore";
import { toastError } from "@/lib/ux";
import { cn } from "@/lib/utils";

/** Item da conversa: mensagem de texto OU componente embutido. */
export interface UnifiedChatItem {
  role: "user" | "assistant";
  content: string;
  /** Componente real renderizado na conversa (ação sem IA ou fence da IA). */
  surfaceId?: string;
  surfaceLabel?: string;
  /** Página real embutida na conversa (intent goto — iframe same-origin). */
  page?: { path: string; label: string };
}

export interface UnifiedChatPanelProps {
  /** Escopo explícito de apps (default: seleção global; vazia = dataset todo). */
  apps?: DatasetEntry[];
  /** Seção do experiment-analyze (default "custom"). Use "os" p/ system prompt próprio. */
  section?: string;
  /** System prompt customizado (só section "os" no servidor — ex.: Uni). */
  systemPromptOverride?: string;
  /** Sugestões rápidas exibidas quando a conversa está vazia. */
  suggestions?: string[];
  /** Desativa a detecção de intenção sem IA (tudo vai para a IA). */
  disableIntents?: boolean;
  /** Mensagem inicial do assistente. */
  welcomeMessage?: string;
  /** Altura máxima da área de mensagens (classe tailwind). */
  messagesClassName?: string;
  /** Elemento extra acima do composer (ex.: chips de contexto). */
  headerExtra?: ReactNode;
  /** Persistência externa opcional (Chat page salva no chatHistoryStore). */
  onMessagesChange?: (messages: UnifiedChatItem[]) => void;
  /** Valor inicial (reidratação de sessão). */
  initialMessages?: UnifiedChatItem[];
  className?: string;
}

/** Relatório determinístico (sem IA) do escopo atual. */
function buildDeterministicReport(entries: DatasetEntry[], scope: string | null): string {
  if (entries.length === 0) {
    return "## Relatório\n\nO dataset está vazio. Peça **\"colete <app>\"** ou **\"pesquise <termo> em todas as fontes\"** para começar.";
  }
  const scoped = scope
    ? entries.filter((e) => e.app.name.toLowerCase().includes(scope.toLowerCase()))
    : entries;
  const use = scoped.length > 0 ? scoped : entries;
  const reviews = use.flatMap((e) => e.reviews);
  const kpis = computeKPIs(reviews, use);
  const perApp = computePerAppStats(use);
  const lines: string[] = [
    `# Relatório ${scope ? `— ${scope}` : "geral"} (determinístico, sem IA)`,
    "",
    `## Visão geral`,
    `- **Apps**: ${kpis.totalApps} · **Reviews**: ${kpis.totalReviews} · **Nota média coletada**: ${kpis.avgRating}`,
    `- **Sentimento**: ${kpis.positivePct}% positivo · ${kpis.neutralPct}% neutro · ${kpis.negativePct}% negativo`,
    kpis.oldestDate && kpis.newestDate
      ? `- **Período**: ${new Date(kpis.oldestDate).toLocaleDateString("pt-BR")} → ${new Date(kpis.newestDate).toLocaleDateString("pt-BR")}`
      : "",
    `- **Respostas de desenvolvedor**: ${kpis.withDeveloperReply}`,
    "",
    `## Por app`,
    ...perApp.map(
      (s) =>
        `- **${s.name}** [${s.store}] — ${s.reviewCount} reviews · média ${s.avgCollected.toFixed(2)} · ${s.positivePct}% pos / ${s.negativePct}% neg`,
    ),
    "",
    `> Relatório gerado sem IA a partir dos dados coletados. Com IA ativada, peça "analise os dados" para um relatório interpretativo.`,
  ];
  return lines.filter((l) => l !== "").join("\n");
}

const DEFAULT_SUGGESTIONS = [
  "exiba os gráficos",
  "gere um relatório",
  "ajuda",
];

export function UnifiedChatPanel({
  apps,
  section = "custom",
  systemPromptOverride,
  suggestions = DEFAULT_SUGGESTIONS,
  disableIntents = false,
  welcomeMessage,
  messagesClassName,
  headerExtra,
  onMessagesChange,
  initialMessages,
  className,
}: UnifiedChatPanelProps) {
  const ai = useAISettings();
  const enabled = isAIEnabled(ai);
  const { entries } = useDataset();
  const { selected } = useSelection();

  /** Escopo efetivo: prop apps > seleção global > dataset inteiro. */
  const scopeApps = apps ?? (selected.size > 0
    ? entries.filter((e) => selected.has(entryKey(e.app.store, e.app.id)))
    : entries);

  const [items, setItems] = useState<UnifiedChatItem[]>(
    initialMessages ?? (welcomeMessage ? [{ role: "assistant", content: welcomeMessage }] : []),
  );
  const [draft, setDraft] = useState("");
  const [inFlight, setInFlight] = useState(0);
  const loading = inFlight > 0;
  const abortsRef = useRef<Set<AbortController>>(new Set());
  const queueRef = useRef<Array<() => void>>([]);

  const parallel = isParallelIA(getAISettings());

  useEffect(() => { onMessagesChange?.(items); }, [items, onMessagesChange]);

  // Auto-scroll vive no ChatScrollGroup (rolagem, follow inteligente, chip
  // "Recentes") — o painel só passa `deps` para o grupo.

  // Drena a fila FIFO no modo sequencial.
  useEffect(() => {
    if (parallel) return;
    if (inFlight === 0 && queueRef.current.length > 0) {
      const t = queueRef.current.shift();
      t?.();
    }
  });

  const stopAll = useCallback(() => {
    for (const c of abortsRef.current) c.abort();
    abortsRef.current.clear();
    queueRef.current = [];
    setInFlight(0);
  }, []);

  /* ------------------------------------------------------ ações sem IA -- */

  const appendAssistant = (content: string, extra?: Partial<UnifiedChatItem>) =>
    setItems((prev) => [...prev, { role: "assistant", content, ...extra }]);

  const runShow = useCallback((action: Extract<ChatAction, { kind: "show" }>) => {
    appendAssistant(`Aqui está **${action.label}** — o componente real, pronto para usar:`, {
      surfaceId: action.surfaceId,
      surfaceLabel: action.label,
    });
    logActivity("chat", "done", `Componente exibido: ${action.label}`);
  }, []);

  const runCollectApp = useCallback(async (term: string) => {
    appendAssistant(`🔎 Buscando **${term}** nas lojas Apple e Google Play…`);
    try {
      const [apple, google] = await Promise.allSettled([
        searchApps(term, undefined, 3),
        searchGooglePlayApps(term, undefined, 3),
      ]);
      const results = [
        ...(apple.status === "fulfilled" ? apple.value : []),
        ...(google.status === "fulfilled" ? google.value : []),
      ];
      if (results.length === 0) {
        appendAssistant(`Nenhum app encontrado para **${term}**. Tente outro termo.`);
        return;
      }
      const best = results[0];
      appendAssistant(`Coletando **${best.name}** [${best.store}] (reviews + metadados)…`);
      const res = await collectAndSelect(best);
      if (res) {
        appendAssistant(
          `✓ **${best.name}** coletado e selecionado — ${res.entry.reviews.length} reviews no dataset. Peça "exiba os gráficos" ou "gere um relatório" para explorar.`,
        );
        recordGeneration({
          type: "collect",
          title: `${best.name} · chat`,
          appKeys: [entryKey(best.store, best.id)],
          summary: `${res.entry.reviews.length} reviews coletados`,
          source: "chat",
        });
      } else {
        appendAssistant(`Não consegui coletar **${best.name}** agora (rede/limite da loja). Tente novamente em instantes.`);
      }
    } catch (e) {
      appendAssistant(`Falha na busca: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    }
  }, []);

  const runCollectMulti = useCallback(async (action: Extract<ChatAction, { kind: "collect-multi" }>) => {
    const mode = action.max ? "max" : "normal";
    appendAssistant(
      `🌐 Pesquisando **${action.term}** em ${action.sources.length} fonte(s) (modo ${mode})… isso pode levar alguns segundos.`,
    );
    logActivity("chat", "start", `Pesquisa multifonte: ${action.term}`);
    const okSources: string[] = [];
    const failed: string[] = [];
    let total = 0;
    for (const src of action.sources) {
      try {
        const out = await collectFromSource(src, action.term, mode as "fast" | "normal" | "max");
        if (out.ok && out.items.length > 0) {
          saveCollection({
            label: `${UNI_SOURCE_META[src]?.label ?? src} · ${action.term}`,
            source: src,
            query: action.term,
            items: out.items,
          });
          okSources.push(`${UNI_SOURCE_META[src]?.label ?? src} (${out.items.length})`);
          total += out.items.length;
        } else if (out.skippedReason) {
          failed.push(`${UNI_SOURCE_META[src]?.label ?? src}: ${out.skippedReason}`);
        }
      } catch {
        failed.push(UNI_SOURCE_META[src]?.label ?? src);
      }
    }
    logActivity("chat", "done", `Pesquisa multifonte concluída: ${action.term}`, `${total} itens`);
    const lines = [
      `## Pesquisa multifonte — ${action.term}`,
      "",
      `**${total} itens coletados** de ${okSources.length} fonte(s), salvos nas coleções da Uni (página /00):`,
      "",
      ...okSources.map((s) => `- ✓ ${s}`),
    ];
    if (failed.length > 0) {
      lines.push("", `Fontes sem resultado:`, ...failed.slice(0, 6).map((s) => `- ⚠ ${s}`));
    }
    appendAssistant(lines.join("\n"));
    recordGeneration({
      type: "collect",
      title: `Multifonte · ${action.term}`,
      appKeys: [],
      summary: `${total} itens de ${okSources.length} fontes`,
      source: "chat",
    });
  }, []);

  const runReport = useCallback((action: Extract<ChatAction, { kind: "report" }>) => {
    appendAssistant(buildDeterministicReport(scopeApps, action.scope));
  }, [scopeApps]);

  /**
   * "Execute o pipeline" / "rode a análise de problemas":
   * - Sem seção: pipeline DETERMINÍSTICO (fatos + anomalias) — sem IA.
   * - Com seção: roda a seção de IA via streamExperiment (exige IA ativa).
   */
  const runPipeline = useCallback(async (action: Extract<ChatAction, { kind: "run-pipeline" }>) => {
    if (scopeApps.length === 0) {
      appendAssistant("O dataset está vazio — peça **\"colete <app>\"** primeiro e depois execute o pipeline.");
      return;
    }
    const appNames = Object.fromEntries(scopeApps.map((e) => [entryKey(e.app.store, e.app.id), e.app.name]));

    // Sem seção específica: fatos + anomalias determinísticos (funciona sem IA).
    if (!action.sectionId) {
      appendAssistant("⚙️ Executando o pipeline determinístico (fatos + anomalias)…");
      const { computeFacts, factsToMarkdown } = await import("@/lib/pipeline/facts");
      const { detectAnomalies } = await import("@/lib/pipeline/anomalies");
      const facts = computeFacts(scopeApps);
      const anomalies = detectAnomalies(scopeApps, facts);
      const md = [
        "## Pipeline — fatos computados (sem IA)",
        "",
        factsToMarkdown(facts, appNames),
        "",
        `## Anomalias (${anomalies.length})`,
        ...(anomalies.length > 0
          ? anomalies.map((a) => `- **[${a.severity.toUpperCase()}]** ${a.title} — ${a.detail}`)
          : ["Nenhuma anomalia detectada com os dados atuais."]),
      ].join("\n");
      appendAssistant(md);
      logActivity("chat", "done", "Pipeline determinístico executado", `${anomalies.length} anomalias`);
      recordGeneration({
        type: "chat",
        title: "Pipeline determinístico · chat",
        appKeys: Object.keys(appNames),
        markdown: md,
        source: "chat",
      });
      return;
    }

    // Com seção: análise de IA (streamExperiment).
    if (!isAIEnabled(getAISettings())) {
      appendAssistant(
        `A análise **${action.sectionId}** precisa de IA ativada. Sem IA posso "execute o pipeline" (fatos + anomalias determinísticos) ou "gere um relatório". [Ativar IA](/configuracoes)`,
      );
      return;
    }
    appendAssistant(`⚡ Rodando a análise **${action.sectionId}**…`);
    const ctrl = new AbortController();
    abortsRef.current.add(ctrl);
    setInFlight((n) => n + 1);
    const idx = { current: -1 };
    setItems((prev) => appendPlaceholder(prev, idx) as UnifiedChatItem[]);
    const { streamExperiment } = await import("@/lib/experimentApi");
    const { saveAIOutput } = await import("@/lib/aiOutputStore");
    await streamExperiment(
      action.sectionId,
      scopeApps,
      {
        onToken: (full) => setItems((prev) => patchIndex(prev, idx.current, full) as UnifiedChatItem[]),
        onDone: (full) => {
          abortsRef.current.delete(ctrl);
          setInFlight((n) => Math.max(0, n - 1));
          if (full) {
            saveAIOutput(action.sectionId!, Object.keys(appNames), full);
            recordGeneration({
              type: "ai-section",
              title: `${action.sectionId} · chat`,
              appKeys: Object.keys(appNames),
              markdown: full,
              source: "chat",
            });
          }
        },
        onError: (msg) => {
          abortsRef.current.delete(ctrl);
          setInFlight((n) => Math.max(0, n - 1));
          setItems((prev) => patchIndex(prev, idx.current, `⚠ ${msg}`) as UnifiedChatItem[]);
        },
      },
      ctrl.signal,
      getAISettings(),
    );
  }, [scopeApps]);

  const runGoto = useCallback((action: Extract<ChatAction, { kind: "goto" }>) => {
    // A página real abre DENTRO da conversa (iframe same-origin) — sem sair
    // do chat. O link no header do bloco leva à rota se necessário.
    appendAssistant(`Aqui está a página **${action.label}** — funcional dentro do chat:`, {
      page: { path: action.path, label: action.label },
    });
    logActivity("chat", "done", `Página embutida: ${action.label}`);
  }, []);

  const runAction = useCallback(async (action: ChatAction) => {
    switch (action.kind) {
      case "show": runShow(action); return;
      case "goto": runGoto(action); return;
      case "collect-app": await runCollectApp(action.term); return;
      case "collect-multi": await runCollectMulti(action); return;
      case "report": runReport(action); return;
      case "run-pipeline": await runPipeline(action); return;
      case "help": appendAssistant(CHAT_COMMANDS_HELP); return;
    }
  }, [runShow, runGoto, runCollectApp, runCollectMulti, runReport, runPipeline]);

  /* --------------------------------------------------------- chat com IA  */

  const runAI = useCallback((text: string, baseMessages: UnifiedChatItem[]) => {
    const ctrl = new AbortController();
    abortsRef.current.add(ctrl);
    setInFlight((n) => n + 1);
    const idx = { current: -1 };
    setItems((prev) => appendPlaceholder(prev, idx) as UnifiedChatItem[]);
    const history: ChatMessage[] = baseMessages
      .filter((m) => !m.surfaceId && !m.page)
      .map((m) => ({ role: m.role, content: m.content }));
    streamExperimentChat(
      scopeApps,
      history,
      {
        onToken: (full) => setItems((prev) => patchIndex(prev, idx.current, full) as UnifiedChatItem[]),
        onDone: (full) => {
          abortsRef.current.delete(ctrl);
          setInFlight((n) => Math.max(0, n - 1));
          if (full) {
            recordGeneration({
              type: "chat",
              title: text.slice(0, 60),
              appKeys: scopeApps.map((e) => entryKey(e.app.store, e.app.id)),
              markdown: full,
              source: "chat",
            });
          }
        },
        onError: (msg) => {
          abortsRef.current.delete(ctrl);
          setInFlight((n) => Math.max(0, n - 1));
          setItems((prev) => patchIndex(prev, idx.current, `⚠ ${msg}`) as UnifiedChatItem[]);
          toastError(msg);
        },
      },
      ctrl.signal,
      getAISettings(),
      section,
      undefined,
      systemPromptOverride,
    );
  }, [scopeApps, section, systemPromptOverride]);

  const send = useCallback((raw?: string) => {
    const text = (raw ?? draft).trim();
    if (!text) return;
    setDraft("");
    const userItem: UnifiedChatItem = { role: "user", content: text };
    const nextItems = [...items, userItem];
    setItems(nextItems);

    // 1) Intenção sem IA — age localmente (componentes, coleta, relatório).
    if (!disableIntents) {
      const intent = detectChatIntent(text);
      if (intent) {
        void runAction(intent);
        return;
      }
    }

    // 2) Com IA: pergunta livre → streaming.
    if (enabled) {
      if (parallel) {
        runAI(text, nextItems);
      } else if (inFlight > 0) {
        queueRef.current.push(() => runAI(text, nextItems));
      } else {
        runAI(text, nextItems);
      }
      return;
    }

    // 3) Sem IA e sem intenção: orienta honestamente.
    appendAssistant(
      `A IA está desativada, então não consigo responder perguntas livres — mas posso **agir**: exibir componentes ("exiba os gráficos"), coletar ("colete nubank"), pesquisar ("pesquise bitcoin em todas as fontes") ou gerar relatório ("gere um relatório"). Digite **ajuda** para ver tudo. Para respostas de IA, ative em [Configurações](/configuracoes).`,
    );
  }, [draft, items, disableIntents, enabled, parallel, inFlight, runAction, runAI]);

  /* ------------------------------------------------------------ render -- */

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-2", className)}>
      {headerExtra}
      {/* Grupo expansivo padrão: rolagem interna garantida (fix do bug de
          4+ respostas cortando o bloco), "Recentes" e estado vazio vivem aqui. */}
      <ChatScrollGroup
        empty={items.length === 0}
        emptyLabel={
          <>
            <p className="flex items-center gap-1.5 font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Converse com o sistema — com ou sem IA
            </p>
            <p>
              Peça para exibir componentes, coletar apps, pesquisar em todas as fontes ou
              gerar relatórios. Digite <strong>ajuda</strong> para ver as capacidades.
            </p>
          </>
        }
        label="Conversa"
        deps={[items]}
        messagesClassName={cn("flex flex-col gap-3 pr-1", messagesClassName)}
      >
        {items.map((m, i) => (
          <ChatMessageBlock
            key={i}
            role={m.role}
            content={m.content}
            streaming={m.role === "assistant" && loading && i === items.length - 1 && !m.surfaceId && !m.page}
            surfaceId={m.surfaceId}
            surfaceLabel={m.surfaceLabel}
            page={m.page}
            storageKey={`unified-${i}`}
            onResend={m.role === "user" ? (text) => setDraft(text) : undefined}
            quickReplies={
              m.role === "assistant" && !loading && i === items.length - 1 && !m.surfaceId && !m.page
                ? suggestQuickReplies(m.content) : undefined
            }
            onQuickReply={
              m.role === "assistant" && !loading && i === items.length - 1 && !m.surfaceId && !m.page
                ? (text) => send(text) : undefined
            }
          />
        ))}
      </ChatScrollGroup>

      {items.length === 0 && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sugestões">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {!enabled && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <BrainCircuit className="h-3 w-3" aria-hidden="true" />
          IA desativada — comandos de ação funcionam; perguntas livres precisam de IA.
          <Link to="/configuracoes" className="text-primary hover:underline">Ativar</Link>
        </p>
      )}

      <ChatComposer
        value={draft}
        onChange={setDraft}
        onSend={() => send()}
        loading={loading}
        onStop={stopAll}
        onToolCommand={(phrase) => send(phrase)}
        placeholder="Peça qualquer coisa: exibir, coletar, pesquisar, analisar…"
      />
    </div>
  );
}
