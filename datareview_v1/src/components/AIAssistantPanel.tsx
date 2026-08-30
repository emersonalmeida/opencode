import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiUrl } from "@/lib/apiBase";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Sparkles, Send, Loader2, RefreshCw, ChevronRight, PanelRightClose, PanelRightOpen,
  AlertCircle, Search, MessageSquare, FileText, Trash2, Wand2, Apple, ShoppingBag, Plus, Check, ArrowUpRight,
  BarChart3, Workflow, Database, History, Settings, Terminal, Mic, MicOff,
} from "lucide-react";
import { LiveTerminal } from "@/components/LiveTerminal";
import { useAIContext } from "@/context/AIContext";
import { useSelection, entryKey } from "@/context/SelectionContext";
import { Button } from "@/components/ui/button";
import { RailHover } from "@/components/shared/RailHover";
import { searchApps, lookupApp, type AppInfo } from "@/lib/appStoreApi";
import { searchGooglePlayApps, fetchGooglePlayAppDetails, parseMultiInput } from "@/lib/googlePlayApi";
import { getUserRegion } from "@/lib/region";
import { useCompare } from "@/context/CompareContext";
import {
  listArtifacts, saveArtifact, removeArtifact, subscribeArtifacts, KIND_META, type Artifact, type ArtifactKind,
} from "@/lib/artifacts";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { SidebarChartsPanel } from "@/components/SidebarChartsPanel";
import { AppsPanel } from "@/components/AppsPanel";
import { ChatHistorySidebar } from "@/components/ChatHistorySidebar";
import SettingsPage from "@/pages/SettingsPage";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";

import { useAISettings, isAIEnabled, isParallelIA } from "@/lib/aiSettings";
import { appendPlaceholder, patchIndex, dropIndex } from "@/lib/chatStream";
import { useDataset } from "@/hooks/useDataset";
import type { DatasetEntry } from "@/lib/datasetStore";
import { useChatHistory } from "@/hooks/useChatHistory";
import { useGenerations } from "@/hooks/useSessions";
import { buildKnowledgeDigest } from "@/lib/aiKnowledge";
import { collectAndSelectInBackground } from "@/lib/collectAndSelect";
import { AIChatShortcuts } from "@/components/shared/AIChatShortcuts";
import { buildDataAwareSuggestions, buildSystemContextSummary, SYSTEM_CHAT_SUGGESTIONS } from "@/lib/aiChatShared";
import { streamExperiment } from "@/lib/experimentApi";
import type { SectionDef } from "@/lib/experimentSections";
import type { PipelineShortcut } from "@/lib/aiChatShared";
import { useSmartAutoScroll } from "@/hooks/useSmartAutoScroll";
import { SidebarTabStrip, SidebarTabRail } from "@/components/shared/SidebarTabStrip";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useVoiceSettings } from "@/lib/voice";
import { detectChatIntent } from "@/lib/chatCommands";
import { ChatMessageBlock } from "@/components/shared/ChatMessageBlock";
import { ChatScrollGroup } from "@/components/shared/ChatScrollGroup";
import { suggestQuickReplies } from "@/lib/quickReplies";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";

interface ChatMessage {
  role: "user" | "assistant" | "search";
  content: string;
  results?: AppInfo[];
  /** Componente real embutido na conversa (ação sem IA). */
  surfaceId?: string;
  surfaceLabel?: string;
  /** Página real embutida na conversa (intent goto — iframe same-origin). */
  page?: { path: string; label: string };
}

const STOP_WORDS = new Set([
  "a","o","e","de","da","do","que","em","para","com","não","um","uma","os","as","no","na","por","mais","se","mas",
  "ao","ele","ela","das","dos","ou","ser","quando","muito","há","nos","já","eu","também","é","foi","esse","essa",
  "está","são","tem","seu","sua","isso","este","me","meu","minha","ter","como","app","pra","pro","tá","vai","bem","só","nem","sem",
]);

function summarizeApp(entry: DatasetEntry) {
  const { app, reviews } = entry;
  if (!app) return null;
  const dist: Record<string, number> = { "1":0,"2":0,"3":0,"4":0,"5":0 };
  reviews.forEach((r) => { dist[String(r.rating)] = (dist[String(r.rating)] || 0) + 1; });
  const positive = reviews.filter((r) => r.rating >= 4).length;
  const negative = reviews.filter((r) => r.rating <= 2).length;
  const neutral = reviews.filter((r) => r.rating === 3).length;
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const avgLen = reviews.length ? Math.round(reviews.reduce((s, r) => s + r.text.length, 0) / reviews.length) : 0;
  const allText = reviews.map((r) => `${r.title} ${r.text}`).join(" ").toLowerCase();
  const words = allText.split(/[\s,.!?;:()"\-/]+/).filter((w: string) => w.length > 3 && !STOP_WORDS.has(w));
  const freq: Record<string, number> = {};
  words.forEach((w: string) => { freq[w] = (freq[w] || 0) + 1; });
  const topWords = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word, count]) => ({ word, count }));

  return {
    name: app.name, store: app.store, developer: app.developer, rating: app.rating,
    ratingCount: app.ratingCount, version: app.version, genre: app.genre, size: app.size,
    contentRating: app.contentRating, minimumOsVersion: app.minimumOsVersion, downloads: app.downloads,
    lastUpdated: app.currentVersionReleaseDate || app.lastUpdated, releaseNotes: app.releaseNotes,
    recentChanges: app.recentChanges, histogram: app.histogram,
    reviewsCollected: reviews.length, avgRatingCollected: avgRating,
    positivePct: reviews.length ? Math.round((positive / reviews.length) * 100) : 0,
    negativePct: reviews.length ? Math.round((negative / reviews.length) * 100) : 0,
    neutralPct: reviews.length ? Math.round((neutral / reviews.length) * 100) : 0,
    avgReviewLength: avgLen, topWords, ratingDistribution: dist,
    sampleReviews: reviews.slice(0, 25).map((r) => ({
      rating: r.rating, author: r.author, title: r.title, text: r.text.slice(0, 400), date: r.date, version: r.version,
    })),
  };
}

