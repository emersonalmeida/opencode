import { useRef, useState } from "react";
import { confirmDestructive } from "@/lib/ux";
import { Sun, Moon, Monitor, HelpCircle, Database, Globe2, Languages, Palette, SlidersHorizontal, ChevronDown, ChevronRight, BrainCircuit, Download, Upload, Recycle, PanelLeft as PanelSectionIcon, PlayCircle, Target, Save } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { useCollectionSettings } from "@/components/CollectionSettingsProvider";
import { resetOnboarding } from "@/components/OnboardingModal";
import { REGION_OPTIONS, LANGUAGE_OPTIONS, getUserRegion, setUserRegion, getUserLanguage, setUserLanguage } from "@/lib/region";
import { listSessions } from "@/lib/chatHistoryStore";
import { clientBuildInfo } from "@/lib/serverHealth";
import { AISettingsPanel } from "@/components/AISettingsPanel";
import { useI18n } from "@/lib/i18n";
import {
  useAISettings, setFeedbackEnabled, setBackgroundRuns, setMissionInjection,
  setAutoSaveOutputs, setConcurrencyMode, setMaxConcurrent,
} from "@/lib/aiSettings";
import {
  usePromptOverrides, setPromptOverride, clearPromptOverrides,
} from "@/lib/promptOverrides";
import { EXPERIMENT_SECTIONS } from "@/lib/experimentSections";
import { downloadExport, importAllData } from "@/lib/dataPortability";
import { CustomPrimaryColor } from "@/components/settings/CustomPrimaryColor";
import { PrimaryColorSwatches } from "@/components/settings/PrimaryColorSwatches";
import { useBackgroundSettings, setBackgroundSettings, GRADIENT_PRESETS, THEME_PRESETS } from "@/lib/appearanceSettings";
import { useUISettings, setUISettings, resetUISettings, FONT_ROLE_META, type UISettings } from "@/lib/uiSettings";
import { FontRolePicker } from "@/components/settings/FontRolePicker";
import { SIDEBARS, getSidebarWidth, setSidebarWidth, activePreset, resetSidebarWidth, type SidebarSide } from "@/lib/sidebarSizing";
import { useColumnWidths } from "@/hooks/useSidebarWidths";
import {
  useAIOutputSettings, setAIOutputSettings, resetAIOutputSettings,
  DEFAULT_AI_OUTPUT, SCALE_MIN, SCALE_MAX, SCALE_STEP, SCALE_PRESETS,
} from "@/lib/aiOutputSettings";

function Section({ icon: Icon, title, defaultOpen = true, children }: { icon: typeof Sun; title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border/50 bg-background">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-2.5 py-2 text-left">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium flex-1">{title}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="px-2.5 pb-2.5 space-y-2.5">{children}</div>}
    </div>
  );
}

const btn = (active: boolean) =>
  `text-[10px] px-2 py-0.5 rounded-md transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`;

/** Controles de coleta (resultados por loja, limite de reviews, ordenação) —
 *  reusado pelo SettingsPanel e pelo Flow (seção Coletar) inline. */
export function CollectionSettingsInline() {
  const { settings, setSettings, searchOptions, reviewOptions, reviewSortOptions } = useCollectionSettings();
  return (
    <>
      <div>
        <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Resultados por loja</p>
        <div className="flex flex-wrap gap-1">
          {searchOptions.map((n) => <button key={n} onClick={() => setSettings({ ...settings, searchLimit: n })} className={btn(settings.searchLimit === n)}>{n}</button>)}
        </div>
      </div>
      <div>
        <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Máx reviews/app</p>
        <div className="flex flex-wrap gap-1">
          {reviewOptions.map((n) => <button key={n} onClick={() => setSettings({ ...settings, reviewLimit: n })} className={btn(settings.reviewLimit === n)}>{n >= 1000 ? `${n / 1000}k` : n}</button>)}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground uppercase tracking-wider shrink-0">Personalizado</span>
          <input type="number" min={1} max={10000} step={50} value={settings.reviewLimit} onChange={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n)) setSettings({ ...settings, reviewLimit: Math.max(1, Math.min(n, 10000)) }); }} aria-label="Limite personalizado de reviews" className="flex-1 min-w-0 text-[11px] px-2 py-1 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40" />
        </div>
      </div>
      <div>
        <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Ordenação dos reviews</p>
        <div className="flex flex-wrap gap-1">
          {reviewSortOptions.map((opt) => <button key={opt.value} title={opt.hint} onClick={() => setSettings({ ...settings, reviewSort: opt.value })} className={btn(settings.reviewSort === opt.value)}>{opt.label}</button>)}
        </div>
      </div>
      <p className="text-[9px] text-muted-foreground leading-relaxed">Coleta o máximo possível até o limite. Google usa a ordenação escolhida; Apple é best-effort (APIs públicas não expõem sort).</p>
    </>
  );
}

