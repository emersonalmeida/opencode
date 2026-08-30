/**
 * Guarda de regressão: TODA chamada ao backend local usa apiUrl/apiBase
 * (mesma origem → proxy do Vite / Express). O padrão antigo
 * `${import.meta.env.VITE_SUPABASE_URL}/functions/...` montava
 * "undefined/functions/..." sem .env ou apontava para fora do proxy com
 * valor errado — era a causa do falso "servidor offline".
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { apiBase, apiUrl } from "@/lib/apiBase";

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) listSourceFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) out.push(full);
  }
  return out;
}

describe("apiBase/apiUrl", () => {
  it("sem VITE_SUPABASE_URL → base vazia (mesma origem)", () => {
    expect(apiBase()).toBe("");
    expect(apiUrl("/functions/v1/x")).toBe("/functions/v1/x");
  });

  it("nenhum arquivo de src/ monta URL com VITE_SUPABASE_URL direto", () => {
    const srcDir = join(process.cwd(), "src");
    const files = listSourceFiles(srcDir);
    const offenders: string[] = [];
    for (const file of files) {
      // apiBase.ts (a própria fonte) e o client supabase (gerado) são exceções.
      if (file.endsWith("apiBase.ts") || file.includes("integrations/supabase")) continue;
      const content = readFileSync(file, "utf-8");
      // Padrão proibido: ${...VITE_SUPABASE_URL...}/functions
      if (/VITE_SUPABASE_URL[^`]*\/functions/.test(content)) offenders.push(file.replace(srcDir + "/", ""));
    }
    expect(offenders).toEqual([]);
  });
});
