import type { ReactNode } from "react";
import { Text } from "../atoms/Text";
import styles from "./SectionHeader.module.css";

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function SectionHeader({ eyebrow, title, description, actions, className = "" }: SectionHeaderProps) {
  return (
    <div className={`${styles.header} ${className}`}>
      <div className={styles.copy}>
        {eyebrow ? (
          <p className="eyebrow">{eyebrow}</p>
        ) : null}
        <Text as="h2" size="lg">{title}</Text>
        {description ? (
          <Text as="p" size="sm" muted>{description}</Text>
        ) : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
}