import { Apple, ShoppingBag, Star, ExternalLink, X, Tag, HardDrive, Calendar, Shield, Info, Download } from "lucide-react";
import type { AppInfo, ReviewEntry } from "@/lib/appStoreApi";
import { StatsCards } from "@/components/StatsCards";
import { RatingChart } from "@/components/RatingChart";
import { RatingBreakdown } from "@/components/RatingBreakdown";
import { SentimentChart } from "@/components/SentimentChart";
import { ReviewLengthChart } from "@/components/ReviewLengthChart";
import { ReviewTimeline } from "@/components/ReviewTimeline";
import { WordCloud } from "@/components/WordCloud";
import { ReviewsList } from "@/components/ReviewsList";
import { AppUpdates } from "@/components/shared/AppUpdates";
import { UpdateIssues } from "@/components/shared/UpdateIssues";
import { QuantiQualiFindings } from "@/components/shared/QuantiQualiFindings";
import { AutoAIAnalysis } from "@/components/shared/AutoAIAnalysis";
import { SectionHeader } from "@/components/SectionHeader";

interface Props {
  app: AppInfo;
  reviews: ReviewEntry[];
  compact?: boolean;
  onRemove?: () => void;
  isPrimary?: boolean;
  /** When true, the per-app AI analysis section is hidden (used when a unified
   *  cross-app AI analysis is rendered below all columns instead). */
  hideAI?: boolean;
}

/**
 * Full dossier for a single app rendered as ONE unified card. Every section
 * lives directly inside the outer card — no nested `glass-card` wrappers —
 * so the whole column reads as a single visual container per app.
 */
