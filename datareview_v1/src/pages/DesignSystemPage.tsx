/**
 * Design System (`/design-system`) — catálogo vivo do design system do
 * App Intelligence, estilo GitLab Pajamas / Storybook:
 * Foundations (tokens, tipografia, espaçamento, elevação, motion, ícones) →
 * Componentes (átomos → moléculas → organismos → layouts, com previews ao
 * vivo via NodeBody do Design Canvas) → Padrões → Conteúdo → Acessibilidade.
 * Cada seção é um ExpandableBlock (3 níveis, persistido) com exportação
 * copy/download do seu conteúdo.
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  SwatchBook, Type, Ruler, Box, Zap, Shapes, Atom as AtomIcon, Puzzle,
  Boxes, LayoutTemplate, Layers, MessageSquareText, Accessibility, Check,
  Copy, ExternalLink, Layers3, Palette,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { EmptyState } from "@/components/shared/EmptyState";
import { CopyDownloadButtons } from "@/components/shared/CopyDownloadButtons";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { Panel } from "@/components/Panel";
import { SidebarTabStrip } from "@/components/shared/SidebarTabStrip";
import { NodeBody } from "@/components/designCanvas/DesignCanvasNode";
import { COMPONENT_LIST } from "@/lib/designCanvas/registry";
import {
  DESIGN_TOKENS, useDesignTokens, effectiveTokenValue,
  TOKEN_GROUP_ORDER, TOKEN_GROUP_META, tokensByGroup,
} from "@/lib/designTokens";
import { DesignSystemSection } from "@/components/settings/DesignSystemSection";
import { PAGES } from "@/lib/pages";
import {
  DS_SECTIONS, TYPE_SCALE, SPACING_SCALE, ELEVATION_SCALE, MOTION_OPTIONS,
  A11Y_RULES, CONTENT_RULES,
} from "@/lib/designSystem";
import { useUISettings } from "@/lib/uiSettings";
import { valueToCss, parseAlpha } from "@/lib/colorUtils";
import type { ComponentMeta } from "@/lib/designCanvas/types";
import type { LucideIcon } from "lucide-react";

/** Fundo xadrez para evidenciar transparência nos swatches. */
const CHECKERBOARD = "conic-gradient(hsl(var(--border)) 25%, transparent 0 50%, hsl(var(--border)) 0 75%, transparent 0) 0 0 / 12px 12px";

/* ---------------------------------------------------------------- helpers */

function useCopyValue() {
  return (value: string, label: string) => {
    navigator.clipboard?.writeText(value).then(
      () => toast.success(`"${label}" copiado`, { description: value }),
      () => toast.error("Clipboard indisponível"),
    );
  };
}

function SectionBlock({
  id, icon, index, exportData, children,
}: {
  id: string;
  icon: React.ReactNode;
  index: number;
  exportData?: () => unknown;
  children: React.ReactNode;
}) {
  const meta = DS_SECTIONS.find((s) => s.id === id);
  return (
    <ExpandableBlock
      id={id}
      storageKey={id}
      title={`${String(index + 1).padStart(2, "0")} · ${meta?.label ?? id}`}
      subtitle={meta?.description}
      icon={icon}
      exportName={id}
      exportData={exportData}
    >
      <div className="px-4 pb-4">{children}</div>
    </ExpandableBlock>
  );
}

/* ------------------------------------------------------------ componentes */

