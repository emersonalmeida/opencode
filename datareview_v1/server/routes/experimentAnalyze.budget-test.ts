// Valida que buildDatasetText cabe no contexto para diferentes volumes.
// Rode com: npx tsx server/routes/experimentAnalyze.budget-test.ts
import { buildDatasetText, selectReviews, type ExperimentApp } from "./experimentAnalyze.js";

type TestReview = ExperimentApp["reviews"][number];

function makeReviews(n: number): TestReview[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    rating: (i % 5) + 1,
    author: `User${i}`,
    title: `Title ${i}`,
    text: `Este é o review número ${i} com texto suficiente para testar o truncamento do budget de contexto. `.repeat(3) + `review ${i}`,
    date: `2026-08-${String((i % 28) + 1).padStart(2, "0")}`,
    version: "8.2",
    country: i % 3 === 0 ? "US" : "BR",
    thumbsUp: i % 15,
  }));
}

const numCtx = 32768;
const budgetChars = (numCtx - 7000) * 4;

let allPass = true;
for (const count of [10, 50, 100, 250, 500, 1000, 5000]) {
  const apps = [{
    app: { name: "Nubank Test", store: "apple", developer: "Nubank", rating: 4.8, ratingCount: 1611549, version: "8.2", genre: "Finance", description: "x".repeat(500) },
    reviews: makeReviews(count),
  }];
  const text = buildDatasetText(apps, numCtx);
  const tokens = Math.ceil(text.length / 4);
  const fits = text.length <= budgetChars;
  const sampled = text.includes("amostra estratificada");
  const hasAggregates = text.includes("DISTRIBUIÇÃO AGREGADA") && text.includes("Sentimento:");
  const status = fits ? "✅" : "❌";
  if (!fits || !hasAggregates) allPass = false;
  console.log(`${status} ${count} reviews → ${text.length} chars / ~${tokens} tokens | fits=${fits} | ${sampled ? "amostrado" : "completo"} | aggregates=${hasAggregates}`);
}

// Testa selectReviews estratificação
const reviews = makeReviews(500); // 100 por nota (1-5)
const { selected, total } = selectReviews(reviews, 50);
const dist = [1, 2, 3, 4, 5].map((r) => {
  const c = selected.filter((s) => s.rating === r).length;
  return `★${r}:${c}`;
}).join(" ");
const stratOk = selected.length === 50 && selected.every((s) => total === 500);
console.log(`${stratOk ? "✅" : "❌"} selectReviews(500→50): ${selected.length} selected, dist: ${dist}`);
if (!stratOk) allPass = false;

// Testa multi-app
const multiApps = [
  { app: { name: "App A", store: "apple" }, reviews: makeReviews(300) },
  { app: { name: "App B", store: "google" }, reviews: makeReviews(300) },
];
const multiText = buildDatasetText(multiApps, numCtx);
const multiFits = multiText.length <= budgetChars;
console.log(`${multiFits ? "✅" : "❌"} multi-app (2×300=600 reviews): ${multiText.length} chars, fits=${multiFits}`);
if (!multiFits) allPass = false;

console.log(allPass ? "\n🎉 TODOS OS TESTES PASSARAM" : "\n💥 FALHAS DETECTADAS");
process.exit(allPass ? 0 : 1);
