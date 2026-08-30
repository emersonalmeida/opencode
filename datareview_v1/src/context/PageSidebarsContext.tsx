/**
 * PageSidebarsContext — o mecanismo canônico de SIDEBARS INTERNAS (por página).
 *
 * Layout alvo do AppShell (5 slots, tudo recolhível/redimensionável):
 *
 *   [Externa Esq] [Interna Esq] [     CENTRO     ] [Interna Dir] [Externa Dir]
 *
 * - Sidebars EXTERNAS (sistema): LeftSidebar (navegação/dados/config) e
 *   AIAssistantPanel (IA/gráficos/artefatos) — as mesmas em TODAS as páginas.
 * - Sidebars INTERNAS (página): registradas pela página ativa via <PageSidebar>;
 *   o AppShell (PageSidebarHost) as renderiza entre o centro e a externa do
 *   mesmo lado, com o MESMO contrato visual das externas (CollapsibleColumn:
 *   recolhível p/ rail, redimensionável, clamp 25% do viewport, persistido).
 *   Esquerdas recolhem para a esquerda; direitas para a direita; o centro
 *   permanece central e fluido.
 *
 * Uma página registra até 1 sidebar interna por lado; se precisar de várias
 * áreas, use PageTabsSidebar (1 sidebar interna com ABAS internas + rail de
 * ícones). As externas são SEMPRE de conteúdo fixo: esquerda = menu de
 * páginas; direita = assistente de IA (Chat/Apps/Chats/Gráficos/Artefatos).
 *
 * A página registra metadados (efeito de mount) e renderiza o CONTEÚDO via
 * portal em containers montados pelo host — assim o conteúdo é sempre fresco
 * a cada render da página e o estado interno sobrevive a collapse/expand. Sem
 * provider (página renderizada isolada em testes), <PageSidebar> cai no
 * fallback inline — a página nunca quebra.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CollapsibleColumn } from "@/components/CollapsibleColumn";
import { RailHover } from "@/components/shared/RailHover";

export type PageSidebarSide = "left" | "right";

/** Metadados estáticos da sidebar interna (registrados uma vez por id). */
export interface PageSidebarMeta {
  id: string;
  side: PageSidebarSide;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  /** localStorage prefix (width + collapsed) — preserva preferências. */
  storageKey: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
  defaultCollapsed?: boolean;
  headerRight?: ReactNode;
  /**
   * Conteúdo do FLYOUT no hover do rail (sidebar recolhida).
   * `undefined` (default) = usa o próprio `content` da sidebar (peek real);
   * `null` = desativa (ex.: PageTabsSidebar, que tem flyout por aba).
   */
  railFlyout?: ReactNode | null;
}

export interface PageSidebarDef extends PageSidebarMeta {
  /** Corpo da coluna (renderizado via portal pelo próprio page component). */
  content: ReactNode;
  /** Ações rápidas exibidas no rail quando recolhida (ex.: trocar de aba). */
  railIcons?: ReactNode;
}

interface PageSidebarsState {
  defs: Record<string, PageSidebarMeta>;
  containers: Record<string, { body: HTMLElement | null; rail: HTMLElement | null }>;
  register: (meta: PageSidebarMeta) => void;
  unregister: (id: string) => void;
  setContainer: (id: string, kind: "body" | "rail", el: HTMLElement | null) => void;
}

const Ctx = createContext<PageSidebarsState | null>(null);

