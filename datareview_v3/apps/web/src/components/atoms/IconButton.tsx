import type { ReactNode } from "react";
import styles from "./IconButton.module.css";

type IconButtonProps = {
  children: ReactNode;
  label: string;
  onClick?: () => void;
};

export function IconButton({ children, label, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      className={styles.iconButton}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {children}
    </button>
  );
}