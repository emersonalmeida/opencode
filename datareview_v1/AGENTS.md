# AGENTS.md

## Build e verificação

- Type-check do app: `npx tsc --noEmit -p tsconfig.app.json`
- Testes: `npx vitest run` (ou `npm test`:).
- Teste isolado: `npx vitest run src/test/<arquivo>.test.tsx`
- Suíte completa do repo tem **12 failures pré-existentes e conhecidos** em
  docs e scripts (`docFile`, `docsCompilado`, `pageDocs`, `sourceDocs`,
  `gitSnapshotScript`, `governance`) — **não relacionados à Home** e fora do
  escopo atual (`docs/pages/` inclusive nem existe).

## Convenções

- Modelo puro/testável vive em `src/lib/` (ex.: `src/lib/home/homeMobileFirst.ts`); o
  componente React em `src/components/`; teste em `src/test/`.
- Registry de rotas/páginas: `src/lib/pages.ts` (`PAGES`). Validar rotas novas contra ele.

- KPIs do dataset local vêm de `computeKPIs(reviews, entries)` em
  `src/lib/dashboardAnalytics.ts` (padrão: `entries.flatMap((e) => e.reviews)`).
- Store local: `src/lib/datasetStore.ts` (upsert/clear; `useDataset` em `src/hooks/`).

## Home

- Página inicial real: `src/pages/Home.tsx` → `src/components/home/HomeMobileFirst.tsx`
  (saudação contextual, KPIs, empty state + QuickCollect, ações e seções).
- Desde 2026-08-29,a `/` do sistema é a `HomeLite` (duplicata enxuta
  da Coleta: Hero + Top Charts, top  ̃50 padrão— sem AppHeader/loop);
  a Home mobile-first (HomeMobileFirst) vive em `/home` dentro do grupo
  Backup. O menu: todas as páginas vivem no grupo builtin Backup
  (TOP_LEVEL_PATHS = somente "/").
- O esqueleto antigo `HomeShell` segue no repo coberto por testes próprios.



## Fiabilidade de edição

- **Parênteses longos/heredocs** podem ser corrompidos no feed — preferir
  edições curtas via `file_editor`, ou scripts Python/`perl` com verificações
  imediatas (`od`/`sed`/`tsc`).