type AppSummary = NonNullable<ReturnType<typeof summarizeApp>>;

/** Suggestions per scope — always up to 10 items, contextual to the current page. */
function suggestionsFor(scope: string, appCount: number): string[] {
  if (scope === "home") {
    return [
      "pesquise por apps de banco digital",
      "pesquise por apps de delivery",
      "bipa",
      "nubank",
      "pesquise por apps de investimentos",
      "itau",
      "spotify",
      "pesquise por apps de streaming",
      "pesquise por apps de fitness",
      "pesquise por apps de produtividade",
    ];
  }
  if (scope === "compare") {
    return [
      "Análise comparativa completa (quanti + quali)",
      "Ranqueie os apps por satisfação real dos usuários",
      "Quais bugs são específicos de cada app?",
      "Compare as funcionalidades mais pedidas em cada um",
      "Que oportunidades cada app está deixando na mesa?",
      "Como difere a percepção de preço/valor?",
      "Que temas aparecem só nos reviews negativos?",
      "Compare a evolução das últimas versões",
      "Personas típicas de cada app",
      "SWOT lado a lado",
    ];
  }
  if (scope === "app") {
    return [
      "Resumo executivo do sentimento",
      "Principais bugs desta versão",
      "Funcionalidades mais pedidas pelos usuários",
      "Recomendações priorizadas para o time",
      "Personas prováveis com base nos reviews",
      "Jornada do usuário e pontos de fricção",
      "Oportunidades de crescimento",
      "O que mudou entre as últimas 3 versões?",
      "Quais concorrentes são citados nos reviews?",
      "Estratégia sugerida para próxima release",
    ];
  }
  if (appCount === 0) {
    // Chat generalista (sem apps em escopo): perguntas sobre o sistema.
    return [
      "O que este sistema faz?",
      "Como coletar reviews de um app?",
      "Quais dados já foram coletados?",
      "O que já foi gerado por IA?",
      "Como funciona a configuração de IA local?",
      "Onde ficam salvos meus dados?",
      "Como exportar e importar tudo?",
      "Qual página uso para comparar apps?",
      "Como o sistema funciona sem IA?",
      "O que são os pipelines do Canvas?",
    ];
  }
  return [
    "Explique o que este produto faz",
    "Como comparo dois apps?",
    "Sugira apps para eu analisar",
  ];
}

const SEARCH_PREFIX = /^(pesquis[ae]|busca|busque|procur[ae]|search|find|encontr[ae])\b[:\s]*/i;

/** In "home" scope, everything is a search unless it's clearly a question. */
function isSearchIntent(text: string, scope: string): boolean {
  if (SEARCH_PREFIX.test(text)) return true;
  if (scope !== "home") return false;
  // No escopo home sem apps ainda, trata input curto/não-pergunta como busca
  if (/[?]|explique|compare|analise|resumo|como|o que|por que|quais/i.test(text)) return false;
  return text.length <= 60;
}

/**
 * Abas do sistema da sidebar direita (sempre presentes, depois das abas
 * dinâmicas da página ativa). A strip rola horizontalmente quando há muitas.
 */
const STATIC_TABS = [
  { id: "chat", label: "Chat", icon: <MessageSquare className="h-3 w-3" />, title: "Chat com IA — as mesmas análises, pipelines e voz da página /chat" },
  { id: "terminal", label: "Terminal", icon: <Terminal className="h-3 w-3" />, title: "Terminal vivo: log em tempo real, monitor, tarefas e IA" },
  { id: "apps", label: "Apps", icon: <Database className="h-3 w-3" />, title: "Buscar, coletar e selecionar apps" },
  { id: "charts", label: "Gráficos", icon: <BarChart3 className="h-3 w-3" />, title: "Gráficos e insights do dataset" },
  { id: "artifacts", label: "Artefatos", icon: <FileText className="h-3 w-3" />, title: "Artefatos gerados" },
  { id: "chats", label: "Chats", icon: <History className="h-3 w-3" />, title: "Histórico de conversas" },
  { id: "config", label: "Config", icon: <Settings className="h-3 w-3" />, title: "Configurações do sistema" },
] as const;

/**
 * Prompt do chat generalista (section "os"): conhecimento do sistema + o que
 * já foi gerado (catálogo de conhecimento) + escopo atual. O servidor usa
 * este texto como system prompt quando o usuário conversa sem apps em escopo.
 */
