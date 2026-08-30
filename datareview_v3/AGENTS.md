# AGENTS.md

## Build e verificação

- Type-check global: `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm -r typecheck` (o `pnpm` via corepack pode pedir confirmação para baixar — usar a env acima).
- Testes do domínio: `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @v3/domain test` — roda `node --import tsx --test test/domain.test.ts`.
- Type-check do domínio isolado: `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 npx tsc -p packages/domain/tsconfig.json --noEmit`.
- Pnpm v11 exige `allowBuilds` (não mais `onlyBuiltDependencies`) para scripts de build — o esbuild já está aprovado no `pnpm-workspace.yaml`; se adicionar dep nova com postinstall, rodar `COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm approve-builds` e comitar o yaml.

- **Fluxo incremental**: cada pedaço termina validado (`pnpm -r typecheck` + testes verdes) e é commitado + pushado na `main` antes de seguir ao próximo — para reduzir retrabalho e perda de trabalho. Commits pequenos e atômicos; sem juntar mudanças não relacionadas. Não reescrever histórico (`main` recebe push direto;. Ao commitar, incluir `Co-authored-by: openhands <openhands@all-hands.dev`> quando credenciais existirem.

## Arquitetura

- Monorepo pnpm: `packages/contracts` (tipos `@v3/contracts`, sem deps); `packages/domain` (núcleo hexagonal puro); `apps/` ainda não criado.

- `packages/domain`: `src/ports/` (interfaces: SourcePort, StoragePort, AIPort, DerivePort, DatasetStats); `src/pipeline/` (`derive.ts`: `normalizeText`, `stats`, `contextHint`, `search`; `stableId.ts`; `index.ts` com `runSource`, `runPipeline`). Zero deps de I/O/HTTP/React.
- Testes: `test/domain.test.ts` (node:test + tsx, sem vitest).

## Front (ADR-0003)

- Stack: React 19 + Vite + TypeScript (strict;. Design system atomico PROPRIO
  (atoms+molecules+organisms+templates) com design tokens (CSS custom properties,
  W3C-style naming); dois temas (claro/escuro) via prefers-color-scheme + toggle manual;
  suportar prefers-reduced-motion e prefers-contrast.

- Responsividade: mobile-first (base; media queries min-width; container queries
  para componentes; fluid type/spacing com clamp(); CSS Grid auto-fit/minmax.

- Breakpoints: 640/768/1024/1280/1536 town. TV (10-foot UI): grade com foco
  visivel (focus-visible), indicador claro, alvo grande, sem hover-only,, tipografia maior..

## Armadilhas do ambiente

- O feed de edição corrompe parênteses e injecta bytes invisíveis( U+FE0F `\xEF\xB8\x8F`; U+2005 `\xE0\x80\x85`; U+8005 `\xE8\x80\x85`) ao escrever código/scripts longos com dígitos. Preferir edições curtas (`file_editor`/sed/perl com sanitização`: `perl -pi -e 's/\xEF\xB8\x8F//g; s/\xE0\x80\x85//g; s/\xE8\x80\x85//g;' arquivo`).
- Regex de diacríticos do `normalizeText` deve ter **1** backslash: `[\u0300-\u036f]`. Com `\\u` o range vira `0`-`\` e come letras ASCII( A,, C,, f,...).
- Teste do `normalizeText` espera `"ola"` (sem acento; normalize remove diacríticos.