import type { ReactNode } from "react";
import styles from "./Card.module.css";

type CardProps = {
  children: ReactNode;
  as?: "article" | "div" | "li" | "section";
};

export function Card({ children, as: Tag = "article" }: CardProps) {
  return <Tag className={styles.card}>{children}</Tag>;
}
