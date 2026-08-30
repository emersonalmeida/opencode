/**
 * FeatureModal — hospeda QUALQUER componente do sistema num modal (Radix
 * Dialog), para situações em que o usuário precisa usar um recurso SEM sair
 * da página atual (ex.: ajustar a IA no meio de uma análise, ver o mapa do
 * fluxo de dados durante um pipeline).
 *
 * Padroniza: título/descrição, tamanhos, fechamento por Esc/fora/botão,
 * scroll interno e a11y (o Radix cuida do focus trap).
 */
import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type FeatureModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<FeatureModalSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-2xl",
  lg: "sm:max-w-4xl",
  xl: "sm:max-w-6xl",
};

export interface FeatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  size?: FeatureModalSize;
  /** Conteúdo do recurso (componente do sistema). */
  children: ReactNode;
  className?: string;
}

export function FeatureModal({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  children,
  className,
}: FeatureModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("flex max-h-[85vh] flex-col overflow-hidden", SIZE_CLASS[size], className)}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook de conveniência: estado open + helpers openModal/closeModal.
 */
export function useFeatureModal() {
  const [open, setOpen] = useState(false);
  return { open, setOpen, openModal: () => setOpen(true), closeModal: () => setOpen(false) };
}
