import { memo, useState } from "react";
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react";
import { Copy, Trash2, GripVertical, Play } from "lucide-react";
import { resolveMeta } from "@/lib/designCanvas/registry";
import { useDesignStore, type DCNode } from "@/lib/designCanvas/store";
import { resolveDataSource, isDataOrganism } from "@/lib/designCanvas/dataBinding";
import { useDataset } from "@/hooks/useDataset";
import { useSelection } from "@/context/SelectionContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AggregateRatingChart, AggregateSentimentChart, AggregateTimelineChart, StoreComparisonChart, KpiCard, PerAppRow } from "@/components/dashboard/DashboardCharts";
import { WordCloud } from "@/components/WordCloud";
import { ReviewsList } from "@/components/ReviewsList";
import { AppCard } from "@/components/AppCard";
import { AIOutputCard } from "@/components/shared/AIOutputCard";
import { computeKPIs, computeRatingDistribution, computeSentiment, computeTimeline, computeStoreComparison, computeWordCloud, computePerAppStats, type ReviewReviewWithContext } from "@/lib/dashboardAnalytics";
import { streamExperiment } from "@/lib/experimentApi";
import { isAIEnabled, useAISettings } from "@/lib/aiSettings";
import { AIDisabledNotice } from "@/components/shared/AIDisabledNotice";

/**
 * Renderiza um nó no design canvas. O corpo renderiza o componente REAL
 * (de src/components/ui/*) com as props vivas do nó — o usuário vê um preview
 * autêntico e editável, como os live components do Figma. Organismos de dados
 * (gráficos, tabelas, reviews) vinculam ao dataset coletado real, então os
 * previews são funcionais. Handles permitem conectar fluxos de protótipo
 * (edges) entre nós.
 */

/** Empty-state shown by data organisms when their source has no data. */
function DataEmpty({ label }: { label: string }) {
  return (
    <div className="w-full rounded-lg border border-dashed border-border/70 bg-muted/20 p-4 text-center text-[11px] text-muted-foreground">
      Sem dados para “{label}”. Colete/selecione apps para ver dados reais aqui.
    </div>
  );
}

/** Hook: resolve a data source for the current node from the live dataset. */
function useBoundData(dataSource: unknown) {
  const { entries } = useDataset();
  const { selected } = useSelection();
  return resolveDataSource(dataSource as string | undefined, entries, selected);
}

/** The AI analysis node body — generates + streams a section on demand. */
function AIAnalysisBody({ section, dataSource }: { section: string; dataSource: string }) {
  const ai = useAISettings();
  const { entries, empty, label } = useBoundData(dataSource);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!isAIEnabled(ai)) {
    return <AIDisabledNotice compact />;
  }
  if (empty) return <DataEmpty label={label} />;

  const run = () => {
    setBusy(true); setErr(null); setContent("");
    streamExperiment(section, entries, {
      onToken: (full) => setContent(full),
      onDone: (full) => { setContent(full); setBusy(false); },
      onError: (e) => { setErr(e); setBusy(false); },
    }, undefined, ai);
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-7 text-[11px]" onClick={run} disabled={busy}>
          {busy ? "Gerando…" : "Gerar análise"}
        </Button>
        <Badge variant="secondary" className="text-[10px]">{section}</Badge>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      {err && <Alert variant="destructive"><AlertDescription className="text-[11px]">{err}</AlertDescription></Alert>}
      {content ? (
        <div className="rounded-md border border-border/60 p-2 relative">
          <AIOutputCard bare content={content} filename="design-analise" streaming={busy} onRegenerate={run} />
        </div>
      ) : !busy && (
        <div className="text-[11px] text-muted-foreground p-2">Clique em “Gerar análise” para produzir a seção <b>{section}</b> com IA sobre os apps vinculados.</div>
      )}
    </div>
  );
}

