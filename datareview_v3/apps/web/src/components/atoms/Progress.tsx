import styles from "./Progress.module.css";

type ProgressProps = {
  value: number;
  max?: number;
  label?: string;
};

export function Progress({ value, max = 100, label }: ProgressProps) {
  const raw = (value / max) * 100;
  const pct = Math.min(100, Math.max(0, raw));
  return (
    <div className={styles.wrap}>
      {label ? <span className={styles.label}>{label}</span> : null}
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={label ?? "Progresso"}
      >
        <div className={styles.bar} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

