import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Command, ArrowRight } from "lucide-react";
import { detectInputType, parseMultiInput } from "@/lib/googlePlayApi";

interface Props {
  compact?: boolean;
  /** Alinhamento do campo: "center"(padrão) reproduz o header; "left" deixa
   *  o campo alinhado ao conteúdo (ex.: hero da página inicial). */
  align?: "left" | "center";
  autoFocus?: boolean;
  placeholder?: string;
}

/**
 * Simple global search input.
 * Aceita nomes de app, palavras-chave, categorias, IDs de loja ou URLs de loja.
 * IDs/URLs diretos navegam direto para a página de detalhe do app;
 * todo o resto vai para a página de resultados de busca.
 */
export function GlobalSearchBar({ compact = false, align = "center", autoFocus, placeholder }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Global ⌘K / Ctrl+K — focuses the search bar from anywhere (the kbd badge
  // advertises this shortcut, so it must actually work). Ignored while typing
  // in another editable field... except ⌘K itself, which always wins.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Esc clears and blurs — quick exit from search mode.
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setQuery("");
      inputRef.current?.blur();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;

    const tokens = parseMultiInput(q);
    if (tokens.length === 1) {
      const t = tokens[0];
      if (t.type === "url" || t.type === "id") {
        navigate(`/app/${t.store}/${encodeURIComponent(t.value)}`);
      } else {
        navigate(`/search?q=${encodeURIComponent(q)}`);
      }
    } else if (tokens.length > 1) {
      navigate(`/search?q=${encodeURIComponent(q)}`);
    } else {
      // fallback: naked term
      const detected = detectInputType(q);
      if (detected.type === "url" || detected.type === "id") {
        navigate(`/app/${detected.store}/${encodeURIComponent(detected.value)}`);
      } else {
        navigate(`/search?q=${encodeURIComponent(q)}`);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      aria-label="Busca global de apps"
      className={`relative flex items-center gap-2 rounded-full border border-border/60 bg-card/80 backdrop-blur transition-all focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/40 hover:border-border ${compact ? "w-full max-w-md" : align === "left" ? "w-full max-w-2xl" : "w-full max-w-2xl mx-auto"}`}
    >
      <Search className="ml-4 h-4 w-4 text-muted-foreground flex-shrink-0" aria-hidden="true" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleInputKeyDown}
        type="search"
        aria-label="Buscar apps"
        placeholder={placeholder ?? "Buscar por nome, ID, URL ou categoria…"}
        className="flex-1 min-w-[80px] bg-transparent outline-none text-sm py-2.5 placeholder:text-muted-foreground/70"
      />
      {query && (
        <button
          type="button"
          onClick={() => { setQuery(""); inputRef.current?.focus(); }}
          aria-label="Limpar busca"
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <kbd className="hidden xl:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/60 text-[10px] text-muted-foreground font-mono">
        <Command className="h-2.5 w-2.5" />K
      </kbd>
      <button
        type="submit"
        disabled={!query.trim()}
        className="mr-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Buscar (Enter)"
        aria-label="Buscar"
      >
        <span className="hidden sm:inline">Buscar</span> <ArrowRight className="h-3 w-3" />
      </button>
    </form>
  );
}
