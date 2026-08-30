/**
 * Configuration page — `/configuracoes`
 *
 * Single source of truth for ALL system settings, organized in expandable
 * blocks (3 levels — same behavior as AIOutputCard) with anchors for the
 * internal sidebar "Seções" tab and per-block copy/download (JSON):
 *  1. Personalização da interface (densidade, painéis, janelas, grade)
 *  2. Design System (tokens de cor HSL por modo, presets, raio/fonte/espaçamento)
 *  3. Layout & widgets (compositor: mover widgets entre colunas, splits)
 *  4. Páginas do sistema (ativar/desativar + abrir)
 *  5. Funcionalidades do sistema (todas as feature flags)
 *  6+. Configurações gerais DESAGRUPADAS — uma âncora por seção
 *      (IA, aparência, sidebars, coleta, região, idioma, dados locais, ajuda)
 *
 * Um menu de âncoras no topo da página navega entre as seções (funciona mesmo
 * com as sidebars recolhidas/ausentes). Cada bloco já tem explicação do que
 * controla e "por que importa" antes das opções.
 */
import { useMemo, useState } from "react";
import { confirmDestructive } from "@/lib/ux";
import { Settings2, RotateCcw, Check, X, Layers, Sparkles, Workflow, Palette, Database as DbIcon, Power, LayoutTemplate, Sliders, Search, SwatchBook, LayoutGrid, HardDrive, Globe, BrainCircuit, PanelLeft, SlidersHorizontal, Globe2, Languages, Database, HelpCircle, Mic } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ErrorBoundary } from "@/components/dashboard/ErrorBoundary";
import {
  SettingsAIContent, SettingsAppearanceContent, SettingsSidebarsContent,
  SettingsCollectionContent, SettingsRegionContent, SettingsLanguageContent,
  SettingsLocalDataContent, SettingsHelpContent,
} from "@/components/SettingsPanel";
import { ExpandableBlock } from "@/components/shared/ExpandableBlock";
import { DesignSystemSection } from "@/components/settings/DesignSystemSection";
import { LayoutComposerSection } from "@/components/settings/LayoutComposerSection";
import { DataHubSection } from "@/components/settings/DataHubSection";
import { TotalResetSection } from "@/components/settings/TotalResetSection";
import { SourcesSection } from "@/components/settings/SourcesSection";
import { AssistantVoicePanel } from "@/components/assistant/AssistantPanels";
import { VoiceDiagnostics } from "@/components/assistant/VoiceDiagnostics";
import { inventoryOutputs } from "@/lib/outputs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  FEATURE_FLAGS, FEATURE_GROUP_LABEL, FEATURE_GROUP_ORDER,
  useFeatureFlags, setFeatureFlag, resetFeatureFlags, pagePathToFlag,
  type FeatureGroup,
} from "@/lib/featureFlags";
import { useWM } from "@/lib/windowManager";
import { getLayout } from "@/lib/layoutComposer";
import { getDesignTokens } from "@/lib/designTokens";
import { getUISettings } from "@/lib/uiSettings";
import { getBackgroundSettings } from "@/lib/appearanceSettings";
import { getAISettings } from "@/lib/aiSettings";
import { getUserRegion, getUserLanguage } from "@/lib/region";
import { PAGES } from "@/lib/pages";
import { ArrowUpRight } from "lucide-react";

const GROUP_ICON: Record<FeatureGroup, typeof Layers> = {
  pages: Layers,
  intelligence: Sparkles,
  canvas: Workflow,
  ui: Palette,
  data: DbIcon,
};

/** IDs âncora usados pela aba "Seções" da sidebar interna. */
/* Ordem = jornada do usuário (primeiro uso → uso contínuo): Começar →
   Inteligência → Aparência & design → Layout & navegação → Dados & sistema. */
export const CONFIG_SECTION_ANCHORS = [
  { id: "conf-coleta", label: "Coleta" },
  { id: "conf-regiao", label: "Região" },
  { id: "conf-idioma", label: "Idioma" },
  { id: "conf-fontes", label: "Fontes" },
  { id: "conf-ia", label: "IA" },
  { id: "conf-voz", label: "Voz" },
  { id: "conf-aparencia", label: "Aparência" },
  { id: "conf-design", label: "Design System" },
  { id: "conf-interface", label: "Interface" },
  { id: "conf-layout", label: "Layout & widgets" },
  { id: "conf-sidebars", label: "Sidebars" },
  { id: "conf-paginas", label: "Páginas" },
  { id: "conf-funcionalidades", label: "Funcionalidades" },
  { id: "conf-dados", label: "Dados & backup" },
  { id: "conf-dados-locais", label: "Dados locais" },
  { id: "conf-ajuda", label: "Ajuda" },
  { id: "conf-reset", label: "Reset total" },
];