function buildOsChatOverride(scopeInfo: string, pageTitle?: string, pagePath?: string): string {
  const digest = buildKnowledgeDigest(4000);
  return `Você é o assistente geral do sistema "App Intelligence" — plataforma local-first de análise de reviews de apps mobile (Apple App Store + Google Play). Responda SEMPRE em português do Brasil, direto e estruturado (markdown).

VOCÊ SABE TUDO SOBRE O SISTEMA:
- FLUXO DE DADOS: busca nas lojas → coleta de reviews (Apple: amp-api+SSR+RSS; Google: google-play-scraper multi-sort) → dedup + enriquecimento determinístico (sentimento por nota, wordCount, flags) → dataset local → análises determinísticas e/ou por IA.
- ARMAZENAMENTO: local-first no localStorage (nada sai da máquina). Principais chaves: aso:dataset:v1 (apps+reviews coletados), aso:selected-apps:v1 (seleção global), aso:ai-outputs:v1 (outputs de IA persistidos), aso:chat-history:v1, aso:generations:v1 (sessões), aso:pipeline-artifacts:v1, aso:insights:v1, aso:feature-flags:v1, aso:ai-settings:v1.
- PÁGINAS: Início (top charts + busca), Dashboard (analytics), Experimentos (12 seções de IA), Chat, Canvas (pipelines visuais de nós), Comparar, Dados brutos, Pipeline (motor de conhecimento recursivo), Pipeline de dados, Analysis Atlas (catálogo de módulos), Lab (experimento→finding→produto), Agentes (7 personas × pipeline), Decision Center, Conceito, Playground, Sessões, Apresentações, Jornada, Terminal (CLI), Nexus OS, Design Canvas, Design System, Central de IA (/ia — tudo sobre a IA: como funciona, capacidades, o que foi gerado, playground), Explorar, Configurações.
- IA: modos auto (detecta hardware → melhor modelo + contexto que cabe na GPU sem swap), local (Ollama), cloud (BYOK) ou none. Sem IA, o sistema segue funcional via análises determinísticas.
- SELEÇÃO GLOBAL: análises honram os apps selecionados (aba Apps da sidebar direita); seleção vazia = dataset inteiro.
- COLETA: limite de reviews por app (até 10.000), ordenação (misto/recentes/úteis/nota), região da loja; reusa cache quando o limite já foi atendido (dedup por id, nunca perde reviews). Selecionar um app na busca já o coleta e seleciona automaticamente.
- CAPACIDADES DA IA: lê o dataset completo (apps, reviews, metadados, versões, países), gera 12 seções de análise, chat com evidências, artefatos, apresentações, relatórios no Canvas, decisões por persona, metodologias de pesquisa, experimentos do Lab. NÃO acessa a internet nem executa código — opera sobre o que foi coletado.

CONTEXTO ATUAL DO USUÁRIO: página "${pageTitle ?? "desconhecida"}" · ${scopeInfo}.
${buildSystemContextSummary(pagePath)}
${digest ? `\nO QUE JÁ FOI GERADO (conhecimento acumulado de análises anteriores):\n${digest}\n` : ""}
REGRAS: seja preciso sobre COMO o sistema funciona e O QUE já foi gerado; se a pergunta for sobre dados de apps específicos e não houver dataset em escopo, oriente a coletar/selecionar apps na aba Apps; quando não souber, diga honestamente "não tenho essa informação"; sugira a página certa quando couber; termine sugerindo 1-2 ações concretas quando fizer sentido.`;
}

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

