/** Design System vivo da v6 — mobile-first, temas claro/escuro. **/
import { useState } from "react";
import { Link } from "react-router";

const SECTIONS = [
  { id: "tokens", label: "Tokens", desc: "Variáveis CSS HSL — cores, superfícies, status, chart" },
  { id: "tipografia", label: "Tipografia", desc: "Escala fluid type com clamp() — display a caption" },
  { id: "espacamento", label: "Espaçamento", desc: "Ritmo de 4px: --spacing-1..14 e medidas de layout" },
  { id: "elevacao", label: "Borda & elevação", desc: "Raio, sombras elev-1..4 e glow" },
  { id: "motion", label: "Motion", desc: "Durações e prefers-reduced-motion" },
  { id: "responsivo", label: "Responsividade", desc: "Grid auto-fit/minmax, container queries, breakpoints 640..1536" },
  { id: "atoms", label: "Átomos", desc: "Button, badge, input, select, kbd, status-pill" },
  { id: "moleculas", label: "Moléculas", desc: "Card, form-field, table, details, row" },
  { id: "organismos", label: "Organismos", desc: "Teaser de dashboard, glass-card, stat-glow" },
  { id: "a11y", label: "Acessibilidade", desc: "Foco visível, teclado, contraste, reduced-motion" },
];

const TYPE_SCALE = [
  { cls: "fluid-display", label: "Display", spec: "clamp(1.875rem, 4vw, 2.25rem) · 700 · -0.02em", sample: "Análise de reviews" },
  { cls: "fluid-title", label: "Título", spec: "clamp(1.25rem, 2.5vw,  ​1.5rem) · 600", sample: "Dashboard de dados" },
  { cls: "", label: "Corpo", spec: "1rem · 400 · 1.6", sample: "Reviews das lojas, deduplicadas por id." },
  { cls: "text-sm", label:"Corpo pequeno", spec:"0.875rem · 400", sample:"Atualizado agora há pouco" },
  { cls: "text-xs", label:"Caption", spec:"0.75rem · muted", sample:"8 apps · 21.432 reviews" },
  { cls: "mono", label:"Mono", spec:"ui-monospace ·  ​0.8rem", sample:"aso:dataset:v1" },
];

const SPACING = [
  { name: "spacing-1", px: "4px" },
  { name: "spacing-2", px: "8px" },
  { name: "spacing-4", px: "16px" },
  { name: "spacing-6", px: "24px" },
  { name: "spacing-8", px: "40px" },
  { name: "spacing-10", px: "56px" },
  { name: "spacing-12", px: "80px" },
  { name: "spacing-14", px: "128px" },
];

const TOKENS = [
  { name: "background", light: "hsl(0 0% 100%)", dark: "hsl(240 10% 10%)" },
  { name: "foreground", light: "hsl(240 10% 3.9%)", dark: "hsl(0 0% 98%)" },
  { name: "primary", light: "hsl(240 5.9% 10%)", dark: "hsl(0 0% 98%)" },
  { name: "muted-foreground", light: "hsl(240 3.8% 42%)", dark: "hsl(240 5% 68%)" },
  { name: "border", light: "hsl(240 5.9% 86%)", dark: "hsl(240 3.7% 22%)" },
  { name: "success", light: "hsl(142 71% 45%)", dark: "hsl(142 71% 45%)" },
  { name: "warning", light: "hsl(38 92% 50%)", dark: "hsl(38 92% 50%)" },
  { name: "status-running", light: "hsl(217 91% 60%)", dark: "hsl(217 91% 60%)" },
];

function TokenSwatches() {
  return (
    <div className="grid-auto">
      {TOKENS.map((t) => (
        <div key={t.name} className="card">
          <div className="row" style={{ gap: "0.5rem" }}>
            <span
              className="swatch"
              style={{ background: t.light }}
              aria-hidden="true"
            />
            <span
              className="swatch swatch-dark"
              style={{ background: t.dark }}
              aria-hidden="true"
            />
          </div>
          <div className="muted text-sm">{t.name}</div>
        </div>
      ))}
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card stack" style={{ gap: "1rem" }}>
      <div>
        <h2 className="fluid-title">{title}</h2>
        <details>
          <summary>Ver detalhes</summary>
          <div className="body muted text-sm">{SECTIONS.find((s) => s.id === id)?.desc}</div>
        </details>
      </div>
      {children}
    </section>
  );
}

