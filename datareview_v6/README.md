# datareview_v6

Núcleo de fontes unificado da v6 — uma evolução da v4 com três objetivos:

1. **Todas as fontes** que já temos, organizadas num núcleo único.
2. **8 fontes ativas por padrão**, com opção de ativar mais: estratégia de priorizar **fontes que não precisam de autenticação**.
3. **Extrair o máximo de dados de cada fonte**: catálogo fonte-a-fonte com dados, metadados, parâmetros, recursos, capacidades, chaves e possibilidades de engine/ação.



## Estrutura

```
packages/
  contracts/  tipos compartilhados (única fonte de verdade)              @v6/contracts
  domain/     núcleo puro hexagonal: ports + pipeline (zero deps)        @v6/domain
  sources/    núcleo de fontes: catálogo + ativação + adaptadores           @v6/sources
apps/
  web/        página de catálogo fonte-a-fonte (ativação por fonte)        (em construção)
```

## Fontes ativas por padrão

| id | por quê |
|----|---------|
| suggest | autocomplete público, sem chave |
| trends | Google Trends explore, sem chave |
| serp | bing/ddg sem chave (brave/google BYOK opcional) |
| youtube | scraping público sem chave |
| googleplay | HTML público sem chave (search/app) |
| apple | amp-api/RSS públicos sem chave |
| producthunt | feed público sem chave |
| reclameaqui | endpoints públicos sem chave |

As demais 51 fontes ficam catalogadas, prontas para ativar na UI.

## Comandos

```bash
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm install
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm typecheck     # todos os pacotes
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm test           # todos os testes
COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm --filter @v6/sources gen:catalog
```

## Fluxo incremental

Cada pedaço termina validado (`typecheck` + testes verdes) e é commitado +
pushado na `main` antes de seguir ao próximo — para reduzir retrabalho e
perda de trabalho. Commits pequenos e atômicos; sem juntar mudanças não
relacionadas; sem reescrever histórico (`main` recebe push direto).

## Reaproveitamento das versões anteriores

- `packages/contracts` e `packages/domain` portados da **v4** (testes do
  domínio idênticos):
- Catálogo 59 fontes portado da **v4** (fonte de verdade em
  `packages/sources/src/catalog/`), com novo campo `enabledByDefault` e
  política de prioridade sem-auth (`auth: "none"` > `byok` > `oauth`).
- Adaptadores das fontes ativas portados da **v4** (com helpers consolidados
  em `packages/sources/src/adapters/shared.ts`), sem a camada Express —
  o núcleo é a única casa dos adaptadores.

## Decisões arquiteturais registradas

- ADR-0001 — Núcleo de fontes com ativação por padrão e prioridade sem-auth
- ADR-0002 — Reuso do núcleo da v4 (contracts/domain) sem duplicação de modelos
- ADR-0003 — Adaptadores vivem no núcleo `packages/sources` (não em apps)
- ADR-0004 — Ativação é estado derivável (default do catálogo + overrides de usuário,
  nunca um campo "ligado/desligado" espalhado por fonte)
- ADR-0005 — Página fonte-a-fonte:(dados, metadados, parâmetros, recurso,
  capacidades, chaves, ToS e possibilidades) com toggle de ativação local