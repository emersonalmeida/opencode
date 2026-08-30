/**
 * Suggest — painel de parâmetros: termo, dimensões da fonte (região/idioma/
 * vertical/cliente) e grupos de expansão com orçamento de sondas ao vivo.
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  buildSeeds, CLIENTS, EXPANSION_GROUPS, LANGS, REGIONS, VERTICALS,
  type SuggestSeed, type SuggestVertical,
} from "@/lib/suggest/suggestCore";
import type { SuggestClient, GatherCombo } from "@/lib/suggest/suggestApi";
import { Loader2, Play, Square } from "lucide-react";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs font-medium">
        {label}
        {hint && <span className="ml-1 font-normal opacity-70">({hint})</span>}
      </span>
      {children}
    </div>
  );
}

function ToggleGroup<T extends string>({
  options, selected, onToggle, label,
}: {
  options: { id: T; label: string }[];
  selected: T[];
  onToggle: (id: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={selected.includes(o.id)}
          onClick={() => onToggle(o.id)}
          className={cn(
            "rounded-md border px-2 py-1 text-xs transition-colors",
            selected.includes(o.id)
              ? "border-primary/40 bg-primary/10 text-primary"
              : "hover:bg-muted",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function toggle<T>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

export interface SuggestParamsValue {
  regions: string[];
  lang: string;
  client: SuggestClient;
  verticals: SuggestVertical[];
  groupIds: string[];
  limit: number;
}

interface Props {
  term: string;
  onTermChange: (term: string) => void;
  value: SuggestParamsValue;
  onChange: (next: Partial<SuggestParamsValue>) => void;
  running: boolean;
  onRun: () => void;
  onStop: () => void;
  unused?: never;
}

export function computeCombos(value: SuggestParamsValue): GatherCombo[] {
  const combos: GatherCombo[] = [];
  for (const region of value.regions) {
    for (const vertical of value.verticals) {
      combos.push({ region, vertical });
    }
  }
  return combos;
}

export function SuggestParams({ term, onTermChange, value, onChange, running, onRun, onStop }: Props) {
  const seeds = useMemo(
    () => buildSeeds(term, EXPANSION_GROUPS.filter((g) => value.groupIds.includes(g.id))),
    [term, value.groupIds],
  );
  const combos = useMemo(() => computeCombos(value), [value]);
  const requests = seeds.length * combos.length;
  const disabled = !term.trim() || !seeds.length || !combos.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Termo de pesquisa">
          <Input
            value={term}
            onChange={(e) => onTermChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !running && !disabled && onRun()}
            placeholder="ex.: inteligência artificial"
            className="w-72"
            aria-label="Termo de pesquisa"
          />
        </Field>
        <Field label="Idioma (hl)">
          <select
            value={value.lang}
            onChange={(e) => onChange({ lang: e.target.value })}
            aria-label="Idioma da consulta"
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Cliente">
          <ToggleGroup
            options={CLIENTS}
            selected={[value.client]}
            onToggle={(id) => onChange({ client: id as SuggestClient })}
            label="Contexto do cliente"
          />
        </Field>
        <Field label="Sugestões por sonda" hint="1–50">
          <Input
            type="number"
            min={1}
            max={50}
            value={value.limit}
            onChange={(e) => onChange({ limit: Math.max(1, Math.min(50, Number(e.target.value) || 10)) })}
            aria-label="Sugestões por sonda"
            className="h-9 w-20"
          />
        </Field>
        <div className="ml-auto flex items-end gap-2">
          {running ? (
            <Button onClick={onStop} variant="outline" size="sm">
              <Square className="mr-1.5 h-3.5 w-3.5" /> Parar
            </Button>
          ) : (
            <Button onClick={onRun} disabled={disabled} size="sm">
              <Play className="mr-1.5 h-3.5 w-3.5" /> Coletar
              {seeds.length > 0 && combos.length > 0 && (
                <span className="ml-1 opacity-70">
                  ({seeds.length} sondas × {combos.length} combos = {requests} requisições)
                </span>
              )}
            </Button>
          )}
        </div>
      </div>

      <Field label={`Regiões (gl) — ${value.regions.length} selecionadas`}>
        <ToggleGroup
          options={REGIONS}
          selected={value.regions}
          onToggle={(id) => onChange({ regions: toggle(value.regions, id) })}
          label="Regiões (gl)"
        />
      </Field>

      <Field label={`Verticais (ds) — ${value.verticals.length} selecionadas`}>
        <ToggleGroup
          options={VERTICALS}
          selected={value.verticals}
          onToggle={(id) => onChange({ verticals: toggle(value.verticals, id) as SuggestVertical[] })}
          label="Verticais (ds)"
        />
      </Field>

      <Field
        label={`Grupos de expansão — ${value.groupIds.length}/${EXPANSION_GROUPS.length} (${seeds.length} sondas)`}
        hint="do briefing do inventário máximo"
      >
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Grupos de expansão">
          {EXPANSION_GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={value.groupIds.includes(g.id)}
              title={`${g.desc} (${g.words.length} variações)`}
              onClick={() => onChange({ groupIds: toggle(value.groupIds, g.id) })}
              className={cn(
                "rounded-md border px-2 py-1 text-xs transition-colors",
                value.groupIds.includes(g.id)
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "hover:bg-muted",
              )}
            >
              {g.label}
              <span className="ml-1 opacity-60">{g.words.length}</span>
            </button>
          ))}
        </div>
      </Field>

      {running && <ProgressNote seeds={seeds} />}
    </div>
  );
}

function ProgressNote({ seeds }: { seeds: SuggestSeed[] }) {
  return (
    <p role="status" className="text-xs text-muted-foreground">
      <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
      Coletando {seeds.length} sondas (lotes no servidor)…
    </p>
  );
}
