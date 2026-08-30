import { useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { Sparkles, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";
import { Button } from "@/components/ui/button";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { useAISettings, isAIEnabled } from "@/lib/aiSettings";
import { usePersistentAIOutput } from "@/lib/aiOutputStore";

interface AppBundle {
  app: AppInfo;
  reviews: ReviewEntry[];
}

interface Props {
  bundles: AppBundle[];
  /**
   * Kept for API compat but ignored — generation is ALWAYS user-initiated now.
   */
  auto?: boolean;
}

export function UnifiedComparisonAI({ bundles }: Props) {
  // Persistido: reidrata a última análise comparativa deste conjunto de apps.
  const persisted = usePersistentAIOutput("compare", bundles.map((b) => `${b.app.store}:${b.app.id}`));
  const [liveAnalysis, setLiveAnalysis] = useState("");
  const analysis = liveAnalysis || persisted.value;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ai = useAISettings();
  const aiEnabled = isAIEnabled(ai);
  const canRun = bundles.length >= 2 && aiEnabled;

  const run = async () => {
    if (bundles.length < 2) return;
    setLoading(true); setError(""); setLiveAnalysis("");
    try {
      const resp = await fetch(apiUrl("/functions/v1/experiment-analyze"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ section: "compare", apps: bundles, ai }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setError(err.error || `Erro ${resp.status}`);
        setLoading(false); return;
      }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("no reader");
      const decoder = new TextDecoder();
      let buffer = ""; let result = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
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
            if (content) { result += content; setLiveAnalysis(result); }
          } catch { /* ignore */ }
        }
      }
      // Persiste o resultado — sobrevive a reload/restart/pull.
      if (result.trim()) persisted.save(result, `${ai.mode}${ai.mode === "local" ? ` ${ai.local?.model ?? ""}` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-3xl p-6 sm:p-8 space-y-4 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary font-semibold">IA · Comparação unificada</p>
            <h2 className="text-lg font-bold text-foreground">Análise cruzada dos {bundles.length} apps</h2>
            <p className="text-xs text-muted-foreground max-w-2xl">
              Síntese a partir dos payloads e reviews de todos os apps exibidos — pontos fortes, fracos, diferenciais, riscos e ranking final com evidências. Gere quando quiser.
            </p>
          </div>
        </div>
        {analysis && (
          <Button size="sm" variant="outline" onClick={run} disabled={loading || !canRun} className="gap-1.5">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerar
          </Button>
        )}
        {analysis && (
          <CopyDownloadButtons content={analysis} filename={`comparativo-${bundles.length}apps`} />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-xs p-3 bg-destructive/10 rounded-lg">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {loading && !analysis && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Analisando {bundles.length} apps e {bundles.reduce((s, b) => s + b.reviews.length, 0)} reviews em conjunto…
        </div>
      )}

      {analysis && (
        <div className="rounded-xl bg-secondary/40 border border-border/40 p-5">
          <AIOutputCard
            bare
            title="Análise cruzada"
            content={analysis}
            streaming={loading}
            filename={`comparativo-${bundles.length}apps`}
            storageKey={`compare-ai:${bundles.map((b) => `${b.app.store}:${b.app.id}`).sort().join("|")}`}
            onRegenerate={canRun ? run : undefined}
          />
        </div>
      )}

      {!analysis && !loading && (
        <div className="space-y-3">
          {!aiEnabled ? (
            <AIDisabledNotice />
          ) : (
            <p className="text-xs text-muted-foreground">
              Gere uma análise comparativa completa destes {bundles.length} apps — visão geral, quantitativo, qualitativo, bugs, pedidos comuns e ranking com recomendações priorizadas.
            </p>
          )}
          <Button size="sm" onClick={run} disabled={!canRun} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Gerar análise comparativa
          </Button>
        </div>
      )}
    </div>
  );
}
