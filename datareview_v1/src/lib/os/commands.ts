/**
 * Nexus OS — registry de comandos do CLI ("do micro ao macro").
 *
 * Todo comando é uma unidade declarativa: id, uso, descrição, categoria,
 * aliases e `run(args, ctx)` que retorna linhas de saída para o console.
 * O mesmo registry alimenta:
 *   - o CONSOLE (aba da sidebar direita) — `/comando args`;
 *   - o AUTOCOMPLETE do input (sugestões enquanto digita);
 *   - a paleta de ações rápidas da barra inferior;
 *   - o `/help` auto-gerado.
 *
 * Comandos que precisam de IA (analyze/agent) apenas DISPARAM a ação — o
 * streaming acontece na coluna central (a página injeta os handlers no ctx).
 * Entrada sem "/" é tratada como pergunta em linguagem natural → vai para o
 * chat de IA (`aiPrompt`).
 */
import type { DatasetEntry } from "@/lib/datasetStore";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { BUILTIN_AGENTS } from "@/lib/agents";
import { PAGES } from "@/lib/pages";
import { OS_VIEWS, line, type ConsoleLine, type OSView } from "./types";
import { trackOSEvent, analysisCoverage, commandFrequency } from "./memory";

/** Tudo que os comandos podem fazer no sistema — injetado pela página. */
export interface OSCommandContext {
  entries: DatasetEntry[];
  aiEnabled: boolean;
  navigate: (path: string) => void;
  setView: (view: OSView) => void;
  /** Dispara uma seção de análise de IA (streaming no centro). */
  runSection: (sectionId: string) => void;
  /** Dispara um agente (pipeline de etapas). */
  runAgent: (agentId: string) => void;
  /** Busca + coleta o primeiro resultado do termo. Retorna msg de status. */
  collectTerm: (term: string) => Promise<string>;
  /** Exporta o dataset inteiro. Retorna descrição do arquivo gerado. */
  exportDataset: (fmt: "json" | "md") => string;
}

export interface OSCommand {
  id: string;
  usage: string;
  description: string;
  category: "dados" | "ia" | "navegação" | "sistema";
  aliases?: string[];
  needsAI?: boolean;
  run: (args: string, ctx: OSCommandContext) => Promise<ConsoleLine[]> | ConsoleLine[];
}

/* ------------------------------------------------------------ helpers --- */

const out = (text: string) => line("out", text);
const ok = (text: string) => line("ok", text);
const err = (text: string) => line("err", text);

function fmtApps(entries: DatasetEntry[]): string {
  if (entries.length === 0) return "(dataset vazio — use /collect <termo>)";
  return entries
    .map((e) => {
      const neg = e.reviews.filter((r) => r.rating <= 2).length;
      const pct = e.reviews.length > 0 ? Math.round((neg / e.reviews.length) * 100) : 0;
      return `• ${e.app.name} [${e.app.store}] — ${e.reviews.length} reviews · ${pct}% negativos`;
    })
    .join("\n");
}

function resolveSection(arg: string): string | null {
  const q = arg.trim().toLowerCase();
  if (!q) return null;
  const exact = EXPERIMENT_SECTIONS.find((s) => s.id === q);
  if (exact) return exact.id;
  const byLabel = EXPERIMENT_SECTIONS.find((s) => s.label.toLowerCase().includes(q));
  return byLabel?.id ?? null;
}

function resolveAgent(arg: string): string | null {
  const q = arg.trim().toLowerCase();
  if (!q) return null;
  const byId = BUILTIN_AGENTS.find((a) => a.id === q);
  if (byId) return byId.id;
  const fuzzy = BUILTIN_AGENTS.find(
    (a) => a.segment.toLowerCase().includes(q) || a.label.toLowerCase().includes(q),
  );
  return fuzzy?.id ?? null;
}

