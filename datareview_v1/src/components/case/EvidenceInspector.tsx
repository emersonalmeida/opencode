/**
 * Evidence Inspector — interactive demonstration of the Evidence Rule.
 *
 * Shows a synthetic AI claim → "Show evidence" → reveals real review evidence
 * from the project's dataset when available, with frequency, sample size,
 * percentage, source, rating. Falls back to an honest empty state when the
 * dataset is empty (does NOT fabricate evidence).
 *
 * No automatic AI calls. Deterministic.
 */
import { useMemo, useState } from "react";
import { Eye, EyeOff, Quote, ShieldQuestion } from "lucide-react";
import { useDataset } from "@/hooks/useDataset";
import type { ReviewEntry } from "@/lib/appStoreApi";
import { CaseCard, CaseLabel, CaseTag } from "./CaseShell";

interface EvidenceClaim {
  id: string;
  claim: string;
  /** Keywords to match against real reviews (lowercased). */
  keywords: string[];
  /** Sentiment filter for the population. */
  sentiment: "all" | "negative" | "positive";
}

const CLAIMS: EvidenceClaim[] = [
  { id: "login", claim: "“Usuários relatam dificuldades no login/cadastro.”", keywords: ["login", "logar", "entrar", "cadastro", "cadastrar", "conta"], sentiment: "negative" },
  { id: "bug", claim: "“Há reclamações recorrentes sobre bugs e travamentos.”", keywords: ["bug", "trav", "crash", "fecha", "fechando", "para", "erro"], sentiment: "negative" },
  { id: "good-app", claim: "“Muitos usuários elogiam o app.”", keywords: ["bom", "ótimo", "otimo", "excelente", "perfeito", "amo", "adoro", "melhor"], sentiment: "positive" },
];

export function EvidenceInspector() {
  const dataset = useDataset();
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [activeClaim, setActiveClaim] = useState(CLAIMS[0].id);

  const allReviews = useMemo(() => {
    const out: { r: ReviewEntry; appName: string }[] = [];
    for (const e of dataset.entries) {
      for (const r of e.reviews) out.push({ r, appName: e.app.name });
    }
    return out;
  }, [dataset.entries]);

  const claim = CLAIMS.find((c) => c.id === activeClaim) ?? CLAIMS[0];

  const evidence = useMemo(() => {
    if (allReviews.length === 0) return null;
    const matches: { r: ReviewEntry; appName: string }[] = [];
    for (const { r, appName } of allReviews) {
      if (claim.sentiment === "negative" && r.rating > 2) continue;
      if (claim.sentiment === "positive" && r.rating < 4) continue;
      const text = `${r.title} ${r.text}`.toLowerCase();
      if (claim.keywords.some((k) => text.includes(k))) matches.push({ r, appName });
    }
    const population = claim.sentiment === "negative"
      ? allReviews.filter((x) => x.r.rating <= 2).length
      : claim.sentiment === "positive"
        ? allReviews.filter((x) => x.r.rating >= 4).length
        : allReviews.length;
    const pct = population > 0 ? Math.round((matches.length / population) * 100) : 0;
    return { matches: matches.slice(0, 3), count: matches.length, population, pct };
  }, [allReviews, claim]);

  const isRevealed = revealed.has(claim.id);

  return (
    <div className="space-y-4">
      <CaseCard className="p-5 sm:p-6 space-y-4">
        <CaseLabel hint="demonstração interativa">Regra de Evidência</CaseLabel>

        {/* Claim selector */}
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Afirmações">
          {CLAIMS.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === activeClaim}
              onClick={() => { setActiveClaim(c.id); setRevealed(new Set()); }}
              className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${c.id === activeClaim ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"}`}
            >
              {c.id === "login" ? "Login" : c.id === "bug" ? "Bugs" : "Elogios"}
            </button>
          ))}
        </div>

        {/* The claim */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Afirmação da IA</p>
          <p className="text-base font-medium text-foreground leading-snug">{claim.claim}</p>
        </div>

        {/* Reveal toggle */}
        <button
          onClick={() => setRevealed((prev) => { const n = new Set(prev); n.add(claim.id); return n; })}
          disabled={isRevealed}
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-primary/40 text-primary hover:bg-primary/5 disabled:opacity-60 transition-colors"
        >
          {isRevealed ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          {isRevealed ? "Evidência revelada" : "Mostrar evidência"}
        </button>

        {/* Evidence */}
        {isRevealed && (
          <div className="animate-fade-in-up space-y-3">
            {evidence === null ? (
              <div className="rounded-lg border border-dashed border-border/60 p-4 text-center">
                <ShieldQuestion className="h-5 w-5 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Colete reviews para inspecionar a evidência real. Sem dados, não há o que verificar —
                  e a IA não deve fabricar.
                </p>
              </div>
            ) : evidence.count === 0 ? (
              <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4">
                <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">Não há evidência</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum review correspondente foi encontrado no dataset ({evidence.population} reviews na população). A afirmação <em>não</em> é sustentada pelos dados coletados.
                </p>
              </div>
            ) : (
              <>
                {/* Calculation */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat label="Frequência" value={String(evidence.count)} />
                  <Stat label="Amostra" value={String(evidence.population)} />
                  <Stat label="Percentual" value={`${evidence.pct}%`} />
                </div>

                {/* Sample quotes */}
                <div className="space-y-2">
                  <CaseLabel hint="citações reais do dataset">Evidência</CaseLabel>
                  {evidence.matches.map(({ r, appName }, i) => (
                    <figure key={`${r.id}-${i}`} className="rounded-lg border-l-2 border-primary/40 bg-muted/20 pl-3 pr-3 py-2">
                      <Quote className="h-3 w-3 text-primary/50 mb-1" aria-hidden />
                      <blockquote className="text-xs text-foreground/90 leading-relaxed italic">
                        {r.text.slice(0, 220) || r.title}{r.text.length > 220 ? "…" : ""}
                      </blockquote>
                      <figcaption className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-2 flex-wrap">
                        <span>— {r.author || "anônimo"}, {appName}</span>
                        <CaseTag>★{r.rating}</CaseTag>
                        {r.country && <CaseTag>{r.country.toUpperCase()}</CaseTag>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </CaseCard>

      <p className="text-xs text-muted-foreground italic px-1">
        "Um insight de IA só é útil quando o usuário entende de onde veio."
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 py-2">
      <p className="text-base font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