export function AIAssistantPanel({ collapsed, onToggle }: Props) {
  const { value, panelOpen, setPanelOpen } = useAIContext();
  const { selected } = useSelection();
  const ai = useAISettings();
  const aiEnabled = isAIEnabled(ai);
  const [tab, setTab] = useState<string>("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [inFlight, setInFlight] = useState(0);
  /** loading derivado: true quando há ≥1 geração/busca em voo (várias no paralelo). */
  const loading = inFlight > 0;
  const parallel = isParallelIA(ai);
  const setBusy = (b: boolean) => setInFlight((n) => Math.max(0, n + (b ? 1 : -1)));
  const [error, setError] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>(() => listArtifacts());
  const [openArtifact, setOpenArtifact] = useState<Artifact | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const region = getUserRegion();
  const { toggle: toggleCompare, isSelected } = useCompare();

  // Ditado por voz no composer (mesmo padrão da página /chat): Web Speech
  // (Chrome) → fallback Whisper local. O texto final entra no input para
  // revisão antes de enviar.
  const voiceSettings = useVoiceSettings();
  const dictationBaseRef = useRef("");
  const stt = useVoiceInput({
    lang: voiceSettings.lang,
    onFinal: (text) => {
      const base = dictationBaseRef.current;
      setInput((base ? `${base} ` : "") + text);
    },
  });
  useEffect(() => {
    if (stt.active && stt.interim) {
      const base = dictationBaseRef.current;
      setInput((base ? `${base} ` : "") + stt.interim);
    }
  }, [stt.active, stt.interim]);
  const toggleDictation = () => {
    if (stt.active) {
      stt.stop();
    } else {
      dictationBaseRef.current = input.trim();
      stt.start();
    }
  };
  useEffect(() => subscribeArtifacts(() => setArtifacts(listArtifacts())), []);
  useEffect(() => { setPanelOpen(!collapsed); }, [collapsed, setPanelOpen]);
  // Badges inteligentes: contagens ao vivo por aba (apps coletados, reviews,
  // sessões de IA, conversas salvas) — visibilidade do estado do sistema.
  const { entries: datasetEntries } = useDataset();
  const chatSessions = useChatHistory();
  const generations = useGenerations();
  const tabBadges = useMemo<Record<string, number>>(() => ({
    apps: datasetEntries.length,
    charts: datasetEntries.reduce((s, e) => s + e.reviews.length, 0),
    artifacts: generations.length,
    chats: chatSessions.length,
  }), [datasetEntries, chatSessions, generations]);

  // Em escopos multi-app (home/compare/search) o painel honra a seleção global
  // de apps feita na sidebar esquerda: só apps selecionados vão para a IA.
  // No escopo de detalhe de app único, a própria página é o contexto (sem filtro).
  const effectiveApps = useMemo(() => {
    if (value.scope === "app") return value.apps;
    const sel = new Set(selected);
    if (sel.size === 0) return value.apps;
    return value.apps.filter((a) => sel.has(entryKey(a.app.store, a.app.id)));
  }, [value.apps, value.scope, selected]);

  const validApps = useMemo(
    () => effectiveApps.map(summarizeApp).filter((a): a is AppSummary => a !== null),
    [effectiveApps],
  );
  const suggestions = useMemo(() => suggestionsFor(value.scope, effectiveApps.length), [value.scope, effectiveApps.length]);
  const isHome = value.scope === "home" || value.scope === "search";
  const scopeInfo = useMemo(
    () => `${validApps.length} app(s) em escopo (${validApps.reduce((s, a) => s + (a?.reviewsCollected ?? 0), 0)} reviews)`,
    [validApps],
  );

  // Reset chat when scope switches
  const contextKey = `${value.scope}:${effectiveApps.map(a => `${a.app.store}:${a.app.id}`).join(",")}`;
  const lastKey = useRef(contextKey);
  useEffect(() => {
    if (lastKey.current !== contextKey) {
      lastKey.current = contextKey;
      setMessages([]);
      setError("");
    }
  }, [contextKey]);

  // Auto-scroll inteligente: mensagens novas só puxam a view quando o usuário
  // já está no fim; trocar de aba sempre vai ao fim.
  const { ref: scrollRef, onScroll: handleScroll, scrollToBottom } = useSmartAutoScroll<HTMLDivElement>([messages]);
  useEffect(() => { scrollToBottom(false); }, [tab, scrollToBottom]);

  const runSearch = async (raw: string) => {
    const q = raw.replace(SEARCH_PREFIX, "").trim();
    if (!q) return;
    setError("");
    setMessages(prev => [...prev, { role: "user", content: raw }, { role: "search", content: q, results: [] }]);
    setInput("");
    setBusy(true);
    try {
      const inputs = parseMultiInput(q);
      const hasDirect = inputs.some(i => i.type === "url" || i.type === "id");
      let apple: AppInfo[] = [], google: AppInfo[] = [];
      if (hasDirect && inputs.length === 1) {
        const i = inputs[0];
        const [a, g] = await Promise.allSettled([
          i.store === "google" ? Promise.resolve(null) : lookupApp(i.value, region),
          i.store === "apple" ? Promise.resolve(null) : fetchGooglePlayAppDetails(i.value, region),
        ]);
        apple = a.status === "fulfilled" && a.value ? [a.value] : [];
        google = g.status === "fulfilled" && g.value ? [g.value] : [];
      } else {
        const [a, g] = await Promise.allSettled([
          searchApps(q, region, 10),
          searchGooglePlayApps(q, region, 10),
        ]);
        apple = a.status === "fulfilled" ? a.value : [];
        google = g.status === "fulfilled" ? g.value : [];
      }
      const results = [...google, ...apple];
      setMessages(prev => {
        const nxt = [...prev];
        const idx = nxt.length - 1;
        nxt[idx] = { ...nxt[idx], results };
        return nxt;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na busca");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  /** Chat generalista: com apps em escopo → dataset; sem apps → knowledge do sistema. */
  const runChat = async (text: string, forceApps?: AppSummary[], onFinish?: (result: string) => void) => {
    const apps = forceApps ?? validApps;
    const osChat = apps.length === 0;
    if (!aiEnabled) {
      setError("A IA está desativada. Ative-a em Configurações → Inteligência Artificial.");
      return;
    }
    setError("");
    const nextMsgs: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMsgs);
    setInput("");
    setBusy(true);
    const idxRef = { current: -1 };
    setMessages((prev) => {
      const extras = prev.length > nextMsgs.length ? prev.slice(nextMsgs.length) : [];
      return appendPlaceholder([...nextMsgs, ...extras], idxRef);
    });

    try {
      // Unified on experiment-analyze: com apps em escopo, a IA recebe o
      // dataset completo; sem apps, roda em modo "os" (chat generalista —
      // sabe tudo sobre o sistema, coleta, armazenamento e o que já foi gerado).
      const body: Record<string, unknown> = osChat
        ? {
            section: "os",
            apps: [],
            messages: nextMsgs.filter(m => m.role !== "search").map(m => ({ role: m.role, content: m.content })),
            ai,
            systemPromptOverride: buildOsChatOverride(scopeInfo, value.title, location.pathname),
          }
        : {
            section: "custom",
            apps: effectiveApps,
            messages: nextMsgs.filter(m => m.role !== "search").map(m => ({ role: m.role, content: m.content })),
            ai,
          };
      const resp = await fetch(apiUrl("/functions/v1/experiment-analyze"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        setError(errData.error || `Erro ${resp.status}`);
        setMessages(prev => dropIndex(prev, idxRef.current));
        setBusy(false);
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "", result = "";
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        buffer += decoder.decode(chunk, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              result += content;
              setMessages(prev => patchIndex(prev, idxRef.current, result));
            }
          } catch { /* ignore */ }
        }
      }
      onFinish?.(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || (!parallel && loading)) return;
    // Intenção sem IA ("exiba a página de pipeline", "mostre os gráficos"):
    // exibe o componente real do sistema direto na conversa.
    const intent = detectChatIntent(t);
    if (intent?.kind === "show") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: t },
        {
          role: "assistant",
          content: `Aqui está **${intent.label}** — o componente real, pronto para usar:`,
          surfaceId: intent.surfaceId,
          surfaceLabel: intent.label,
        },
      ]);
      setInput("");
      return;
    }
    // Navegação "vá para o dashboard": a página real abre DENTRO da
    // conversa (iframe same-origin) — sem sair do chat.
    if (intent?.kind === "goto") {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: t },
        {
          role: "assistant",
          content: `Aqui está a página **${intent.label}** — funcional dentro do chat:`,
          page: { path: intent.path, label: intent.label },
        },
      ]);
      setInput("");
      return;
    }
    if (isSearchIntent(t, value.scope)) runSearch(t);
    else runChat(t);
  };

  /**
   * Atalho de análise (12 seções do sistema) direto na sidebar — mesmo poder
   * da página Chat: roda o prompt metodológico oficial da seção e entrega o
   * resultado como mensagem do chat.
   */
  const runSection = async (section: SectionDef) => {
    if ((!parallel && loading) || effectiveApps.length === 0) return;
    if (!aiEnabled) {
      setError("A IA está desativada. Ative-a em Configurações → Inteligência Artificial.");
      return;
    }
    setError("");
    const history: ChatMessage[] = [...messages, { role: "user", content: `⚡ ${section.label}` }];
    const idxRef = { current: -1 };
    setMessages((prev) => {
      const extras = prev.length > history.length ? prev.slice(history.length) : [];
      return appendPlaceholder([...history, ...extras], idxRef);
    });
    setBusy(true);
    const write = (full: string) => setMessages((prev) => patchIndex(prev, idxRef.current, full));
    await streamExperiment(
      section.id,
      effectiveApps,
      {
        onToken: write,
        onDone: write,
        onError: (err) => {
          setError(err);
          setMessages((prev) => dropIndex(prev, idxRef.current));
        },
      },
      undefined,
      ai,
    );
    setBusy(false);
    inputRef.current?.focus();
  };

  /** Pipeline (agente) na sidebar: etapas em sequência, uma mensagem por etapa. */
  const runPipeline = async (pipeline: PipelineShortcut) => {
    if ((!parallel && loading) || effectiveApps.length === 0) return;
    if (!aiEnabled) {
      setError("A IA está desativada. Ative-a em Configurações → Inteligência Artificial.");
      return;
    }
    setError("");
    let history: ChatMessage[] = [
      ...messages,
      { role: "user", content: `🔁 Pipeline: ${pipeline.label} (${pipeline.steps.map((s) => s.label).join(" → ")})` },
    ];
    setMessages(history);
    setBusy(true);
    for (let i = 0; i < pipeline.steps.length; i++) {
      const step = pipeline.steps[i];
      const assistantIdx = history.length;
      setMessages([...history, { role: "assistant", content: `**Etapa ${i + 1}/${pipeline.steps.length} — ${step.label}**\n\n` }]);
      const write = (full: string) =>
        setMessages((prev) => {
          const nxt = [...prev];
          nxt[assistantIdx] = { role: "assistant", content: full };
          return nxt;
        });
      if (step.section === "custom" && step.prompt) {
        await runChat(step.prompt);
      } else {
        await streamExperiment(
          step.section,
          effectiveApps,
          { onToken: write, onDone: write, onError: (err) => setError(err) },
          undefined,
          ai,
        );
      }
      history = [...history, { role: "assistant", content: "" }];
    }
    setBusy(false);
    inputRef.current?.focus();
  };

  const generateArtifact = async (kind: ArtifactKind) => {
    if (validApps.length === 0) { setError("Selecione ao menos um app para gerar o artefato."); return; }
    const meta = KIND_META[kind];
    const prompt = kind === "custom"
      ? (input.trim() || "Descreva o que gostaria de gerar como artefato de pesquisa.")
      : meta.prompt;
    if (!prompt) return;
    setTab("chat");
    await runChat(`Gerar artefato — ${meta.label}: ${prompt}`, undefined, (result) => {
      if (result?.trim()) {
        saveArtifact({
          kind, title: meta.label, content: result, scope: value.scope,
          scopeLabel: value.title,
        });
      }
    });
  };

  // ============ COLLAPSED RAIL ============
  // Flyout por aba no hover: conteúdo real do recurso (usável sem expandir).
  // Chat/Artefatos ganham ações rápidas que expandem + executam num gesto.
  const renderTabFlyout = (id: string): ReactNode => {
    switch (id) {
      case "terminal":
        return <LiveTerminal />;
      case "apps":
        return <AppsPanel />;
      case "chats":
        return (
          <div className="min-h-0 flex flex-col">
            <ChatHistorySidebar
              activeId={null}
              onNew={() => navigate("/chat")}
              onSelect={(s) => navigate(`/chat?session=${s.id}`)}
              embedded
            />
          </div>
        );
      case "config":
        // Paridade total com a página /configuracoes (embedded — mesmos
        // blocos, mesmas âncoras, mesmas ações).
        return <SettingsPage embedded />;
      case "charts":
        return (
          <ErrorBoundary>
            <SidebarChartsPanel />
          </ErrorBoundary>
        );
      case "artifacts":
        return artifacts.length === 0 ? (
          <p className="p-3 text-[11px] text-muted-foreground leading-relaxed">
            Nenhum artefato ainda. Os entregáveis gerados pela IA aparecem aqui.
          </p>
        ) : (
          <div className="p-2 space-y-1">
            {artifacts.slice(0, 12).map((a) => (
              <button
                key={a.id}
                onClick={() => { onToggle(); setTab("artifacts"); setOpenArtifact(a); }}
                className="w-full text-left px-2.5 py-2 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{KIND_META[a.kind].icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{KIND_META[a.kind].label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {a.scopeLabel} · {new Date(a.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        );
      case "chat":
      default:
        return (
          <div className="p-2 space-y-1">
            {SYSTEM_CHAT_SUGGESTIONS.slice(0, 5).map((s) => (
              <button
                key={s}
                onClick={() => { onToggle(); setTab("chat"); runChat(s); }}
                className="w-full flex items-center gap-2 text-left text-[11px] px-2.5 py-2 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{s}</span>
              </button>
            ))}
          </div>
        );
    }
  };

  if (collapsed) {
    return (
      <aside className="hidden md:flex h-full w-full flex-col items-center gap-2 py-3 border-l border-border/50 bg-card/40 backdrop-blur-sm">
        <RailHover
          side="left"
          label="Expandir assistente"
          description="Assistente de IA, apps, gráficos e artefatos"
          trigger={
            <button onClick={onToggle} aria-label="Expandir assistente" className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
              <PanelRightOpen className="h-4 w-4" />
            </button>
          }
        />
        <div className="w-8 h-px bg-border/40 my-0.5" />
        <SidebarTabRail
          tabs={STATIC_TABS.map((t) => ({ ...t, badge: tabBadges[t.id] ?? 0 }))}
          onSelect={(id) => { onToggle(); setTab(id); }}
          tooltipSide="left"
          flyoutWidth={400}
          renderFlyout={(t) => renderTabFlyout(t.id)}
        />
        <div className="flex-1" />
      </aside>
    );
  }

  // ============ EXPANDED ============
  return (
    <aside className="hidden md:flex h-full w-full flex-col border-l border-border/50 bg-card/40 backdrop-blur-sm">
      <header className="flex items-center justify-between p-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
              Assistente de IA
              {aiEnabled
                ? <span className="inline-flex items-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 text-[8px] font-normal" title="IA ativa">IA ativa</span>
                : <span className="inline-flex items-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 text-[8px] font-normal" title="IA desativada — ative em Configurações">IA off</span>}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {value.title} · {validApps.length} app{validApps.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {tab === "chat" && messages.length > 0 && (
            <button onClick={() => { setMessages([]); setError(""); }} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Nova conversa">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          <button onClick={onToggle} aria-label="Recolher assistente" className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Recolher painel">
            <PanelRightClose className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Tabs — abas do sistema (fixas); scroll horizontal quando há muitas
          (botões nunca espremem). Conteúdo por página vive nas internas. */}
      <SidebarTabStrip
        tabs={STATIC_TABS.map((t) => ({ ...t, badge: tabBadges[t.id] ?? 0 }))}
        active={tab}
        onChange={(id) => setTab(id)}
        ariaLabel="Painéis do assistente"
      />

      {/* Body (abas do sistema). Apps/Chats/Config têm layout próprio
          (full-height, scroll interno); Chat/Gráficos/Artefatos usam padding. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role={tab === "chat" ? "log" : undefined}
        aria-live={tab === "chat" ? "polite" : undefined}
        className={`flex-1 min-h-0 overflow-y-auto ${
          tab === "apps" || tab === "chats" || tab === "terminal" ? "p-0 flex flex-col"
          : tab === "chat" ? "p-0 flex flex-col overflow-hidden"
          : "p-3 space-y-3"
        }`}
      >
        {tab === "terminal" ? (
          // ============ TERMINAL TAB (default) — log vivo + monitor + tarefas + IA ============
          <LiveTerminal />
        ) : tab === "apps" ? (
          // ============ APPS TAB (busca + coleta + seleção) ============
          <AppsPanel />
        ) : tab === "chats" ? (
          // ============ CHATS TAB (histórico de conversas) ============
          <div className="flex-1 min-h-0 flex flex-col">
            <ChatHistorySidebar
              activeId={null}
              onNew={() => navigate("/chat")}
              onSelect={(s) => navigate(`/chat?session=${s.id}`)}
              embedded
            />
          </div>
        ) : tab === "config" ? (
          // ============ CONFIG TAB (paridade com /configuracoes) ============
          <SettingsPage embedded />
        ) : tab === "chat" ? (
          <ChatScrollGroup
            empty={messages.length === 0}
            label="Conversa do assistente"
            deps={[messages]}
            messagesClassName="p-3 space-y-3"
            emptyLabel={
              <div className="space-y-3">
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {isHome
                      ? "Digite o que quiser encontrar — nome do app, categoria (\"apps de banco\"), URL ou ID. Ou clique numa sugestão abaixo."
                      : validApps.length > 0
                        ? "A IA tem acesso a todos os payloads brutos, metadados, notas, distribuições, reviews e versões dos apps em contexto."
                        : "Chat geral do sistema: pergunte sobre coleta, dados coletados, o que já foi gerado e como o sistema funciona — ou colete apps na aba Apps para análises com evidência."}
                  </p>
                </div>

                {/* Atalhos de IA: as 12 análises + pipelines + sugestões
                    inteligentes (baseadas na forma dos dados) — o mesmo poder
                    da página Chat, aqui na sidebar. */}
                {!isHome && validApps.length > 0 && (
                  <AIChatShortcuts
                    entries={effectiveApps}
                    disabled={loading}
                    onRunSection={runSection}
                    onRunPipeline={runPipeline}
                    onSuggestion={(s) => submit(s)}
                  />
                )}

                {!isHome && validApps.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 mb-1.5 flex items-center gap-1">
                      <Wand2 className="h-3 w-3" /> Gerar artefato
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(KIND_META) as ArtifactKind[]).filter(k => k !== "custom").map(k => (
                        <button
                          key={k}
                          onClick={() => generateArtifact(k)}
                          disabled={loading}
                          className="text-left text-[11px] px-2.5 py-2 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-40"
                        >
                          <span className="mr-1">{KIND_META[k].icon}</span>
                          {KIND_META[k].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 mb-1.5">
                    {isHome ? "Sugestões de busca" : validApps.length > 0 ? "Sugestões para estes dados" : "Sugestões sobre o sistema"}
                  </p>
                  <div className="space-y-1">
                    {(validApps.length > 0 ? buildDataAwareSuggestions(effectiveApps, 5) : isHome ? suggestions : SYSTEM_CHAT_SUGGESTIONS.slice(0, 6)).map(s => (
                      <button
                        key={s}
                        onClick={() => submit(s)}
                        disabled={loading}
                        className="w-full text-left text-xs px-3 py-2 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-40 flex items-center gap-2 group"
                      >
                        {isHome ? <Search className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                : <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />}
                        <span className="flex-1">{s}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            }
          >
            {messages.map((m, i) => {
              if (m.role === "user") {
                return (
                  <ChatMessageBlock
                    key={i}
                    role="user"
                    content={m.content}
                    storageKey={`aipanel-user-${i}`}
                    compact
                    onResend={(text) => setInput(text)}
                  />
                );
              }
              if (m.role === "search") {
                return (
                  <div key={i} className="space-y-2 animate-fade-in">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Search className="h-3 w-3" /> Resultados para "{m.content}"</p>
                    {(!m.results || m.results.length === 0) && !loading && (
                      <p className="text-xs text-muted-foreground italic">Nada encontrado nas duas lojas.</p>
                    )}
                    {loading && (!m.results || m.results.length === 0) && (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs"><Loader2 className="h-3 w-3 animate-spin" /> Consultando…</div>
                    )}
                    <div className="space-y-1">
                      {(m.results || []).slice(0, 10).map((app, ri) => {
                        const selected = isSelected(app);
                        return (
                          <div
                            key={`${app.store}-${app.id}`}
                            style={{ animationDelay: `${ri * 30}ms` }}
                            className="flex items-center gap-2 p-2 rounded-lg border border-border/40 bg-card/60 hover:border-primary/30 hover:bg-card/80 hover:-translate-y-px transition-all group animate-fade-in"
                          >
                            {app.icon
                              ? <img src={app.icon} alt="" className="w-8 h-8 rounded flex-shrink-0" loading="lazy" />
                              : <div className="w-8 h-8 rounded bg-secondary flex-shrink-0" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">{app.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                                {app.store === "apple" ? <Apple className="h-2.5 w-2.5" /> : <ShoppingBag className="h-2.5 w-2.5" />}
                                {app.developer}
                                {app.rating > 0 && <> · ★ {app.rating.toFixed(1)}</>}
                              </p>
                            </div>
                            <button
                              onClick={() => navigate(`/app/${app.store}/${app.id}`)}
                              className="p-1.5 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Abrir detalhes"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                const was = isSelected(app);
                                toggleCompare(app);
                                // Auto-coleta + auto-seleção global ao adicionar
                                if (!was) collectAndSelectInBackground(app);
                              }}
                              className={`p-1.5 rounded transition-colors ${selected ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                              title={selected ? "Remover do painel" : "Adicionar ao painel (coleta e seleciona automaticamente)"}
                            >
                              {selected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              // assistant
              const isLast = i === messages.length - 1;
              return (
                <ChatMessageBlock
                  key={i}
                  role="assistant"
                  content={m.content}
                  streaming={loading && isLast && !m.surfaceId && !m.page}
                  surfaceId={m.surfaceId}
                  surfaceLabel={m.surfaceLabel}
                  page={m.page}
                  storageKey={`aipanel-${i}`}
                  filename={`chat-resposta-${i}`}
                  compact
                  quickReplies={isLast && !loading && !m.surfaceId && !m.page ? suggestQuickReplies(m.content) : undefined}
                  onQuickReply={isLast && !loading && !m.surfaceId && !m.page ? (text) => submit(text) : undefined}
                />
              );
            })}

            {error && (
              <div className="flex items-start gap-2 text-destructive text-xs p-2 bg-destructive/10 rounded-lg" role="alert">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  {error}
                  {error.includes("IA está desativada") && (
                    <>
                      {" "}
                      <Link to="/configuracoes" className="text-primary hover:underline" onClick={() => setError("")}>
                        Abrir Configurações
                      </Link>
                    </>
                  )}
                </span>
              </div>
            )}
          </ChatScrollGroup>
        ) : tab === "charts" ? (
          // ============ CHARTS TAB ============
          <ErrorBoundary>
            <SidebarChartsPanel />
          </ErrorBoundary>
        ) : (
          // ============ ARTIFACTS TAB ============
          <>
            {openArtifact ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <button onClick={() => setOpenArtifact(null)} className="text-[11px] text-primary hover:underline">← Voltar</button>
                  <button onClick={() => { removeArtifact(openArtifact.id); setOpenArtifact(null); }} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Excluir
                  </button>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{KIND_META[openArtifact.kind].icon} {KIND_META[openArtifact.kind].label}</p>
                  <h3 className="text-sm font-semibold text-foreground">{openArtifact.scopeLabel}</h3>
                  <p className="text-[10px] text-muted-foreground">{new Date(openArtifact.createdAt).toLocaleString("pt-BR")}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card/60 p-4">
                  <AIOutputCard bare content={openArtifact.content} filename={`artefato-${openArtifact.kind}`} storageKey={`artifact-${openArtifact.kind}`} />
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Entregáveis de pesquisa e produto gerados pela IA — ficam salvos no seu navegador para você revisitar quando quiser.
                  </p>
                </div>

                {validApps.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 mb-1.5">Gerar novo</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(KIND_META) as ArtifactKind[]).filter(k => k !== "custom").map(k => (
                        <button
                          key={k}
                          onClick={() => generateArtifact(k)}
                          disabled={loading}
                          className="text-left text-[11px] px-2.5 py-2 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-40"
                        >
                          <span className="mr-1">{KIND_META[k].icon}</span>
                          {KIND_META[k].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 px-1 mb-1.5">
                    Meus artefatos ({artifacts.length})
                  </p>
                  {artifacts.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-6 px-2">
                      Nenhum artefato ainda. Abra um app ou comparação e gere entregáveis a partir dos dados coletados.
                    </p>
                  )}
                  <div className="space-y-1">
                    {artifacts.map(a => (
                      <button
                        key={a.id}
                        onClick={() => setOpenArtifact(a)}
                        className="w-full text-left px-2.5 py-2 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{KIND_META[a.kind].icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-foreground truncate">{KIND_META[a.kind].label}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{a.scopeLabel} · {new Date(a.createdAt).toLocaleDateString("pt-BR")}</p>
                          </div>
                          <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Composer */}
      {tab === "chat" && !openArtifact && (
        <div className="border-t border-border/50 flex-shrink-0 bg-card/60 backdrop-blur-sm">
          {/* Atalhos de análise/pipeline sempre acessíveis quando há apps em escopo */}
          {messages.length > 0 && validApps.length > 0 && !isHome && (
            <div className="px-3 pt-2.5 animate-fade-in">
              <AIChatShortcuts
                entries={effectiveApps}
                disabled={loading}
                onRunSection={runSection}
                onRunPipeline={runPipeline}
                onSuggestion={(s) => submit(s)}
                showSuggestions={false}
              />
            </div>
          )}
          {/* Persistent suggestions strip — always visible so users can keep exploring */}
          {messages.length > 0 && suggestions.length > 0 && (
            <div className="px-3 pt-2.5 pb-1 animate-fade-in">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1.5 flex items-center gap-1">
                <Sparkles className="h-2.5 w-2.5" />
                {isHome ? "Continue explorando" : "Perguntas sugeridas"}
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-1.5 -mx-0.5 px-0.5 scrollbar-thin">
                {suggestions.map((s, si) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    disabled={loading}
                    style={{ animationDelay: `${si * 20}ms` }}
                    className="animate-fade-in flex-shrink-0 text-[11px] px-2.5 py-1.5 rounded-full border border-border/50 bg-secondary/40 hover:border-primary/50 hover:bg-primary/10 hover:text-primary text-muted-foreground transition-all disabled:opacity-40 whitespace-nowrap flex items-center gap-1"
                  >
                    {isHome ? <Search className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="p-3">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(input); }
                }}
                placeholder={isHome
                  ? "Pesquisar apps ou digitar um nome / URL / ID…"
                  : (validApps.length ? "Pergunte sobre os apps ou peça um artefato…" : "Abra um app para começar")}
                rows={2}
                disabled={loading}
                className="flex-1 resize-none text-xs bg-secondary/50 border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/40 transition-all disabled:opacity-50"
              />
              {voiceSettings.sttEnabled && (
                <Button
                  size="sm"
                  variant={stt.active ? "destructive" : "secondary"}
                  onClick={toggleDictation}
                  disabled={!stt.engine}
                  title={
                    !stt.engine
                      ? "Ditado indisponível — veja o diagnóstico na página Chat com voz"
                      : stt.active
                        ? "Parar ditado"
                        : "Ditar por voz (o texto entra aqui para revisão)"
                  }
                  aria-label={stt.active ? "Parar ditado por voz" : "Ditar por voz"}
                  aria-pressed={stt.active}
                  className="h-9 w-9 p-0 flex-shrink-0"
                >
                  {stt.state === "transcribing" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : stt.active ? (
                    <MicOff className="h-3.5 w-3.5 animate-pulse" />
                  ) : (
                    <Mic className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
              <Button size="sm" onClick={() => submit(input)} disabled={loading || !input.trim()} aria-label="Enviar mensagem" className="h-9 w-9 p-0 flex-shrink-0 transition-transform hover:scale-105 active:scale-95">
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </div>
            {isHome && messages.length === 0 && (
              <p className="text-[10px] text-muted-foreground/70 mt-1.5 px-1">
                Dica: digite qualquer coisa — a IA entende termos, categorias, URLs e IDs.
              </p>
            )}
{!aiEnabled && <AIDisabledNotice compact className="mt-1.5" />}
          </div>
        </div>
      )}
    </aside>
  );
}
