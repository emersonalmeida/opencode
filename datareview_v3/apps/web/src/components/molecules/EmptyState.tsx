import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Text } from "../atoms/Text";
import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ icon: Icon, title, description, action, compact }: EmptyStateProps) {
  return (
    <div role="status" className={`${styles.empty} ${compact ? styles.compact : ""}`}>
      <div className={styles.iconWrap}>
        <Icon className={styles.icon} aria-hidden="true" />
      </div>
      <div className={styles.copy}>
        <Text as="h3" weight="medium">{title}</Text>
        {description ? (
          <Text as="p" size="sm" muted>{description}</Text>
        ) : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}