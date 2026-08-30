import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import styles from "./Feedback.module.css";

export function LiveStatus({ message }: { message: string }) {
  return (
    <p role="status" aria-live="polite" className={styles.liveStatus}>
      {message}
    </p>
  );
}

export function BusyIndicator({ label }: { label: string }) {
  return (
    <span role="status" className={styles.busy}>
      <Loader2 className={styles.spinner} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

type ErrorBoxProps = {
  message: string;
  hint?: string;
  onRetry?: () => void;
};

export function ErrorBox({ message, hint, onRetry }: ErrorBoxProps) {
  return (
    <div role="alert" className={styles.errorBox}>
      <AlertCircle className={styles.errorIcon} aria-hidden="true" />
      <div className={styles.errorCopy}>
        <p className={styles.errorMessage}>{message}</p>
        {hint ? <p className={styles.errorHint}>{hint}</p> : null}
      </div>
      {onRetry ? (
        <button type="button" className={styles.retry} onClick={onRetry}>
          <RefreshCw className={styles.retryIcon} aria-hidden="true" /> Tentar novamente
        </button>
      ) : null}
    </div>
  );
}