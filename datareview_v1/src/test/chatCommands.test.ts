/**
 * chatCommands — detecção de intenção sem IA.
 */
import { describe, it, expect } from "vitest";
import { detectChatIntent, resolveUniSources, resolvePagePath, CHAT_COMMANDS_HELP } from "@/lib/chatCommands";
import { PIPELINE_SOURCES } from "@/lib/uni/sourceRunner";

describe("detectChatIntent — exibir superfícies", () => {
  it('"exiba a página de pipeline" → show pipeline', () => {
    expect(detectChatIntent("exiba a página de pipeline")).toEqual({
      kind: "show",
      surfaceId: "pipeline",
      label: "Pipeline",
    });
  });

  it('"mostre os gráficos" → show charts', () => {
    const a = detectChatIntent("mostre os gráficos");
    expect(a?.kind).toBe("show");
    expect((a as { surfaceId: string }).surfaceId).toBe("charts");
  });

  it('"abra a configuração de coleta" → show collection-config', () => {
    const a = detectChatIntent("abra a configuração de coleta");
    expect(a?.kind).toBe("show");
    expect((a as { surfaceId: string }).surfaceId).toBe("collection-config");
  });

  it('"exiba o componente de relatório da página experimentos" → show report', () => {
    const a = detectChatIntent("exiba o componente de relatório da página experimentos");
    expect(a?.kind).toBe("show");
    expect((a as { surfaceId: string }).surfaceId).toBe("report");
  });

  it("nomear a página sem verbo também resolve", () => {
    const a = detectChatIntent("página de pipeline");
    expect(a?.kind).toBe("show");
  });
});

describe("detectChatIntent — coleta de apps", () => {
  it('"colete nubank" → collect-app', () => {
    expect(detectChatIntent("colete nubank")).toEqual({ kind: "collect-app", term: "nubank" });
  });

  it('"coletar o app banco inter" → collect-app com termo composto', () => {
    const a = detectChatIntent("coletar o app banco inter");
    expect(a?.kind).toBe("collect-app");
    expect((a as { term: string }).term).toContain("banco inter");
  });
});

describe("detectChatIntent — pesquisa multifonte", () => {
  it('"pesquise bitcoin em todas as fontes" → collect-multi com todas', () => {
    const a = detectChatIntent("pesquise bitcoin em todas as fontes");
    expect(a?.kind).toBe("collect-multi");
    const m = a as { term: string; sources: string[]; max: boolean };
    expect(m.term).toBe("bitcoin");
    expect(m.sources.length).toBe(PIPELINE_SOURCES.length);
    expect(m.max).toBe(true);
  });

  it('"pesquise cripto e autocustodia em todas as fontes com coleta máxima" → termo completo', () => {
    const a = detectChatIntent("pesquise cripto e autocustodia em todas as fontes com coleta máxima de todos os dados");
    expect(a?.kind).toBe("collect-multi");
    const m = a as { term: string; max: boolean };
    expect(m.term).toContain("cripto");
    expect(m.max).toBe(true);
  });

  it('"busque reviews de apps no reddit" → fonte específica', () => {
    const a = detectChatIntent("busque reviews de apps no reddit");
    expect(a?.kind).toBe("collect-multi");
    const m = a as { sources: string[] };
    expect(m.sources).toContain("reddit");
    expect(m.sources.length).toBeLessThan(PIPELINE_SOURCES.length);
  });

  it('"pesquise IA em fontes acadêmicas" → grupo acadêmico', () => {
    const a = detectChatIntent("pesquise inteligência artificial em fontes acadêmicas");
    expect(a?.kind).toBe("collect-multi");
    const m = a as { sources: string[] };
    expect(m.sources).toContain("arxiv");
  });
});

describe("detectChatIntent — executar pipeline", () => {
  it('"execute o pipeline" → run-pipeline sem seção', () => {
    expect(detectChatIntent("execute o pipeline")).toEqual({ kind: "run-pipeline", sectionId: null });
  });

  it('"rode a pipeline completa" → run-pipeline', () => {
    const a = detectChatIntent("rode a pipeline completa");
    expect(a?.kind).toBe("run-pipeline");
  });

  it('"rode a análise de problemas" → run-pipeline com seção problems', () => {
    expect(detectChatIntent("rode a análise de problemas")).toEqual({ kind: "run-pipeline", sectionId: "problems" });
  });

  it('"execute a análise de oportunidades" → run-pipeline opportunities', () => {
    const a = detectChatIntent("execute a análise de oportunidades");
    expect(a).toEqual({ kind: "run-pipeline", sectionId: "opportunities" });
  });

  it('"execute a coleta" NÃO vira run-pipeline (verbo coleta vence)', () => {
    const a = detectChatIntent("execute a coleta do nubank");
    expect(a?.kind).not.toBe("run-pipeline");
  });
});

