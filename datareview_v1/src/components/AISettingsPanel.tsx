import { useState, useEffect, useRef } from "react";
import {
  Cpu, CloudOff, Zap, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff,
  ExternalLink, Sparkles, Wifi, RefreshCw, MonitorSmartphone, Gauge,
} from "lucide-react";
import {
  useAISettings, setAIMode, setLocalAIConfig, setCloudAIConfig,
  PROVIDER_META, CLOUD_PROVIDERS, type CloudProvider, type AIMode,
} from "@/lib/aiSettings";
import { useSystemProfile, browserHints } from "@/lib/systemProfile";
import { checkAIReadiness, aiFingerprint } from "@/lib/aiReadiness";
import { GB, rankModelsWithCtx, memoryBudgetBytes, type SystemProfile } from "../../server/lib/systemProfileCore";


const MODE_META: Record<AIMode, { label: string; desc: string }> = {
  auto: { label: "Automático (recomendado)", desc: "Detecta o hardware desta máquina e escolhe o melhor modelo/modo local sozinho." },
  none: { label: "Sem IA", desc: "Desativa toda geração. Os dados continuam disponíveis para análise manual." },
  local: { label: "IA local (Ollama)", desc: "Você escolhe modelo, GPU e contexto manualmente (ou deixa cada um em auto)." },
  cloud: { label: "IA na nuvem (BYOK)", desc: "Sua própria chave de API: OpenAI, Anthropic, Gemini ou compatível." },
};

const TIER_META: Record<SystemProfile["tier"], { label: string; cls: string }> = {
  low: { label: "Baixo", cls: "text-amber-600 dark:text-amber-400" },
  medium: { label: "Médio", cls: "text-sky-600 dark:text-sky-400" },
  high: { label: "Alto", cls: "text-emerald-600 dark:text-emerald-400" },
  ultra: { label: "Ultra", cls: "text-violet-600 dark:text-violet-400" },
};

const CTX_OPTIONS = [8192, 16384, 32768, 65536] as const;

function fmtGB(bytes: number): string {
  return `${(bytes / GB).toFixed(bytes >= 8 * GB ? 0 : 1)}GB`;
}

