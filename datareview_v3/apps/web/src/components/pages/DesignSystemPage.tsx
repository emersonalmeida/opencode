import { useState } from "react";
import {
  Accessibility, AlertCircle, Atom, Boxes, Check, CheckCircle2, Copy, Loader2, Moon, Palette, PenLine, Ruler, Search, Shuffle, Sparkles, Star, Sun, SwatchBook, Type as TypeIcon, Zap,
} from "lucide-react";
import { Button } from "../atoms/Button";
import { Badge } from "../atoms/Badge";
import { Container } from "../atoms/Container";
import { Input } from "../atoms/Input";
import { Text } from "../atoms/Text";
import { Progress } from "../atoms/Progress";
import { SearchField } from "../molecules/SearchField";
import { SectionHeader } from "../molecules/SectionHeader";
import { EmptyState } from "../molecules/EmptyState";
import { LiveStatus, BusyIndicator, ErrorBox } from "../molecules/Feedback";
import { StatCard } from "../molecules/StatCard";
import { SourceRow } from "../molecules/SourceRow";
import { SiteHeader } from "../organisms/SiteHeader";
import { Hero } from "../organisms/Hero";
import styles from "./DesignSystemPage.module.css";

type Theme = "light" | "dark";

const COLOR_TOKENS = [
  { var: "color-brand-500", label: "Brand", light: "#1a56d9", dark: "#5b8def" },
  { var: "color-brand-600", label: "Brand 600", light: "#0f4aa6", dark: "#7aa2ff" },
  { var: "color-success-600", label: "Sucesso", light: "#0b7a3b", dark: "#3fbf7f" },
  { var: "color-warning-600", label: "Aviso", light: "#a16207", dark: "#d9a92e" },
  { var: "color-danger-600", label: "Erro", light: "#d92c24", dark: "#ff6259" },
  { var: "color-info-600", label: "Info", light: "#175cd3", dark: "#6ea8ff" },
];

const TYPE_SCALE = [
  { cls: "text-display", label: "Display", spec: "2.5rem · 700 · -0.02em", sample: "Análise de reviews" },
  { cls: "text-xxl", label: "xxl", spec: "2rem · 600", sample: "Coleta multi-fonte" },
  { cls: "text-xl", label: "xl", spec: "1.5rem · 600", sample: "Fontes auditadas" },
  { cls: "text-lg", label: "lg", spec: "1.25rem ·osmosis  600", sample: "Dashboard de dados" },
  { cls: "text-md", label: "md", spec: "1rem ·  400", sample: "Métricas agregadas do dataset" },
  { cls: "text-sm", label: "sm", spec: "0.875rem ·  400", sample: "Reviews coletadas das duas lojas" },
  { cls: "text-xs", label: "xs", spec: "0.75rem ·  400", sample: "Atualizado agora há pouco" },
  { cls: "text-caption", label: "Caption", spec: "0.75rem · muted", sample: "8 apps ·́21.432 reviews" },
];

const SPACING_SCALE = [
  { var: "space-1", rem: 0.25 },
  { var: "space-2", rem: 0.5 },
  { var: "space-3", rem: 0.75 },
  { var: "space-4", rem:  1 },
  { var: "space-6", rem:  1.5 },
  { var: "space-8", rem: 2 },
];

const ELEVATION_SCALE = [
  { var: "shadow-1", label: "Elev 1", usage: "Cards em repouso" },
  { var: "shadow-2", label: "Elev 2", usage: "Cards hover / popovers" },
  { var: "shadow-3", label: "Elev 3", usage: "Dropdowns / diálogos" },
  { var: "shadow-4", label: "Elev 4", usage: "Modais / overlays" },
  { var: "shadow-glow", label: "Glow", usage:"Destaque primário (CTA ativo)" },
];

const MOTION_OPTIONS = [
  { key: "fast", label: "Rápido", spec: "120ms — feedback quase instantâneo" },
  { key: "normal", label: "Normal", spec: "200ms — padrão do sistema" },
];

