import { describe, it, expect } from "vitest";
import { buildDemoProjectMap, DEMO_BASE } from "@/lib/gitCanvas/demoData";
import { buildCanvasGraph, buildSearchIndex, searchGraph } from "@/lib/gitCanvas/graph";
import { computeProjectHealth, buildTimeline, GIT_CANVAS_VIEWS } from "@/lib/gitCanvas/types";
import { GIT_PROVIDERS, AGENT_PROVIDERS, CI_PROVIDERS, DEPLOYMENT_PROVIDERS, plannedStatus, DEFAULT_REPO } from "@/lib/gitCanvas/providers";

const map = buildDemoProjectMap();

describe("gitCanvas demoData (§37)", () => {
  it("é determinístico: duas construções produzem o mesmo mapa", () => {
    expect(JSON.stringify(buildDemoProjectMap())).toBe(JSON.stringify(buildDemoProjectMap()));
  });

  it("sempre marcado como demo (nunca misturar com dados reais)", () => {
    expect(map.demo).toBe(true);
    expect(map.connections.git).toBe("demo");
    expect(map.connections.agents).toBe("demo");
  });

  it("timestamps derivam da base fixa", () => {
    for (const c of map.commits) expect(Date.parse(c.date)).toBeLessThanOrEqual(DEMO_BASE);
  });

  it("cobre as entidades principais do fluxo OpenHands → GitHub → local (§52)", () => {
    expect(map.branches.length).toBeGreaterThanOrEqual(3);
    expect(map.commits.length).toBeGreaterThanOrEqual(5);
    expect(map.pullRequests.length).toBeGreaterThanOrEqual(2);
    expect(map.agents.some((a) => a.provider === "OpenHands")).toBe(true);
    expect(map.workflows.length).toBeGreaterThanOrEqual(1);
    expect(map.deployments.length).toBeGreaterThanOrEqual(1);
    expect(map.releases.length).toBeGreaterThanOrEqual(1);
    expect(map.local.connected).toBe(true);
  });
});

