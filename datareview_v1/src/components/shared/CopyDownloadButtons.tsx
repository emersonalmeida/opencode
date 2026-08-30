import { useState } from "react";
import { Copy, Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CopyDownloadButtons — botões de copiar e baixar para qualquer saída gerada
 * por IA (markdown). Reutilizável em todos os componentes que produzem conteúdo
 * de IA (AutoAIAnalysis, UnifiedComparisonAI, AIAssistantPanel, DashboardAIPanel,
 * SidebarChartsPanel, Atlas ModuleContract, Concept, DecisionCenter, Chat,
 * Canvas NodeOutput, DataExplorer, Playground, Lab, DesignCanvas).
 *
 * - Copiar: envia o markdown cru para o clipboard (com feedback "copiado").
 * - Baixar: salva como .md (timestamp no nome para não sobrescrever).
 * - Renderiza nada se `content` estiver vazio.
 * - `label` opcional para o nome do arquivo (default "analise").
 * - `className` para alinhar (ex: absolute canto, inline, etc).
 */
interface Props {
  content: string;
  /** Nome base do arquivo (sem extensão). Default "analise". */
  filename?: string;
  /** Classe extra para alinhar/dimensionar. */
  className?: string;
  /** Tamanho dos ícones. Default h-3.5 w-3.5. */
  iconSize?: string;
  /** Variant compacto (só ícones, sem texto). Default true. */
  compact?: boolean;
  /** Extensão do arquivo baixado. Default "md" (text/markdown). Use "json" para dados. */
  extension?: "md" | "json" | "txt" | "csv" | "html";
}

function slug(s: string): string {
  return (s || "analise")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || "analise";
}

export function CopyDownloadButtons({
  content,
  filename = "analise",
  className,
  iconSize = "h-3.5 w-3.5",
  compact = true,
  extension = "md",
}: Props) {
  const [copied, setCopied] = useState(false);
  if (!content || !content.trim()) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Fallback para ambientes sem clipboard API.
      const ta = document.createElement("textarea");
      ta.value = content;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
  };

  const download = () => {
    const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(/:/g, "");
    const mime = extension === "json" ? "application/json" : extension === "csv" ? "text/csv" : extension === "txt" ? "text/plain" : extension === "html" ? "text/html" : "text/markdown";
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(filename)}_${stamp}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      <button
        onClick={copy}
        title="Copiar conteúdo"
        aria-label="Copiar conteúdo"
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        {copied ? <Check className={cn(iconSize, "text-emerald-500")} /> : <Copy className={iconSize} />}
      </button>
      <button
        onClick={download}
        title={`Baixar .${extension}`}
        aria-label={`Baixar .${extension}`}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      >
        <Download className={iconSize} />
      </button>
      {!compact && (
        <span className="text-[10px] text-muted-foreground ml-1">
          {copied ? "Copiado!" : "Copiar · Baixar"}
        </span>
      )}
    </div>
  );
}
