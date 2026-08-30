import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  as?: "div" | "section" | "header" | "footer" | "main" | "nav";
  size?: "sm" | "md" | "lg";
  id?: string;
  className?: string;
};

const SIZE = { sm: "container-sm", md: "container", lg: "container-lg" };

export function Container({ children, as: Tag = "div", size = "md", id, className }: ContainerProps) {
  return (
    <Tag id={id} className={[SIZE[size], className].filter(Boolean).join(" ")}>
      {children}
    </Tag>
  );
}
