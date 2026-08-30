# datareview_v2

Núcleo unificado e reutilizável de coleta/análise multi-fonte — front e back
desacoplados por um **contrato único**. Reescrita dirigida e evolutiva do
`datareview` (monolito de ~80k linhas) com foco em fronteiras claras.

## Princípios (decisões arquiteturais registradas)

1. **Modular monolith** — não microserviços. As ~35 fontes vivem no mesmo
   processo, separadas por **adaptadores** (1 pasta por fonte), não por deploy.

2. **Hexagonal (Ports & Adapters)** — o núcleo (`packages/domain`) é puro
   (zero deps de I/O/HTTP/React) e só conhece *ports*. Fontes, persistência
   e IA são *adaptadores* trocáveis. Trocar o front nunca toca o núcleo.

3. **Headless + API-first** — o backend nunca serve HTML; expõe só JSON/SSE
   via contrato OpenAPI. Qualquer front (React, CLI, agente IA) consume
   a mesma API. Nu front vira consumidor enxuto e trocável.

4. **Contract-first** — `packages/contracts` é a única fonte de verdade dos tipos.

   Front, back e fontes importam dele — zero drift entre camadas. Um só
   `NormalizedItem` (não dois, como no legado: `UniItem` vs `SourceItem`).
   
5. **Medallion (Bronze→Silver→Gold)** — o `raw` da fonte fica preservado em
   `meta` (auditável); o pipeline refina progressivamente: coletar raw →
   normalizar → deduplicar → persistir → derivar → IA.

6. **Pequenos pedaços, sempre verdes** — cada etapa termina validada
   (typecheck + testes) e é commitada/pushada na `main` antes de seguir para
   a próxima — para reduzir retrabalho e perda de trabalho.

## Estrutura

```
apps/
  api/       backend headless (node:http, montado a partir do registry)
  web/       front React enxuto (consome só contracts + api client)
packages/
  contracts/ tipos compartilhados (única fonte de verdade)
  domain/    núcleo puro: ports + pipeline + dedup/derive (zero deps)
  sources/   registry de adaptadores de fonte (1 interface, N fontes)
```

## Pipeline canônico

```
DISCOVER → SEARCH → COLLECT → NORMALIZE → DEDUPLICATE → STORE DATASET
→ DERIVE INSIGHTS → AI ANALYSIS
```

## Comandos

```bash
pnpm install
pnpm typecheck      # todos os pacotes
pnpm test            # todos os testes
pnpm --filter @v2/domain test   # só o núcleo
```

## Roadmap de portabilidade de fontes

Ordem sugerida para portar as fontes do monolito datareview para o v2.
Cada lote termina validado com typecheck e testes antes do proximo.

### Lote 1 - declarativas, zero auth, JSON direto

Adaptadores que so mapeiam JSON publico, ja padronizados no monolito
como uniConnectors e sourceEngine. Portar 1 para 1 trocando
o contrato por @v2/contracts.

- Hacker News com endpoint Algolia.
- Repositorios GitHub com API publica.
- Steam com appdetails.
- Product Hunt com posts.
- arXiv com query.
- GDELT com documents.
- YouTube, Reddit, SERP, Stackexchange e SemanticScholar.
  Quando a fonte exigir chave, manter auth byok e o segredo no backend.

### Lote 2 - lojas, scraping documentado

A base historica do produto: Google Play e Apple App Store,
reviews e top charts. Scraping ou API nao oficial: portar
com method, tosNote e rate-limit declarados no adaptador,
padrao do sourceRegistry do monolito.

### Lote 3 - derivados e especiais

- Google Suggest e autocomplete, sem API oficial.
- Google Trends, endpoints publicos nao documentados.
  Exigem paramsSpec de regiao ou janela.
- Reclame Aqui, demonstrativos e ambientes sem chave publica.
- Fontes que precisam de pos-processamento, dedup ou derive, antes do item final.

### Criterios de aceite por lote

1. Testes do pacote sources verdes, mesmos casos do monolito.
2. Tipo NormalizedItem do @v2/contracts sem extensoes por fonte.
   Payload especifico vai em meta, nunca em campos novos.
3. Zero I/O fora do adaptador: o nucleo domain nao conhece HTTP ou scraping.

## Decisoes arquiteturais

- ADR-0001 - Consolidacao da navegacao de paginas: docs/decisions/ADR-0001.md
- ADR-0002 - SerpAPI como fallback multi-fonte (so das fontes que ja temos): docs/decisions/ADR-0002.md
