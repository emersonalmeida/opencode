import { Badge } from "../atoms/Badge";
import { Progress } from "../atoms/Progress";
import { Text } from "../atoms/Text";
import styles from "./SourceRow.module.css";

type SourceRowProps = {
  name: string;
  status: string;
  category?: string;
  progress?: number;
};

export function SourceRow({ name, status, category, progress }: SourceRowProps) {
  return (
    <li className={styles.row}>
      <div className={styles.info}>
        <Text as="p" weight="medium">{name}</Text>
        <Text as="p" size="sm" muted>{category}</Text>
        <Badge>{status}</Badge>
      </div>
      {typeof progress === "number" ? (
        <Progress value={progress} label={`${progress}% coletado`} />
      ) : null}
    </li>
  );
}
