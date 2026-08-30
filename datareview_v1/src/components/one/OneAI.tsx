import { useMemo } from "react";
import { Bot, Sparkles } from "lucide-react";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";
import { UnifiedChatPanel } from "@/components/shared/UnifiedChatPanel";
import { getAISettings, isAIEnabled } from "@/lib/aiSettings";
import { buildUniSystemPrompt, uniScopeLabel } from "@/lib/uni/uniAiPrompt";
import { UNI_SOURCE_META, type UniItem, type UniSourceId } from "@/lib/uni/types";

/**
 * Seção IA da One Page: chat completo (UnifiedChatPanel) sobre a COLETA
 * GLOBAL da página — todos os itens coletados em todas as seções (cruzamento
 * de fontes). Degrada com o AIDisabledNotice padrão quando a IA está off.
 */
export function OneAI({ items }: { items: UniItem[] }) {
  const ai = getAISettings();
  const enabled = isAIEnabled(ai);

  const systemPrompt = useMemo(
    () => buildUniSystemPrompt(items, uniScopeLabel(items, (s) => UNI_SOURCE_META[s as UniSourceId]?.label ?? s)),
    [items],
  );

  if (!enabled) {
    return (
      <div className="mx-auto flex h-full max-w-2xl flex-col justify-center p-6">
        <AIDisabledNotice />
        <p className="mt-4 text-center text-xs text-muted-foreground">
          A coleta nas fontes continua funcionando sem IA. Configure um modo de
          IA para conversar e gerar artefatos sobre o que você coletou aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col p-4">
      <div className="mb-3 flex items-center gap-2 rounded-lg border bg-card/60 p-3">
        <Bot className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <p className="text-xs text-muted-foreground">
          Contexto: <strong className="text-foreground">{items.length}</strong> itens coletados
          nesta página. Pergunte, peça resumos, cruzamentos e artefatos.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <UnifiedChatPanel
          section="os"
          systemPromptOverride={systemPrompt}
          disableIntents={false}
          welcomeMessage={items.length === 0
            ? "Colete dados nas seções acima (ou use a busca global) e eu analiso, cruzo e gero artefatos sobre eles."
            : "Estou lendo os itens coletados nesta página. O que você quer saber ou gerar?"}
          suggestions={[
            "Resumo executivo do que foi coletado",
            "Cruze as fontes: o que se repete?",
            "Gere um ranking dos principais temas",
            "Escreva um relatório com os achados",
          ]}
        />
      </div>
      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
        <Sparkles className="h-3 w-3" aria-hidden /> Respostas geradas por IA sobre os dados que você coletou.
      </p>
    </div>
  );
}