/** Wrap a data organism so the hook is always called at the top level. */
function DataOrganism({ kind, props }: { kind: string; props: Record<string, unknown> }) {
  const { entries, reviews, label, empty } = useBoundData(props.dataSource);
  if (kind === "kpi-card") {
    if (empty) return <DataEmpty label={label} />;
    const kpis = computeKPIs(reviews, entries);
    const value = (kpis as unknown as Record<string, number>)[(props.metric as string) ?? "totalReviews"] ?? 0;
    return <KpiCard label={props.title as string} value={value} sub={label} icon={resolveMeta("kpi-card").icon} accent="primary" />;
  }
  if (kind === "rating-chart") {
    if (empty) return <DataEmpty label={label} />;
    return <div className="w-full h-[200px]"><AggregateRatingChart data={computeRatingDistribution(reviews)} /></div>;
  }
  if (kind === "sentiment-chart") {
    if (empty) return <DataEmpty label={label} />;
    return <div className="w-full h-[200px]"><AggregateSentimentChart data={computeSentiment(reviews)} /></div>;
  }
  if (kind === "timeline-chart") {
    if (empty) return <DataEmpty label={label} />;
    const tl = computeTimeline(reviews);
    return tl.length ? <div className="w-full h-[220px]"><AggregateTimelineChart data={tl} /></div> : <DataEmpty label={label} />;
  }
  if (kind === "store-comparison") {
    if (empty) return <DataEmpty label={label} />;
    return <div className="w-full h-[220px]"><StoreComparisonChart data={computeStoreComparison(entries)} /></div>;
  }
  if (kind === "word-cloud") {
    if (empty) return <DataEmpty label={label} />;
    return <WordCloud reviews={reviews} />;
  }
  if (kind === "reviews-list") {
    if (empty) return <DataEmpty label={label} />;
    return <ReviewsList reviews={reviews.slice(0, (props.limit as number) ?? 10)} />;
  }
  if (kind === "app-card") {
    if (empty) return <DataEmpty label={label} />;
    const app = entries[(props.index as number) ?? 0]?.app;
    if (!app) return <DataEmpty label={label} />;
    return <AppCard app={app} isSelected={false} onClick={() => {}} />;
  }
  if (kind === "per-app-table") {
    if (empty) return <DataEmpty label={label} />;
    const stats = computePerAppStats(entries);
    return (
      <Table>
        <TableHeader><TableRow>{["App", "Loja", "Nota", "Reviews", "Nota coleta", "% Pos"].map((h) => <TableHead key={h} className="text-[11px]">{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {stats.map((s) => (
            <TableRow key={s.key}>
              <TableCell className="text-xs"><div className="flex items-center gap-2"><img src={s.icon} alt="" className="w-5 h-5 rounded" /><span className="truncate max-w-[120px]">{s.name}</span></div></TableCell>
              <TableCell className="text-xs">{s.store}</TableCell>
              <TableCell className="text-xs font-semibold">{s.rating?.toFixed(1) ?? "—"}</TableCell>
              <TableCell className="text-xs">{s.reviewCount}</TableCell>
              <TableCell className="text-xs font-semibold">{s.avgCollected?.toFixed(2) ?? "—"}</TableCell>
              <TableCell className="text-xs">{s.positivePct}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  return null;
}

export function NodeBody({ kind, props }: { kind: string; props: Record<string, unknown> }) {
  const children = props.children as string | undefined;
  // Data organisms delegate to DataOrganism (hooks at top level).
  if (kind === "ai-analysis") {
    return <AIAnalysisBody section={(props.section as string) || "summary"} dataSource={(props.dataSource as string) || "selected"} />;
  }
  if (isDataOrganism(kind)) {
    return <DataOrganism kind={kind} props={props} />;
  }
  switch (kind) {
    case "button":
      return <Button variant={props.variant as never} size={props.size as never} disabled={props.disabled as boolean}>{children}</Button>;
    case "badge":
      return <Badge variant={props.variant as never}>{children}</Badge>;
    case "input":
      return <Input placeholder={props.placeholder as string} type={props.type as string} disabled={props.disabled as boolean} />;
    case "textarea":
      return <Textarea placeholder={props.placeholder as string} rows={props.rows as number} />;
    case "switch":
      return (
        <div className="flex items-center gap-2">
          <Switch checked={props.checked as boolean} disabled={props.disabled as boolean} />
          <span className="text-xs text-muted-foreground">{props.checked ? "on" : "off"}</span>
        </div>
      );
    case "checkbox":
      return (
        <div className="flex items-center gap-2">
          <Checkbox checked={props.checked as boolean} disabled={props.disabled as boolean} />
          <Label className="text-xs">{props.label as string}</Label>
        </div>
      );
    case "select":
      return (
        <Select>
          <SelectTrigger className="w-full"><SelectValue placeholder={props.placeholder as string} /></SelectTrigger>
          <SelectContent>
            {String(props.options ?? "").split(",").map((o, i) => (
              <SelectItem key={i} value={o.trim()}>{o.trim()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "label":
      return <Label>{children}</Label>;
    case "separator":
      return <Separator orientation={props.orientation as never} />;
    case "progress":
      return <Progress value={props.value as number} className="w-full" />;
    case "skeleton":
      return <Skeleton className="w-full" style={{ height: `${props.height as number}px` }} />;
    case "slider":
      return <Slider defaultValue={[props.value as number]} max={100} step={1} className="w-full" />;
    case "avatar":
      return <Avatar className="h-12 w-12"><AvatarFallback>{props.initials as string}</AvatarFallback></Avatar>;
    case "toggle-group": {
      const opts = String(props.options ?? "").split(",").map((o) => o.trim()).filter(Boolean);
      return (
        <ToggleGroup type="single" defaultValue={props.value as string} className="justify-start">
          {opts.map((o) => <ToggleGroupItem key={o} value={o}>{o}</ToggleGroupItem>)}
        </ToggleGroup>
      );
    }
    case "tooltip":
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild><span className="text-xs underline decoration-dotted cursor-help">{props.trigger as string}</span></TooltipTrigger>
            <TooltipContent>{props.content as string}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case "breadcrumb": {
      const items = String(props.items ?? "").split(",").map((o) => o.trim()).filter(Boolean);
      return (
        <Breadcrumb>
          <BreadcrumbList>
            {items.map((it, i) => (
              <span key={i} className="flex items-center">
                <BreadcrumbItem><BreadcrumbLink>{it}</BreadcrumbLink></BreadcrumbItem>
                {i < items.length - 1 && <BreadcrumbSeparator />}
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      );
    }
    case "pagination":
      return (
        <Pagination>
          <PaginationContent>
            <PaginationItem><PaginationPrevious /></PaginationItem>
            <PaginationItem><span className="text-xs px-2">{String(props.page)}/{String(props.pages)}</span></PaginationItem>
            <PaginationItem><PaginationNext /></PaginationItem>
          </PaginationContent>
        </Pagination>
      );
    case "calendar":
      return <div className="flex justify-center"><Calendar mode="single" className="rounded-md border" /></div>;
    case "dialog":
      return (
        <Dialog>
          <DialogTrigger asChild><Button size="sm">{props.trigger as string}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{props.title as string}</DialogTitle><DialogDescription>{props.description as string}</DialogDescription></DialogHeader>
          </DialogContent>
        </Dialog>
      );
    case "accordion": {
      const items = String(props.items ?? "").split("|").map((s) => s.split(":"));
      return (
        <Accordion type="single" className="w-full">
          {items.map((it, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger className="text-xs">{it[0]}</AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground">{it[1]}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      );
    }
    case "tabs": {
      const tabs = String(props.tabs ?? "").split(",").map((o) => o.trim()).filter(Boolean);
      const active = (props.active as string) || tabs[0] || "";
      return (
        <Tabs defaultValue={active} className="w-full">
          <TabsList className="w-full justify-start">
            {tabs.map((t) => <TabsTrigger key={t} value={t}>{t}</TabsTrigger>)}
          </TabsList>
          <TabsContent value={active} className="text-xs text-muted-foreground mt-2">{props.content as string}</TabsContent>
        </Tabs>
      );
    }
    case "table": {
      const headers = String(props.headers ?? "").split(",").map((h) => h.trim()).filter(Boolean);
      const rows = String(props.rows ?? "").split("|").map((r) => r.split(",").map((c) => c.trim()));
      return (
        <Table>
          <TableHeader><TableRow>{headers.map((h, i) => <TableHead key={i}>{h}</TableHead>)}</TableRow></TableHeader>
          <TableBody>
            {rows.map((cells, ri) => (
              <TableRow key={ri}>{headers.map((_, ci) => <TableCell key={ci} className="text-xs">{cells[ci] ?? ""}</TableCell>)}</TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }
    case "image": {
      const src = props.src as string;
      const ratio = parseFloat(props.ratio as string) || 1.777;
      if (!src) return <div className="w-full rounded-md border border-dashed border-border/60 p-6 text-center text-[11px] text-muted-foreground">Sem imagem (URL vazia)</div>;
      return (
        <div className="w-full overflow-hidden rounded-md border border-border/60">
          <AspectRatio ratio={ratio}>
            <img src={src} alt={props.alt as string} className="w-full h-full object-cover" />
          </AspectRatio>
        </div>
      );
    }
    case "alert":
      return (
        <Alert variant={props.variant as never}>
          <AlertTitle>{props.title as string}</AlertTitle>
          <AlertDescription>{props.description as string}</AlertDescription>
        </Alert>
      );
    case "card":
      return (
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="text-sm">{props.title as string}</CardTitle>
            <CardDescription className="text-xs">{props.description as string}</CardDescription>
          </CardHeader>
          <CardContent><p className="text-xs text-muted-foreground">{props.content as string}</p></CardContent>
          <CardFooter className="text-xs text-muted-foreground">{props.footer as string}</CardFooter>
        </Card>
      );
    case "markdown":
      return (
        <div className="w-full rounded-md border border-border/60 p-2 relative">
          <AIOutputCard bare content={props.content as string} filename="design-markdown" />
        </div>
      );
    case "columns2":
      return (
        <div className="grid grid-cols-2 gap-3 w-full">
          <div className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground min-h-[60px]">{props.left as string}</div>
          <div className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground min-h-[60px]">{props.right as string}</div>
        </div>
      );
    case "section":
      return <div className="w-full rounded-md border border-dashed border-border/50 p-3 text-[11px] text-muted-foreground">Seção (gap {props.gap as number}px)</div>;
    case "row":
      return <div className="w-full rounded-md border border-dashed border-border/50 p-3 text-[11px] text-muted-foreground">Linha (gap {props.gap as number}px)</div>;
    case "pageframe":
      return (
        <div className="rounded-lg border border-border/70 w-full overflow-hidden">
          <div className="border-b border-border/50 px-3 py-2 bg-muted/40">
            <div className="text-sm font-semibold">{props.title as string}</div>
            <div className="text-[11px] text-muted-foreground">{props.subtitle as string}</div>
          </div>
          <div className="p-3 min-h-[80px] text-xs text-muted-foreground/70">Conteúdo da página…</div>
        </div>
      );

    case "note":
      return (
        <div className="rounded-md bg-yellow-500/10 border border-yellow-500/30 p-3 text-xs text-foreground/90 whitespace-pre-wrap">
          {props.text as string}
        </div>
      );
    default:
      return <div className="text-xs text-muted-foreground">Componente desconhecido</div>;
  }
}

export const DesignCanvasNode = memo(function DesignCanvasNode({ id, data, selected }: NodeProps) {
  const meta = resolveMeta((data as DCNode["data"]).kind);
  const width = ((data as DCNode["data"]).width as number) ?? meta.defaultWidth ?? 220;
  const updateNodeSize = useDesignStore((s) => s.updateNodeSize);
  const removeNode = useDesignStore((s) => s.removeNode);
  const duplicateNode = useDesignStore((s) => s.duplicateNode);
  const Icon = meta.icon;

  return (
    <div
      style={{ width }}
      className={`relative rounded-xl border bg-card shadow-sm transition-shadow ${
        selected ? "border-primary ring-2 ring-primary/30 shadow-md" : "border-border/70"
      }`}
    >
      {selected && (
        <NodeResizer
          minWidth={140}
          maxWidth={760}
          isVisible={selected}
          onResize={(_, dims) => updateNodeSize(id, dims.width)}
          lineClassName="!border-primary/40"
          handleClassName="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background !rounded-full"
        />
      )}
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !bg-muted-foreground/60 !border-2 !border-card" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !bg-muted-foreground/60 !border-2 !border-card" />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium flex-1 truncate">{(data as DCNode["data"]).label || meta.label}</span>
        <span className="text-[9px] uppercase tracking-wide text-muted-foreground/70">{meta.layer}</span>
        <button
          onClick={() => duplicateNode(id)}
          className="text-muted-foreground hover:text-primary rounded p-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          title="Duplicar"
          aria-label={`Duplicar ${meta.label}`}
        ><Copy className="h-3 w-3" /></button>
        <button
          onClick={() => removeNode(id)}
          className="text-muted-foreground hover:text-destructive rounded p-0.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50"
          title="Excluir"
          aria-label={`Excluir ${meta.label}`}
        ><Trash2 className="h-3 w-3" /></button>
      </div>

      {/* Live component preview */}
      <div className="p-3 flex items-start justify-center min-h-[40px]">
        <div className="w-full pointer-events-none select-none">
          <NodeBody kind={meta.kind} props={(data as DCNode["data"]).props as Record<string, unknown>} />
        </div>
      </div>

      {/* Resize hint footer */}
      <div className="flex items-center justify-center gap-1 px-2 pb-1.5 text-[9px] text-muted-foreground/50">
        <GripVertical className="h-2.5 w-2.5" /> arraste a borda p/ redimensionar
      </div>
    </div>
  );
});
