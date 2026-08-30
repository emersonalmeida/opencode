import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import { useState, type ReactNode, type HTMLAttributes } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { EmbeddedSurface } from "@/components/shared/EmbeddedSurface";

interface Props {
  content: string;
  className?: string;
  compact?: boolean;
  enableCharts?: boolean;
  /** Renderiza HTML embutido no markdown (details, kbd, mark, img, sub/sup…).
   *  Default true — conteúdo é gerado pela IA configurada pelo próprio usuário. */
  enableHtml?: boolean;
  /** Renderiza blocos fenced ```component <id>``` como componentes REAIS do
   *  sistema (superfícies embutíveis — o usuário interage de verdade). */
  enableComponents?: boolean;
}

function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = (className || "").replace("language-", "") || "code";
  return (
    <div className="not-prose my-3 rounded-lg border border-border/60 bg-muted/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-muted/60">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{lang}</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(children);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          {copied ? <><Check className="h-3 w-3" /> Copiado</> : <><Copy className="h-3 w-3" /> Copiar</>}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed"><code className="font-mono text-foreground">{children}</code></pre>
    </div>
  );
}

const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
  "hsl(280 65% 60%)", "hsl(190 70% 45%)",
];

type ChartType = "bar" | "pie" | "line" | "area";

function ChartBlock({ type, raw }: { type: ChartType; raw: string }) {
  let data: Array<Record<string, unknown>> = [];
  let xKey = "name";
  let yKey = "value";
  let parseErr = "";
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      data = parsed;
    } else if (parsed && Array.isArray(parsed.data)) {
      data = parsed.data;
      if (parsed.xKey) xKey = String(parsed.xKey);
      if (parsed.yKey) yKey = String(parsed.yKey);
    }
  } catch (e) {
    parseErr = e instanceof Error ? e.message : "JSON inválido";
  }

  if (parseErr) {
    return (
      <div className="not-prose my-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-[11px] text-destructive">
        Erro ao renderizar gráfico: {parseErr}
      </div>
    );
  }
  if (!data.length) {
    return (
      <div className="not-prose my-3 rounded-lg border border-border/60 bg-muted/40 p-3 text-[11px] text-muted-foreground">
        Gráfico sem dados.
      </div>
    );
  }

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--card-foreground))",
    fontSize: "11px",
  };
  const axisProps = {
    stroke: "hsl(var(--muted-foreground))",
    fontSize: 11,
    tickLine: false,
    axisLine: false,
  } as const;

  return (
    <div className="not-prose my-4 rounded-xl border border-border/60 bg-card p-4">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === "bar" ? (
            <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <XAxis dataKey={xKey} {...axisProps} />
              <YAxis {...axisProps} width={36} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
              <Bar dataKey={yKey} radius={[4, 4, 0, 0]} maxBarSize={48}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : type === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={80} innerRadius={42} paddingAngle={2}
                label={({ percent }: { percent?: number }) => percent ? `${(percent * 100).toFixed(0)}%` : ""}
                labelLine={false} fontSize={11}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
            </PieChart>
          ) : type === "area" ? (
            <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <XAxis dataKey={xKey} {...axisProps} />
              <YAxis {...axisProps} width={36} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey={yKey} stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.25} strokeWidth={2} />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
              <XAxis dataKey={xKey} {...axisProps} />
              <YAxis {...axisProps} width={36} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey={yKey} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3, fill: "hsl(var(--chart-1))" }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const CHART_LANGS: Record<string, ChartType> = {
  "chart-bar": "bar",
  "chart-pie": "pie",
  "chart-line": "line",
  "chart-area": "area",
};

/**
 * Renderizador PADRÃO de markdown/IA do sistema. Além do GFM completo
 * (tabelas, task lists, strikethrough), renderiza HTML embutido
 * (details/summary, kbd, mark, sub/sup, img com atributos), imagens
 * responsivas com legenda, links externos com ícone, tabelas com header
 * fixo e zebra, blocos de código com copiar, e gráficos fenced
 * (chart-bar/pie/line/area).
 */
