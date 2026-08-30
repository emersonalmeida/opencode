import { SiteHeader } from "../organisms/SiteHeader";
import { Hero } from "../organisms/Hero";
import { Container } from "../atoms/Container";
import { Card } from "../atoms/Card";
import { Text } from "../atoms/Text";
import { StatCard } from "../molecules/StatCard";
import { SourceRow } from "../molecules/SourceRow";
import { SearchField } from "../molecules/SearchField";
import styles from "./HomeTemplate.module.css";

type SourceSummary = {
  name: string;
  status: string;
  category: string;
  progress?: number;
};

type HomeTemplateProps = {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  sources: SourceSummary[];
  stats: { audited: number; implemented: number; partial: number };
  onStartToSources: () => void;
  onSuggest: () => void;
  query: string;
  onQueryChange: (value: string) => void;
};

export function HomeTemplate({
  theme, onToggleTheme, sources, stats, onStartToSources, onSuggest, query, onQueryChange,
}: HomeTemplateProps) {
  return (
    <>
      <SiteHeader theme={theme} onToggleTheme={onToggleTheme} />
      <main id="main">
        <Hero onStart={onStartToSources} onSuggest={onSuggest} />
        <Container as="section" size="lg">
        <div className={styles.statsGrid} aria-label="Resumo das fontes">
          <StatCard label="Fontes auditadas" value={stats.audited} hint="fontes mapeadas no registry" tone="info" />
          <StatCard label="Implementadas" value={stats.implemented} hint="coleta automatizada funcional" tone="success" />
          <StatCard label="Com cobertura parcial" value={stats.partial} hint="necessitam fallback serpapi" tone="warning" />
        </div>
        </Container>
        <Container as="section" size="lg" id="fontes" className={styles.sources}>
          <Card>
            <div className={styles.sourcesHead}>
              <Text as="h2" size="lg">Fontes</Text>
              <SearchField value={query} onChange={onQueryChange} placeholder="Buscar fonte..." />
            </div>
            <ul className={styles.list}>
              {sources.map(s => (
                <SourceRow key={s.name} name={s.name} status={s.status} category={s.category} progress={s.progress} />
              ))}
            </ul>
          </Card>
        </Container>
        <Container as="section" size="lg" id="como-funciona" className={styles.how}>
          <Text as="h2" size="lg">Como funciona</Text>
          <ol className={styles.steps}>
            <li><Text as="p" weight="medium">Auditoria de fontes</Text><Text as="p" muted>55+ fontes registradas e classificadas por status.</Text></li>
            <li><Text as="p" weight="medium">Coleta multi-fonte</Text><Text as="p" muted>Raspagem + fallback serpapi para garantir cobertura.</Text></li>
            <li><Text as="p" weight="medium">Análise e publicação</Text><Text as="p" muted>Normalização, KPIs e painel por categoria.</Text></li>
          </ol>
        </Container>
      </main>
      <footer className={styles.footer}>
        <Container>
          <Text as="p" size="sm">datareview v3 — dados públicos, coleta transparente.</Text>
        </Container>
      </footer>
    </>
  );
}
