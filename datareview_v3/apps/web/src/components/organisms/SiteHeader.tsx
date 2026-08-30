import { Moon, Sun } from "lucide-react";
import { Text } from "../atoms/Text";
import { Container } from "../atoms/Container";
import styles from "./SiteHeader.module.css";

type SiteHeaderProps = {
  onToggleTheme: () => void;
  theme: "light" | "dark";
};

export function SiteHeader({ onToggleTheme, theme }: SiteHeaderProps) {
  const label = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
  return (
    <header className={styles.header}>
      <Container as="div">
        <div className={styles.inner}>
          <a className={styles.brand} href="#main">
            <Text as="span" size="lg" weight="bold">datareview</Text>
            <Text as="span" size="xs" muted>v3</Text>
          </a>
          <nav aria-label="Principal">
            <ul className={styles.nav}>
              <li><a href="#fontes">Fontes</a></li>
              <li><a href="#como-funciona">Como funciona</a></li>
              <li><a href="#/design-system">Design System</a></li>
            </ul>
          </nav>
          <button type="button" className={styles.themeToggle} onClick={onToggleTheme} aria-label={label} title={label}>
            {theme === "dark" ? <Sun className={styles.themeIcon} aria-hidden="true" /> : <Moon className={styles.themeIcon} aria-hidden="true" />}
          </button>
        </div>
      </Container>
    </header>
  );
}
