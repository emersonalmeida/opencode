import { useState, type FormEvent } from "react";
import { SiteHeader } from "../organisms/SiteHeader";
import { Container } from "../atoms/Container";
import { Card } from "../atoms/Card";
import { Text } from "../atoms/Text";
import { Input } from "../atoms/Input";
import { Button } from "../atoms/Button";
import { useTheme } from "../atoms/ThemeProvider";
import { buildSeeds, REGIONS, VERTICALS, runGather, type GatherResult, type SuggestRow } from "@v3/sources";
import styles from "./SuggestPage.module.css";

function ResultList({ rows }: { rows: SuggestRow[] }) {
  if (rows.length === 0) {
    return null;
  }
  return (
    <ul className={styles.list}>
      {rows.map((r) => (
        <li key={r.text} className={styles.item}>
          <Text as="p" weight="medium">{r.text}</Text>
          <Text as="p" size="sm" muted>
            score {r.relevance} — {r.groups.join(", ")}
          </Text>
        </li>
      ))}
    </ul>
  );
}

export function SuggestPage() {
  const { theme, toggleTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<GatherResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCollect(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) { setError("Digite uma palavra-chave."); return; }
    setLoading(true);
    setError(null);
    try {
      const seeds = buildSeeds(q);
      const combos = [{ region: REGIONS[0]!.id, vertical: VERTICALS[0]!.id }];
      const res = await runGather(q, seeds, combos, { limit: 10 });
      if (!res.ok) { setError(res.error ?? "Falha na coleta."); return; }
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader theme={theme} onToggleTheme={toggleTheme} />
      <main id="main">
        <section className={styles.hero}>
          <Container size="lg">
            <Text as="h1" size="xxl" id="suggest-title">Coleta no Google Suggest</Text>
            <Text as="p" size="lg" muted>
              Digite uma palavra-chave para reunir sugestões do autocomplete.
            </Text>
            <form className={styles.form} onSubmit={handleCollect}>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ex.: seguro de vida"
                aria-label="Palavra-chave"
              />
              <Button type="submit" disabled={loading} size="lg">
                {loading ? "Coletando..." : "Coletar"}
              </Button>
            </form>
            {error && <Text as="p" size="sm" className={styles.error}>{error}</Text>}
          </Container>
        </section>
        <Container as="section" size="lg" className={styles.results}>
          <Card>
            {result && <ResultList rows={result.rows} />}
          </Card>
        </Container>
      </main>
    </>
  );
}