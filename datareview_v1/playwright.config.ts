import { defineConfig } from "@playwright/test";

/**
 * E2E de fluxos críticos (todo.md P0) com @playwright/test direto — sem o
 * pacote lovable-agent-playwright-config (não instalado). Specs vivem em
 * `e2e/`, spec dir sem pacote em node_modules.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: "http://localhost:8080",
    headless: true,
  },
});

