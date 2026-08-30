# datareview_v3

Projeto proprio do data review — nucleo unificado e reutilizavel de coleta/
analise multi-fonte, com front novo em React 19 + Vite + TypeScript,
design system atomico proprio, responsive mobile/tablet/desktop/TV.

## Estrutura

```
apps/
  web/       front React 19 + Vite (design system atomico, tokens, WCAG 2.2 AA)
packages/
  contracts/ tipos compartilhados (unica fonte de verdade) @v3/contracts
  domain/   nucleo puro: ports + pipeline + dedup/derive (zero deps) @v3/domain
  sources/   registry de adaptadores de fonte (Lote 1+)
```

## Pipeline canonico

DISCOVER → SEARCH → COLLECT → NORMALIZE → DEDUPLICATE → STORE DATASET
→ DERIVE INSIGHTS → AI ANALYSIS

## Comandos

```bash
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm typecheck          # todos os pacotes
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm test                # todos os testes
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @v3/domain test   # so o nucleo
```

## Decisoes arquiteturais

- ADR-0001 - Consolidacao da navegacao de paginas: docs/decisions/ADR-0001.md
- ADR-0002 - SerpAPI como fallback multi-fonte (so das fontes que ja temos): docs/decisions/ADR-0002.md
- ADR-0003 - Stack do front (React+Vite+TS, design system atomico proprio,
  tokens, responsive mobile/tablet/desktop/TV, WCAG 2.2 AA): docs/decisions/ADR-0003.md