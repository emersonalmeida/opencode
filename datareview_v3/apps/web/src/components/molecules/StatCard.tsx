import type { ReactNode } from "react";
import { Card } from "../atoms/Card";
import { Text } from "../atoms/Text";
import styles from "./StatCard.module.css";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
};

export function StatCard({ label, value, hint, tone = "neutral" }: StatCardProps) {
  return (
    <Card>
      <div className={styles.stat}>
        <Text as="p" size="sm" muted>{label}</Text>
        <Text as="p" size="xxl" weight="bold">
          <span data-tone={tone}>{value}</span>
        </Text>
      </div>
      {hint ? <Text as="p" size="xs" muted>{hint}</Text> : null}
    </Card>
  );
}