export function MarkdownRenderer({ content, className, compact = true, enableCharts = false, enableHtml = true, enableComponents = false }: Props) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:text-foreground prose-headings:font-semibold prose-headings:tracking-tight",
        "prose-h1:text-base prose-h1:mt-4 prose-h1:mb-2 prose-h1:pb-1 prose-h1:border-b prose-h1:border-border/60",
        "prose-h2:text-sm prose-h2:mt-4 prose-h2:mb-2 prose-h2:text-foreground",
        "prose-h3:text-xs prose-h3:uppercase prose-h3:tracking-wider prose-h3:text-muted-foreground prose-h3:mt-3 prose-h3:mb-1.5",
        "prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:my-2",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-em:text-foreground/80",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-ul:my-2 prose-ul:pl-4 prose-li:my-0.5 prose-li:text-foreground/90 prose-li:marker:text-primary",
        "prose-ol:my-2 prose-ol:pl-4",
        "prose-blockquote:border-l-2 prose-blockquote:border-primary/60 prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-3 prose-blockquote:rounded-r prose-blockquote:not-italic prose-blockquote:text-foreground/80 prose-blockquote:my-3",
        "prose-code:text-primary prose-code:bg-primary/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em] prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
        "prose-hr:border-border/60 prose-hr:my-4",
        "prose-table:text-xs prose-th:text-foreground prose-th:font-semibold prose-th:bg-muted/50 prose-th:px-2 prose-th:py-1.5 prose-th:border prose-th:border-border/60",
        "prose-td:px-2 prose-td:py-1.5 prose-td:border prose-td:border-border/60 prose-td:text-foreground/90",
        compact && "text-xs",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={enableHtml ? [rehypeRaw] : []}
        components={{
          code({ inline, className, children, ...props }: { inline?: boolean; className?: string; children?: ReactNode } & HTMLAttributes<HTMLElement>) {
            const text = String(children).replace(/\n$/, "");
            const lang = (className || "").replace("language-", "");
            if (inline) {
              return <code className={className} {...props}>{text}</code>;
            }
            const chartType = enableCharts ? CHART_LANGS[lang] : undefined;
            if (chartType) {
              return <ChartBlock type={chartType} raw={text} />;
            }
            // Fence ```component <id>``` → superfície REAL embutida na resposta.
            if (enableComponents && lang === "component") {
              const surfaceId = text.split(/\s+/)[0]?.trim() ?? "";
              return <EmbeddedSurface id={surfaceId} />;
            }
            return <CodeBlock className={className}>{text}</CodeBlock>;
          },
          a({ href, children }) {
            const external = !!href && /^https?:\/\//.test(href);
            return (
              <a
                href={href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="text-primary hover:underline underline-offset-2 inline-flex items-baseline gap-0.5 break-words"
              >
                {children}
                {external && <ExternalLink className="h-2.5 w-2.5 inline-block shrink-0 self-center" aria-hidden="true" />}
              </a>
            );
          },
          img({ src, alt }) {
            return (
              <span className="not-prose block my-3">
                <img
                  src={src}
                  alt={alt ?? ""}
                  loading="lazy"
                  className="max-w-full h-auto max-h-80 rounded-lg border border-border/60 bg-muted/30 object-contain"
                />
                {alt && <span className="block mt-1 text-[10px] text-muted-foreground italic">{alt}</span>}
              </span>
            );
          },
          details({ children, ...props }) {
            return (
              <details
                className="not-prose my-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 open:pb-3 [&>summary]:cursor-pointer"
                {...props}
              >
                {children}
              </details>
            );
          },
          summary({ children }) {
            return (
              <summary className="text-xs font-semibold text-foreground select-none marker:text-primary">
                {children}
              </summary>
            );
          },
          kbd({ children }) {
            return (
              <kbd className="not-prose inline-flex items-center rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground shadow-sm">
                {children}
              </kbd>
            );
          },
          mark({ children }) {
            return (
              <mark className="rounded-sm bg-warning/30 px-0.5 text-foreground">
                {children}
              </mark>
            );
          },
          hr() {
            return <hr className="not-prose my-4 border-border/60" />;
          },
          table({ children }) {
            return (
              <div className="not-prose my-3 overflow-x-auto overflow-y-auto max-h-96 rounded-lg border border-border/60 [&_tbody_tr:nth-child(even)]:bg-muted/30">
                <table className="w-full text-xs border-collapse">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="sticky top-0 z-10 text-left font-semibold bg-muted px-2.5 py-1.5 border-b border-border/60 text-foreground whitespace-nowrap">{children}</th>;
          },
          td({ children }) {
            return <td className="px-2.5 py-1.5 border-b border-border/40 text-foreground/90 align-top">{children}</td>;
          },
          input({ type, checked, ...props }: { type?: string; checked?: boolean } & HTMLAttributes<HTMLInputElement>) {
            if (type === "checkbox") {
              return (
                <span className={cn(
                  "inline-flex h-3.5 w-3.5 items-center justify-center rounded border mr-1.5 align-middle",
                  checked ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background",
                )}>
                  {checked && <Check className="h-2.5 w-2.5" />}
                </span>
              );
            }
            return <input type={type} {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
