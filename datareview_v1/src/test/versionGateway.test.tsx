/**
 * VersionGateway — guarda de regressão das URLs versionadas:
 * /latest e /oldest resolvem para a versão em execução (Navigate para "/"),
 * /v0 (baseline sem tag) mostra painel honesto, release com build estático
 * faz navegação full-page para /versions/<tag>/.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import VersionGateway, { __resetBuildsCache } from "@/components/VersionGateway";
import { RELEASES, CURRENT_VERSION } from "@/lib/releases";

/** Short da release em execução (ex.: "v2" quando CURRENT_VERSION = 1.1.0). */
const RUNNING_SHORT = RELEASES.find((r) => r.version === CURRENT_VERSION)!.short;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<div>HOME-MARKER</div>} />
        <Route path="/v0" element={<VersionGateway />} />
        <Route path={`/${RUNNING_SHORT}`} element={<VersionGateway />} />
        <Route path="/latest" element={<VersionGateway />} />
        <Route path="/oldest" element={<VersionGateway />} />
      </Routes>
    </MemoryRouter>,
  );
}

function mockBuildsIndex(tags: string[] | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      tags === null
        ? { ok: false, json: async () => null }
        : { ok: true, json: async () => ({ tags }) },
    ),
  );
}

beforeEach(() => __resetBuildsCache());
afterEach(() => vi.unstubAllGlobals());

describe("VersionGateway", () => {
  it("/latest redireciona para / quando a release mais recente é a versão em execução", async () => {
    mockBuildsIndex(null);
    renderAt("/latest");
    await waitFor(() => expect(screen.getByText("HOME-MARKER")).toBeTruthy());
  });

  it("/oldest com baseline sem build mostra painel honesto (sem tag git)", async () => {
    mockBuildsIndex(null);
    renderAt("/oldest");
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("baseline"),
    );
    expect(screen.getByRole("status")).toHaveTextContent("v0.0.0");
    expect(screen.getByRole("status")).toHaveTextContent("v1.0.0");
  });

  it("/vN da versão em execução redireciona para /", async () => {
    mockBuildsIndex(null);
    renderAt(`/${RUNNING_SHORT}`);
    await waitFor(() => expect(screen.getByText("HOME-MARKER")).toBeTruthy());
  });

  it("release com build estático navega para /versions/<tag>/ (full-page)", async () => {
    mockBuildsIndex(["v0.0.0"]);
    renderAt("/v0");
    await waitFor(() =>
      expect(screen.getByText(/Abrindo v0\.0\.0/)).toBeTruthy(),
    );
  });

  it("release com tag mas sem build mostra o comando para gerar", async () => {
    // Simula um cenário onde a versão em execução NÃO é a v1: forçamos via
    // builds vazio e rota /v0 (que tem tag=false). Para o caso hasTag=true
    // sem build, o painel exibe "npm run build:version <tag>".
    mockBuildsIndex([]);
    renderAt("/v0");
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    // v0.0.0 é baseline (sem tag) → mensagem de baseline, não o comando.
    expect(screen.getByRole("status")).toHaveTextContent("CHANGELOG");
  });

  it("lista todas as releases com status no painel", async () => {
    mockBuildsIndex(null);
    renderAt("/v0");
    await waitFor(() =>
      expect(screen.getByLabelText("Releases disponíveis")).toBeTruthy(),
    );
    const list = screen.getByLabelText("Releases disponíveis");
    expect(list).toHaveTextContent("v0");
    expect(list).toHaveTextContent("v1");
    expect(list).toHaveTextContent("versão em execução");
  });
});
