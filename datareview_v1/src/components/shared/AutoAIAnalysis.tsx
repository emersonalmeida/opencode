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

interface Props {
  app: AppInfo;
  reviews: ReviewEntry[];
  compact?: boolean;
  /**
   * Kept for API compat but ignored — generation is ALWAYS user-initiated now.
   * Auto-generation was removed so the user decides when to spend tokens/time.
   */
  auto?: boolean;
}

export function AutoAIAnalysis({ app, reviews, compact }: Props) {
  // Persistido: a análise sobrevive a reload/restart (reidrata do store).
  const persisted = usePersistentAIOutput("single", [`${app.store}:${app.id}`]);
  const [liveAnalysis, setLiveAnalysis] = useState("");
  const analysis = liveAnalysis || persisted.value;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ai = useAISettings();
  const aiEnabled = isAIEnabled(ai);

  const run = async () => {
    if (reviews.length === 0) {
      setError("Sem reviews para analisar.");
      return;
    }
    setLoading(true);
    setError("");
    setLiveAnalysis("");
    try {
      const resp = await fetch(apiUrl("/functions/v1/experiment-analyze"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          section: "single",
          apps: [{ app, reviews }],
          ai,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        setError(err.error || `Erro ${resp.status}`);
        setLoading(false);
        return;
      }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("no reader");
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";
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
    <div className="rounded-xl bg-secondary/40 border border-border/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className={compact ? "text-xs font-semibold text-foreground" : "text-sm font-semibold text-foreground"}>
            Análise por IA
          </h3>
        </div>
        {analysis && (
          <Button size="sm" variant="ghost" onClick={run} disabled={loading || reviews.length === 0 || !aiEnabled} className="h-7 gap-1 text-[11px]">
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerar
          </Button>
        )}
        {analysis && (
          <CopyDownloadButtons content={analysis} filename={`analise-${app.name}`} className="ml-1" />
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-xs p-2 bg-destructive/10 rounded-lg">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {loading && !analysis && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Analisando {reviews.length} reviews...
        </div>
      )}

      {analysis && (
        <AIOutputCard
          bare
          title="Análise por IA"
          content={analysis}
          streaming={loading}
          filename={`analise-${app.name}`}
          storageKey={`autoai:${app.store}:${app.id}`}
          onRegenerate={run}
        />
      )}

      {!analysis && !loading && (
        <div className="space-y-2">
          {!aiEnabled ? (
            <AIDisabledNotice />
          ) : (
            <p className="text-xs text-muted-foreground">
              Gere uma análise completa deste app com base em todos os {reviews.length} reviews coletados — pontos fortes, fracos, bugs, pedidos e recomendações, com citações reais.
            </p>
          )}
          <Button size="sm" onClick={run} disabled={reviews.length === 0 || !aiEnabled} className="gap-1.5 text-xs h-8">
            <Sparkles className="h-3.5 w-3.5" />
            Gerar análise
          </Button>
        </div>
      )}
    </div>
  );
}
