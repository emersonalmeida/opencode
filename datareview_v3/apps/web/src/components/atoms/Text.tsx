import type { ElementType, ReactNode } from "react";

type TextProps = {
  children: ReactNode;
  as?: ElementType;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
  weight?: "normal" | "medium" | "bold";
  muted?: boolean;
  id?: string;
  className?: string;
};

const SIZE_MAP: Record<NonNullable<TextProps["size"]>, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-md",
  lg: "text-lg",
  xl: "text-xl",
  xxl: "text-xxl",
};

export function Text({
  children,
  as: Tag = "p",
  size = "md",
  weight,
  muted,
  id,
  className,
}: TextProps) {
  const classes: string[] = [SIZE_MAP[size]];
  if (muted) classes.push("text-muted");
  if (weight) classes.push("text-" + weight);
  if (className) classes.push(className);

  return (
    <Tag id={id} className={classes.join(" ")}>
      {children}
    </Tag>
  );
}
