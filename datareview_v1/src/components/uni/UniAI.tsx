/**
 * Uni — painel de IA: análise sob demanda dos itens coletados + chat.
 *
 * O chat usa o UnifiedChatPanel (componente padronizado do sistema): section
 * "os" com systemPromptOverride próprio (o dataset da Uni é serializado no
 * prompt, apps não são exigidos). Comandos sem IA ("exiba…", "colete…",
 * "pesquise…") também funcionam aqui.
 */
import { useMemo, useRef, useState } from "react";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";
import { FeatureModal, useFeatureModal } from "@/components/shared/FeatureModal";
import { AISettingsPanel } from "@/components/AISettingsPanel";
import { UnifiedChatPanel } from "@/components/shared/UnifiedChatPanel";
import { Button } from "@/components/ui/button";
import { streamExperimentChat, type ChatMessage } from "@/lib/experimentChatApi";
import { getAISettings, isAIEnabled } from "@/lib/aiSettings";
import { saveAIOutput, getAIOutput } from "@/lib/aiOutputStore";
import { buildUniSystemPrompt, uniScopeLabel } from "@/lib/uni/uniAiPrompt";
import { UNI_SOURCE_META, type UniItem, type UniSourceId } from "@/lib/uni/types";
import { toastError } from "@/lib/ux";
import { BrainCircuit, Square } from "lucide-react";

const UNI_OUTPUT_KEY = "uni:analysis";

const buildSystemPrompt = (items: UniItem[], scope: string) => buildUniSystemPrompt(items, scope);

function scopeLabel(items: UniItem[]): string {
  return uniScopeLabel(items, (s) => UNI_SOURCE_META[s as UniSourceId]?.label ?? s);
}

function DisabledHint() {
  const modal = useFeatureModal();
  return (
    <div className="space-y-2">
      <AIDisabledNotice inlineConfigure={modal.openModal} />
      <FeatureModal
        open={modal.open}
        onOpenChange={modal.setOpen}
        title="Inteligência Artificial"
        description="Configure o modo de IA (auto/local/cloud) sem sair da Uni."
        size="lg"
      >
        <AISettingsPanel />
      </FeatureModal>
    </div>
  );
}

export function UniAI({ items, source }: { items: UniItem[]; source: UniSourceId }) {
  const ai = getAISettings();
  const [output, setOutput] = useState(() => getAIOutput(UNI_OUTPUT_KEY)?.markdown ?? "");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const enabled = isAIEnabled(ai);

  const systemPrompt = useMemo(() => buildSystemPrompt(items, scopeLabel(items)), [items]);

  const run = (onDone?: (text: string) => void) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStreaming(true);
    const userMsg: ChatMessage = { role: "user", content: "Analise os dados coletados: principais temas, sentimento geral, padrões e oportunidades. Cite a evidência." };
    streamExperimentChat(
      [],
      [userMsg],
      {
        onToken: (text) => setOutput(text),
        onDone: (text) => {
          setStreaming(false);
          if (text) saveAIOutput("uni", [], text, `uni · ${source}`, UNI_OUTPUT_KEY);
          onDone?.(text);
        },
        onError: (msg) => {
          setStreaming(false);
          toastError(msg);
        },
      },
      ctrl.signal,
      ai,
      "os",
      undefined,
      systemPrompt,
    );
  };

  if (!enabled) return <DisabledHint />;

  return (
    <div className="flex flex-col gap-4">
      {/* Análise sob demanda */}
      <div className="flex items-center gap-2">
        <Button onClick={() => run()} disabled={streaming || !items.length}>
          <BrainCircuit className="mr-1.5 h-4 w-4" />
          {output ? "Regenerar análise" : "Analisar com IA"}
        </Button>
        {streaming && (
          <Button variant="outline" onClick={() => { abortRef.current?.abort(); setStreaming(false); }}>
            <Square className="mr-1.5 h-4 w-4" /> Parar
          </Button>
        )}
        {!items.length && <span className="text-muted-foreground text-xs">Colete dados primeiro.</span>}
      </div>

      {(output || streaming) && (
        <AIOutputCard
          title={`Análise — ${UNI_SOURCE_META[source]?.label ?? source}`}
          content={output}
          streaming={streaming}
          storageKey="uni:analysis"
          filename={`uni-${source}`}
          onRegenerate={streaming ? undefined : () => run()}
        />
      )}

      {/* Chat sobre os dados — componente unificado (com e sem IA). */}
      <div className="rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">Conversar sobre os dados</p>
        <UnifiedChatPanel
          section="os"
          systemPromptOverride={systemPrompt}
          suggestions={[
            "Quais os principais temas?",
            "Resuma o sentimento geral",
            "exiba a saída Uni",
          ]}
          messagesClassName="max-h-80"
        />
      </div>
    </div>
  );
}