describe("gitCanvas graph — visão projeto (§3)", () => {
  const graph = buildCanvasGraph(map, "project");

  it("monta o mapa vivo: projeto, remoto, local, branches, PRs, issues, agentes, deploy", () => {
    const kinds = new Set(graph.nodes.map((n) => n.data.kind));
    for (const k of ["project", "remote", "local-repository", "branch", "commit", "pull-request", "issue", "agent", "workflow", "deployment", "release"] as const)
      expect(kinds.has(k), `kind ${k} presente`).toBe(true);
  });

  it("toda edge conecta nodes existentes (integridade referencial)", () => {
    const ids = new Set(graph.nodes.map((n) => n.id));
    for (const e of graph.edges) {
      expect(ids.has(e.source), `source de ${e.id}`).toBe(true);
      expect(ids.has(e.target), `target de ${e.id}`).toBe(true);
    }
  });

  it("ids de node são únicos", () => {
    const ids = graph.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("commits da mesma branch formam uma cadeia ordenada (§8: branches são caminhos)", () => {
    const featureCommits = graph.nodes
      .filter((n) => n.data.kind === "commit" && n.data.meta?.branch === "feature/visual-git-canvas")
      .sort((a, b) => a.position.x - b.position.x);
    expect(featureCommits.length).toBe(2);
    expect(featureCommits[0].position.x).toBeLessThan(featureCommits[1].position.x);
  });

  it("aresta de sincronização remoto↔local mostra divergência (§12)", () => {
    const sync = graph.edges.find((e) => e.id === "e:sync");
    expect(sync).toBeTruthy();
    expect(String(sync!.label)).toContain("↓2");
  });

  it("alterações locais geram node de diff com aviso (§12)", () => {
    const changes = graph.nodes.find((n) => n.id === "local:changes");
    expect(changes).toBeTruthy();
    expect(changes!.data.status).toBe("warning");
    expect(String(changes!.data.sub)).toContain("3 modificados");
  });

  it("agente trabalhando tem edge animada para a branch (§13)", () => {
    const ae = graph.edges.find((e) => e.id === "e:agent-openhands-1");
    expect(ae?.animated).toBe(true);
  });

  it("issue conecta a branch, PR e agente relacionados (§16)", () => {
    const rels = graph.edges.filter((e) => e.source === "issue:16").map((e) => e.target);
    expect(rels).toContain("branch:feature/visual-git-canvas");
    expect(rels).toContain("pr:42");
    expect(rels).toContain("agent:openhands-1");
  });
});

describe("gitCanvas graph — visões como projeções (§34)", () => {
  it("as 9 visões existem (7 projeções + timeline cronológica + blocos)", () => {
    expect(GIT_CANVAS_VIEWS.map((v) => v.id)).toEqual(["project", "git", "agents", "review", "architecture", "deploy", "local", "timeline", "blocks"]);
  });

  it("visão git: só branches/commits (sem PRs nem issues)", () => {
    const g = buildCanvasGraph(map, "git");
    const kinds = new Set(g.nodes.map((n) => n.data.kind));
    expect(kinds.has("branch")).toBe(true);
    expect(kinds.has("commit")).toBe(true);
    expect(kinds.has("pull-request")).toBe(false);
    expect(kinds.has("issue")).toBe(false);
  });

  it("visão review: PRs + CI (sem issues)", () => {
    const g = buildCanvasGraph(map, "review");
    const kinds = new Set(g.nodes.map((n) => n.data.kind));
    expect(kinds.has("pull-request")).toBe(true);
    expect(kinds.has("workflow")).toBe(true);
    expect(kinds.has("issue")).toBe(false);
  });

  it("visão arquitetura: árvore de código (folders/files)", () => {
    const g = buildCanvasGraph(map, "architecture");
    const kinds = new Set(g.nodes.map((n) => n.data.kind));
    expect(kinds.has("folder")).toBe(true);
    expect(kinds.has("file")).toBe(true);
    expect(kinds.has("branch")).toBe(false);
  });

  it("visão deploy: workflows/deployments/releases", () => {
    const g = buildCanvasGraph(map, "deploy");
    const kinds = new Set(g.nodes.map((n) => n.data.kind));
    expect(kinds.has("workflow")).toBe(true);
    expect(kinds.has("deployment")).toBe(true);
    expect(kinds.has("release")).toBe(true);
  });
});

describe("gitCanvas — saúde do projeto (§23) e timeline (§22)", () => {
  it("saúde é derivada de sinais reais, nunca inventada", () => {
    const h = computeProjectHealth(map);
    expect(h.status).toBe("attention");
    expect(h.signals).toContain("PR aguardando review");
    expect(h.signals).toContain("Agente trabalhando");
    expect(h.signals).toContain("Branches divergentes");
  });

  it("mapa saudável quando não há sinais", () => {
    const clean = buildDemoProjectMap();
    clean.workflows = clean.workflows.filter((w) => w.status !== "failure");
    clean.pullRequests = [];
    clean.agents = [];
    clean.branches = clean.branches.map((b) => ({ ...b, ahead: 0, behind: 0 }));
    clean.local = { ...clean.local, modifiedFiles: 0, untrackedFiles: 0 };
    const h = computeProjectHealth(clean);
    expect(h.status).toBe("healthy");
    expect(h.signals).toHaveLength(0);
  });

  it("timeline ordenada do mais recente ao mais antigo, com nodeId para focar", () => {
    const t = buildTimeline(map);
    expect(t.length).toBeGreaterThan(5);
    for (let i = 1; i < t.length; i++)
      expect(Date.parse(t[i - 1].date)).toBeGreaterThanOrEqual(Date.parse(t[i].date));
    for (const e of t) expect(e.nodeId, `nodeId de ${e.id}`).toBeTruthy();
  });
});

describe("gitCanvas — busca global (§35)", () => {
  it("indexa todos os nodes e encontra por label/sub/id", () => {
    const graph = buildCanvasGraph(map, "project");
    const index = buildSearchIndex(graph);
    expect(index.length).toBe(graph.nodes.length);
    expect(searchGraph(index, "visual git").some((r) => r.kind === "branch")).toBe(true);
    expect(searchGraph(index, "8a91bc").some((r) => r.kind === "commit")).toBe(true);
    expect(searchGraph(index, "PR #42").some((r) => r.kind === "pull-request")).toBe(true);
  });

  it("query curta demais retorna vazio", () => {
    expect(searchGraph(buildSearchIndex(buildCanvasGraph(map)), "m")).toEqual([]);
  });
});

describe("gitCanvas providers (§24/§54)", () => {
  it("registries cobrem os providers conceituais do spec", () => {
    expect(GIT_PROVIDERS.map((p) => p.kind)).toEqual(["github", "gitlab", "bitbucket", "gitea", "local"]);
    expect(AGENT_PROVIDERS.map((p) => p.kind)).toContain("openhands");
    expect(CI_PROVIDERS.map((p) => p.kind)).toContain("github-actions");
    expect(DEPLOYMENT_PROVIDERS.length).toBeGreaterThanOrEqual(3);
  });

  it("primeiro provider é GitHub, primeiro agente é OpenHands", () => {
    expect(GIT_PROVIDERS[0].kind).toBe("github");
    expect(AGENT_PROVIDERS[0].kind).toBe("openhands");
    expect(DEFAULT_REPO.name).toBe("appdatareview");
  });

  it("providers planejados têm status honesto (nunca fingem conexão)", () => {
    const gitlab = GIT_PROVIDERS.find((p) => p.kind === "gitlab")!;
    const s = plannedStatus(gitlab);
    expect(s.connected).toBe(false);
    expect(s.state).toBe("disconnected");
    expect(s.message).toBe("Disponível em breve");
  });
});

describe("gitCanvas graph — visão Timeline (linha do tempo)", () => {
  it("inclui TODOS os objetos datáveis + a raiz do projeto", () => {
    const g = buildCanvasGraph(map, "timeline");
    const ids = new Set(g.nodes.map((n) => n.id));
    expect(ids.has("project:root")).toBe(true);
    for (const c of map.commits) expect(ids.has(`commit:${c.sha}`)).toBe(true);
    for (const p of map.pullRequests) expect(ids.has(`pr:${p.number}`)).toBe(true);
    for (const i of map.issues) expect(ids.has(`issue:${i.number}`)).toBe(true);
    for (const a of map.agents) expect(ids.has(`agent:${a.id}`)).toBe(true);
    for (const w of map.workflows) expect(ids.has(`workflow:${w.id}`)).toBe(true);
    for (const d of map.deployments) expect(ids.has(`deploy:${d.id}`)).toBe(true);
    for (const r of map.releases) expect(ids.has(`release:${r.tag}`)).toBe(true);
  });

  it("ordena do mais antigo (esquerda) ao mais recente (direita)", () => {
    const g = buildCanvasGraph(map, "timeline");
    const dated = g.nodes
      .filter((n) => n.id !== "project:root")
      .map((n) => {
        const meta = (n.data.meta ?? {}) as Record<string, unknown>;
        const iso = (meta.updatedAt ?? meta.date ?? meta.startedAt ?? "") as string;
        return { x: n.position.x, ms: Date.parse(iso) };
      })
      .filter((d) => Number.isFinite(d.ms));
    for (let i = 1; i < dated.length; i++) {
      // x cresce com o tempo: itens mais recentes estão mais à direita
      if (dated[i].x !== dated[i - 1].x) {
        expect(dated[i].x > dated[i - 1].x).toBe(true);
        expect(dated[i].ms >= dated[i - 1].ms).toBe(true);
      }
    }
  });

  it("cada nó mostra a data curta no subtítulo (dd/mm/aaaa)", () => {
    const g = buildCanvasGraph(map, "timeline");
    const commit = g.nodes.find((n) => n.data.kind === "commit")!;
    expect(commit.data.sub).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    const pr = g.nodes.find((n) => n.data.kind === "pull-request")!;
    expect(pr.data.sub).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("lanes verticais por categoria: commits, PRs, issues, agentes, CI, deploys, releases", () => {
    const g = buildCanvasGraph(map, "timeline");
    const yOf = (kind: string) => g.nodes.find((n) => n.data.kind === kind)!.position.y;
    expect(yOf("commit")).toBe(0);
    expect(yOf("pull-request")).toBe(165);
    expect(yOf("issue")).toBe(325);
    expect(yOf("agent")).toBe(485);
    expect(yOf("workflow")).toBe(645);
    expect(yOf("deployment")).toBe(805);
    expect(yOf("release")).toBe(965);
  });

  it("dedup por sha: commit em mais de uma branch vira UM nó só", () => {
    const dup = { ...map, commits: [...map.commits, { ...map.commits[0], branch: "outra" }] };
    const g = buildCanvasGraph(dup, "timeline");
    const count = g.nodes.filter((n) => n.id === `commit:${map.commits[0].sha}`).length;
    expect(count).toBe(1);
  });

  it("toda edge referencia nós existentes (nada órfão)", () => {
    const g = buildCanvasGraph(map, "timeline");
    const ids = new Set(g.nodes.map((n) => n.id));
    for (const e of g.edges) {
      expect(ids.has(e.source)).toBe(true);
      expect(ids.has(e.target)).toBe(true);
    }
  });

  it("a raiz aponta para o PRIMEIRO evento da linha do tempo", () => {
    const g = buildCanvasGraph(map, "timeline");
    const rootEdge = g.edges.find((e) => e.id === "e:root-timeline-start")!;
    const target = g.nodes.find((n) => n.id === rootEdge.target)!;
    const others = g.nodes.filter((n) => n.id !== "project:root");
    for (const o of others) expect(target.position.x <= o.position.x).toBe(true);
  });

  it("ids únicos e grafo estável (duas construções = mesmo grafo)", () => {
    const g1 = buildCanvasGraph(map, "timeline");
    const g2 = buildCanvasGraph(map, "timeline");
    const ids = g1.nodes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(JSON.stringify(g1.nodes.map((n) => n.id))).toBe(JSON.stringify(g2.nodes.map((n) => n.id)));
  });

  it("objetos sem data vão ao fim (nunca são descartados)", () => {
    const semData = {
      ...map,
      pullRequests: [...map.pullRequests, { ...map.pullRequests[0], number: 999, updatedAt: "agora" }],
    };
    const g = buildCanvasGraph(semData, "timeline");
    const pr999 = g.nodes.find((n) => n.id === "pr:999")!;
    const maxX = Math.max(...g.nodes.filter((n) => n.id !== "project:root").map((n) => n.position.x));
    expect(pr999.position.x).toBe(maxX);
  });
});

