# datareview_v4

Núcleo unificado de coleta/análise multi-fonte de dados públicos, com **núcleo
hexagonal puro** (v3) e **front com o design system da v1** (enxuto, sem o
excesso). Reescrita evolutiva consolidando o melhor das três versões anteriores.

## Estrutura

```
packages/
  contracts/  tipos compartilhados (única fonte de verdade)          @v4/contracts
  domain/     núcleo puro hexagonal: ports + pipeline (zero deps)     @v4/domain
  sources/    catálogo de fontes + adaptadores (registry, serpapi,
              suggest, audit)                                         @v4/sources
apps/
  web/        front React 19 + Vite (design system da v1, enxuto)     (em construção)
  api/        backend headless Express (todas as fontes via SourcePort)(em construção)
docs/
  SOURCES.md  catálogo completo de fontes/dados/parâmetros (gerado)
  decisions/  ADRs
```

## Pipeline canônico

```
DISCOVER → SEARCH → COLLECT → NORMALIZE → DEDUPLICATE → STORE DATASET
→ DERIVE INSIGHTS → AI ANALYSIS
```

## Catálogo de fontes

`docs/SOURCES.md` documenta **59 fontes** (dados, metadados, parâmetros,
recursos, chaves, ToS) — gerado do `packages/sources/src/catalog/` (fonte de
verdade machine-readable). Regerar após editar o catálogo:

```bash
pnpm --filter @v4/sources gen:catalog
```

Status: `implemented` = coletor ativo; `bridge` = coletor funcional no legado
v1 a ser embrulhado por `SourcePort`; `planned` = mapeado, sem coletor.

## Comandos

```bash
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm typecheck     # todos os pacotes
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm test           # todos os testes
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @v4/domain test   # só o núcleo
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @v4/sources gen:catalog
```

## Regras do fluxo incremental

- Cada pedaço termina validado (`typecheck` + testes verdes) e é commitado +
  pushado na `main` antes de seguir para o próximo.
- Commits pequenos e atômicos; sem juntar mudanças não relacionadas; sem
  reescrever histórico.

## Decisões arquiteturais registradas

- ADR-0001 — Consolidação da navegação de páginas
- ADR-0002 — SerpAPI como fallback multi-fonte
- ADR-0003 — Stack do front (design system atômico próprio, tokens, WCAG 2.2)
- ADR-0004 — Home focada em Suggest