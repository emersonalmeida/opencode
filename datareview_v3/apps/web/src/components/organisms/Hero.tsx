import { Sparkles } from "lucide-react";
import { Button } from "../atoms/Button";
import { Container } from "../atoms/Container";
import { Text } from "../atoms/Text";
import styles from "./Hero.module.css";

type HeroProps = {
  onStart: () => void;
  onSuggest: () => void;
};

export function Hero({ onStart, onSuggest }: HeroProps) {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <Container>
        <div className={styles.grid}>
          <div className={styles.copy}>
            <span className={styles.eyebrow}>
              <Sparkles aria-hidden="true" /> App Intelligence — fontes abertas, ao vivo
            </span>
            <Text as="h1" size="xxl" id="hero-title" className={styles.title}>
              Coleta <span className={styles.gradient}>multi-fonte</span> de dados públicos
            </Text>
            <Text as="p" size="lg" muted>
              Auditoria, coleta e análise de 55+ fontes abertas — com
              transparência de origem, status por item e fallback serpapi.

            </Text>
            <div className={styles.actions}>
              <Button onClick={onStart} size="lg">
                Explorar fontes
              </Button>
              <Button onClick={onSuggest} size="lg" variant="outline">
                Coletar no Suggest
              </Button>
            </div>
          </div>
          <div className={styles.panel}>
            <Text as="p" size="sm" muted>55+ fontes auditadas</Text>
            <Text as="p" size="xxl" weight="bold">18 implementadas</Text>
            <Text as="p" size="sm" muted>+ fallback serpapi para coberturas parciais</Text>
          </div>
        </div>
      </Container>
    </section>
  );
}