function FlagRow({ flagKey }: { flagKey: string }) {
  const flags = useFeatureFlags();
  const flag = useMemo(() => FEATURE_FLAGS.find((f) => f.key === flagKey)!, [flagKey]);
  const enabled = flags[flagKey] !== false;
  return (
    <label
      htmlFor={`ff-${flagKey}`}
      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40 bg-background hover:border-border/70 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground truncate">{flag.label}</span>
          {flag.locked && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-secondary text-muted-foreground">sempre ativo</span>
          )}
          {flag.defaultOff && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400" title="Superfície experimental — desligada por padrão em instalações novas">lab</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">{flag.description}</p>
      </div>
      <Switch
        id={`ff-${flagKey}`}
        checked={enabled}
        disabled={flag.locked}
        onCheckedChange={(v) => setFeatureFlag(flagKey, v)}
        aria-label={`${flag.label} — ${flag.description}`}
      />
    </label>
  );
}

/** Seção "Páginas do sistema" — ativa/desativa cada página (feature flag) e abre-a. */
function PagesSection() {
  const flags = useFeatureFlags();
  return (
    <div>
      <p className="px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
        Cada página pode ser ativada/desativada (some da navegação e a rota redireciona ao Início). O botão ↗ abre a página em nova aba.
      </p>
      <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {PAGES.map((p) => {
          const flagKey = pagePathToFlag(p.path);
          const flag = flagKey ? FEATURE_FLAGS.find((f) => f.key === flagKey) : undefined;
          const enabled = !flagKey || flags[flagKey] !== false;
          const Icon = p.icon;
          return (
            <div
              key={p.path}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-colors ${
                enabled ? "border-border/40 bg-background hover:border-border/70" : "border-border/30 bg-muted/30 opacity-60"
              }`}
            >
              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-foreground truncate">{p.label}</p>
                <p className="text-[9px] text-muted-foreground truncate">{p.desc}</p>
              </div>
              <button
                onClick={() => window.open(p.path, "_blank", "noopener")}
                title={`Abrir ${p.label}`}
                aria-label={`Abrir ${p.label} em nova aba`}
                disabled={!enabled}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
              {flag ? (
                <Switch
                  checked={enabled}
                  disabled={flag.locked}
                  onCheckedChange={(v) => setFeatureFlag(flag.key, v)}
                  aria-label={`Ativar ${p.label}`}
                />
              ) : (
                <span className="text-[9px] text-muted-foreground px-1" title="Sem flag própria (sempre ativa)">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SettingsPage({ embedded = false }: { embedded?: boolean }) {
  const flags = useFeatureFlags();
  const [flagQuery, setFlagQuery] = useState("");
  const enabledCount = FEATURE_FLAGS.filter((f) => flags[f.key] !== false).length;
  const disabledCount = FEATURE_FLAGS.length - enabledCount;

  const flagMatches = useMemo(() => {
    const q = flagQuery.trim().toLowerCase();
    if (!q) return null;
    return new Set(
      FEATURE_FLAGS.filter(
        (f) =>
          f.label.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.key.toLowerCase().includes(q),
      ).map((f) => f.key),
    );
  }, [flagQuery]);
  const wmGrid = useWM((s) => s.gridSize);
  const wmWindows = useWM((s) => s.windows);
  const setGridSize = useWM((s) => s.setGridSize);
  const closeAllWindows = useWM((s) => s.closeAll);

  const jumpTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <ErrorBoundary title="Erro ao renderizar Configurações">
      <div className="h-full flex flex-col">
        {!embedded && <AppHeader title="Configurações" crumb="Tudo do sistema em um só lugar" showSearch={false} />}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-4 space-y-5">
            <section aria-label="Começar — o essencial para o primeiro uso" className="space-y-5 pt-2">
              <header className="border-b border-border/40 pb-1.5">
                <h2 className="text-sm font-semibold text-foreground">Começar — o essencial para o primeiro uso</h2>
                <p className="text-[11px] text-muted-foreground">Coleta, região, idioma e fontes de dados: configure antes de coletar.</p>
              </header>

            <ExpandableBlock
              id="conf-coleta"
              storageKey="conf-coleta"
              title="Coleta de dados"
              subtitle="resultados por loja · limite de reviews · ordenação"
              icon={<SlidersHorizontal className="h-4 w-4 text-primary" />}
              exportName="config-coleta"
              exportData={() => ({ nota: "configurações de coleta (collection-settings)" })}
            >
              <div className="p-3">
                <SettingsCollectionContent />
              </div>
            </ExpandableBlock>

            <ExpandableBlock
              id="conf-regiao"
              storageKey="conf-regiao"
              title="Região da loja"
              subtitle="de onde apps e reviews são coletados"
              icon={<Globe2 className="h-4 w-4 text-primary" />}
              exportName="config-regiao"
              exportData={() => ({ regiao: getUserRegion() })}
            >
              <div className="p-3">
                <SettingsRegionContent />
              </div>
            </ExpandableBlock>

            <ExpandableBlock
              id="conf-idioma"
              storageKey="conf-idioma"
              title="Idioma"
              subtitle="idioma dos textos coletados (descrições, reviews)"
              icon={<Languages className="h-4 w-4 text-primary" />}
              exportName="config-idioma"
              exportData={() => ({ idioma: getUserLanguage() })}
            >
              <div className="p-3">
                <SettingsLanguageContent />
              </div>
            </ExpandableBlock>

            {/* 5. Fontes (Source Registry) */}
            <ExpandableBlock
              id="conf-fontes"
              storageKey="conf-fontes"
              title="Fontes de dados"
              subtitle="catálogo do Source Registry (capabilities, método, limitações)"
              icon={<Globe className="h-4 w-4 text-primary" />}
              exportName="config-fontes"
              exportData={() => ({ nota: "metadados declarativos do registry" })}
            >
              <p className="px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                Catálogo declarativo de fontes do servidor: capacidades (busca/detalhes/reviews/top charts),
                método preferido, regiões e limitações de ToS declaradas. Base da expansão multi-fonte —
                novos conectores aparecem aqui automaticamente.
              </p>
              <SourcesSection />
            </ExpandableBlock>
            </section>

            <section aria-label="Inteligência — IA, prompts e voz" className="space-y-5 pt-2">
              <header className="border-b border-border/40 pb-1.5">
                <h2 className="text-sm font-semibold text-foreground">Inteligência — IA, prompts e voz</h2>
                <p className="text-[11px] text-muted-foreground">Como a IA trabalha, o que ela ouve/fala e como exibir as respostas.</p>
              </header>

            {/* 6–13. Configurações gerais DESAGRUPADAS — cada seção do
                SettingsPanel vira um bloco próprio com âncora (os mesmos
                componentes de conteúdo; a sidebar externa as mantém agrupadas). */}
            <ExpandableBlock
              id="conf-ia"
              storageKey="conf-ia"
              title="Inteligência Artificial"
              subtitle="modo · provedores · comportamento · prompts · exibição"
              icon={<BrainCircuit className="h-4 w-4 text-primary" />}
              exportName="config-ia"
              exportData={() => {
                const ai = getAISettings();
                return {
                  mode: ai.mode,
                  local: ai.local,
                  cloud: { ...ai.cloud, apiKey: ai.cloud.apiKey ? "***" : "" },
                  feedbackEnabled: ai.feedbackEnabled,
                };
              }}
            >
              <div className="p-3">
                <SettingsAIContent />
              </div>
            </ExpandableBlock>

            <ExpandableBlock
              id="conf-voz"
              storageKey="conf-voz"
              title="Voz"
              subtitle="ditado · leitura em voz alta · velocidade · diagnóstico"
              icon={<Mic className="h-4 w-4 text-primary" />}
              exportName="config-voz"
              exportData={() => ({ nota: "configurações de voz (aso:voice-settings:v1)" })}
            >
              <p className="px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                Voz→texto (ditado nos composers) e texto→voz (leitura das respostas de IA),
                com engines do navegador ou locais (Whisper/Piper via servidor).
              </p>
              <AssistantVoicePanel />
              <div className="px-3 pb-3">
                <VoiceDiagnostics />
              </div>
            </ExpandableBlock>
            </section>

            <section aria-label="Aparência & design" className="space-y-5 pt-2">
              <header className="border-b border-border/40 pb-1.5">
                <h2 className="text-sm font-semibold text-foreground">Aparência & design</h2>
                <p className="text-[11px] text-muted-foreground">Tema, cores, tipografia, tokens do design system e fundo da interface.</p>
              </header>

            <ExpandableBlock
              id="conf-aparencia"
              storageKey="conf-aparencia"
              title="Aparência"
              subtitle="tema · cor principal · idioma da interface · fundo · interface avançada"
              icon={<Palette className="h-4 w-4 text-primary" />}
              exportName="config-aparencia"
              exportData={() => ({ ui: getUISettings(), fundo: getBackgroundSettings() })}
            >
              <div className="p-3">
                <SettingsAppearanceContent />
              </div>
            </ExpandableBlock>

            {/* 2. Design System */}
            <ExpandableBlock
              id="conf-design"
              storageKey="conf-design"
              title="Design System"
              subtitle="cores · presets · raio · tipografia · espaçamento"
              icon={<SwatchBook className="h-4 w-4 text-primary" />}
              exportName="config-design-system"
              exportData={() => ({ tokens: getDesignTokens(), ui: getUISettings() })}
            >
              <p className="px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                Todos os tokens configuráveis do design system: cores HSL por modo (claro/escuro), presets coesos, raio de borda, tipografia e espaçamento. Mudanças aplicam-se ao vivo em todo o sistema e persistem entre sessões.
              </p>
              <DesignSystemSection />
            </ExpandableBlock>

            {/* Menu de âncoras — navegação própria da página (independe da sidebar
                interna, então funciona também com sidebars recolhidas/ausentes). */}
            <nav aria-label="Seções de configuração" className="flex flex-wrap gap-1.5">
              {CONFIG_SECTION_ANCHORS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => { e.preventDefault(); jumpTo(s.id); }}
                  className="rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {s.label}
                </a>
              ))}
            </nav>
            {/* 1. Interface personalization */}
            <ExpandableBlock
              id="conf-interface"
              storageKey="conf-interface"
              title="Personalização da interface"
              subtitle="densidade · painéis · janelas flutuantes · grade"
              icon={<LayoutTemplate className="h-4 w-4 text-primary" />}
              exportName="config-interface"
              exportData={() => ({
                densidadeCompacta: flags["ui.compact-density"] !== false,
                paineisAbertos: flags["ui.panel-auto-expand"] !== false,
                janelasFlutuantes: flags["ui.window-tiling"] !== false,
                gradePx: wmGrid,
                ui: getUISettings(),
                fundo: getBackgroundSettings(),
              })}
            >
              <p className="px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                Deixe o sistema do seu jeito. Ative janelas flutuantes estilo desktop (arrastar, redimensionar, encaixar, menu de contexto), ajuste a densidade e o alinhamento à grade. Cada painel nasce aberto com conteúdo completo — recolha/redimensione o que quiser.
              </p>
              <div className="px-4 pb-4 space-y-3">
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40 bg-background hover:border-border/70 transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">Densidade compacta</span>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Reduz espaçamentos em toda a interface para mais conteúdo por tela.</p>
                  </div>
                  <Switch checked={flags["ui.compact-density"] !== false} onCheckedChange={(v) => setFeatureFlag("ui.compact-density", v)} aria-label="Densidade compacta" />
                </label>
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40 bg-background hover:border-border/70 transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">Painéis abertos por padrão</span>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Todo painel nasce expandido com conteúdo completo; recolha/redimensione o que quiser.</p>
                  </div>
                  <Switch checked={flags["ui.panel-auto-expand"] !== false} onCheckedChange={(v) => setFeatureFlag("ui.panel-auto-expand", v)} aria-label="Painéis abertos por padrão" />
                </label>
                <label className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border/40 bg-background hover:border-border/70 transition-colors">
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">Janelas flutuantes (window tiling)</span>
                    <p className="text-[10px] text-muted-foreground leading-snug mt-0.5">Modo desktop OS: janelas arrastáveis, redimensionáveis, encaixáveis (drag, resize, snap, context menu).</p>
                  </div>
                  <Switch checked={flags["ui.window-tiling"] !== false} onCheckedChange={(v) => setFeatureFlag("ui.window-tiling", v)} aria-label="Janelas flutuantes" />
                </label>
                <div className="px-3 py-2.5 rounded-lg border border-border/40 bg-background">
                  <div className="flex items-center gap-2 mb-2">
                    <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">Tamanho da grade de alinhamento</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">{wmGrid}px {wmGrid === 0 ? "(desligado)" : ""}</span>
                  </div>
                  <Slider
                    defaultValue={[wmGrid]}
                    min={0} max={40} step={2}
                    onValueChange={(v) => setGridSize(v[0])}
                    aria-label="Tamanho da grade"
                  />
                  <p className="text-[10px] text-muted-foreground leading-snug mt-2">0 = sem alinhamento (livre). Valores maiores alinham janelas e colunas a uma grade ao arrastar/redimensionar.</p>
                </div>
                {wmWindows.length > 0 && (
                  <button
                    onClick={() => { if (confirmDestructive(`Fechar as ${wmWindows.length} janela(s) flutuante(s) aberta(s)?`)) closeAllWindows(); }}
                    className="w-full text-[11px] px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 inline-flex items-center justify-center gap-1.5"
                  >
                    <X className="h-3 w-3" /> Fechar {wmWindows.length} janela(s) flutuante(s)
                  </button>
                )}
              </div>
            </ExpandableBlock>
            </section>

            <section aria-label="Layout & navegação" className="space-y-5 pt-2">
              <header className="border-b border-border/40 pb-1.5">
                <h2 className="text-sm font-semibold text-foreground">Layout & navegação</h2>
                <p className="text-[11px] text-muted-foreground">Composer de colunas, larguras de sidebar, páginas e funcionalidades do sistema.</p>
              </header>

            {/* 3. Layout & widgets */}
            <ExpandableBlock
              id="conf-layout"
              storageKey="conf-layout"
              title="Layout & widgets"
              subtitle="compositor de interface · colunas · splits verticais"
              icon={<LayoutGrid className="h-4 w-4 text-primary" />}
              exportName="config-layout"
              exportData={() => getLayout()}
            >
              <p className="px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                Monte a própria interface: mova widgets (menu de páginas, assistente de IA, painéis da página) entre as colunas arrastando ou pelos botões abaixo. Colunas dividem-se verticalmente quando recebem mais de um widget. O layout padrão de 5 colunas é preservado até você mover algo.
              </p>
              <LayoutComposerSection />
            </ExpandableBlock>

            <ExpandableBlock
              id="conf-sidebars"
              storageKey="conf-sidebars"
              title="Sidebars"
              subtitle="larguras · presets · reset por lado"
              icon={<PanelLeft className="h-4 w-4 text-primary" />}
              exportName="config-sidebars"
              exportData={() => ({ nota: "larguras persistidas por sidebar" })}
            >
              <div className="p-3">
                <SettingsSidebarsContent />
              </div>
            </ExpandableBlock>

            {/* 6. Páginas do sistema */}
            <ExpandableBlock
              id="conf-paginas"
              storageKey="conf-paginas"
              title="Páginas do sistema"
              subtitle={`${PAGES.length} páginas`}
              icon={<Layers className="h-4 w-4 text-primary" />}
              exportName="config-paginas"
              exportData={() =>
                Object.fromEntries(
                  PAGES.map((p) => {
                    const k = pagePathToFlag(p.path);
                    return [p.path, k ? flags[k] !== false : true];
                  }),
                )
              }
            >
              <PagesSection />
            </ExpandableBlock>

            {/* 5. Feature flags */}
            <ExpandableBlock
              id="conf-funcionalidades"
              storageKey="conf-funcionalidades"
              title="Funcionalidades do sistema"
              icon={<Power className="h-4 w-4 text-primary" />}
              exportName="config-funcionalidades"
              exportData={() => Object.fromEntries(FEATURE_FLAGS.map((f) => [f.key, flags[f.key] !== false]))}
              headerRight={
                <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" />{enabledCount} ativas</span>
                  <span className="inline-flex items-center gap-1"><X className="h-3 w-3 text-muted-foreground" />{disabledCount} desativadas</span>
                  <button
                    onClick={() => { if (confirmDestructive("Redefinir todas as funcionalidades para o padrão?")) resetFeatureFlags(); }}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    title="Redefinir para o padrão"
                  >
                    <RotateCcw className="h-3 w-3" /> Redefinir
                  </button>
                </span>
              }
            >
              <p className="px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                Ative ou desative qualquer página, recurso de IA, comportamento do Canvas, opção de interface ou fonte de dados. Mudanças aplicam-se imediatamente: páginas desativadas saem da navegação e suas rotas voltam para o Início. Páginas essenciais (Início, Dados brutos, Configurações) ficam sempre ativas.
              </p>

              <div className="px-4 pb-3">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
                  <input
                    type="search"
                    value={flagQuery}
                    onChange={(e) => setFlagQuery(e.target.value)}
                    placeholder="Buscar funcionalidade…"
                    aria-label="Buscar funcionalidade"
                    className="w-full text-xs pl-8 pr-3 py-2 rounded-lg bg-background border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                {flagMatches && (
                  <p className="text-[10px] text-muted-foreground mt-1.5 px-1" role="status">
                    {flagMatches.size > 0
                      ? `${flagMatches.size} funcionalidade(s) encontrada(s)`
                      : "Nenhuma funcionalidade corresponde à busca."}
                  </p>
                )}
              </div>

              <div className="px-4 pb-4 space-y-5">
                {FEATURE_GROUP_ORDER.map((group) => {
                  const groupFlags = FEATURE_FLAGS.filter(
                    (f) => f.group === group && (!flagMatches || flagMatches.has(f.key)),
                  );
                  if (groupFlags.length === 0) return null;
                  const Icon = GROUP_ICON[group];
                  return (
                    <div key={group}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{FEATURE_GROUP_LABEL[group]}</h3>
                      </div>
                      <div className="space-y-1.5">
                        {groupFlags.map((f) => <FlagRow key={f.key} flagKey={f.key} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ExpandableBlock>
            </section>

            <section aria-label="Dados & sistema" className="space-y-5 pt-2">
              <header className="border-b border-border/40 pb-1.5">
                <h2 className="text-sm font-semibold text-foreground">Dados & sistema</h2>
                <p className="text-[11px] text-muted-foreground">Data hub, portabilidade e ajuda — e a zona de perigo no fim.</p>
              </header>

            {/* 4. Dados & backup */}
            <ExpandableBlock
              id="conf-dados"
              storageKey="conf-dados"
              title="Dados & backup"
              subtitle="salvar · baixar · importar · apagar · reset de fábrica"
              icon={<HardDrive className="h-4 w-4 text-primary" />}
              exportName="config-dados-inventario"
              exportData={() =>
                inventoryOutputs().map((g) => ({
                  grupo: g.group.label,
                  chaves: g.entries.length,
                  bytes: g.totalBytes,
                }))
              }
            >
              <p className="px-4 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
                Tudo que o sistema coletou e gerou, chave a chave: selecione individualmente, por grupo ou tudo; baixe um backup selecionado ou completo, importe um backup baixado antes (mesclar ou substituir), apague itens ou resete o sistema para o estado de fábrica. Credenciais de IA nunca são exportadas.
              </p>
              <DataHubSection />
            </ExpandableBlock>

            <ExpandableBlock
              id="conf-dados-locais"
              storageKey="conf-dados-locais"
              title="Dados locais"
              subtitle="exportar · importar · o que fica no navegador"
              icon={<Database className="h-4 w-4 text-primary" />}
              exportName="config-dados-locais"
              exportData={() => ({ nota: "portabilidade de dados locais" })}
            >
              <div className="p-3">
                <SettingsLocalDataContent />
              </div>
            </ExpandableBlock>

            <ExpandableBlock
              id="conf-ajuda"
              storageKey="conf-ajuda"
              title="Ajuda"
              subtitle="tour guiado do sistema"
              icon={<HelpCircle className="h-4 w-4 text-primary" />}
              exportName="config-ajuda"
              exportData={() => ({ nota: "sem dados exportáveis" })}
            >
              <div className="p-3">
                <SettingsHelpContent />
              </div>
            </ExpandableBlock>
            </section>

            {/* 7. Zona de perigo — RESET TOTAL (sempre visível, fim da página) */}
            <div id="conf-reset" className="scroll-mt-4">
              <TotalResetSection />
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
