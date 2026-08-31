# AGENTS.md

## Build e verificacao

- Type-check global: COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm -r typecheck
- Testes do sources: COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @v6/sources test
- Testes do dominio: COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @v6/domain test

## Arquitetura

- Monorepo pnpm: packages/contracts, packages/domain, packages/sources, apps/web (front da v1 sobre o motor v6, sem backend).
- packages/sources: src/adapters/ (8 fontes ativas portadas da v4) src/catalog/ (59+ opt-in) src/sources.ts (registry runtime createSources/sourcesFromEnv/collectAll) src/keys.ts.
- Ativas por padrao (sem-auth): suggest, trends, serp, youtube, googleplay, apple, producthunt, reclameaqui. Todas as outras continuam no catalogo como opt-in.
- Testes: node:test + tsx (test/sources.test.ts, test/catalog.test.ts).

## Front web v6 (apps/web

- Stack: React 19 + Vite + react-router (Shell v4; Home/Coleta/Fontes/NotFound). Sem backend: `src/lib/motor.ts` e o bridge que instancia `@v6/sources` (createSources/sourcesFromEnv) e expoe `coletar/`catalogo/`grupos/`ativas`.
- Comandos (via filter @v6/web): `dev` (vite), `build` (vite build), `typecheck` (tsc --noEmit), `test` (node --import tsx --test test/web.test.tsx).
- Testes: SSR smoke das 4 rotas + NotFound + helpers puros de formatacao (test/web.test.tsx).
- O `pnpm local` raiz roda: install+typecheck global+test global+build web+demo do nucleo.

## Armadilhas do ambiente

- O feed de edicao corrompe parenteses, ponto-virgulas, em-dashes e bytes invisiveis em codigo longo (file_editor, heredocs, printf grandes). Preferir linhas curtas via printf por linha,, sed curto, cat de fragmentos em disco, e sanitizar com perl. Validar com tsc imediatamente apos criar/editar qualquer arquivo.
- Parenteses desbalanceados em JSdoc podem gerar TS1011 enganoso em linhas posteriores; quando em duvida, remover ambiguidade do comentario.
