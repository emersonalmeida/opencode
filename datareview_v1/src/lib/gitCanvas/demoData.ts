/**
 * Git Canvas — dataset DEMO determinístico (spec §37).
 *
 * Permite desenvolver e testar o Canvas antes de todas as integrações estarem
 * prontas. NUNCA misturar com dados reais: `demo: true` e a UI mostra
 * "DEMO MODE" de forma permanente. Timestamps derivam de uma base fixa para
 * o dataset ser estável (testes, screenshots, depuração).
 */
import type { ProjectMap } from "./types";

/** Base fixa: 2026-08-22T08:00:00Z. Todos os horários derivam dela. */
export const DEMO_BASE = Date.parse("2026-08-22T08:00:00Z");

const iso = (minutesAgo: number) => new Date(DEMO_BASE - minutesAgo * 60_000).toISOString();

/** Mapa demo do próprio appdatareview (fluxo OpenHands → GitHub → local). */
export function buildDemoProjectMap(): ProjectMap {
  return {
    demo: true,
    project: { name: "APPDATAREVIEW", description: "Dashboard de análise de reviews de apps" },
    repository: {
      id: "emersonalmeida/appdatareview",
      owner: "emersonalmeida",
      name: "appdatareview",
      defaultBranch: "main",
      url: "https://github.com/emersonalmeida/appdatareview",
      provider: "github",
      description: "App reviews intelligence dashboard",
    },
    connections: { git: "demo", agents: "demo", ci: "demo", local: "demo" },
    branches: [
      {
        name: "main",
        headSha: "9aac58e1",
        upstream: "origin/main",
        ahead: 0,
        behind: 0,
        isDefault: true,
        local: true,
        remote: true,
        lastCommitMessage: "chore(release): congela baseline v0.0.0",
        lastCommitDate: iso(30),
      },
      {
        name: "feature/visual-git-canvas",
        headSha: "8a91bc42",
        upstream: "origin/feature/visual-git-canvas",
        ahead: 3,
        behind: 0,
        isDefault: false,
        local: true,
        remote: true,
        lastCommitMessage: "feat(git-canvas): nodes de branch e commit",
        lastCommitDate: iso(12),
      },
      {
        name: "fix/apple-reviews-429",
        headSha: "77de10ab",
        ahead: 1,
        behind: 2,
        isDefault: false,
        local: true,
        remote: false,
        lastCommitMessage: "fix(apple): retry com backoff no rate limit",
        lastCommitDate: iso(190),
      },
    ],
    commits: [
      { sha: "9aac58e1", message: "chore(release): congela baseline v0.0.0", author: "Emerson Almeida", date: iso(30), parents: ["84bc2190"], branch: "main", filesChanged: 2, additions: 24, deletions: 3 },
      { sha: "84bc2190", message: "docs: atualiza README com scripts locais", author: "Emerson Almeida", date: iso(95), parents: ["51cd77ee"], branch: "main", filesChanged: 1, additions: 18, deletions: 6 },
      { sha: "51cd77ee", message: "feat(layouts): páginas customizadas /p/:id", author: "Emerson Almeida", date: iso(160), parents: ["3f02aa10"], branch: "main", filesChanged: 9, additions: 412, deletions: 37 },
      { sha: "3f02aa10", message: "fix(sonner): import correto do toaster", author: "OpenHands", date: iso(240), parents: [], branch: "main", filesChanged: 1, additions: 2, deletions: 2 },
      { sha: "8a91bc42", message: "feat(git-canvas): nodes de branch e commit", author: "OpenHands", date: iso(12), parents: ["b20e55f1"], branch: "feature/visual-git-canvas", filesChanged: 7, additions: 183, deletions: 42 },
      { sha: "b20e55f1", message: "feat(git-canvas): modelo de domínio tipado", author: "OpenHands", date: iso(28), parents: ["9aac58e1"], branch: "feature/visual-git-canvas", filesChanged: 4, additions: 220, deletions: 0 },
      { sha: "77de10ab", message: "fix(apple): retry com backoff no rate limit", author: "Emerson Almeida", date: iso(190), parents: ["9aac58e1"], branch: "fix/apple-reviews-429", filesChanged: 2, additions: 46, deletions: 11 },
    ],
    pullRequests: [
      {
        number: 42,
        title: "Visual Git Canvas — fundação",
        state: "open",
        sourceBranch: "feature/visual-git-canvas",
        targetBranch: "main",
        filesChanged: 11,
        additions: 403,
        deletions: 42,
        reviews: [{ id: "r1", author: "emersonalmeida", state: "pending", date: iso(8) }],
        checks: [
          { name: "build", status: "success" },
          { name: "test", status: "running" },
        ],
        comments: 2,
        url: "https://github.com/emersonalmeida/appdatareview/pull/42",
        updatedAt: iso(8),
      },
      {
        number: 41,
        title: "Layouts v3 — páginas customizadas",
        state: "merged",
        sourceBranch: "feature/layouts-v3",
        targetBranch: "main",
        filesChanged: 14,
        additions: 902,
        deletions: 118,
        reviews: [{ id: "r0", author: "emersonalmeida", state: "approved", date: iso(200) }],
        checks: [
          { name: "build", status: "success" },
          { name: "test", status: "success" },
        ],
        comments: 5,
        url: "https://github.com/emersonalmeida/appdatareview/pull/41",
        updatedAt: iso(200),
      },
    ],
    issues: [
      {
        number: 15,
        title: "Apple reviews: rate limit 429 no amp-api",
        state: "open",
        labels: ["bug", "coleta"],
        assignee: "emersonalmeida",
        linkedBranch: "fix/apple-reviews-429",
        url: "https://github.com/emersonalmeida/appdatareview/issues/15",
        updatedAt: iso(190),
      },
      {
        number: 16,
        title: "Visual Git Canvas — nova página Git",
        state: "open",
        labels: ["feature", "canvas"],
        linkedBranch: "feature/visual-git-canvas",
        linkedPR: 42,
        linkedAgent: "openhands-1",
        url: "https://github.com/emersonalmeida/appdatareview/issues/16",
        updatedAt: iso(10),
      },
    ],
    agents: [
      {
        id: "openhands-1",
        provider: "OpenHands",
        task: "Criar página Git com Visual Git Canvas",
        status: "working",
        branch: "feature/visual-git-canvas",
        filesChanged: 7,
        additions: 183,
        deletions: 42,
        testsPassed: 24,
        testsTotal: 26,
        steps: [
          { label: "Entender tarefa", state: "done" },
          { label: "Inspecionar repositório", state: "done" },
          { label: "Criar branch", state: "done" },
          { label: "Alterar arquivos", state: "done" },
          { label: "Executar testes", state: "running" },
          { label: "Criar commit", state: "pending" },
          { label: "Push", state: "pending" },
          { label: "Criar PR", state: "pending" },
        ],
        startedAt: iso(25),
      },
    ],
    workflows: [
      {
        id: "ci-1042",
        name: "CI",
        status: "running",
        commitSha: "8a91bc42",
        branch: "feature/visual-git-canvas",
        jobs: [
          { name: "build", status: "success" },
          { name: "test", status: "running" },
          { name: "lint", status: "queued" },
        ],
        url: "https://github.com/emersonalmeida/appdatareview/actions",
        updatedAt: iso(6),
      },
      {
        id: "ci-1041",
        name: "CI",
        status: "success",
        commitSha: "9aac58e1",
        branch: "main",
        jobs: [
          { name: "build", status: "success" },
          { name: "test", status: "success" },
          { name: "lint", status: "success" },
        ],
        url: "https://github.com/emersonalmeida/appdatareview/actions",
        updatedAt: iso(29),
      },
    ],
    deployments: [
      {
        id: "dep-prod-1",
        environment: "production",
        status: "success",
        url: "https://appdatareview.example.com",
        version: "v0.0.0",
        commitSha: "9aac58e1",
        date: iso(28),
      },
    ],
    releases: [
      {
        tag: "v0.0.0",
        name: "Baseline congelada",
        date: iso(28),
        commits: 1204,
        prs: 41,
        notes: "Baseline v0.0.0 do appdatareview.",
        url: "https://github.com/emersonalmeida/appdatareview/releases/tag/v0.0.0",
      },
    ],
    local: {
      connected: true,
      branch: "main",
      headSha: "84bc2190",
      ahead: 0,
      behind: 2,
      modifiedFiles: 3,
      stagedFiles: 1,
      untrackedFiles: 1,
    },
    codeTree: {
      id: "root",
      name: "appdatareview",
      kind: "folder",
      children: [
        {
          id: "src",
          name: "src",
          kind: "folder",
          children: [
            { id: "src/pages", name: "pages", kind: "folder", children: [
              { id: "src/pages/GitCanvas.tsx", name: "GitCanvas.tsx", kind: "file" },
              { id: "src/pages/Index.tsx", name: "Index.tsx", kind: "file" },
            ] },
            { id: "src/lib", name: "lib", kind: "folder", children: [
              { id: "src/lib/gitCanvas", name: "gitCanvas", kind: "folder", children: [
                { id: "src/lib/gitCanvas/types.ts", name: "types.ts", kind: "file" },
                { id: "src/lib/gitCanvas/providers.ts", name: "providers.ts", kind: "file" },
              ] },
            ] },
            { id: "src/components", name: "components", kind: "folder", children: [
              { id: "src/components/gitCanvas", name: "gitCanvas", kind: "folder" },
            ] },
          ],
        },
        { id: "server", name: "server", kind: "folder", children: [
          { id: "server/routes", name: "routes", kind: "folder" },
        ] },
        { id: "package.json", name: "package.json", kind: "file" },
      ],
    },
  };
}
