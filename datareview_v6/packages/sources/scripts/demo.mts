import { createSources, collectAll } from "../src/index.js";

const registry = createSources({});
console.log("Fontes ativas por padrao:", registry.enabled.length);
console.log("  " + registry.enabled.join(", "));
console.log("");

const q = process.argv[2] ?? "open source";
const limit = Number(process.argv[3] ?? 3);
const targets = registry.enabled.slice(0, 4);
console.log("Coletando", targets.length, "fontes:", targets.join(", "), "...");

const responses = await collectAll(registry, { query: q, limit });
for (const r of responses.filter((x) => x.source !== "error").slice(0, 4)) {
  console.log("  [" + r.source + "] " + r.items.length + " itens");
  for (const it of r.items.slice(0, 2)) {
    console.log("      - " + (it.title ?? it.name ?? it.id ?? "").toString().slice(0, 80));
  }
}

console.log("");
console.log("OK - demo do nucleo v6 concluida.");
