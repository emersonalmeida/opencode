import { useMemo } from "react";
import { Monitor, Tablet, Smartphone, Code } from "lucide-react";
import { useDesignStore } from "@/lib/designCanvas/store";
import { DEVICE_WIDTHS, type PageNode, type DeviceMode } from "@/lib/designCanvas/pageModel";
import { NodeBody } from "./DesignCanvasNode";
import type { DCNode } from "@/lib/designCanvas/types";

/**
 * Renderiza a página estruturada ativa como uma página REAL e responsiva
 * (não um grafo). Usado no modo de visualização "Preview". Sections/rows/
 * columns viram layout CSS grid; folhas de componente renderizam o NodeBody
 * vivo (componentes reais + dados reais).
 *
 * O frame de device (desktop/tablet/mobile) restringe a largura da página para
 * imitar o viewport alvo — como o device preview do Figma / breakpoints do Webflow.
 */

function RenderNode({
  node,
  nodeById,
  onSelect,
  selectedId,
}: {
  node: PageNode;
  nodeById: Map<string, DCNode>;
  onSelect: (id: string) => void;
  selectedId: string | null;
}) {
  if (node.kind === "component" && node.ref) {
    const dc = nodeById.get(node.ref);
    if (!dc) return <div className="text-[11px] text-muted-foreground italic">[componente removido]</div>;
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onSelect(dc.id); }}
        className={`rounded-md transition-all cursor-pointer ${selectedId === dc.id ? "ring-2 ring-primary/50" : "ring-1 ring-transparent hover:ring-primary/20"}`}
      >
        <NodeBody kind={dc.data.kind} props={dc.data.props as Record<string, unknown>} />
      </div>
    );
  }

  // Containers
  const gap = (node.gap ?? 16) as number;
  const cls = node.className ?? "";
  if (node.kind === "page") {
    return <div className={`flex flex-col w-full ${cls}`} style={{ gap }}>{node.children.map((c) => <RenderNode key={c.id} node={c} nodeById={nodeById} onSelect={onSelect} selectedId={selectedId} />)}</div>;
  }
  if (node.kind === "section") {
    return <div className={`flex flex-col w-full ${cls}`} style={{ gap }}>{node.children.length ? node.children.map((c) => <RenderNode key={c.id} node={c} nodeById={nodeById} onSelect={onSelect} selectedId={selectedId} />) : <EmptyDrop text="Seção vazia — arraste componentes aqui" />}</div>;
  }
  if (node.kind === "row") {
    // Responsive: stack on mobile, grid on >=sm. Columns use 12-col span.
    const cols = node.children.filter((c) => c.kind === "column");
    return (
      <div className={`grid w-full grid-cols-1 sm:grid-cols-12 ${cls}`} style={{ gap }}>
        {node.children.map((c) => {
          const span = (c.kind === "column" ? c.span ?? 6 : 12) as number;
          return (
            <div key={c.id} className={`sm:col-span-${span} col-span-12`} style={{ gridColumn: undefined }}>
              <RenderNode node={c} nodeById={nodeById} onSelect={onSelect} selectedId={selectedId} />
            </div>
          );
        })}
        {cols.length === 0 && <EmptyDrop text="Linha vazia" />}
      </div>
    );
  }
  if (node.kind === "column") {
    return (
      <div className={`flex flex-col w-full ${cls}`} style={{ gap }}>
        {node.children.length ? node.children.map((c) => <RenderNode key={c.id} node={c} nodeById={nodeById} onSelect={onSelect} selectedId={selectedId} />) : <EmptyDrop text="Coluna vazia — arraste componentes aqui" />}
      </div>
    );
  }
  if (node.kind === "stack") {
    return <div className={`flex flex-col w-full ${cls}`} style={{ gap }}>{node.children.map((c) => <RenderNode key={c.id} node={c} nodeById={nodeById} onSelect={onSelect} selectedId={selectedId} />)}</div>;
  }
  return null;
}