function resolvePage(arg: string): string | null {
  const q = arg.trim().toLowerCase().replace(/^\//, "");
  if (!q) return null;
  const byPath = PAGES.find((p) => p.path === `/${q}` || p.path === q);
  if (byPath) return byPath.path;
  // aceita o NÚMERO do menu de páginas (ex.: "/goto 2" → 2ª página do registry)
  if (/^\d{1,2}$/.test(q)) {
    const byNum = PAGES[parseInt(q, 10) - 1];
    if (byNum) return byNum.path;
  }
  const fuzzy = PAGES.find((p) => p.label.toLowerCase().includes(q))
    ?? PAGES.find((p) => p.desc?.toLowerCase().includes(q));
  return fuzzy?.path ?? null;
}

/** Similaridade barata para "você quis dizer…". */
function closestCommand(token: string): string | null {
  const t = token.toLowerCase();
  let best: string | null = null;
  let bestScore = 0;
  for (const c of OS_COMMANDS) {
    const names = [c.id, ...(c.aliases ?? [])];
    for (const n of names) {
      let score = 0;
      if (n.startsWith(t) || t.startsWith(n)) score = Math.min(n.length, t.length) + 1;
      else if (n.includes(t) || t.includes(n)) score = Math.min(n.length, t.length);
      if (score > bestScore) { bestScore = score; best = c.id; }
    }
  }
  return bestScore >= 2 ? best : null;
}

/* ------------------------------------------------------------ comandos -- */

export const OS_COMMANDS: OSCommand[] = [
  {
    id: "help",
    usage: "/help",
    description: "Lista todos os comandos do OS.",
    category: "sistema",
    aliases: ["ajuda", "?"],
    run: () => {
      const groups = ["dados", "ia", "navegação", "sistema"] as const;
      return groups.flatMap((g) => [
        out(`— ${g.toUpperCase()} —`),
        ...OS_COMMANDS.filter((c) => c.category === g).map((c) => out(`${c.usage.padEnd(24)} ${c.description}`)),
      ]);
    },
  },
  {
    id: "stats",
    usage: "/stats",
    description: "Fatos determinísticos do dataset (sem IA): volume, nota, sentimento, lojas.",
    category: "dados",
    aliases: ["status", "fatos"],
    run: (_args, ctx) => {
      const entries = ctx.entries;
      if (entries.length === 0) return [err("Dataset vazio. Colete um app com /collect <termo>.")];
      const reviews = entries.flatMap((e) => e.reviews);
      const total = reviews.length;
      const pos = reviews.filter((r) => r.rating >= 4).length;
      const neg = reviews.filter((r) => r.rating <= 2).length;
      const avg = total > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(2) : "—";
      const apple = entries.filter((e) => e.app.store === "apple").length;
      const google = entries.filter((e) => e.app.store === "google").length;
      return [
        ok(`📊 ${entries.length} apps · ${total} reviews · nota média ${avg}`),
        out(`Sentimento: ${Math.round((pos / total) * 100)}% positivo · ${Math.round((neg / total) * 100)}% negativo`),
        out(`Lojas: ${apple} Apple · ${google} Google`),
      ];
    },
  },
  {
    id: "apps",
    usage: "/apps",
    description: "Lista os apps coletados com volume e % de negatividade.",
    category: "dados",
    aliases: ["listar", "ls"],
    run: (_args, ctx) => [out(fmtApps(ctx.entries))],
  },
  {
    id: "collect",
    usage: "/collect <termo>",
    description: "Busca o termo nas duas lojas e coleta o app mais relevante (reviews incluídos).",
    category: "dados",
    aliases: ["coletar"],
    run: async (args, ctx) => {
      const term = args.trim();
      if (!term) return [err("Uso: /collect <termo> — ex.: /collect nubank")];
      const msg = await ctx.collectTerm(term);
      return [msg.startsWith("✓") ? ok(msg) : err(msg)];
    },
  },
  {
    id: "analyze",
    usage: "/analyze <seção>",
    description: `Gera uma análise de IA. Seções: ${EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai").map((s) => s.id).join(", ")}.`,
    category: "ia",
    aliases: ["analisar"],
    needsAI: true,
    run: (args, ctx) => {
      if (!ctx.aiEnabled) return [err("IA desativada. Ative em Configurações → Inteligência Artificial.")];
      const id = resolveSection(args);
      if (!id) {
        return [err(`Seção desconhecida: "${args}". Opções: ${EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai").map((s) => s.id).join(", ")}`)];
      }
      if (ctx.entries.length === 0) return [err("Dataset vazio. Colete um app primeiro (/collect).")];
      ctx.runSection(id);
      ctx.setView("analises");
      return [ok(`⚡ Gerando "${EXPERIMENT_SECTIONS.find((s) => s.id === id)?.label}" — acompanhe o streaming no centro.`)];
    },
  },
  {
    id: "agent",
    usage: "/agent <id|segmento>",
    description: `Delega um pipeline completo a um agente. Agentes: ${BUILTIN_AGENTS.map((a) => a.id).join(", ")}.`,
    category: "ia",
    aliases: ["agente"],
    needsAI: true,
    run: (args, ctx) => {
      if (!ctx.aiEnabled) return [err("IA desativada. Ative em Configurações → Inteligência Artificial.")];
      const id = resolveAgent(args);
      if (!id) {
        return [err(`Agente desconhecido: "${args}". Opções: ${BUILTIN_AGENTS.map((a) => `${a.id} (${a.label})`).join(", ")}`)];
      }
      if (ctx.entries.length === 0) return [err("Dataset vazio. Colete um app primeiro (/collect).")];
      ctx.runAgent(id);
      ctx.setView("fluxos");
      const agent = BUILTIN_AGENTS.find((a) => a.id === id);
      return [ok(`🤖 Agente ${agent?.label} executando: ${agent?.pipeline.map((s) => s.label).join(" → ")}`)];
    },
  },
  {
    id: "view",
    usage: "/view <overview|analises|fluxos|insights>",
    description: "Troca a view da coluna central.",
    category: "navegação",
    aliases: ["abrir"],
    run: (args, ctx) => {
      const q = args.trim().toLowerCase();
      const view = OS_VIEWS.find((v) => v.id === q || v.label.toLowerCase().includes(q));
      if (!view) return [err(`View desconhecida: "${args}". Opções: ${OS_VIEWS.map((v) => v.id).join(", ")}`)];
      ctx.setView(view.id);
      return [ok(`→ ${view.label}`)];
    },
  },
  {
    id: "goto",
    usage: "/goto <página>",
    description: "Navega para qualquer página do sistema (dashboard, canvas, pipeline…).",
    category: "navegação",
    aliases: ["ir", "cd"],
    run: (args, ctx) => {
      const path = resolvePage(args);
      if (!path) return [err(`Página desconhecida: "${args}". Veja /help ou o menu Páginas.`)];
      ctx.navigate(path);
      return [ok(`→ ${path}`)];
    },
  },
  {
    id: "export",
    usage: "/export <json|md>",
    description: "Exporta o dataset inteiro (apps + reviews) como JSON ou Markdown.",
    category: "dados",
    aliases: ["exportar"],
    run: (args, ctx) => {
      const fmt = args.trim().toLowerCase();
      if (fmt !== "json" && fmt !== "md") return [err("Uso: /export json ou /export md")];
      if (ctx.entries.length === 0) return [err("Dataset vazio — nada a exportar.")];
      return [ok(`✓ ${ctx.exportDataset(fmt)}`)];
    },
  },
  {
    id: "insights",
    usage: "/insights",
    description: "Abre a view de insights — o que o OS aprendeu sobre o seu trabalho.",
    category: "navegação",
    aliases: ["recomendar"],
    run: (_args, ctx) => {
      ctx.setView("insights");
      return [ok("→ Insights")];
    },
  },
  {
    id: "memory",
    usage: "/memory",
    description: "Resumo do que o OS aprendeu com o seu uso (comandos, cobertura).",
    category: "sistema",
    aliases: ["memoria", "aprendizado"],
    run: async (_args, ctx) => {
      const { listOSEvents } = await import("./memory");
      const events = listOSEvents();
      const { done, missing } = analysisCoverage(events);
      const top = commandFrequency(events).slice(0, 5);
      return [
        ok(`🧠 ${events.length} eventos registrados`),
        out(`Cobertura de análises: ${done.length}/${done.length + missing.length} seções`),
        out(top.length > 0 ? `Mais usados: ${top.map(([id, n]) => `/${id} (${n}×)`).join(" · ")}` : "Sem hábitos detectados ainda."),
        out(`Apps no dataset: ${ctx.entries.length}`),
      ];
    },
  },
  {
    id: "forget",
    usage: "/forget",
    description: "Apaga a memória de aprendizado do OS (não afeta o dataset).",
    category: "sistema",
    aliases: ["esquecer"],
    run: async () => {
      const { clearOSMemory } = await import("./memory");
      clearOSMemory();
      return [ok("Memória de aprendizado apagada. O OS recomeça a aprender a partir de agora.")];
    },
  },
];

/* ----------------------------------------------------------- execução --- */

/** Sugestões de autocomplete: comandos que batem com o prefixo digitado. */
export function matchCommands(query: string): OSCommand[] {
  const q = query.trim().toLowerCase().replace(/^\//, "");
  if (!q) return OS_COMMANDS;
  return OS_COMMANDS.filter(
    (c) => c.id.startsWith(q) || (c.aliases ?? []).some((a) => a.startsWith(q)),
  );
}

export interface CLIResult {
  lines: ConsoleLine[];
  /** Entrada em linguagem natural (sem "/") — a página manda para o chat IA. */
  aiPrompt?: string;
}

/**
 * Executa uma linha do console. "/" → comando; qualquer outra coisa →
 * pergunta em linguagem natural para a IA.
 */
export async function executeCLI(input: string, ctx: OSCommandContext): Promise<CLIResult> {
  const trimmed = input.trim();
  if (!trimmed) return { lines: [] };
  if (!trimmed.startsWith("/")) {
    trackOSEvent("chat", trimmed.slice(0, 48));
    return { lines: [out("💬 Enviado ao assistente de IA (barra inferior).")], aiPrompt: trimmed };
  }
  const [token, ...rest] = trimmed.slice(1).split(/\s+/);
  const args = rest.join(" ");
  const cmd = OS_COMMANDS.find((c) => c.id === token.toLowerCase() || (c.aliases ?? []).includes(token.toLowerCase()));
  if (!cmd) {
    const suggestion = closestCommand(token);
    return {
      lines: [
        err(`Comando desconhecido: /${token}.${suggestion ? ` Você quis dizer /${suggestion}?` : " Veja /help."}`),
      ],
    };
  }
  trackOSEvent("command", cmd.id, args || undefined);
  try {
    const lines = await cmd.run(args, ctx);
    return { lines };
  } catch (e) {
    return { lines: [err(e instanceof Error ? e.message : "Falha ao executar o comando")] };
  }
}