/** Card com o hardware detectado + recomendação + botão aplicar. */
function HardwareCard() {
  const { profile, loading, error, refresh } = useSystemProfile();
  const ai = useAISettings();
  const hints = browserHints();

  if (loading && !profile) {
    return (
      <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 flex items-center gap-2 text-[10px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Detectando hardware…
      </div>
    );
  }

  if (!profile) {
    const serverOffline = error?.includes("servidor local inacessível");
    return (
      <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          <span>
            {serverOffline
              ? "Servidor local offline — suba com `npm run dev:server` e a detecção aparece sozinha."
              : `Não foi possível detectar o hardware (${error ?? "erro"}). Usando fallback seguro.`}
          </span>
        </div>
        <button onClick={refresh} className="flex items-center gap-1 text-[10px] text-primary hover:underline">
          <RefreshCw className="h-2.5 w-2.5" /> Tentar novamente
        </button>
      </div>
    );
  }

  const rec = profile.recommended;
  const tier = TIER_META[profile.tier];
  const budget = memoryBudgetBytes(profile.hardware, rec.useGpu);
  // Ranking com o num_ctx que cada modelo aguenta sem vazar da memória.
  const ranked = rankModelsWithCtx(profile.ollama.models, budget, profile.tier);

  const applyRecommendation = () => {
    setAIMode("local");
    setLocalAIConfig({ model: rec.model || "auto", useGpu: rec.useGpu, numCtx: rec.numCtx });
  };

  return (
    <div className="rounded-lg border border-border/50 bg-secondary/20 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Gauge className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-[11px] font-medium text-foreground">Este hardware</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold ${tier.cls}`}>tier {tier.label}</span>
          <button onClick={refresh} aria-label="Redetectar hardware" title="Redetectar hardware"
            className="p-1 rounded hover:bg-secondary/60 text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="space-y-0.5 text-[10px] text-muted-foreground leading-relaxed">
        <p><MonitorSmartphone className="inline h-3 w-3 mr-1" />{profile.hardware.cpuModel} · {profile.hardware.cpuCores} threads</p>
        <p>RAM: {fmtGB(profile.hardware.totalRamBytes)} total
          {hints.memoryGB ? ` · browser reporta ~${hints.memoryGB}GB` : ""}</p>
        {profile.hardware.gpus.length > 0 ? (
          profile.hardware.gpus.map((g) => (
            <p key={g.name}>GPU: {g.name} ({fmtGB(g.vramBytes)} VRAM)</p>
          ))
        ) : (
          <p>GPU dedicada não detectada — CPU é usada para inferência.</p>
        )}
        <p>Ollama: {profile.ollama.available ? `${profile.ollama.models.length} modelo(s) instalados` : "indisponível"}</p>
        {profile.embeddingModel && <p>Embeddings: {profile.embeddingModel}</p>}
      </div>

      {rec.mode === "local" && rec.model && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-2 space-y-1">
          <p className="text-[10px] text-emerald-700 dark:text-emerald-300 leading-relaxed">
            <Sparkles className="inline h-3 w-3 mr-1" />
            Recomendado: <strong>{rec.model}</strong> · {rec.useGpu ? "GPU" : "CPU"} · contexto {rec.numCtx} tokens
          </p>
          <button
            onClick={applyRecommendation}
            className="w-full flex items-center justify-center gap-1 py-1 rounded-md text-[10px] bg-emerald-600/90 text-white hover:bg-emerald-600"
          >
            <CheckCircle2 className="h-3 w-3" /> Aplicar recomendação
          </button>
        </div>
      )}

      {ranked.length > 0 && (
        <details className="text-[10px]">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ranking dos modelos instalados</summary>
          <ul className="mt-1 space-y-0.5 text-muted-foreground">
            {ranked.map((m) => (
              <li key={m.name} className="flex items-center gap-1">
                {m.comfortable
                  ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 shrink-0" />
                  : <AlertCircle className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
                <span className="truncate">{m.name}</span>
                <span className="ml-auto shrink-0">
                  {m.paramBillions ? `${m.paramBillions}B` : fmtGB(m.sizeBytes)}
                  {m.recommendedCtx > 0 ? ` · ctx ${m.recommendedCtx >= 1024 ? `${m.recommendedCtx / 1024}k` : m.recommendedCtx}` : " (não cabe)"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {ai.mode === "auto" && rec.mode === "local" && (
        <p className="text-[9px] text-muted-foreground leading-relaxed">
          Modo automático ativo: o servidor resolve estas escolhas a cada chamada de IA.
        </p>
      )}
    </div>
  );
}

/** AI configuration section, embedded in the left sidebar "Config" tab. */
export function AISettingsPanel() {
  const ai = useAISettings();
  const { profile } = useSystemProfile();
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  // Evita setState após desmontagem (o auto-teste é assíncrono).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await checkAIReadiness(ai);
    if (!mountedRef.current) return;
    setTestResult({ ok: res.ok, message: res.message });
    setTesting(false);
  };

  // Ativação: ao trocar para um modo com IA, verifica AUTOMATICAMENTE se a
  // configuração está pronta (sem exigir o clique em "Testar conexão").
  const fp = aiFingerprint(ai);
  useEffect(() => {
    if (fp === "none") { setTestResult(null); return; }
    void runTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runTest é estável por fp
  }, [fp]);

  const installedModels = profile?.ollama.models ?? [];
  const modelOptions = ["auto", ...installedModels.map((m) => m.name)];
  if (ai.local.model && !modelOptions.includes(ai.local.model)) modelOptions.push(ai.local.model);

  // Fit por modelo instalado neste hardware (memória disponível × ctx máximo
  // sem vazar) — o dropdown do modo local mostra a melhor config de cada um.
  const budget = profile ? memoryBudgetBytes(profile.hardware, ai.local.useGpu) : 0;
  const fitByName = new Map(
    (profile ? rankModelsWithCtx(installedModels, budget, profile.tier) : []).map((m) => [m.name, m] as const),
  );

  return (
    <div className="space-y-3">
      {/* Mode dropdown */}
      <div className="space-y-1.5">
        <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Modo de IA</label>
        <select
          value={ai.mode}
          onChange={(e) => { setAIMode(e.target.value as AIMode); setTestResult(null); }}
          className="w-full text-[11px] px-2 py-1.5 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
        >
          {(Object.keys(MODE_META) as AIMode[]).map((m) => (
            <option key={m} value={m}>{MODE_META[m].label}</option>
          ))}
        </select>
        <p className="text-[9px] text-muted-foreground leading-relaxed">{MODE_META[ai.mode].desc}</p>
      </div>

      {/* Ativação rápida quando a IA está desativada */}
      {ai.mode === "none" && (
        <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/20 p-2.5">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            O sistema funciona completo sem IA (coleta, dashboards, pipeline determinístico, exports).
            Para análises geradas por IA, ative um modo:
          </p>
          <button
            type="button"
            onClick={() => { setAIMode("auto"); setTestResult(null); }}
            className="w-full text-[11px] font-medium px-2 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Ativar IA automática (recomendado)
          </button>
          <p className="text-[9px] text-muted-foreground leading-relaxed">
            Detecta o hardware desta máquina (inclusive Apple Silicon) e escolhe o melhor modelo
            Ollama instalado, GPU/Metal e contexto — sem configurar nada. Ou escolha "IA local"
            / "IA na nuvem" no seletor acima para configurar manualmente.
          </p>
        </div>
      )}

      {/* Hardware profile (auto/local) */}
      {(ai.mode === "auto" || ai.mode === "local") && <HardwareCard />}

      {/* Local config */}
      {ai.mode === "local" && (
        <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/20 p-2.5">
          <div>
            <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">URL do Ollama</label>
            <input
              type="text"
              value={ai.local.ollamaUrl}
              onChange={(e) => setLocalAIConfig({ ollamaUrl: e.target.value })}
              placeholder="http://localhost:11434"
              className="w-full text-[11px] px-2 py-1 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 mt-0.5"
            />
          </div>
          <div>
            <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Modelo</label>
            <select
              value={ai.local.model}
              onChange={(e) => setLocalAIConfig({ model: e.target.value })}
              className="w-full text-[11px] px-2 py-1 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 mt-0.5"
            >
              {modelOptions.map((m) => {
                const fit = fitByName.get(m);
                const label = m === "auto"
                  ? "Automático (melhor para o hardware)"
                  : !fit ? m
                  : fit.recommendedCtx <= 0 ? `${m} — não cabe neste hardware`
                  : `${m} — ctx máx ${fit.recommendedCtx >= 1024 ? `${fit.recommendedCtx / 1024}k` : fit.recommendedCtx}${fit.comfortable ? " ✓" : " (apertado)"}`;
                return <option key={m} value={m}>{label}</option>;
              })}
            </select>
            {installedModels.length === 0 && (
              <p className="text-[9px] text-muted-foreground mt-1">
                Lista vazia porque o perfil não foi detectado — digite manualmente (ex.: gemma3:12b) ou rode <code>ollama list</code>.
              </p>
            )}
          </div>

          {/* Modelo digitável quando a lista está vazia */}
          {installedModels.length === 0 && (
            <input
              type="text"
              value={ai.local.model}
              onChange={(e) => setLocalAIConfig({ model: e.target.value })}
              placeholder="gemma3:12b"
              className="w-full text-[11px] px-2 py-1 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          )}

          <div>
            <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Janela de contexto (num_ctx)</label>
            <select
              value={String(ai.local.numCtx)}
              onChange={(e) =>
                setLocalAIConfig({ numCtx: e.target.value === "auto" ? "auto" : Number(e.target.value) })
              }
              className="w-full text-[11px] px-2 py-1 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 mt-0.5"
            >
              <option value="auto">Automático (perf. do hardware)</option>
              {CTX_OPTIONS.map((c) => (
                <option key={c} value={c}>{c.toLocaleString("pt-BR")} tokens</option>
              ))}
            </select>
            <p className="text-[9px] text-muted-foreground mt-1">Mais contexto = mais reviews na análise, mais VRAM/RAM usada.</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md hover:bg-secondary/40">
            <input
              type="checkbox"
              checked={ai.local.useGpu}
              onChange={(e) => setLocalAIConfig({ useGpu: e.target.checked })}
              className="h-3.5 w-3.5 rounded"
            />
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-foreground">Usar GPU</p>
              <p className="text-[9px] text-muted-foreground">Acelera a geração. Desligue se não tem GPU ou quer poupar VRAM.</p>
            </div>
          </label>
        </div>
      )}

      {/* Cloud config */}
      {ai.mode === "cloud" && (
        <div className="space-y-2 rounded-lg border border-border/50 bg-secondary/20 p-2.5">
          <div>
            <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Provedor</label>
            <select
              value={ai.cloud.provider}
              onChange={(e) => {
                const p = e.target.value as CloudProvider;
                const meta = PROVIDER_META[p];
                setCloudAIConfig({ provider: p, baseUrl: meta.defaultBaseUrl, model: meta.defaultModel });
              }}
              className="w-full text-[11px] px-2 py-1 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 mt-0.5"
            >
              {CLOUD_PROVIDERS.map((p) => (
                <option key={p} value={p}>{PROVIDER_META[p].label}</option>
              ))}
            </select>
          </div>

          {PROVIDER_META[ai.cloud.provider].keyUrl && (
            <a
              href={PROVIDER_META[ai.cloud.provider].keyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[9px] text-primary hover:underline"
            >
              <ExternalLink className="h-2.5 w-2.5" /> Obter chave de API em {PROVIDER_META[ai.cloud.provider].label}
            </a>
          )}

          <div>
            <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Chave de API</label>
            <div className="relative mt-0.5">
              <input
                type={showKey ? "text" : "password"}
                value={ai.cloud.apiKey}
                onChange={(e) => setCloudAIConfig({ apiKey: e.target.value })}
                placeholder="sk-..."
                autoComplete="off"
                spellCheck={false}
                className="w-full text-[11px] px-2 py-1 pr-7 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                aria-label={showKey ? "Ocultar chave" : "Mostrar chave"}
              >
                {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">A chave fica salva só neste navegador e é enviada apenas ao provedor escolhido.</p>
          </div>

          <div>
            <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Modelo</label>
            {PROVIDER_META[ai.cloud.provider].models.length > 0 ? (
              <select
                value={ai.cloud.model}
                onChange={(e) => setCloudAIConfig({ model: e.target.value })}
                className="w-full text-[11px] px-2 py-1 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 mt-0.5"
              >
                {PROVIDER_META[ai.cloud.provider].models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                {!PROVIDER_META[ai.cloud.provider].models.includes(ai.cloud.model) && ai.cloud.model && (
                  <option value={ai.cloud.model}>{ai.cloud.model} (personalizado)</option>
                )}
              </select>
            ) : (
              <input
                type="text"
                value={ai.cloud.model}
                onChange={(e) => setCloudAIConfig({ model: e.target.value })}
                placeholder="ex: llama-3.3-70b-versatile"
                className="w-full text-[11px] px-2 py-1 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 mt-0.5"
              />
            )}
          </div>

          {(ai.cloud.provider === "openai-compatible" || !ai.cloud.baseUrl) && (
            <div>
              <label className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">URL base da API</label>
              <input
                type="text"
                value={ai.cloud.baseUrl}
                onChange={(e) => setCloudAIConfig({ baseUrl: e.target.value })}
                placeholder="https://api.exemplo.com/v1"
                className="w-full text-[11px] px-2 py-1 rounded-md bg-background border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40 mt-0.5"
              />
              <p className="text-[9px] text-muted-foreground mt-1">Endpoint compatível com OpenAI: Groq, Together, OpenRouter, LM Studio, vLLM, etc.</p>
            </div>
          )}
        </div>
      )}

      {/* Test button */}
      {ai.mode !== "none" && (
        <button
          onClick={runTest}
          disabled={testing}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50"
        >
          {testing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
          {testing ? "Testando..." : "Testar conexão"}
        </button>
      )}

      {testResult && (
        <div className={`flex items-start gap-1.5 rounded-md p-2 text-[10px] ${testResult.ok ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
          {testResult.ok ? <CheckCircle2 className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />}
          <span className="leading-relaxed">{testResult.message}</span>
        </div>
      )}

      {ai.mode === "none" && (
        <div className="flex items-start gap-1.5 rounded-md bg-secondary/40 p-2 text-[10px] text-muted-foreground">
          <CloudOff className="h-3 w-3 mt-0.5 shrink-0" />
          <span className="leading-relaxed">Com a IA desativada, todos os botões de "Gerar análise" ficam ocultos. Gráficos, tabelas e dados coletados continuam funcionando normalmente.</span>
        </div>
      )}
    </div>
  );
}