function EmptyDrop({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6 text-center text-[11px] text-muted-foreground">{text}</div>;
}

const DEVICE_META: Record<DeviceMode, { label: string; icon: typeof Monitor }> = {
  desktop: { label: "Desktop", icon: Monitor },
  tablet: { label: "Tablet", icon: Tablet },
  mobile: { label: "Mobile", icon: Smartphone },
};

export function DesignCanvasPreview() {
  const pages = useDesignStore((s) => s.pages);
  const activePageId = useDesignStore((s) => s.activePageId);
  const nodes = useDesignStore((s) => s.nodes);
  const device = useDesignStore((s) => s.device);
  const setDevice = useDesignStore((s) => s.setDevice);
  const selectedId = useDesignStore((s) => s.selectedId);
  const selectNode = useDesignStore((s) => s.selectNode);

  const page = useMemo(() => pages.find((p) => p.id === activePageId) ?? null, [pages, activePageId]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  if (!page) {
    return (
      <div className="h-full w-full flex items-center justify-center text-center p-6">
        <div className="max-w-sm">
          <div className="text-sm font-semibold mb-1">Nenhuma página</div>
          <p className="text-xs text-muted-foreground">Crie uma página ou carregue um template (Dashboard, Comparativo…) para visualizar.</p>
        </div>
      </div>
    );
  }

  const width = DEVICE_WIDTHS[device];
  const DevIcon = DEVICE_META[device].icon;

  return (
    <div className="h-full w-full flex flex-col bg-muted/30">
      {/* Device toolbar */}
      <div className="flex items-center gap-1 p-1.5 border-b border-border/60 bg-card/80 backdrop-blur">
        {(Object.keys(DEVICE_META) as DeviceMode[]).map((d) => {
          const M = DEVICE_META[d];
          const Ic = M.icon;
          return (
            <button key={d} onClick={() => setDevice(d)} aria-pressed={device === d}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] ${device === d ? "bg-primary/10 text-primary" : "hover:bg-secondary text-muted-foreground"}`}>
              <Ic className="h-3.5 w-3.5" /> {M.label}
            </button>
          );
        })}
        <div className="ml-2 text-[11px] text-muted-foreground flex items-center gap-1">
          <DevIcon className="h-3 w-3" /> {width}px
        </div>
        <div className="ml-auto text-[11px] text-muted-foreground truncate max-w-[200px]">{page.name} · v{page.version}</div>
      </div>

      {/* Device viewport */}
      <div className="flex-1 min-h-0 overflow-auto p-4 flex justify-center">
        <div
          className="bg-background rounded-xl shadow-lg border border-border/60 transition-all duration-200"
          style={{ width: `min(${width}px, 100%)`, maxWidth: "100%" }}
        >
          <div className="p-4">
            <RenderNode node={page.root} nodeById={nodeById} onSelect={(id) => selectNode(id)} selectedId={selectedId} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** The "Code" view: shows the serialized page JSON (export-friendly). */
export function DesignCanvasCode() {
  const pages = useDesignStore((s) => s.pages);
  const activePageId = useDesignStore((s) => s.activePageId);
  const page = useMemo(() => pages.find((p) => p.id === activePageId) ?? null, [pages, activePageId]);
  if (!page) return <div className="p-6 text-xs text-muted-foreground">Nenhuma página para exportar.</div>;
  const json = JSON.stringify(page, null, 2);
  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center gap-2 p-2 border-b border-border/60 bg-card/80">
        <Code className="h-4 w-4 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground">JSON da página (estrutura serializável) · copie para exportar/versionar.</span>
        <button
          onClick={() => navigator.clipboard?.writeText(json)}
          className="ml-auto text-[11px] px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20"
        >Copiar</button>
      </div>
      <pre className="flex-1 min-h-0 overflow-auto p-3 text-[11px] font-mono bg-muted/20"><code>{json}</code></pre>
    </div>
  );
}
