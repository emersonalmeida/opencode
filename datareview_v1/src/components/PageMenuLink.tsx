import { NavLink } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { pageNumber, type PageItem } from "@/lib/pages";

interface Props {
  page: PageItem;
  active: boolean;
  /** Callback ao clicar (ex.: limpar busca do menu). */
  onClick?: () => void;
  className?: string;
}

/**
 * Link de página do menu lateral. Itens com `external: true` (outro app na
 * mesma origem, ex.: /frontend-starter/) viram <a href> com reload completo
 * — o roteador interno não conhece essas rotas (cairia no 404 do SPA).
 */
export function PageMenuLink({ page: p, active, onClick, className }: Props) {
  const Icon = p.icon;
  const cls = `flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"} ${className ?? ""}`;
  const inner = (
    <>
      <span className="w-6 shrink-0 text-[9px] font-medium tabular-nums text-muted-foreground/60">{pageNumber(p.path)}</span>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{p.label}</span>
      {p.external && <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/50" />}
    </>
  );
  if (p.external) {
    return (
      <a key={p.path} href={p.path} title={p.desc} onClick={onClick} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <NavLink key={p.path} to={p.path} end={p.path === "/"} title={p.desc} onClick={onClick} className={cls}>
      {inner}
    </NavLink>
  );
}
