/**
 * GitCommandPalette — busca + ações (spec §5/§35).
 *
 * ⌘K/Ctrl+K abre. Filtra COMANDOS (agrupados) e OBJETOS DO CANVAS (foco).
 * Ações que não podem executar de verdade ficam desabilitadas com a razão
 * honesta ao lado (§51) + equivalente Git (§43) + explicação humana (§46).
 */
import { useMemo, useState } from "react";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Ban, Crosshair } from "lucide-react";
import {
  COMMAND_GROUPS, GIT_COMMANDS, filterCommands, resolveCommand, type GitCommand,
} from "@/lib/gitCanvas/commands";
import { buildSearchIndex, searchGraph, type GitCanvasNode } from "@/lib/gitCanvas/graph";
import { KIND_LABEL } from "./GitObjectNode";
import type { ProjectMap } from "@/lib/gitCanvas/types";

export interface GitCommandPaletteProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  map: ProjectMap | null;
  nodes: GitCanvasNode[];
  onRunCommand(cmd: GitCommand): void;
  onFocusNode(nodeId: string): void;
}

export function GitCommandPalette({ open, onOpenChange, map, nodes, onRunCommand, onFocusNode }: GitCommandPaletteProps) {
  const [query, setQuery] = useState("");

  const resolved = useMemo(() => {
    const filtered = filterCommands(GIT_COMMANDS, query);
    return filtered.map((c) => resolveCommand(c, map));
  }, [query, map]);

  const objectHits = useMemo(() => {
    if (query.trim().length < 2) return [];
    return searchGraph(buildSearchIndex({ nodes, edges: [] }), query);
  }, [nodes, query]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar ação, arquivo, commit, branch, PR, agente…"
        value={query}
        onValueChange={setQuery}
        aria-label="Buscar comandos e objetos"
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>Nenhum resultado — tente outro termo.</CommandEmpty>

        {objectHits.length > 0 && (
          <CommandGroup heading="Objetos do canvas">
            {objectHits.map((h) => (
              <CommandItem
                key={h.nodeId}
                value={`obj:${h.nodeId}`}
                onSelect={() => {
                  onFocusNode(h.nodeId);
                  onOpenChange(false);
                }}
                className="gap-2"
              >
                <Crosshair className="h-3.5 w-3.5 text-primary" />
                <span className="flex-1 truncate">{h.label}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{KIND_LABEL[h.kind]}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {COMMAND_GROUPS.map((g) => {
          const items = resolved.filter((c) => c.group === g.id);
          if (!items.length) return null;
          return (
            <CommandGroup key={g.id} heading={g.label}>
              {items.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  disabled={!c.available}
                  onSelect={() => {
                    if (!c.available) return;
                    onRunCommand(c);
                    onOpenChange(false);
                  }}
                  className="gap-2 aria-disabled:opacity-60"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13px]">{c.label}</span>
                      {!c.available && <Ban className="h-3 w-3 shrink-0 text-amber-500" />}
                    </span>
                    {c.available && c.description && (
                      <span className="truncate text-[11px] text-muted-foreground">{c.description}</span>
                    )}
                    {!c.available && c.reason && (
                      <span className="truncate text-[11px] text-amber-600 dark:text-amber-400">{c.reason}</span>
                    )}
                  </span>
                  {c.gitEquivalent && (
                    <code className="hidden shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
                      {c.gitEquivalent}
                    </code>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}