const ICONS = [
  Search, Sparkles, Star, Zap, Check, CheckCircle2, Copy, Loader2, Moon, Sun, Palette, PenLine, Ruler, Shuffle, SwatchBook, Atom, Boxes, TypeIcon, Accessibility, AlertCircle,
];

const A11Y_RULES = [
  { title:"Foco visível", detail:"Todo elemento interativo tem anel :focus-visible — navegação por teclado nunca é às cegas." },
  { title:"ARIA completo", detail:"aria-label em botões só-ícone, aria-pressed em toggles, role=status/log/alert em regiões dinâmicas." },
  { title:"Teclado", detail:"Enter/Espaço em seleções, Esc fecha overlays, foco gerenciado em diálogos." },
  { title:"Contraste", detail:"Texto sempre sobre tokens de cor — nunca cor absoluta; badges de status têm texto + ícone, nunca só cor." },
  { title:"Motion responsável", detail:"prefers-reduced-motion desativa animações de fundo/reveal — todo motion é decorativo e dispensável." },
  { title:"Alvos generosos", detail:"Áreas de hit de no mínimo 44px (--target-md) em controles interativos." },
  { title:"Estado anunciado", detail:"Contagens, erros (role=alert) e resultados de busca são anunciados a leitores de tela." },
];

const CONTENT_RULES = [
  { title:"PT-BR por padrão", detail:"Toda UI em português do Brasil; i18n (aso:ui-lang) prepara EN." },
  { title:"Honestidade de dados", detail:"Números sempre sobre o total coletado; quando não há evidência, o sistema diz 'não há evidência' — nunca inventa." },
  { title:"Verbos de ação", detail:"Botões com verbos claros: Coletar, Explorar, Buscar, Tentar novamente — não 'OK'/'Submit'." },
  { title:"Estado vazio útil", detail:"Todo empty state explica o que falta e oferece a próxima ação (CTA)." },
  { title:"Progresso visível", detail:"Tarefas longas mostram status (queued/running/done) via BusyIndicator e LiveStatus." },
];

const SECTIONS = [
  { id:"tokens", label:"Tokens de cor" },
  { id:"tipografia", label:"Tipografia" },
  { id:"espacamento", label:"Espaçamento" },
  { id:"elevacao", label:"Raio & elevação" },
  { id:"motion", label:"Motion" },
  { id:"icones", label:"Iconografia" },
   { id:"atomos", label:"Átomos" },
  { id:"moleculas", label:"Moléculas" },
  { id:"organismos", label:"Organismos" },
  { id:"padroes", label:"Padrões" },
  { id:"conteudo", label:"Conteúdo & voz" },
  { id:"acessibilidade", label:"Acessibilidade" },
];

type DesignSystemPageProps = {
  theme: Theme;
  onToggleTheme: () => void;
};

const scrollToSection = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior:"smooth", block:"start" });
};

function Copyable({ children, text, label }: { children: React.ReactNode; text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={styles.copyable}
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 900);
      }}
      title={`Copiar ${label}`}
      aria-label={`Copiar ${label}`}
    >
      {copied ? <Check className={styles.copyCheck} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function DemoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.demoCard}>
      <p className={styles.pillLabel}>{title}</p>
      <div className={styles.pills}>{children}</div>
    </div>
  );
}

