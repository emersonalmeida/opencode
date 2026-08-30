/**
 * E2E dos fluxos críticos (todo.md P0): coleta simulada via dataset seedado
 * no localStorage → da dashboard visível à exportação, e canvas renderiza.
 * Nenhum mock de rede: jsdom-style é proibido aqui — só navegador real.
 */
import { test, expect } from "@playwright/test";

const DATASET = [
  {
    app: {
      id: "814456780",
      store: "apple",
      name: "Nubank",
      icon: "",
      developer: "Nu Pagamentos S.A.",
      rating: 4.6,
      ratingCount: 1200000,
      price: "0",
      genre: "Financial",
      description: "Banco digital",
      version: "1.0.0",
      releaseDate: "2024-01-01",
      currentVersionReleaseDate: "2024-01-01",
      screenshots: [],
      url: "https://apps.apple.com/app/id123",
    },
    reviews: [
      {
        id: "r1",
        store: "apple",
        appId: "814456780",
        appName: "Nubank",
        author: "Ana",
        rating: 5,
        title: "Ótimo",
        text: "Funciona perfeitamente no meu uso diário",
        date: "2026-08-01",
      },
      {
        id: "r2",
        store: "apple",
        appId: "814456780",
        appName: "Nubank",
        author: "Bia",
        rating: 1,
        title: "Travando",
        text: "App trava ao abrir a tela de pagamento PIX",
        date: "2026-08-02",
      },
    ],
    collectedAt: Date.now() - 86400000,
  },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((dataset) => {
    localStorage.setItem("aso:dataset:v1", JSON.stringify(dataset));
    // Fecha o overlay de onboarding (chave real do OnboardingModal).
    localStorage.setItem("aso:onboarded", "1");
  }, DATASET);
});

test("dashboard: dataset seedado → KPIs renderizam", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Dashboard" }).first()).toBeVisible();
  await expect(page.getByText("1 app(s)", { exact: true })).toBeVisible();
  await expect(page.getByText(/\b2 reviews\b/).first()).toBeVisible();
});

test("dados: lista entries e fresh label renderizam", async ({ page }) => {
  await page.goto("/dados");
  await expect(page.getByRole("heading", { name: "Nubank" }).or(page.getByText("Nubank"))).toBeVisible();
  await expect(page.getByText(/há \d+ (dia|dias|semanas?|meses)|hoje/)).toBeVisible();
});

test("exportação XLSX gera download (content-disposition)", async ({ page }) => {
  await page.goto("/dashboard");
  const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
  const xlsx = page.getByRole("button", { name: "Exportar XLSX" });
  await expect(xlsx).toBeVisible();
  await xlsx.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.xls$/);
});

test("canvas: renderiza com atraso inicial sem erro", async ({ page }) => {
  await page.goto("/canvas");
  await expect(page.getByText("Canvas vazio")).toBeVisible();
});

test("navegação: header não quebra (smoke)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading").first()).toBeVisible();
});