export function AppDetailColumn({ app, reviews, compact = false, onRemove, isPrimary, hideAI = false }: Props) {
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const medianRating = reviews.length ? [...reviews].sort((a, b) => a.rating - b.rating)[Math.floor(reviews.length / 2)].rating : 0;
  const reviewsWithText = reviews.filter(r => r.text.length > 10).length;
  const avgTextLen = reviews.length ? Math.round(reviews.reduce((s, r) => s + r.text.length, 0) / reviews.length) : 0;

  const metaItems = [
    { icon: Tag, label: "Gênero", value: app.genre },
    { icon: HardDrive, label: "Versão", value: app.version },
    { icon: Calendar, label: "Lançamento", value: app.releaseDate ? new Date(app.releaseDate).toLocaleDateString("pt-BR") : "" },
    { icon: Calendar, label: "Atualizado", value: app.currentVersionReleaseDate ? new Date(app.currentVersionReleaseDate).toLocaleDateString("pt-BR") : (app.lastUpdated || "") },
    { icon: HardDrive, label: "Tamanho", value: app.size },
    { icon: Shield, label: "Classificação", value: app.contentRating },
    { icon: Info, label: "OS Mínimo", value: app.minimumOsVersion },
    { icon: Download, label: "Downloads", value: app.downloads },
  ].filter(m => m.value);

  const gap = compact ? "space-y-6" : "space-y-10";
  const metaCols = compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
  const chartGrid = compact ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2";

  // Subtle inner surface — visually a nested panel WITHOUT being another card.
  const panel = "rounded-xl bg-secondary/40 border border-border/40";

  return (
    <article className="glass-card rounded-3xl p-6 sm:p-8 min-w-0 animate-fade-in transition-all duration-300 hover:shadow-lg relative">
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Remover da comparação"
        >
          <X className="h-4 w-4" />
        </button>
      )}

      <div className={`${gap} min-w-0`}>
        {/* Identity */}
        <header className="flex items-start gap-4">
          {app.icon ? (
            <img src={app.icon} alt={app.name} className={`${compact ? "w-16 h-16" : "w-24 h-24"} rounded-2xl shadow-md flex-shrink-0`} />
          ) : (
            <div className={`${compact ? "w-16 h-16" : "w-24 h-24"} rounded-2xl bg-secondary flex items-center justify-center flex-shrink-0`}>
              {app.store === "apple" ? <Apple className="h-8 w-8 text-muted-foreground" /> : <ShoppingBag className="h-8 w-8 text-muted-foreground" />}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${app.store === "apple" ? "bg-secondary text-secondary-foreground" : "bg-accent/10 text-accent"}`}>
                {app.store === "apple" ? "App Store" : "Google Play"}
              </span>
              {isPrimary && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">foco</span>}
            </div>
            <h1 className={`${compact ? "text-lg" : "text-2xl"} font-bold text-foreground leading-tight truncate`}>{app.name}</h1>
            <p className={`${compact ? "text-xs" : "text-sm"} text-muted-foreground truncate`}>{app.developer}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-star text-star" />
                <span className={`${compact ? "text-xs" : "text-sm"} font-semibold`}>{app.rating > 0 ? app.rating.toFixed(1) : "—"}</span>
                {app.ratingCount > 0 && (
                  <span className="text-[11px] text-muted-foreground">({app.ratingCount.toLocaleString("pt-BR")})</span>
                )}
              </div>
              <span className="text-[11px] text-muted-foreground">{app.price}</span>
              <a href={app.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline text-[11px]">
                <ExternalLink className="h-3 w-3" /> Abrir na loja
              </a>
            </div>
          </div>
        </header>

        {/* Ficha técnica */}
        {metaItems.length > 0 && (
          <section className="space-y-3">
            <SectionHeader
              eyebrow="Ficha técnica"
              title="Dados oficiais da loja"
              description="Metadados coletados diretamente do payload da App Store ou Google Play."
            />
            <div className={`grid gap-2.5 ${metaCols}`}>
              {metaItems.map(m => (
                <div key={m.label} className={`${panel} p-3`}>
                  <div className="flex items-center gap-2 mb-1">
                    <m.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground">{m.label}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground truncate">{m.value}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Descrição */}
        {app.description && (
          <section className="space-y-3">
            <SectionHeader
              eyebrow="Posicionamento"
              title="Descrição publicada pelo desenvolvedor"
              description="Como o app se apresenta na loja — útil para comparar promessa vs. percepção nos reviews."
            />
            <div className={`${panel} p-5`}>
              <p className={`text-sm text-muted-foreground whitespace-pre-line leading-relaxed ${compact ? "line-clamp-[8]" : "line-clamp-[12]"}`}>{app.description}</p>
            </div>
          </section>
        )}

        {/* Screenshots */}
        {app.screenshots.length > 0 && (
          <section className="space-y-3">
            <SectionHeader
              eyebrow="Visual"
              title="Screenshots da loja"
              description="Primeiras impressões que o usuário tem antes de instalar."
            />
            <div className={`${panel} p-4`}>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {app.screenshots.slice(0, 8).map((s, i) => (
                  <img key={i} src={s} alt={`Screenshot ${i + 1}`} className={`${compact ? "h-40" : "h-52"} rounded-lg flex-shrink-0 object-contain`} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Indicadores principais */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Panorama"
            title="Indicadores principais"
            description="Notas, volume de avaliações e engajamento — base rápida de leitura antes de mergulhar nos gráficos."
          />
          <StatsCards app={app} reviews={reviews} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { label: "Mediana das Notas", value: medianRating > 0 ? `★${medianRating}` : "—" },
              { label: "Reviews c/ Texto", value: `${reviewsWithText}/${reviews.length}` },
              { label: "Tamanho Médio", value: `${avgTextLen} chars` },
              { label: "Nota Média Coletada", value: avgRating > 0 ? avgRating.toFixed(2) : "—" },
            ].map(s => (
              <div key={s.label} className={`${panel} p-3 text-center`}>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Distribuição de notas */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Distribuição"
            title="Como as notas se distribuem"
            description="Comparativo entre a média histórica da loja e a amostra coletada — ajuda a detectar polarização."
          />
          <div className={`grid gap-4 ${chartGrid}`}>
            <RatingChart reviews={reviews} />
            <RatingBreakdown reviews={reviews} />
          </div>
        </section>

        {/* Sentimento & tamanho */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Comportamento"
            title="Sentimento e profundidade das opiniões"
            description="Quantos reviews são positivos/negativos e quão elaborados eles são — indicadores da temperatura da base."
          />
          <div className={`grid gap-4 ${chartGrid}`}>
            <SentimentChart reviews={reviews} />
            <ReviewLengthChart reviews={reviews} />
          </div>
        </section>

        {/* Linha do tempo */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Evolução"
            title="Linha do tempo das avaliações"
            description="Volume e nota média ao longo do tempo — mostra impacto de releases e eventos."
          />
          <ReviewTimeline reviews={reviews} />
        </section>

        {/* Temas */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Temas"
            title="O que os usuários mais mencionam"
            description="Palavras e expressões recorrentes extraídas do texto dos reviews."
          />
          <WordCloud reviews={reviews} />
        </section>

        {/* Updates + issues */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Ciclo de release"
            title="Atualizações e problemas relatados"
            description="O que mudou em cada versão e quais reclamações apareceram depois de cada release."
          />
          <div className={`grid gap-4 ${chartGrid}`}>
            <AppUpdates app={app} reviews={reviews} compact={compact} />
            <UpdateIssues reviews={reviews} compact={compact} />
          </div>
        </section>

        {/* Findings */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Descobertas"
            title="Achados quantitativos e qualitativos"
            description="Métricas cruzadas com trechos representativos — pronto para levar a discovery."
          />
          <QuantiQualiFindings app={app} reviews={reviews} compact={compact} />
        </section>

        {/* Reviews */}
        <section className="space-y-3">
          <SectionHeader
            eyebrow="Vozes do usuário"
            title="Reviews coletados"
            description="Amostra completa com filtro por nota — evidência bruta para citações e análise qualitativa."
          />
          <ReviewsList reviews={reviews} />
        </section>

        {/* AI — sempre por último dentro do card do app */}
        {!hideAI && (
          <section className="space-y-3">
            <SectionHeader
              eyebrow="IA"
              title="Análise automática por IA"
              description="Síntese gerada com base em todo o payload coletado deste app — use como ponto de partida, não como verdade final."
            />
            <AutoAIAnalysis app={app} reviews={reviews} compact={compact} />
          </section>
        )}
      </div>
    </article>
  );
}