export function PageSidebarsProvider({ children }: { children: ReactNode }) {
  const [defs, setDefs] = useState<Record<string, PageSidebarMeta>>({});
  const [containers, setContainers] = useState<Record<string, { body: HTMLElement | null; rail: HTMLElement | null }>>({});

  const register = useCallback((meta: PageSidebarMeta) => {
    setDefs((prev) => (prev[meta.id] ? prev : { ...prev, [meta.id]: meta }));
  }, []);
  const unregister = useCallback((id: string) => {
    setDefs((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setContainers((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);
  const setContainer = useCallback((id: string, kind: "body" | "rail", el: HTMLElement | null) => {
    setContainers((prev) => {
      const cur = prev[id] ?? { body: null, rail: null };
      if (cur[kind] === el) return prev;
      return { ...prev, [id]: { ...cur, [kind]: el } };
    });
  }, []);

  const value = useMemo<PageSidebarsState>(
    () => ({ defs, containers, register, unregister, setContainer }),
    [defs, containers, register, unregister, setContainer],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePageSidebars(): PageSidebarsState | null {
  return useContext(Ctx);
}

/** Ref-callback estável por (id,kind) — mesmo gotcha do SidebarTabsContext:
 *  ref inline muda de identidade a cada render e causa loop (React #185). */
function useStableContainerRef() {
  const ctx = useContext(Ctx);
  const cache = useRef(new Map<string, (el: HTMLElement | null) => void>());
  return useCallback(
    (id: string, kind: "body" | "rail") => {
      const key = `${id}:${kind}`;
      let fn = cache.current.get(key);
      if (!fn) {
        fn = (el) => ctx?.setContainer(id, kind, el);
        cache.current.set(key, fn);
      }
      return fn;
    },
    [ctx],
  );
}

export interface PageSidebarTargets {
  body: HTMLElement | null;
  rail: HTMLElement | null;
}

/**
 * Registra a sidebar interna da página (metadados, efeito de mount) e retorna
 * os containers (body/rail) montados pelo host do shell. `null` fora do shell.
 */
export function usePageSidebar(meta: PageSidebarMeta): PageSidebarTargets | null {
  const ctx = useContext(Ctx);
  const id = meta.id;
  const side = meta.side;
  // Deps NÃO podem incluir `ctx` — ele muda a cada register/unregister e
  // causaria loop (cleanup unregister → ctx novo → register → …). Os callbacks
  // register/unregister são estáveis (useCallback), então bastam id/side.
  useEffect(() => {
    if (!ctx) return;
    ctx.register(meta);
    return () => ctx.unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, side, !!ctx]);
  if (!ctx) return null;
  return ctx.containers[id] ?? { body: null, rail: null };
}

type PageSidebarProps =
  | (PageSidebarDef & { children?: ReactNode })
  | { meta: PageSidebarMeta & { railIcons?: ReactNode }; children?: ReactNode };

/**
 * Declara a sidebar interna da página. Renderiza `content` e `railIcons` via
 * portal na coluna do shell; sem shell, renderiza o conteúdo inline (fallback).
 * Aceita os dois formatos: flat (`content=…`) ou `{meta}…children</PageSidebar>`.
 */
export function PageSidebar(props: PageSidebarProps) {
  const def: PageSidebarDef =
    "meta" in props
      ? ({
          ...props.meta,
          content: props.children ?? ("content" in props ? props.content : undefined),
          railIcons: props.meta.railIcons,
        } as PageSidebarDef)
      : props;
  const targets = usePageSidebar(def);
  if (!targets) {
    return (
      <div className="h-full min-h-0 flex flex-col bg-card/40" data-page-sidebar={def.id}>
        {def.content}
      </div>
    );
  }
  // Flyout no hover do rail: sidebars flat (sem abas) mostram o PRÓPRIO
  // conteúdo num painel flutuante — o usuário usa o recurso sem expandir.
  // (Recolhida, o body não está montado — sem risco de montagem duplicada.)
  const flyout = def.railFlyout === null ? undefined : (def.railFlyout ?? def.content);
  const rail = def.railIcons ? (
    flyout ? (
      <RailHover
        trigger={<span className="flex flex-col items-center gap-2">{def.railIcons}</span>}
        label={typeof def.title === "string" ? def.title : "Painel"}
        icon={def.icon}
        description={typeof def.subtitle === "string" ? def.subtitle : undefined}
        content={flyout}
        side={def.side === "right" ? "left" : "right"}
        width={400}
      />
    ) : (
      def.railIcons
    )
  ) : null;
  return (
    <>
      {targets.body && createPortal(def.content, targets.body)}
      {targets.rail && rail ? createPortal(rail, targets.rail) : null}
    </>
  );
}

/**
 * Host da sidebar interna de um lado — montado pelo AppShell ENTRE o centro e
 * a sidebar externa. Nada registrado → não ocupa espaço (centro fluido).
 */
export function PageSidebarHost({ side, fill = false }: { side: PageSidebarSide; fill?: boolean }) {
  const ctx = usePageSidebars();
  const def = useMemo(() => {
    if (!ctx) return null;
    const all = Object.values(ctx.defs).filter((d) => d.side === side);
    return all[all.length - 1] ?? null;
  }, [ctx, side]);
  const getRef = useStableContainerRef();

  if (!ctx || !def) return null;
  return (
    <CollapsibleColumn
      side={def.side}
      storageKey={def.storageKey}
      defaultWidth={def.defaultWidth}
      minWidth={def.minWidth}
      maxWidth={def.maxWidth}
      defaultCollapsed={def.defaultCollapsed}
      fill={fill}
      title={def.title}
      subtitle={def.subtitle}
      icon={def.icon}
      headerRight={def.headerRight}
      railIcons={<div ref={getRef(def.id, "rail")} className="contents" />}
    >
      <div ref={getRef(def.id, "body")} className="h-full min-h-0" />
    </CollapsibleColumn>
  );
}
