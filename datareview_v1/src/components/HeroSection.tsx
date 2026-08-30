import { useEffect, useState, type ReactNode } from "react";
import { Search, Sparkles, GitCompare, BarChart3 } from "lucide-react";

const ROTATING = ["reviews", "atualizações", "problemas", "oportunidades", "sentimento", "concorrentes"];

/**
 * Left-aligned all-type animated hero. Rotates a keyword in the headline and
 * lays out a 4-step guided flow beneath.
 */
export function HeroSection({ showSteps = true, searchBelow }: { showSteps?: boolean; searchBelow?: ReactNode }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % ROTATING.length), 2200);
    return () => clearInterval(t);
  }, []);

  const steps = [
    { n: "01", icon: Search, title: "Descubra", body: "Busque qualquer app pelo nome, URL ou ID — ou explore os Top 10 por categoria da sua região." },
    { n: "02", icon: BarChart3, title: "Colete", body: "Puxamos metadados completos e centenas de reviews da App Store e Google Play, com cache local para consultas instantâneas." },
    { n: "03", icon: GitCompare, title: "Compare", body: "Selecione um ou mais apps no painel lateral direito para analisar lado a lado com métricas e citações." },
    { n: "04", icon: Sparkles, title: "Pergunte à IA", body: "O assistente à direita responde qualquer pergunta e gera artefatos de pesquisa a partir dos payloads coletados." },
  ];

  return (
    <section className="text-left max-w-4xl space-y-7 pt-6 pb-2 animate-fade-in">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium">
        <Sparkles className="h-3 w-3" /> App Intelligence — Apple + Google, ao vivo
      </div>

      <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-[1.05]">
        Transforme{" "}
        <span key={idx} className="inline-block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent animate-fade-in">
          {ROTATING[idx]}
        </span>
        <br />
        em decisão de produto.
      </h1>

      <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
        Uma plataforma única para pesquisar, coletar e interpretar tudo o que os usuários dizem sobre qualquer app — nas duas lojas, sem planilhas, com IA contextual sempre à mão.
      </p>

      {searchBelow}

      {showSteps && (
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
        {steps.map((s, i) => (
          <li
            key={s.n}
            className="group relative rounded-2xl border border-border/50 bg-card/60 p-4 hover:border-primary/50 hover:bg-card transition-all duration-300 hover:-translate-y-0.5"
            style={{ animation: `fade-in 0.5s ease-out ${i * 80}ms both` }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-mono text-muted-foreground tracking-wider">{s.n}</span>
              <div className="flex-1 h-px bg-border/50" />
              <s.icon className="h-3.5 w-3.5 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">{s.title}</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.body}</p>
          </li>
        ))}
      </ol>
      )}
    </section>
  );
}
