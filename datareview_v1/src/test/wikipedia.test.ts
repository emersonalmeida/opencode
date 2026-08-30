// @vitest-environment node
/**
 * Conector Wikipedia (server/routes/wikipedia) — discovery por search +
 * artigo por pageid/title, com fetch mockado e camada RAW fechada por run.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response } from "express";
import { wikipedia } from "../../server/routes/wikipedia";
import { listArtifacts, listRunEvents, type RawArtifact } from "../../server/lib/rawStore";
import { tmpdir } from "node:os";

const RUN_DIR = `${tmpdir()}/_tmp_wiki_${Date.now()}`;
const savedEnv = process.env.RAW_STORE_DIR;

beforeEach(() => {
  vi.unstubAllGlobals();
  // Dir único por teste: isola eventos (evita cross-test contaminado).
  process.env.RAW_STORE_DIR = `${RUN_DIR}_${Math.random().toString(36).slice(2, 9)}`;
});
afterEach(() => {
  process.env.RAW_STORE_DIR = savedEnv;
});

function fakeRes() {
  const captured = { status: 200, body: null as unknown };
  interface FakeChain {
    set(name: string): FakeChain;
    status(code: number): FakeChain;
    json(payload: unknown): FakeChain;
  }
  const self: FakeChain = {
    set() {
      return self;
    },
    status(code) {
      captured.status = code;
      return self;
    },
    json(payload) {
      captured.body = payload;
      return self;
    },
  };
  return { res: self as unknown as Response, captured };
}

function runHandler(body: unknown) {
  const { res, captured } = fakeRes();
  const req = { body } as Request;
  // RequestHandler tipado exige next; chamamos direto com cast.
  const handle = (wikipedia as (req: Request, res: Response) => Promise<unknown> | unknown)(req, res);
  return { handle: Promise.resolve(handle), captured };
}

describe("wikipedia connector", () => {
  it("search: descobre candidatos com snippet e grava RAW", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            query: {
              search: [
                { title: "UX Research", pageid: 111, snippet: "metodologia de pesquisa" },
                { title: "Double Diamond", pageid: 222, snippet: "divergir e convergir" },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const { handle, captured } = runHandler({ action: "search", query: "ux research", lang: "pt" });
    await handle;

    const body = captured.body as { action: string; results: { title: string }[]; count: number };
    expect(body.action).toBe("search");
    expect(body.count).toBe(2);

    // Camada RAW/provenance fechada no run + artifact hash.
    const artifacts = listArtifacts();
    expect(artifacts[0].endpoint).toBe("wikipedia-search");
    expect((artifacts[0] as RawArtifact).hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("article: retorna extract do artigo por pageid", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response(
          JSON.stringify({ query: { pages: { 333: { title: "UX", extract: "User Experience..." } } } }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const { handle, captured } = runHandler({ action: "article", pageid: 333 });
    await handle;

    const body = captured.body as { article: { extract: string }; found: boolean };
    expect(body.found).toBe(true);
    expect(body.article.extract).toContain("User Experience");
  });

  it("validação: 400 sem iniciar run quando params ausentes", async () => {
    const { handle, captured } = runHandler({ action: "search" }); // query ausente
    await handle;
    expect(captured.status).toBe(400);
    expect(listRunEvents()).toHaveLength(0);
  });

  it("action desconhecida → 400 sem deixar run pendente", async () => {
    const { handle, captured } = runHandler({ action: "bogus" });
    await handle;
    expect(captured.status).toBe(400);
    // Action inválida não inicia run — nenhum evento deve existir no dir único.
    expect(listRunEvents()).toHaveLength(0);
  });
});