function ComponentCard({ meta }: { meta: ComponentMeta }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-lg border border-border/40 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-secondary/20">
        <meta.icon className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="text-[11px] font-semibold text-foreground">{meta.label}</span>
        <span className="text-[9px] font-mono text-muted-foreground">{meta.kind}</span>
        {meta.dataBound && (
          <span className="text-[8px] px-1 rounded bg-primary/10 text-primary shrink-0">dados reais</span>
        )}
        <button
          onClick={() => {
            navigator.clipboard?.writeText(meta.kind);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          title="Copiar kind do componente"
          aria-label={`Copiar kind ${meta.kind}`}
          className="ml-auto p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary shrink-0"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <div className="px-3 py-2 text-[10px] text-muted-foreground border-b border-border/20">
        {meta.description}
      </div>
      {/* Preview ao vivo — componente REAL renderizado com as props default */}
      <div className="p-3 bg-background/60">
        <div className={meta.dataBound ? "max-h-56 overflow-y-auto rounded-md border border-dashed border-border/40 p-2" : "flex flex-wrap items-center gap-2"}>
          <ErrorBoundary title={`Erro no preview de ${meta.label}`}>
            <NodeBody kind={meta.kind} props={{ ...meta.defaults }} />
          </ErrorBoundary>
        </div>
      </div>
      {meta.props.length > 0 && (
        <div className="px-3 py-2 border-t border-border/20 flex flex-wrap gap-1">
          {meta.props.map((p) => (
            <span key={p.key} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground" title={`${p.label} (${p.type})`}>
              {p.key}: {p.type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentGroup({ layer }: { layer: ComponentMeta["layer"] }) {
  const items = useMemo(() => COMPONENT_LIST.filter((c) => c.layer === layer), [layer]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {items.map((c) => <ComponentCard key={c.kind} meta={c} />)}
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function DesignSystemPage() {
  const [dsTab, setDsTab] = useState("a");
  const copyValue = useCopyValue();
  const tokenState = useDesignTokens();
  const ui = useUISettings();

  const allTokenExport = () =>
    DESIGN_TOKENS.map((t) => ({
      variavel: `--${t.cssVar}`,
      camada: t.layer,
      base: t.value,
      light: effectiveTokenValue("light", t.cssVar),
      dark: effectiveTokenValue("dark", t.cssVar),
      customizado: Boolean(tokenState.light[t.cssVar] || tokenState.dark[t.cssVar]),
      descricao: t.description,
    }));

  let sectionIndex = -1;
  const nextIndex = () => ++sectionIndex;

  return (
    <div className="flex flex-col h-full min-h-0">
      <AppHeader title="Design System" crumb="tokens · componentes · padrões" />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="content-fluid py-6 space-y-4">
          {/* Hero */}
          <div className="rounded-xl border border-border/40 bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                <SwatchBook className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-title">App Intelligence Design System</h1>
                <p className="text-subtitle mt-1 max-w-2xl">
                  A linguagem visual e comportamental de todo o produto — foundations,
                  componentes e padrões, sempre com previews ao vivo dos componentes reais.
                  Mudanças de token refletem imediatamente aqui e no app inteiro.
                </p>
              </div>
              <CopyDownloadButtons
                content={JSON.stringify(allTokenExport(), null, 2)}
                filename="design-system-tokens"
                extension="json"
                compact={false}
                className="shrink-0"
              />
            </div>
            <div className="flex flex-wrap gap-4 mt-4 text-[10px] text-muted-foreground">
              <span>{DS_SECTIONS.length} seções</span>
              <span>{DESIGN_TOKENS.length} tokens</span>
              <span>{COMPONENT_LIST.length} componentes</span>
              <Link to="/design" className="inline-flex items-center gap-1 text-primary hover:underline">
                Abrir no Design Canvas <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* 01 — Tokens de cor (editor completo, ao vivo) */}
          <SectionBlock id="ds-tokens" icon={<SwatchBook className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={allTokenExport}>
            {TOKEN_GROUP_ORDER.map((groupId) => {
              const specs = tokensByGroup(groupId).filter((s) => s.kind === "color");
              if (!specs.length) return null;
              return (
                <div key={groupId} className="mb-3">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                    {TOKEN_GROUP_META[groupId].label}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
                    {specs.map((t) => {
                      const light = effectiveTokenValue("light", t.cssVar);
                      const dark = effectiveTokenValue("dark", t.cssVar);
                      return (
                        <button
                          key={t.cssVar}
                          onClick={() => copyValue(`hsl(${light})`, t.label)}
                          title={`${t.description} — clique para copiar`}
                          className="group text-left rounded-lg border border-border/40 bg-card p-2 hover:border-primary/40 transition-colors"
                        >
                          <div className="flex gap-1 mb-1.5">
                            {([["Claro", light], ["Escuro", dark]] as const).map(([lbl, v]) => (
                              <span
                                key={lbl}
                                className="w-8 h-8 rounded-md border border-border/50 overflow-hidden"
                                style={{ background: CHECKERBOARD }}
                                title={`${lbl}: ${v}`}
                              >
                                <span className="block w-full h-full" style={{ background: valueToCss(v) }} />
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] font-medium text-foreground truncate">{t.label}</p>
                          <p className="text-[9px] font-mono text-muted-foreground truncate">--{t.cssVar}</p>
                          <p className="text-[9px] font-mono text-muted-foreground/70 truncate">{light}</p>
                          {parseAlpha(light) < 100 && (
                            <p className="text-[8px] font-mono text-primary truncate">α {parseAlpha(light)}%</p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground mt-2 mb-3">
              Par de swatches = claro · escuro (valor efetivo: override do usuário ou padrão). Clique num token para copiar. Edite abaixo — reflete imediatamente no sistema inteiro. <strong>Transparência (alpha)</strong> suportada: adicione <code>/ 0.75</code> ao valor ou use o controle de transparência por token (o swatch fica sobre xadrez para evidenciar).
            </p>
            <div className="rounded-xl border border-primary/30 bg-primary/5">
              <DesignSystemSection />
            </div>
          </SectionBlock>

          {/* 02 — Tipografia */}
          <SectionBlock id="ds-tipografia" icon={<Type className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => TYPE_SCALE}>
            <div className="space-y-1 divide-y divide-border/20">
              {TYPE_SCALE.map((s) => (
                <button
                  key={s.cls}
                  onClick={() => copyValue(s.cls, s.label)}
                  title={`Copiar classe ${s.cls}`}
                  className="w-full flex items-baseline gap-3 py-2 text-left hover:bg-secondary/30 rounded-md px-2 transition-colors"
                >
                  <span className={`${s.cls} text-foreground truncate flex-1 min-w-0`}>{s.sample}</span>
                  <span className="text-[9px] text-muted-foreground shrink-0 w-16">{s.label}</span>
                  <span className="text-[9px] font-mono text-muted-foreground/70 shrink-0 hidden sm:block">{s.spec}</span>
                </button>
              ))}
            </div>
          </SectionBlock>

          {/* 03 — Espaçamento */}
          <SectionBlock id="ds-espacamento" icon={<Ruler className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => SPACING_SCALE}>
            <div className="space-y-2">
              {SPACING_SCALE.map((s) => (
                <button
                  key={s.cls}
                  onClick={() => copyValue(s.cls, s.label)}
                  title={`Copiar classe ${s.cls}`}
                  className="w-full flex items-center gap-3 text-left hover:bg-secondary/30 rounded-md px-2 py-1 transition-colors"
                >
                  <span className="text-[10px] font-mono text-muted-foreground w-12">{s.label}</span>
                  <span className="h-3 rounded-sm bg-primary/60" style={{ width: `${s.rem * 64}px` }} />
                  <span className="text-[9px] text-muted-foreground">{s.rem}rem · {s.rem * 16}px</span>
                  <span className="text-[9px] font-mono text-muted-foreground/60 ml-auto">{s.cls}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">Ritmo de 4px. Prefira utilities do Tailwind (gap-2, p-4…); use estas classes quando o ritmo do design system precisar ser explícito.</p>
          </SectionBlock>

          {/* 04 — Borda & elevação */}
          <SectionBlock id="ds-borda-elevacao" icon={<Box className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => ELEVATION_SCALE}>
            <p className="text-[10px] text-muted-foreground mb-2">Raio base: <code className="font-mono">--radius</code> × escala atual ({ui.radiusScale}%)</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {["rounded-none", "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-full"].map((r) => (
                <div key={r} className="text-center">
                  <div className={`w-14 h-14 bg-primary/15 border border-primary/40 ${r}`} />
                  <p className="text-[9px] font-mono text-muted-foreground mt-1">{r.replace("rounded-", "")}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {ELEVATION_SCALE.map((e) => (
                <button
                  key={e.cls}
                  onClick={() => copyValue(e.cls, e.label)}
                  title={`Copiar classe ${e.cls}`}
                  className={`rounded-lg bg-card border border-border/40 p-3 text-left ${e.cls} hover:border-primary/40 transition-colors`}
                >
                  <p className="text-[10px] font-semibold text-foreground">{e.label}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{e.usage}</p>
                  <p className="text-[9px] font-mono text-muted-foreground/60 mt-1">{e.cls}</p>
                </button>
              ))}
            </div>
          </SectionBlock>

          {/* 05 — Motion */}
          <SectionBlock id="ds-motion" icon={<Zap className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => MOTION_OPTIONS}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MOTION_OPTIONS.map((m) => (
                <div key={m.value} className={`rounded-lg border p-3 ${ui.motion === m.value ? "border-primary/50 bg-primary/5" : "border-border/40 bg-card"}`}>
                  <p className="text-[11px] font-semibold text-foreground">{m.label}{ui.motion === m.value && <span className="text-[9px] text-primary ml-1.5">ativo</span>}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{m.description}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Configurável em Interface avançada. <code className="font-mono">prefers-reduced-motion</code> é sempre respeitado: animações de fundo e reveals são desativadas automaticamente.
            </p>
          </SectionBlock>

          {/* 06 — Iconografia */}
          <SectionBlock id="ds-icones" icon={<Shapes className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => PAGES.map((p) => ({ pagina: p.label, path: p.path }))}>
            <p className="text-[10px] text-muted-foreground mb-2">
              Biblioteca: <span className="font-mono">lucide-react</span> (nunca emojis na UI). Ícones de navegação em uso:
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-5 xl:grid-cols-7 gap-2">
              {PAGES.map((p) => {
                const Icon = p.icon as LucideIcon;
                return (
                  <Link
                    key={p.path}
                    to={p.path}
                    title={`${p.label} — ${p.desc}`}
                    className="flex flex-col items-center gap-1.5 rounded-lg border border-border/40 bg-card py-3 hover:border-primary/40 transition-colors"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-[9px] text-muted-foreground text-center leading-tight px-1">{p.label}</span>
                  </Link>
                );
              })}
            </div>
          </SectionBlock>

          {/* 07-10 — Componentes por camada */}
          <SectionBlock id="ds-atomos" icon={<AtomIcon className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => COMPONENT_LIST.filter((c) => c.layer === "atom").map((c) => ({ kind: c.kind, label: c.label, props: c.props.map((p) => p.key) }))}>
            <ComponentGroup layer="atom" />
          </SectionBlock>
          <SectionBlock id="ds-moleculas" icon={<Puzzle className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => COMPONENT_LIST.filter((c) => c.layer === "molecule").map((c) => ({ kind: c.kind, label: c.label, props: c.props.map((p) => p.key) }))}>
            <ComponentGroup layer="molecule" />
          </SectionBlock>
          <SectionBlock id="ds-organismos" icon={<Boxes className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => COMPONENT_LIST.filter((c) => c.layer === "organism").map((c) => ({ kind: c.kind, label: c.label, dataBound: !!c.dataBound }))}>
            <p className="text-[10px] text-muted-foreground mb-2">Organismos com badge "dados reais" ligam ao dataset coletado — sem dados, mostram o empty state honesto.</p>
            <ComponentGroup layer="organism" />
          </SectionBlock>
          <SectionBlock id="ds-layouts" icon={<LayoutTemplate className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => COMPONENT_LIST.filter((c) => c.layer === "layout").map((c) => ({ kind: c.kind, label: c.label }))}>
            <ComponentGroup layer="layout" />
          </SectionBlock>

          {/* 11 — Padrões */}
          <SectionBlock id="ds-padroes" icon={<Layers className="h-4 w-4 text-primary" />} index={nextIndex()}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/40 bg-card p-3">
                <p className="text-[11px] font-semibold text-foreground mb-1">Empty state</p>
                <p className="text-[10px] text-muted-foreground mb-2">Sempre explica o que falta + próxima ação. Nunca uma tela morta.</p>
                <div className="rounded-md border border-dashed border-border/40">
                  <EmptyState icon={Boxes} title="Nenhum app coletado" description="Busque um app na aba Apps da sidebar para começar a análise." compact />
                </div>
              </div>
              <div className="rounded-lg border border-border/40 bg-card p-3">
                <p className="text-[11px] font-semibold text-foreground mb-1">Saída de IA (AIOutputCard)</p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Toda saída de IA: 3 níveis (expandida/resumida/recolhida) + copy/download + <strong>escala de leitura A−/A+</strong> (texto ampliado por padrão, ajustável por card ou global em Configurações → Saída de IA) + <strong>barra de status</strong> (tempo, ~tokens, palavras, velocidade) + acento visual em `primary`.
                </p>
                <AIOutputCard
                  title="Resumo executivo (exemplo)"
                  content={"## Insight\nOs usuários elogiam a rapidez do app.\n\n## Evidência\n> \"app muito rápido\" — ★5, BR"}
                  filename="exemplo-padrao"
                  storageKey="ds-pattern-aioutput"
                />
              </div>
              <div className="rounded-lg border border-border/40 bg-card p-3">
                <p className="text-[11px] font-semibold text-foreground mb-1">Painel expansível</p>
                <p className="text-[10px] text-muted-foreground mb-2">Conteúdo completo por padrão, recolhível e redimensionável, estado persistido.</p>
                <Panel title="Painel de exemplo" subtitle="arraste a borda inferior" storageKey="ds-pattern-panel" defaultHeight={90} minHeight={60} maxHeight={200}>
                  <p className="text-[11px] text-muted-foreground p-2">Conteúdo do painel com scroll interno quando excede a altura.</p>
                </Panel>
              </div>
              <div className="rounded-lg border border-border/40 bg-card p-3">
                <p className="text-[11px] font-semibold text-foreground mb-1">Copy / Download</p>
                <p className="text-[10px] text-muted-foreground mb-2">Presente em toda saída gerada (markdown, JSON, CSV, texto).</p>
                <div className="flex items-center gap-2">
                  <CopyDownloadButtons content={"# Exemplo\nConteúdo"} filename="exemplo" compact={false} />
                  <CopyDownloadButtons content={JSON.stringify({ ok: true }, null, 2)} filename="exemplo" extension="json" compact={false} />
                  <CopyDownloadButtons content={"a;b\n1;2"} filename="exemplo" extension="csv" compact={false} />
                </div>
              </div>
              <div className="rounded-lg border border-border/40 bg-card p-3">
                <p className="text-[11px] font-semibold text-foreground mb-1">Abas de sidebar (SidebarTabStrip)</p>
                <p className="text-[10px] text-muted-foreground mb-2">
                  A ÚNICA strip de abas do sistema — usada por TODAS as sidebars (externas e internas). Botões nunca espremem: rolagem horizontal quando há muitas abas, badge de contagem opcional, pill ativa em primary.
                </p>
                <div className="rounded-md border border-border/40 overflow-hidden">
                  <SidebarTabStrip
                    tabs={[
                      { id: "a", label: "Chat", icon: <MessageSquareText className="h-3 w-3" /> },
                      { id: "b", label: "Gráficos", icon: <Boxes className="h-3 w-3" />, badge: 4 },
                      { id: "c", label: "Artefatos", icon: <Layers3 className="h-3 w-3" /> },
                      { id: "d", label: "Configuração", icon: <Palette className="h-3 w-3" /> },
                    ]}
                    active={dsTab}
                    onChange={setDsTab}
                    ariaLabel="Exemplo de abas de sidebar"
                  />
                </div>
              </div>
            </div>
          </SectionBlock>

          {/* 12 — Conteúdo & voz */}
          <SectionBlock id="ds-conteudo" icon={<MessageSquareText className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => CONTENT_RULES}>
            <div className="space-y-1.5">
              {CONTENT_RULES.map((r) => (
                <div key={r.title} className="flex gap-2.5 rounded-lg border border-border/40 bg-card px-3 py-2">
                  <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-foreground">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </SectionBlock>

          {/* 13 — Acessibilidade */}
          <SectionBlock id="ds-acessibilidade" icon={<Accessibility className="h-4 w-4 text-primary" />} index={nextIndex()} exportData={() => A11Y_RULES}>
            <div className="space-y-1.5">
              {A11Y_RULES.map((r) => (
                <div key={r.title} className="flex gap-2.5 rounded-lg border border-border/40 bg-card px-3 py-2">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-foreground">{r.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Experimente: navegue esta página só com Tab/Shift+Tab — todo elemento interativo mostra o anel de foco.
            </p>
          </SectionBlock>
        </div>
      </div>
    </div>
  );
}
