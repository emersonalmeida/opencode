/**
 * FontRolePicker — seletor de família Google Fonts POR PAPEL tipográfico
 * (primária/secundária/monoespaçada): presets + busca no catálogo COMPLETO
 * do Google Fonts (via rota local /functions/v1/google-fonts — ~1500
 * famílias), com preview ao vivo da família digitada/selecionada.
 *
 * - Busca filtra o catálogo no cliente (acento-insensível, case-insensitive);
 *   sem catálogo (offline/servidor fora) cai nos presets + campo manual.
 * - Preview injeta o stylesheet da família escolhida sob demanda.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "@/lib/apiBase";
import { Search, Loader2 } from "lucide-react";
import {
  FONT_PRESETS, googleFontsUrl, sanitizeFontFamily, setFontRole, useUISettings,
  type UISettings,
} from "@/lib/uiSettings";
import { cn } from "@/lib/utils";

// apiUrl resolve a base (mesma origem → proxy do Vite).

let catalogCache: string[] | null = null;
let catalogPromise: Promise<string[] | null> | null = null;

/** Busca o catálogo completo do Google Fonts (cache em memória). */
async function fetchFontCatalog(): Promise<string[] | null> {
  if (catalogCache) return catalogCache;
  if (catalogPromise) return catalogPromise;
  catalogPromise = fetch(apiUrl("/functions/v1/google-fonts"))
    .then(async (r) => {
      if (!r.ok) return null;
      const data = (await r.json()) as { families?: string[] };
      catalogCache = Array.isArray(data.families) ? data.families : null;
      return catalogCache;
    })
    .catch(() => null)
    .finally(() => { catalogPromise = null; });
  return catalogPromise;
}

/** Injeta o stylesheet de UMA família para o preview (link por família). */
function previewFont(family: string): void {
  if (typeof document === "undefined" || !family) return;
  const id = `font-preview-${family.replace(/[^A-Za-z0-9]/g, "-")}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = googleFontsUrl(family);
  document.head.appendChild(link);
}

export function FontRolePicker({
  role, label, hint,
}: {
  role: keyof UISettings["fontRoles"]; label: string; hint: string;
}) {
  const ui = useUISettings();
  const value = ui.fontRoles[role];
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Carrega o catálogo sob demanda (primeira abertura da busca).
  useEffect(() => {
    if (!open || catalog !== null) return;
    setLoading(true);
    void fetchFontCatalog().then((f) => { setCatalog(f); setLoading(false); });
  }, [open, catalog]);

  // Fecha a lista ao clicar fora / Esc.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const base = catalog ?? FONT_PRESETS.map((f) => f.family);
    if (!q) return base.slice(0, 40);
    const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    return base.filter((f) => norm(f).includes(q)).slice(0, 40);
  }, [query, catalog]);

  useEffect(() => { if (value) previewFont(value); }, [value]);

  const choose = (family: string) => {
    setFontRole(role, family);
    previewFont(family);
    setOpen(false);
  };

  const isCustom = value && !FONT_PRESETS.some((f) => f.family === value);

  return (
    <div ref={boxRef} className="relative space-y-1">
      <div className="flex items-baseline justify-between">
        <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
          {label} {role !== "primary" && <span className="normal-case">(opcional)</span>}
        </p>
        <span className="text-[9px] text-muted-foreground/70">{hint}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <select
          value={FONT_PRESETS.some((f) => f.family === value) ? value : value === "" ? "" : "__custom"}
          onChange={(e) => {
            if (e.target.value === "__custom") return; // usuário busca abaixo
            setFontRole(role, e.target.value);
          }}
          aria-label={`Fonte ${label.toLowerCase()}`}
          className="h-8 min-w-0 flex-1 rounded-md border border-border/60 bg-background px-2 text-xs"
        >
          <option value="">Herdar da primária</option>
          {FONT_PRESETS.map((f) => (
            <option key={f.family} value={f.family}>{f.label}</option>
          ))}
          {isCustom && <option value="__custom">{value} (personalizada)</option>}
          {!isCustom && <option value="__custom">Personalizada…</option>}
        </select>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={`Pesquisar fontes do Google Fonts para ${label.toLowerCase()}`}
          title="Pesquisar em todas as fontes do Google Fonts"
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:border-primary/50"
        >
          <Search className="h-3 w-3" aria-hidden />
          Buscar
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-popover shadow-lg">
          <div className="flex items-center gap-1.5 border-b border-border/50 px-2 py-1.5">
            <Search className="h-3 w-3 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar em todas as fontes do Google…"
              aria-label="Buscar fonte do Google Fonts"
              className="h-6 min-w-0 flex-1 bg-transparent text-xs focus:outline-none"
            />
            {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden />}
          </div>
          <ul className="max-h-56 overflow-y-auto p-1" role="listbox" aria-label="Fontes encontradas">
            {results.map((f) => (
              <li key={f}>
                <button
                  type="button"
                  role="option"
                  aria-selected={f === value}
                  onClick={() => choose(f)}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-secondary",
                    f === value && "bg-primary/10 text-primary",
                  )}
                >
                  <span>{f}</span>
                  <span aria-hidden style={{ fontFamily: `'${f}'` }} onMouseOver={() => previewFont(f)}>
                    Ag 123
                  </span>
                </button>
              </li>
            ))}
            {results.length === 0 && (
              <li className="px-2 py-3 text-center text-[11px] text-muted-foreground">
                Nenhuma fonte encontrada para “{query}”.
              </li>
            )}
            {catalog === null && !loading && (
              <li className="px-2 py-1.5 text-[10px] text-muted-foreground">
                Catálogo completo indisponível (servidor offline) — mostrando presets. Digite o nome exato para usar qualquer fonte.
              </li>
            )}
          </ul>
          <div className="border-t border-border/50 px-2 py-1.5">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && query.trim()) choose(sanitizeFontFamily(query));
              }}
              placeholder="Ou digite o nome exato e pressione Enter"
              aria-label="Nome exato da fonte"
              className="h-6 w-full bg-transparent text-[11px] text-muted-foreground focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Preview ao vivo da família selecionada. */}
      {value && (
        <p className="rounded-md border border-border/40 bg-secondary/30 px-2 py-1.5 text-sm" style={{ fontFamily: `'${value}'` }}>
          A voz do usuário guia o produto — 0123456789
        </p>
      )}
    </div>
  );
}
