import type { ReviewEntry } from "@/lib/appStoreApi";

interface WordCloudProps {
  reviews: ReviewEntry[];
}

const STOP_WORDS = new Set([
  "a", "o", "e", "de", "da", "do", "que", "em", "para", "com", "não", "um", "uma",
  "os", "as", "no", "na", "por", "mais", "se", "mas", "ao", "ele", "ela", "das",
  "dos", "ou", "ser", "quando", "muito", "há", "nos", "já", "eu", "também", "é",
  "foi", "esse", "essa", "está", "são", "tem", "seu", "sua", "isso", "este",
  "me", "meu", "minha", "ter", "como", "the", "and", "is", "it", "to", "of", "in",
  "app", "que", "mas", "pra", "pro", "tá", "vai", "bem", "só", "nem", "sem",
]);

export function WordCloud({ reviews }: WordCloudProps) {
  if (reviews.length === 0) return null;

  const allText = reviews.map(r => `${r.title} ${r.text}`).join(" ").toLowerCase();
  const words = allText.split(/[\s,.!?;:()"-]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));

  const freq: Record<string, number> = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 30);
  if (sorted.length === 0) return null;

  const maxFreq = sorted[0][1];
  const minFreq = sorted[sorted.length - 1][1];

  return (
    <div className="glass-card rounded-xl p-6 animate-fade-in-up">
      <h3 className="font-semibold text-card-foreground mb-4">Palavras Mais Frequentes</h3>
      <div className="flex flex-wrap gap-2 justify-center">
        {sorted.map(([word, count]) => {
          const size = minFreq === maxFreq ? 1 : 0.6 + ((count - minFreq) / (maxFreq - minFreq)) * 1.4;
          return (
            <span
              key={word}
              className="px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium transition-transform hover:scale-110 cursor-default"
              style={{ fontSize: `${size}rem` }}
              title={`${count} ocorrências`}
            >
              {word}
            </span>
          );
        })}
      </div>
    </div>
  );
}