/** Conteúdo da seção "Inteligência Artificial" (sem moldura de seção) —
 *  usado pelo SettingsPanel (agrupado) e pela página Configurações (desagrupado). */
export function SettingsAIContent() {
  return (
    <>
      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Escolha como a IA funciona: rodando no seu PC (Ollama), na nuvem com sua própria chave, ou desativada. Você decide quando gerar cada análise — nada é automático.
      </p>
      <AISettingsPanel />
      <FeedbackToggle />
      <AIBehaviorToggles />
      <PromptsEditor />
      <AIOutputSection />
    </>
  );
}

/** Conteúdo da seção "Aparência" (tema, cor, idioma da UI, fundo, interface avançada). */
export function SettingsAppearanceContent() {
  const { theme, setTheme, primaryColor, setPrimaryColor, primaryColors } = useTheme();
  const { lang, setLang, t } = useI18n();
  return (
    <>
        <div>
          <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Modo do tema</p>
          <div className="flex gap-1">
            {[
              { key: "light" as const, icon: Sun, label: "Claro" },
              { key: "dark" as const, icon: Moon, label: "Escuro" },
              { key: "system" as const, icon: Monitor, label: "Sistema" },
            ].map((m) => (
              <button key={m.key} onClick={() => setTheme(m.key)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[11px] transition-colors ${theme === m.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                <m.icon className="h-3 w-3" /> {m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Cor principal · {primaryColors.length} opções</p>
          <PrimaryColorSwatches />
          <CustomPrimaryColor />
        </div>
        <div>
          <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">{t("settings.language")}</p>
          <div className="flex gap-1" role="group" aria-label={t("settings.language")}>
            {([
              { key: "pt" as const, label: t("settings.language.pt") },
              { key: "en" as const, label: t("settings.language.en") },
            ]).map((l) => (
              <button key={l.key} onClick={() => setLang(l.key)} aria-pressed={lang === l.key} className={`flex-1 py-1.5 rounded-md text-[11px] transition-colors ${lang === l.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                {l.label}
              </button>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-1">{t("settings.language.hint")}</p>
        </div>
        <BackgroundPickerSection />
        <UISettingsSection />
    </>
  );
}

/** Conteúdo da seção "Sidebars" (larguras, presets, reset por lado). */
export function SettingsSidebarsContent() {
  return <SidebarWidthsSection />;
}

/** Conteúdo da seção "Coleta de dados" (resultados, limite, ordenação). */
export function SettingsCollectionContent() {
  return <CollectionSettingsInline />;
}

/** Conteúdo da seção "Região da loja". */
export function SettingsRegionContent() {
  const [region, setRegionState] = useState(() => getUserRegion());
  const updateRegion = (r: string) => { setRegionState(r); setUserRegion(r); window.location.reload(); };
  return (
    <>
      <select value={region} onChange={(e) => updateRegion(e.target.value)} className="w-full text-[11px] px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40">
        {REGION_OPTIONS.map((r) => <option key={r.code} value={r.code}>{r.flag} {r.label}</option>)}
      </select>
      <p className="text-[9px] text-muted-foreground">De onde os apps e reviews serão coletados.</p>
    </>
  );
}

/** Conteúdo da seção "Idioma" (idioma dos textos coletados). */
export function SettingsLanguageContent() {
  const [language, setLanguageState] = useState(() => getUserLanguage());
  const updateLanguage = (l: string) => { setLanguageState(l); setUserLanguage(l); window.location.reload(); };
  return (
    <>
      <select value={language} onChange={(e) => updateLanguage(e.target.value)} className="w-full text-[11px] px-2 py-1.5 rounded-md bg-secondary text-secondary-foreground border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40">
        {LANGUAGE_OPTIONS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
      </select>
      <p className="text-[9px] text-muted-foreground">Idioma dos textos coletados (descrições, reviews).</p>
    </>
  );
}

/** Conteúdo da seção "Dados locais" (portabilidade export/import). */
export function SettingsLocalDataContent() {
  return (
    <>
      <p className="text-[10px] text-muted-foreground leading-relaxed">Apps, reviews, chats, canvas, artefatos e configurações ficam salvos no seu navegador (localStorage). Chaves de API da IA nunca são exportadas.</p>
      <DataPortabilityControls />
      <p className="text-[9px] text-muted-foreground">{listSessions().length} conversa(s) salva(s). Para apagar TUDO de uma vez, use a Zona de perigo no fim da página Configurações.</p>
    </>
  );
}

/** Conteúdo da seção "Ajuda" (rever tour guiado + identificação do build). */
export function SettingsHelpContent() {
  const build = clientBuildInfo();
  const builtAt = build.builtAt ? new Date(build.builtAt).toLocaleString("pt-BR") : "";
  return (
    <div className="space-y-1.5">
      <button onClick={resetOnboarding} className="w-full flex items-center gap-1.5 py-1.5 rounded-md text-[11px] bg-secondary text-secondary-foreground hover:bg-secondary/80">
        <HelpCircle className="h-3 w-3" /> Rever tour guiado
      </button>
      {/* Identificação do build — verifique após git pull: o build aberto deve
          corresponder ao commit mais recente (banner âmbar avisa se divergir). */}
      {(build.version || build.commit) && (
        <p className="text-[9px] text-muted-foreground leading-relaxed">
          Build: v{build.version || "0.0.0"}
          {build.commit && <> · <code className="font-mono">{build.commit}</code></>}
          {builtAt && <> · {builtAt}</>}
        </p>
      )}
    </div>
  );
}

/** ChatGPT-style settings panel rendered in the left sidebar "Configurações" tab.
 *  Compõe os MESMOS conteúdos exportados acima em seções agrupadas — a página
 *  Configurações usa os mesmos conteúdos desagrupados (uma âncora por seção). */
export function SettingsPanel() {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
      <Section icon={BrainCircuit} title="Inteligência Artificial" defaultOpen>
        <SettingsAIContent />
      </Section>

      <Section icon={Palette} title="Aparência" defaultOpen>
        <SettingsAppearanceContent />
      </Section>

      <Section icon={PanelSectionIcon} title="Sidebars" defaultOpen>
        <SettingsSidebarsContent />
      </Section>

      <Section icon={SlidersHorizontal} title="Coleta de dados" defaultOpen>
        <SettingsCollectionContent />
      </Section>

      <Section icon={Globe2} title="Região da loja">
        <SettingsRegionContent />
      </Section>

      <Section icon={Languages} title="Idioma">
        <SettingsLanguageContent />
      </Section>

      <Section icon={Database} title="Dados locais">
        <SettingsLocalDataContent />
      </Section>

      <Section icon={HelpCircle} title="Ajuda">
        <SettingsHelpContent />
      </Section>

    </div>
  );
}

/** Toggle do modo "retroalimentação": a IA recebe o conhecimento gerado por
 *  análises anteriores como contexto (opcional — o usuário escolhe). */
function FeedbackToggle() {
  const ai = useAISettings();
  return (
    <div className="rounded-md border border-border/50 bg-secondary/30 p-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Recycle className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-[10px] font-medium text-foreground">Retroalimentação da IA</span>
        </div>
        <button
          onClick={() => setFeedbackEnabled(!ai.feedbackEnabled)}
          aria-pressed={ai.feedbackEnabled}
          className={`px-2 py-0.5 rounded-md text-[10px] transition-colors ${ai.feedbackEnabled ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
        >
          {ai.feedbackEnabled ? "Ativa" : "Desativa"}
        </button>
      </div>
      <p className="text-[9px] text-muted-foreground leading-relaxed">
        {ai.feedbackEnabled
          ? "Ativa: toda análise recebe o conhecimento gerado antes (artefatos, findings, sessões) como contexto — respostas acumulativamente melhores. Os dados brutos sempre prevalecem."
          : "Desativada: cada análise usa apenas os dados brutos coletados. Ative para a IA aprender com o que já foi descoberto."}
      </p>
    </div>
  );
}

/** Linha de toggle padronizada (label + descrição + botão liga/desliga). */
function ToggleRow({ icon: Icon, label, description, value, onToggle }: {
  icon: typeof Recycle; label: string; description: string; value: boolean; onToggle: () => void;
}) {
  return (
    <div className="rounded-md border border-border/50 bg-secondary/30 p-2 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-[10px] font-medium text-foreground">{label}</span>
        </div>
        <button
          onClick={onToggle}
          aria-pressed={value}
          className={`px-2 py-0.5 rounded-md text-[10px] transition-colors ${value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
        >
          {value ? "Ativa" : "Desativada"}
        </button>
      </div>
      <p className="text-[9px] text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

/** Toggles de comportamento da IA: background runs, injeção de missão, autosave. */
export function AIBehaviorToggles() {
  const ai = useAISettings();
  return (
    <div className="space-y-1.5">
      <ToggleRow
        icon={PlayCircle}
        label="IA em segundo plano"
        description="Pipelines de IA (Investigar, Decision Center, Experimentos, Metodologias) continuam rodando ao trocar de página. Recarregar a página pausa a fila — retomável pela barra de fila."
        value={ai.backgroundRuns}
        onToggle={() => setBackgroundRuns(!ai.backgroundRuns)}
      />
      <ToggleRow
        icon={BrainCircuit}
        label="Gerações paralelas de IA"
        description="Permite várias respostas de IA ao mesmo tempo (chats e fila global): envie a próxima pergunta enquanto a anterior ainda gera. Desligue para o comportamento clássico — uma por vez, com fila local."
        value={ai.concurrencyMode !== "sequential"}
        onToggle={() => setConcurrencyMode(ai.concurrencyMode === "sequential" ? "parallel" : "sequential")}
      />
      {ai.concurrencyMode !== "sequential" && (
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-secondary/30 px-2 py-1.5">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground flex-1">Máximo simultâneo</span>
          <div className="flex items-center gap-1" role="group" aria-label="Máximo de gerações simultâneas">
            <button
              onClick={() => setMaxConcurrent(ai.maxConcurrent - 1)}
              disabled={ai.maxConcurrent <= 1}
              className="h-6 w-6 rounded border border-border text-xs hover:bg-secondary disabled:opacity-40"
              aria-label="Diminuir máximo simultâneo"
            >−</button>
            <span className="w-6 text-center text-xs font-semibold tabular-nums" aria-live="polite">{ai.maxConcurrent}</span>
            <button
              onClick={() => setMaxConcurrent(ai.maxConcurrent + 1)}
              disabled={ai.maxConcurrent >= 8}
              className="h-6 w-6 rounded border border-border text-xs hover:bg-secondary disabled:opacity-40"
              aria-label="Aumentar máximo simultâneo"
            >+</button>
          </div>
        </div>
      )}
      <ToggleRow
        icon={Target}
        label="Injetar missão nos prompts"
        description="O objetivo definido em Fluxo → Missão orienta automaticamente todas as análises de IA do sistema."
        value={ai.missionInjection}
        onToggle={() => setMissionInjection(!ai.missionInjection)}
      />
      <ToggleRow
        icon={Save}
        label="Salvar saídas de IA automaticamente"
        description="Toda geração concluída é persistida no inventário de saídas (visível em Sessões/Outputs e reidratada nas páginas)."
        value={ai.autoSaveOutputs}
        onToggle={() => setAutoSaveOutputs(!ai.autoSaveOutputs)}
      />
    </div>
  );
}

/** Editor de prompts: o usuário edita as diretrizes por trás de cada
 *  funcionalidade de IA (base global, chat, e cada seção de análise). */
export function PromptsEditor() {
  const overrides = usePromptOverrides();
  const [open, setOpen] = useState<string | null>(null);
  const count = Object.keys(overrides).length;
  const sections = EXPERIMENT_SECTIONS.filter((s) => s.kind === "ai");

  const Row = ({ target, label, hint }: { target: string; label: string; hint: string }) => {
    const value = overrides[target] ?? "";
    const editing = open === target;
    return (
      <div className="rounded-md border border-border/50 bg-secondary/30 p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-foreground truncate">{label}</p>
            <p className="text-[9px] text-muted-foreground truncate">{hint}</p>
          </div>
          <button
            onClick={() => setOpen(editing ? null : target)}
            aria-expanded={editing}
            className={`px-2 py-0.5 rounded-md text-[10px] shrink-0 transition-colors ${value ? "bg-primary/15 text-primary" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
          >
            {value ? "Editar ✓" : "Editar"}
          </button>
        </div>
        {editing && (
          <div className="mt-1.5 space-y-1">
            <textarea
              value={value}
              onChange={(e) => setPromptOverride(target, e.target.value)}
              rows={4}
              placeholder="Ex.: foque em problemas de onboarding; responda em bullets curtos; ignore reviews de elogio genérico…"
              aria-label={`Diretrizes de ${label}`}
              className="w-full rounded-md border border-border/60 bg-background px-2 py-1.5 text-[11px] focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <p className="text-[9px] text-muted-foreground">
              Anexadas como diretrizes de alta prioridade ao prompt da IA (metodologia e regra de evidência são preservadas). Vazio = comportamento padrão.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-foreground">Prompts da IA (diretrizes editáveis)</p>
        {count > 0 && (
          <button
            onClick={() => { if (confirmDestructive(`Remover as ${count} diretriz(es) editadas?`)) clearPromptOverrides(); }}
            className="text-[9px] text-muted-foreground hover:text-destructive"
          >
            Limpar todas ({count})
          </button>
        )}
      </div>
      <Row target="base" label="Base (todas as análises)" hint="Aplicada a TODA chamada de IA do sistema" />
      <Row target="chat" label="Chats e copilotos" hint="Assistente, Chat, copilotos contextuais" />
      {sections.map((s) => (
        <Row key={s.id} target={`section:${s.id}`} label={s.label} hint={`Seção de análise "${s.label}"`} />
      ))}
    </div>
  );
}

/** Exportar/importar TODO o estado local (dataset, artefatos, canvas, lab,
 *  config). Chaves de IA nunca saem no backup. */
function DataPortabilityControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const mode = confirm("Mesclar (só adiciona dados novos)? OK = mesclar · Cancelar = substituir tudo")
        ? "merge"
        : "replace";
      const res = importAllData(String(reader.result ?? ""), mode);
      setMsg(res.ok ? `✓ ${res.imported} item(ns) importado(s), ${res.skipped} ignorado(s). Recarregue para aplicar.` : `Erro: ${res.error}`);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <button
          onClick={() => downloadExport()}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] bg-secondary text-secondary-foreground hover:bg-secondary/80"
        >
          <Download className="h-3 w-3" /> Exportar tudo
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11px] bg-secondary text-secondary-foreground hover:bg-secondary/80"
        >
          <Upload className="h-3 w-3" /> Importar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
      </div>
      {msg && <p className="text-[9px] text-muted-foreground leading-relaxed">{msg}</p>}
    </div>
  );
}


/** Controles avançados de interface — opacidade, raio, fonte, densidade, motion. */
/** Controle padronizado das larguras das sidebars (slider + presets + reset). */
function SidebarWidthsSection() {
  const widths = useColumnWidths();
  const sides = Object.values(SIDEBARS);
  return (
    <div className="space-y-3">
      {sides.map((spec) => {
        const side: SidebarSide = spec.side;
        const { width, max } = widths[side];
        const preset = activePreset(side, width);
        const isDefault = width === spec.defaultWidth;
        return (
          <div key={side} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">{spec.label}</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-mono text-foreground" role="status">{width}px</span>
                {!isDefault && (
                  <button
                    onClick={() => resetSidebarWidth(side)}
                    className="text-[9px] text-primary hover:underline"
                    aria-label={`Restaurar largura padrão da ${spec.label}`}
                  >
                    Padrão
                  </button>
                )}
              </div>
            </div>
            <input
              type="range"
              min={spec.minWidth}
              max={max}
              step={4}
              value={width}
              onChange={(e) => setSidebarWidth(side, Number(e.target.value))}
              aria-label={`Largura da ${spec.label}`}
              aria-valuetext={`${width}px`}
              className="w-full"
            />
            <div className="flex gap-1" role="group" aria-label={`Presets de largura da ${spec.label}`}>
              {spec.presets.map((p) => (
                <button
                  key={p.id}
                  aria-pressed={preset === p.id}
                  onClick={() => setSidebarWidth(side, p.width)}
                  className={btn(preset === p.id)}
                  title={`${p.width}px`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <p className="text-[9px] text-muted-foreground leading-relaxed">
        Também é possível arrastar a borda da sidebar (duplo-clique redefini) ou usar
        ←/→ com o handle focado. Larguras limitadas a 25% do viewport e persistem entre sessões.
      </p>
    </div>
  );
}

function UISettingsSection() {
  const ui = useUISettings();
  const isDefault = JSON.stringify(ui) === JSON.stringify({
    panelOpacity: 100, glassOpacity: 62, radiusScale: 100, fontScale: 100,
    density: "normal", motion: "normal", surfaceMode: "solid", fontFamily: "Inter",
  });
  const slider = (
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (v: number) => void,
    aria: string,
    suffix = "%",
  ) => (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <span className="text-[9px] font-mono text-foreground">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={aria}
        className="w-full"
      />
    </div>
  );
  const segBtn = (
    options: { key: string; label: string }[],
    current: string,
    onPick: (k: string) => void,
    aria: string,
  ) => (
    <div className="flex gap-1" role="group" aria-label={aria}>
      {options.map((o) => (
        <button
          key={o.key}
          aria-pressed={current === o.key}
          onClick={() => onPick(o.key)}
          className={btn(current === o.key)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
  return (
    <div className="pt-2 mt-2 border-t border-border/50">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Interface avançada</p>
        {!isDefault && (
          <button
            onClick={resetUISettings}
            className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground"
            aria-label="Redefinir interface avançada"
          >
            Redefinir
          </button>
        )}
      </div>
      <div className="space-y-2.5">
        <div>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Superfícies (skeumorphism)</p>
          {segBtn(
            [
              { key: "solid", label: "Sólidas" },
              { key: "translucent", label: "Vidro (blur)" },
            ],
            ui.surfaceMode,
            (k) => setUISettings({ surfaceMode: k as UISettings["surfaceMode"] }),
            "Modo de superfície",
          )}
          <p className="mt-1 text-[9px] text-muted-foreground leading-snug">
            Sólidas: cores opacas, sem transparência. Vidro: todos os fundos
            ficam translúcidos <strong>sempre com blur</strong> — nunca
            opacidade sobre conteúdo sem blur.
          </p>
        </div>
        {/* Tipografia por papel — cada família é buscada no catálogo
            COMPLETO do Google Fonts; secundária/mono vazias herdam da
            primária. Pesos de normal/negrito configuráveis. */}
        <div className="space-y-2.5">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Tipografia (Google Fonts)</p>
          {FONT_ROLE_META.map((r) => (
            <FontRolePicker key={r.key} role={r.key} label={r.label} hint={r.hint} />
          ))}
          <div className="grid grid-cols-2 gap-2">
            {slider("Peso normal", ui.fontWeightRegular, 300, 700, (v) => setUISettings({ fontWeightRegular: v }), "Peso do texto normal")}
            {slider("Peso negrito", ui.fontWeightBold, 500, 800, (v) => setUISettings({ fontWeightBold: v }), "Peso do texto em negrito")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {slider("Escala dos títulos", ui.headingScale, 80, 150, (v) => setUISettings({ headingScale: v }), "Escala dos títulos (h1–h4)")}
            {slider("Altura de linha", ui.lineHeight, 120, 200, (v) => setUISettings({ lineHeight: v }), "Altura de linha do texto")}
          </div>
          <p className="text-[9px] text-muted-foreground leading-snug">
            Famílias carregadas do Google Fonts sob demanda (uma requisição
            combinada); fallback do sistema se a rede falhar.
          </p>
        </div>
        {slider("Opacidade dos painéis", ui.panelOpacity, 5, 100, (v) => setUISettings({ panelOpacity: v }), "Opacidade dos painéis")}
        {slider("Opacidade no modo vidro", ui.glassOpacity, 5, 95, (v) => setUISettings({ glassOpacity: v }), "Opacidade no modo vidro (glass)")}
        {slider("Raio de borda", ui.radiusScale, 0, 250, (v) => setUISettings({ radiusScale: v }), "Raio de borda (escala)")}
        {slider("Tamanho da fonte", ui.fontScale, 80, 130, (v) => setUISettings({ fontScale: v }), "Escala da fonte")}
        <div>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Densidade</p>
          {segBtn(
            [
              { key: "compact", label: "Compacta" },
              { key: "normal", label: "Normal" },
              { key: "spacious", label: "Espaçosa" },
            ],
            ui.density,
            (k) => setUISettings({ density: k as UISettings["density"] }),
            "Densidade da interface",
          )}
        </div>
        <div>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Velocidade das animações</p>
          {segBtn(
            [
              { key: "slow", label: "Lenta" },
              { key: "normal", label: "Normal" },
              { key: "fast", label: "Rápida" },
            ],
            ui.motion,
            (k) => setUISettings({ motion: k as UISettings["motion"] }),
            "Velocidade das animações",
          )}
        </div>
        <p className="text-[9px] text-muted-foreground leading-snug">
          Opacidade &lt; 100% deixa o fundo atravessar painéis, cards e menus (combine com um fundo ativo + modo vidro para o efeito completo).
        </p>
      </div>
    </div>
  );
}

/** Seletor de fundo customizado (gradiente/cor/imagem + animação + blur). */
function BackgroundPickerSection() {
  const bg = useBackgroundSettings();
  const modeBtns = [
    { key: "none" as const, label: "Nenhum" },
    { key: "gradient" as const, label: "Gradiente" },
    { key: "color" as const, label: "Cor" },
    { key: "image" as const, label: "Imagem/GIF" },
    { key: "video" as const, label: "Vídeo" },
  ];
  return (
    <div>
      <p className="text-[9px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Fundo da interface</p>

      {/* Presets de tema — um clique = conjunto coeso */}
      <div className="grid grid-cols-2 gap-1.5 mb-2">
        {THEME_PRESETS.map((t) => (
          <button
            key={t.id}
            onClick={() => setBackgroundSettings(t.settings)}
            className="text-left rounded-lg border border-border/60 p-2 hover:border-primary/60 hover:bg-secondary/40 transition-colors"
            title={t.description}
          >
            <p className="text-[10px] font-medium">{t.label}</p>
            <p className="text-[9px] text-muted-foreground">{t.description}</p>
          </button>
        ))}
      </div>

      <div className="flex gap-1" role="group" aria-label="Modo de fundo">
        {modeBtns.map((m) => (
          <button
            key={m.key}
            aria-pressed={bg.mode === m.key}
            onClick={() => setBackgroundSettings({ mode: m.key })}
            className={btn(bg.mode === m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {bg.mode === "gradient" && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-1.5">
            {GRADIENT_PRESETS.map((g) => (
              <button
                key={g.label}
                onClick={() => setBackgroundSettings({ gradient: g.css })}
                title={g.label}
                aria-label={`Gradiente ${g.label}`}
                aria-pressed={bg.gradient === g.css}
                className={`h-8 rounded-md transition-all ${bg.gradient === g.css ? "ring-2 ring-foreground scale-[1.02]" : "hover:scale-[1.02]"}`}
                style={{ background: g.css }}
              />
            ))}
          </div>
          <input
            value={bg.gradient}
            onChange={(e) => setBackgroundSettings({ gradient: e.target.value })}
            aria-label="Gradiente CSS customizado"
            className="w-full text-[10px] px-2 py-1.5 rounded-md bg-secondary border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder="linear-gradient(135deg, ...)"
          />
        </div>
      )}

      {bg.mode === "color" && (
        <input
          value={bg.color}
          onChange={(e) => setBackgroundSettings({ color: e.target.value })}
          aria-label="Cor de fundo (CSS)"
          className="mt-2 w-full text-[10px] px-2 py-1.5 rounded-md bg-secondary border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          placeholder="hsl(240 30% 10%)"
        />
      )}

      {bg.mode === "image" && (
        <input
          value={bg.imageUrl}
          onChange={(e) => setBackgroundSettings({ imageUrl: e.target.value })}
          aria-label="URL da imagem ou GIF de fundo"
          className="mt-2 w-full text-[10px] px-2 py-1.5 rounded-md bg-secondary border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
          placeholder="https://…/fundo.jpg ou .gif"
        />
      )}

      {bg.mode === "video" && (
        <>
          <p className="text-[9px] text-muted-foreground mt-2">
            URL de YouTube (watch/shorts/youtu.be) ou vídeo direto (.mp4/.webm/.ogg)
          </p>
          <input
            value={bg.videoUrl}
            onChange={(e) => setBackgroundSettings({ videoUrl: e.target.value })}
            aria-label="URL de vídeo de fundo"
            className="mt-1 w-full text-[10px] px-2 py-1.5 rounded-md bg-secondary border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary/40"
            placeholder="https://www.youtube.com/watch?v=… ou .mp4"
          />
        </>
      )}

      {bg.mode !== "none" && (
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-2 text-[10px]">
            <input
              type="checkbox"
              checked={bg.animated}
              onChange={(e) => setBackgroundSettings({ animated: e.target.checked })}
              className="rounded"
            />
            Animação (pan / ken-burns)
          </label>
          {(bg.mode === "image" || bg.mode === "video") && (
            <div>
              <p className="text-[9px] text-muted-foreground mb-1">Desfoque (blur): {bg.blur}px</p>
              <input
                type="range"
                min={0}
                max={40}
                value={bg.blur}
                onChange={(e) => setBackgroundSettings({ blur: Number(e.target.value) })}
                aria-label="Blur de fundo"
                className="w-full"
              />
            </div>
          )}
          <div>
            <p className="text-[9px] text-muted-foreground mb-1">Overlay de legibilidade: {bg.overlayOpacity}%</p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={90}
                value={bg.overlayOpacity}
                onChange={(e) => setBackgroundSettings({ overlayOpacity: Number(e.target.value) })}
                aria-label="Opacidade do overlay"
                className="flex-1"
              />
              <button
                onClick={() =>
                  setBackgroundSettings({ overlayColor: bg.overlayColor === "dark" ? "light" : "dark" })}
                className="px-1.5 py-0.5 rounded bg-secondary text-[9px]"
                aria-label="Cor do overlay (claro/escuro)"
              >
                {bg.overlayColor === "dark" ? "🌙" : "☀️"}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-[10px]">
            <input
              type="checkbox"
              checked={bg.glass}
              onChange={(e) => setBackgroundSettings({ glass: e.target.checked })}
              className="rounded"
            />
            Glassmorphism (painéis de vidro)
          </label>
          <label className="flex items-center gap-2 text-[10px]">
            <input
              type="checkbox"
              checked={bg.noEffects}
              onChange={(e) => setBackgroundSettings({ noEffects: e.target.checked })}
              className="rounded"
            />
            Desativar efeitos/animações do app
          </label>
        </div>
      )}
    </div>
  );
}

/** Preferências de EXIBIÇÃO da saída de IA (AIOutputCard): escala de leitura
 *  global + barra de status da geração. Os cards também têm ajuste próprio
 *  (A−/A+) — aqui fica o padrão de todo o sistema. */
function AIOutputSection() {
  const s = useAIOutputSettings();
  const isDefault = s.fontScale === DEFAULT_AI_OUTPUT.fontScale && s.showStatusBar === DEFAULT_AI_OUTPUT.showStatusBar;
  return (
    <div className="pt-2 mt-2 border-t border-border/50">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Saída de IA (exibição)</p>
        {!isDefault && (
          <button
            onClick={resetAIOutputSettings}
            className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground hover:text-foreground"
            aria-label="Redefinir exibição da saída de IA"
          >
            Redefinir
          </button>
        )}
      </div>
      <p className="text-[9px] text-muted-foreground leading-relaxed mb-2">
        O conteúdo gerado por IA é exibido ampliado para facilitar a leitura e se destacar do restante da página. Cada card também tem botões A−/A+ próprios.
      </p>
      <div className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Tamanho do texto gerado</p>
            <span className="text-[9px] font-mono text-foreground">{s.fontScale}%</span>
          </div>
          <input
            type="range"
            min={SCALE_MIN}
            max={SCALE_MAX}
            step={SCALE_STEP}
            value={s.fontScale}
            onChange={(e) => setAIOutputSettings({ fontScale: Number(e.target.value) })}
            aria-label="Escala do texto gerado por IA"
            className="w-full"
          />
          <div className="flex gap-1 mt-1" role="group" aria-label="Predefinições de escala">
            {SCALE_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAIOutputSettings({ fontScale: p })}
                aria-pressed={s.fontScale === p}
                className={`flex-1 py-1 rounded-md text-[10px] tabular-nums transition-colors ${s.fontScale === p ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setAIOutputSettings({ showStatusBar: !s.showStatusBar })}
          aria-pressed={s.showStatusBar}
          className="w-full flex items-center gap-2 text-left"
        >
          <span className={`w-7 h-4 rounded-full transition-colors relative shrink-0 ${s.showStatusBar ? "bg-primary" : "bg-muted"}`}>
            <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${s.showStatusBar ? "left-3.5" : "left-0.5"}`} />
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-medium text-foreground">Barra de status da geração</span>
            <span className="block text-[9px] text-muted-foreground">Tempo, ~tokens, palavras e velocidade sob cada resposta.</span>
          </span>
        </button>
      </div>
    </div>
  );
}

