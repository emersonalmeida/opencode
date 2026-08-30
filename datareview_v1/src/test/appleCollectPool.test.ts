import { describe, it, expect } from "vitest";
import { pool, deepCountriesForTarget } from "../../server/routes/appleReviews";

describe("apple-reviews pool (coleta paralela com early-stop)", () => {
  it("executa todos os itens respeitando o limite de concorrência", async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;
    const done: number[] = [];
    await pool(items, 4, () => false, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      done.push(n);
      inFlight--;
    });
    expect(done.sort((a, b) => a - b)).toEqual(items);
    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(maxInFlight).toBeGreaterThan(1); // realmente paralelo
  });

  it("para de agendar novos itens quando shouldStop dispara", async () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    let processed = 0;
    await pool(items, 2, () => processed >= 5, async () => {
      processed++;
      await new Promise((r) => setTimeout(r, 2));
    });
    // 2 workers podem processar um par a mais antes de checar o stop.
    expect(processed).toBeLessThanOrEqual(7);
    expect(processed).toBeGreaterThanOrEqual(5);
  });

  it("isola falhas: um item que falha não mata os demais", async () => {
    const done: number[] = [];
    await pool([1, 2, 3, 4], 2, () => false, async (n) => {
      if (n === 2) throw new Error("boom");
      done.push(n);
    });
    expect(done.sort()).toEqual([1, 3, 4]);
  });

  it("concorrência maior que a lista usa apenas len workers", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    await pool([1, 2], 10, () => false, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });
});

describe("deepCountriesForTarget (profundidade amp-api escala com o alvo)", () => {
  it("alvo pequeno/médio/grande", () => {
    expect(deepCountriesForTarget(100)).toBe(6);
    expect(deepCountriesForTarget(2000)).toBe(6);
    expect(deepCountriesForTarget(2001)).toBe(10);
    expect(deepCountriesForTarget(5000)).toBe(10);
    expect(deepCountriesForTarget(5001)).toBe(14);
  });
});