describe("detectChatIntent — seletor de fontes", () => {
  it('"selecione as fontes" → show uni-picker', () => {
    expect(detectChatIntent("selecione as fontes")).toEqual({
      kind: "show",
      surfaceId: "uni-picker",
      label: "Seletor de fontes Uni",
    });
  });

  it('"configure a coleta multifonte" → show uni-picker', () => {
    const a = detectChatIntent("configure a coleta multifonte");
    expect(a).toEqual({ kind: "show", surfaceId: "uni-picker", label: "Seletor de fontes Uni" });
  });
});

describe("detectChatIntent — relatório e ajuda", () => {
  it('"gere um relatório" → report sem escopo', () => {
    expect(detectChatIntent("gere um relatório")).toEqual({ kind: "report", scope: null });
  });

  it('"gere um relatório completo do nubank" → report com escopo', () => {
    const a = detectChatIntent("gere um relatório completo do nubank");
    expect(a?.kind).toBe("report");
    expect((a as { scope: string | null }).scope).toContain("nubank");
  });

  it('"ajuda" → help', () => {
    expect(detectChatIntent("ajuda")).toEqual({ kind: "help" });
    expect(detectChatIntent("o que você pode fazer?")).toEqual({ kind: "help" });
  });
});

describe("detectChatIntent — sem intenção", () => {
  it("pergunta livre retorna null (vai para a IA)", () => {
    expect(detectChatIntent("quais são os principais problemas do app?")).toBeNull();
    expect(detectChatIntent("")).toBeNull();
  });
});

describe("resolveUniSources", () => {
  it("resolve fontes citadas por nome", () => {
    const s = resolveUniSources("busque no reddit e no youtube");
    expect(s).toContain("reddit");
    expect(s).toContain("youtube");
  });

  it("texto sem fontes retorna vazio", () => {
    expect(resolveUniSources("qualquer coisa")).toEqual([]);
  });
});

describe("detectChatIntent — navegação (goto)", () => {
  it('"vá para o dashboard" → goto /dashboard', () => {
    expect(detectChatIntent("vá para o dashboard")).toEqual({
      kind: "goto",
      path: "/dashboard",
      label: "Dashboard",
    });
  });

  it('"acesse o canvas" → goto /canvas', () => {
    expect(detectChatIntent("acesse o canvas")).toEqual({
      kind: "goto",
      path: "/canvas",
      label: "Canvas",
    });
  });

  it('"abra a página de configurações" → goto (não show)', () => {
    const a = detectChatIntent("abra a página de configurações");
    expect(a?.kind).toBe("goto");
    expect((a as { path: string }).path).toBe("/configuracoes");
  });

  it('"ir para configurações" → goto /configuracoes', () => {
    const a = detectChatIntent("ir para configurações");
    expect(a?.kind).toBe("goto");
  });

  it('"vá para /chat" aceita o path direto', () => {
    expect(detectChatIntent("vá para /chat")).toEqual({
      kind: "goto",
      path: "/chat",
      label: "Chat",
    });
  });

  it("navegação sem página conhecida cai fora (null ou outra ação)", () => {
    const a = detectChatIntent("vá para o espaço sideral");
    expect(a?.kind).not.toBe("goto");
  });

  it('"exiba a página de pipeline" continua sendo show (verbo de exibição)', () => {
    expect(detectChatIntent("exiba a página de pipeline")?.kind).toBe("show");
  });
});

describe("resolvePagePath", () => {
  it("resolve por path", () => {
    expect(resolvePagePath("/dashboard")).toEqual({ path: "/dashboard", label: "Dashboard" });
  });

  it("resolve por label exata e parcial", () => {
    expect(resolvePagePath("Canvas")).toEqual({ path: "/canvas", label: "Canvas" });
    expect(resolvePagePath("configurações")?.path).toBe("/configuracoes");
  });

  it("resolve pelo número do menu (ordem do registry)", () => {
    const byNum = resolvePagePath("1");
    expect(byNum).not.toBeNull();
    expect(typeof byNum?.path).toBe("string");
  });

  it("desconhecida retorna null", () => {
    expect(resolvePagePath("planeta marte")).toBeNull();
  });
});

describe("CHAT_COMMANDS_HELP", () => {
  it("documenta as 4 capacidades", () => {
    expect(CHAT_COMMANDS_HELP).toContain("Exibir componentes");
    expect(CHAT_COMMANDS_HELP).toContain("Coletar apps");
    expect(CHAT_COMMANDS_HELP).toContain("multifonte");
    expect(CHAT_COMMANDS_HELP).toContain("Relatório");
  });

  it("documenta a abertura de páginas no chat", () => {
    expect(CHAT_COMMANDS_HELP).toContain("Abrir página no chat");
  });
});