export function DesignSystem() {
  const [plain, setPlain] = useState(false);
  return (
    <div className="stack" style={{ gap: "2rem" }}>
      <header className="stack" style={{ gap: "0.5rem" }}>
        <h1 className="fluid-display">Design System</h1>
        <p className="muted">
          Catálogo vivo do sistema — mobile-first, dois temas, componentes reais.
{" "}
          <Link to="/suggest" className="underline">Ir para Suggest →</Link>
        </p>
        <div className="row">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPlain((v) => !v)}>
            {plain ? "Tema:" : "Tema:"} {plain ? "claro" : "escuro"}
          </button>
        </div>
      </header>

      <Section id="tokens" title="Tokens">
        <TokenSwatches />
      </Section>

      <Section id="tipografia" title="Tipografia">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Classe</th><th>Spec</th><th>Exemplo</th></tr>
            </thead>
            <tbody>
              {TYPE_SCALE.map((t) => (
                <tr key={t.label}>
                  <td><code>{t.cls || "body"}</code></td>
                  <td className="muted text-sm">{t.spec}</td>
                  <td className={t.cls} style={t.cls === "fluid-display" || t.cls === "fluid-title" ? { fontSize: "1.4rem", fontWeight: 700 } : undefined}>{t.sample}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="espacamento" title="Espaçamento">
        <div className="grid-auto">
          {SPACING.map((s) => (
            <div key={s.name} className="card">
              <div style={{ height: s.px, background: "hsl(var(--primary))", opacity: 0.25, borderRadius: 6 }} />
              <div className="muted text-sm">{s.name} · {s.px}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="elevacao" title="Borda & elevação">
        <div className="grid-auto">
          <div className="card elev-1">elev-1 · cards</div>
          <div className="card elev-2">elev-2 · hover</div>
          <div className="card elev-3">elev-3 · diálogos</div>
          <div className="card elev-4">elev-4 · modais</div>
          <div className="card stat-glow">glow · destaque</div>
        </div>
      </Section>

      <Section id="motion" title="Motion">
        <div className="row">
          <button type="button" className="btn btn-secondary anim-fade">Fade</button>
          <button type="button" className="btn btn-secondary anim-slide">Slide</button>
          <button type="button" className="btn btn-secondary anim-scale">Scale</button>
        </div>
        <p className="muted text-sm">prefers-reduced-motion desativa todas as animações.</p>
      </Section>

      <Section id="responsivo" title="Responsividade">
        <div className="grid-auto">
          <div className="card">Auto-fit</div>
          <div className="card">Minmax</div>
          <div className="card">Fluid</div>
          <div className="card">Clamp</div>
        </div>
        <p className="muted text-sm">
          Breakpoints: 640 / 768 / 1024 / 1280 / 1536px — mobile-first com media queries min-width.
        </p>
      </Section>

      <Section id="atoms" title="Átomos">
        <div className="wrap">
          <button type="button" className="btn">Primário</button>
          <button type="button" className="btn btn-secondary">Secundário</button>
          <button type="button" className="btn btn-ghost">Fantasma</button>
          <button type="button" className="btn btn-sm">Pequeno</button>
          <button type="button" className="btn btn-lg">Grande</button>
          <button type="button" className="btn" disabled>Desabilitado</button>
        </div>
        <div className="wrap">
          <span className="badge">badge</span>
          <span className="badge badge-primary">primário</span>
          <span className="badge badge-outline">outline</span>
          <span className="kbd">Ctrl K</span>
        </div>
        <div className="form-field">
          <label htmlFor="ds-input">Input</label>
          <input id="ds-input" placeholder="Texto…" />
        </div>
        <div className="form-field">
          <label htmlFor="ds-select">Select</label>
          <select id="ds-select" defaultValue="br">
            <option value="br">Brasil</option>
            <option value="us">EUA</option>
          </select>
        </div>
        <div className="wrap">
          <span className="status-pill ok" data-status="ok">ok</span>
          <span className="status-pill run" data-status="run">running</span>
          <span className="status-pill warn" data-status="warn">warn</span>
          <span className="status-pill err" data-status="error">error</span>
          <span className="status-pill">idle</span>
        </div>
      </Section>

      <Section id="moleculas" title="Moléculas">
        <div className="grid-auto">
          <div className="card stack">
            <h3>Card</h3>
            <p className="muted text-sm">Com borda, raio e padding padronizados.</p>
          </div>
          <div className="card">
            <div className="row">
              <div className="metric"><div className="value">12k</div><div className="label">reviews</div></div>
              <div className="metric"><div className="value">98%</div><div className="label">precisão</div></div>
            </div>
          </div>
        </div>
        <details open>
          <summary>Bloco expansível</summary>
          <div className="body">
            <p className="muted text-sm">Conteúdo revelado — usa &lt;details&gt; nativo, sem JS.</p>
          </div>
        </details>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Fonte</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td>Google Suggest</td><td><span className="status-pill ok">ok</span></td></tr>
              <tr><td>YouTube</td><td><span className="status-pill run">run</span></td></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="organismos" title="Organismos">
        <div className="grid-auto">
          <div className="card stat-glow stack">
            <div className="metric"><div className="value">4.2k</div><div className="label">sugestões</div></div>
            <div className="metric"><div className="value">31</div><div className="label">testes verdes</div></div>
          </div>
          <div className="glass-card card stack">
            <h3>Glass card</h3>
            <p className="muted text-sm">Backdrop blur + transparência — sobre header sticky.</p>
          </div>
        </div>
      </Section>

      <Section id="a11y" title="Acessibilidade">
        <ul className="stack">
          <li>Foco visível em todo interativo (:focus-visible).</li>
          <li>aria-label em botões só-ícone; aria-expanded no menu.</li>
          <li>prefers-reduced-motion respeitado globalmente.</li>
          <li>Contraste via tokens — nunca cor absoluta.</li>
          <li>Alvos generosos e navegação por teclado.</li>
        </ul>
      </Section>
    </div>
  );
}