export function DesignSystemPage({ theme, onToggleTheme }: DesignSystemPageProps) {
  return (
    <div className="page">
      <Container>
        <section className={styles.hero} aria-labelledby="ds-title">
          <div className={styles.heroHead}>
            <div className={styles.heroIcon}>
              <SwatchBook aria-hidden="true" />
            </div>
            <div className={styles.heroCopy}>
              <p className="eyebrow">App Intelligence · design system vivo</p>
              <Text as="h1" size="xxl" id="ds-title">Design System</Text>
              <Text as="p" size="md" muted>
                A linguagem visual e comportamental do produto — foundations, componentes
                e padrões, sempre com previews ao vivo dos componentes reais. Um único ponto
                de referência para quem constrói novas páginas.

              </Text>
              <p className={styles.heroMeta}>
                <span>{COLOR_TOKENS.length} cores</span> · <span>{TYPE_SCALE.length} escalas</span> ·
                <span>{SPACING_SCALE.length} passos</span> · <span>{A11Y_RULES.length} regras de a11y</span>
              </p>
            </div>
          </div>
          <nav className={styles.nav} aria-label="Seções do design system">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" className={styles.chip} onClick={() => scrollToSection(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>
        </section>
      </Container>

      <Container as="section" className={styles.sectionBody}>
        {/* 01 · Tokens de cor */}
        <section id="tokens" className={styles.section} aria-labelledby="h-tokens">
          <SectionHeader
            eyebrow="Foundations · 01"
            title="Tokens de cor"
            description="Variáveis CSS que alimentam todo o sistema — dois estados (claro/escuro), padrão sonho no dark por preferência do usuário."
          />
          <div className={styles.swatches}>
            {COLOR_TOKENS.map((t) => (
              <Copyable key={t.var} text={`var(--${t.var})`} label={`token ${t.var}`}>
                <span className={styles.swatchName}>{t.label}</span>
                <span className={styles.swatchVar}>--{t.var}</span>
                <span className={styles.swatchDots}>
                  <span className={styles.dot} style={{ background: t.light }} title={`claro: ${t.light}`} />
                  <span className={styles.dot} style={{ background: t.dark }} title={`escuro: ${t.dark}`} />
                </span>
              </Copyable>
            ))}
          </div>
        </section>

        {/* 02 · Tipografia */}
        <section id="tipografia" className={styles.section} aria-labelledby="h-tipografia">
          <SectionHeader
            eyebrow="Foundations · 02"
            title="Tipografia"
            description="Escala tipográfica via tokens — display → caption, com hierarquia e mono para código."
          />
          <div className={styles.typeRows}>
            {TYPE_SCALE.map((t) => (
              <Copyable key={t.cls} text={t.cls} label={`classe ${t.cls}`}>
                <span className={`${t.cls} ${styles.typeSample}`}>{t.sample}</span>
                <span className={styles.typeSpec}>{t.label} · {t.spec}</span>
                <span className={styles.typeCls}>{t.cls}</span>
              </Copyable>
            ))}
          </div>
        </section>

        {/* 03 · Espaçamento */}
        <section id="espacamento" className={styles.section} aria-labelledby="h-espacamento">
          <SectionHeader
            eyebrow="Foundations · 03"
            title="Espaçamento"
            description="Ritmo base de 4px: gaps e paddings consistents em todo o produto."
          />
          <div className={styles.spacingRows}>
            {SPACING_SCALE.map((s) => (
              <Copyable key={s.var} text={`var(--${s.var})`} label={`token ${s.var}`}>
                <span className={styles.spacingLabel}>{s.var.replace("space-", "s")}</span>
                <span className={styles.spacingBar} style={{ width: `${s.rem * 64}px` }} />
                <span className={styles.spacingVal}>{s.rem}rem · {Math.round(s.rem * 16)}px</span>
                <span className={styles.spacingCls}>--{s.var}</span>
              </Copyable>
            ))}
          </div>
        </section>

        {/* 04 · Raio & elevação */}
        <section id="elevacao" className={styles.section} aria-labelledby="h-elevacao">
          <SectionHeader
            eyebrow="Foundations · 04"
            title="Raio de borda & elevação"
            description="Raio escalável de borda e sombras escaladas (1 repouso → 4 modais) + glow para CTA ativo."
          />
          <div className={styles.radiusRow}>
            {["sm", "md", "lg", "full"].map((r) => (
              <div key={r} className={styles.radiusItem}>
                <span className={styles.radiusBox} style={{ borderRadius: r === "sm" ? "var(--radius-sm)" : r === "md" ? "var(--radius-md)" : r === "lg" ? "var(--radius-lg)" : "var(--radius-full)" }} />
                <span className={styles.radiusLabel}>{r}</span>
              </div>
            ))}
          </div>
          <div className={styles.elevRow}>
            {ELEVATION_SCALE.map((e) => (
              <Copyable key={e.var} text={`var(--${e.var})`} label={`token ${e.var}`}>
                <span className={`${styles.elevCard} elev-${e.var === "shadow-glow" ? "glow" : e.var.slice(-1)}`}>
                  <span className={styles.elevName}>{e.label}</span>
                  <span className={styles.elevUse}>{e.usage}</span>
                  <span className={styles.elevVar}>--{e.var}</span>
                </span>
              </Copyable>
            ))}
          </div>
        </section>

        {/* 05 · Motion */}
        <section id="motion" className={styles.section} aria-labelledby="h-motion">
          <SectionHeader
            eyebrow="Foundations · 05"
            title="Motion"
            description="Durações de animação do sistema — sempre respeitando prefers-reduced-motion."
          />
          <div className={styles.motionRow}>
            {MOTION_OPTIONS.map((m) => (
              <div key={m.key} className={styles.motionBox}>
                <span className={`${styles.motionChip} ${m.key === "fast" ? styles.motionChipFast : styles.motionChipNormal}`} />
                <span>
                  <strong>{m.label}</strong>
                  <p className={styles.typeSpec}>{m.spec}</p>
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* 06 · Iconografia */}
        <section id="icones" className={styles.section} aria-labelledby="h-icones">
          <SectionHeader
            eyebrow="Foundations · 06"
            title="Iconografia"
            description="Biblioteca lucide-react — nunca emojis na UI. Ícones em uso no sistema:"
          />
          <div className={styles.iconGrid}>
            {ICONS.map((Icon) => (
              <span key={Icon.displayName ?? String(Icon)} className={styles.iconCell}>
                <Icon aria-hidden="true" />
                <span className={styles.iconName}>{Icon.displayName}</span>
              </span>
            ))}
          </div>
        </section>

        {/* 07 · Átomos */}
        <section id="atomos" className={styles.section} aria-labelledby="h-atomos">
          <SectionHeader
            eyebrow="Componentes · 07"
            title="Átomos"
            description="Componentes indivisíveis: botões, badges, inputs, cards, textos, progresso."
          />
          <div className={styles.demoCard}>
            <p className={styles.pillLabel}>Button — variants</p>
            <div className={styles.pills}>
              {(["primary", "secondary", "ghost", "outline", "danger"] as const).map((v) => (
                <Button key={v} variant={v}>{(v === "danger" ? "Perigo" : v[0]!.toUpperCase() + v.slice(1))}</Button>
              ))}
            </div>
            <p className={styles.pillLabel}>Button — sizes</p>
            <div className={styles.pills}>
              <Button size="sm">Pequeno</Button>
              <Button size="md">Médio</Button>
              <Button size="lg">Grande</Button>
              <Button size="icon" aria-label="Buscar"><Search aria-hidden="true" /></Button>
            </div>
            <p className={styles.pillLabel}>Badge — tones</p>
            <div className={styles.pills}>
              <Badge>Padrão</Badge>
              <Badge tone="neutral">Neutro</Badge>
              <Badge tone="success">Sucesso</Badge>
              <Badge tone="warning">Aviso</Badge>
              <Badge tone="danger">Erro</Badge>
              <Badge tone="info">Info</Badge>
            </div>
            <p className={styles.pillLabel}>Input</p>
            <div className={styles.pills}>
              <Input placeholder="Digite algo…" aria-label="Exemplo de input" />
            </div>
            <p className={styles.pillLabel}>Progress — estados</p>
            <div className={styles.pills}>
              <div style={{ width: "100%", maxWidth: 320 }}>
                <Progress value={72} label="Coletando de App Store…" />
              </div>
            </div>
          </div>
        </section>

        {/* 08 · Moléculas */}
        <section id="moleculas" className={styles.section} aria-labelledby="h-moleculas">
          <SectionHeader
            eyebrow="Componentes · 08"
            title="Moléculas"
            description="Composições simples: busca com ícone e limpar, cards de estatística, linhas de fonte, feedback."
          />
          <div className={styles.demoCard}>
            <p className={styles.pillLabel}>SearchField</p>
            <SearchField value="" onChange={() => undefined} placeholder="Buscar fonte…" />
            <p className={styles.pillLabel}>StatCard — tones</p>
            <div className={styles.pills}>
              <StatCard label="Apps auditados" value="55+" />
              <StatCard label="Entregues" value="18" tone="success" />
              <StatCard label="Falhas" value="3" tone="danger" />
            </div>
            <p className={styles.pillLabel}>SourceRow</p>
            <SourceRow
              name="App Store"
              status="Auditada"
              category="Lojas"
              progress={100}
            />
          </div>
        </section>

        {/* 09 · Organismos */}
        <section id="organismos" className={styles.section} aria-labelledby="h-organismos">
          <SectionHeader
            eyebrow="Componentes · 09"
            title="Organismos"
            description="Blocos compostos: header com navegação, hero com pill e gradiente, seções de página."
          />
          <div className={styles.organismBox}>
            <SiteHeader theme={theme} onToggleTheme={onToggleTheme} />
            <Hero onStart={() => undefined} onSuggest={() => undefined} />
          </div>
        </section>

        {/* 10 · Padrões */}
        <section id="padroes" className={styles.section} aria-labelledby="h-padroes">
          <SectionHeader
            eyebrow="Padrões · 10"
            title="Padrões compostos"
            description="Estados vazios úteis, feedback de carregamento/erro, hierarquia de seção."
          />
          <div className={styles.patternList}>
            <DemoBlock title="EmptyState — util, com CTA">
              <EmptyState
                icon={Boxes}
                title="Nenhuma fonte coletada"
                description="Busque uma fonte na página Fontes para começar a auditoria."
                action={<Button size="sm" variant="outline" onClick={() => scrollToSection("fontes")}>Explorar fontes</Button>}
                compact
              />
            </DemoBlock>
            <DemoBlock title="Feedback — LiveStatus, BusyIndicator, ErrorBox">
              <div style={{ display: "grid", gap: 12 }}>
                <LiveStatus message="Coleta concluída — 18 fontes entregues." />
                <BusyIndicator label="Gerando análise…" />
                <ErrorBox message="Falha ao buscar desta fonte" hint="Verifique sua conexão e tente novamente." onRetry={() => undefined} />
              </div>
            </DemoBlock>
          </div>
        </section>

        {/* 11 · Conteúdo & voz */}
        <section id="conteudo" className={styles.section} aria-labelledby="h-conteudo">
          <SectionHeader
            eyebrow="Diretrizes · 11"
            title="Conteúdo & voz"
            description="Texto de UI com clareza, honestidade e ação — sempre em PT-BR."
          />
          <div className={styles.ruleList}>
            {CONTENT_RULES.map((r) => (
              <div key={r.title} className={styles.rule}>
                <Check className={styles.ruleIcon} aria-hidden="true" />
                <div className={styles.ruleCopy}>
                  <p className={styles.ruleTitle}>{r.title}</p>
                  <p className={styles.ruleText}>{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 12 · Acessibilidade */}
        <section id="acessibilidade" className={styles.section} aria-labelledby="h-acessibilidade">
          <SectionHeader
            eyebrow="Diretrizes · 12"
            title="Acessibilidade"
            description="Regras aplicadas em todo o sistema — foco, ARIA, teclado, contraste, motion responsável."
          />
          <div className={styles.ruleList}>
            {A11Y_RULES.map((r) => (
              <div key={r.title} className={styles.rule}>
                <Accessibility className={styles.ruleIcon} aria-hidden="true" />
                <div className={styles.ruleCopy}>
                  <p className={styles.ruleTitle}>{r.title}</p>
                  <p className={styles.ruleText}>{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Container>
    </div>
  );
}
