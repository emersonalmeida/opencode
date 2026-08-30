import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLocalSnapshotMap } from "@/lib/gitCanvas/gitLocalClient";

const SNAP_FILES = [
  { name: "git-log.txt", text: "def5678|abc1234|Dev|2026-08-02T10:00:00Z|feat: dois\n\n1\t0\tsrc/a.ts\n\nabc1234||Dev|2026-08-01T10:00:00Z|init\n\n1\t0\tsrc/a.ts\n" },
  { name: "git-branches.txt", text: "* main\n  feature-x\n" },
  { name: "git-status.txt", text: " M src/a.ts\n" },
  { name: "git-reflog.txt", text: "def5678 HEAD@{0}: commit: feat: dois" },
];

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: () => "application/json" },
  })));
}

describe("fetchLocalSnapshotMap", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("converte snapshot válido em ProjectMap com source local-snapshot", async () => {
    mockFetch({ ok: true, repoName: "meu-repo", files: SNAP_FILES, failed: [], generatedAt: "2026-08-22T15:00:00Z" });
    const r = await fetchLocalSnapshotMap();
    expect(r.ok).toBe(true);
    expect(r.map?.project.name).toBe("meu-repo");
    expect(r.map?.uploadMeta?.source).toBe("local-snapshot");
    expect(r.map?.commits.length).toBeGreaterThanOrEqual(2);
    expect(r.map?.local.modifiedFiles).toBe(1);
    expect(r.headSha).toBeTruthy();
  });

  it("adiciona gap honesto quando comandos falham no servidor", async () => {
    mockFetch({ ok: true, repoName: "r", files: SNAP_FILES, failed: ["git-reflog.txt"], generatedAt: "2026-08-22T15:00:00Z" });
    const r = await fetchLocalSnapshotMap();
    expect(r.ok).toBe(true);
    expect(r.map?.uploadMeta?.gaps.some((g) => g.includes("git-reflog.txt"))).toBe(true);
    expect(r.map?.uploadMeta?.source).toBe("local-snapshot");
  });

  it("ok=false com mensagem quando o servidor não é repo git", async () => {
    mockFetch({ ok: false, files: [], failed: [], message: "O diretório do servidor não é um repositório git.", generatedAt: "x" }, 503);
    const r = await fetchLocalSnapshotMap();
    expect(r.ok).toBe(false);
    expect(r.message).toContain("não é um repositório git");
  });

  it("ok=false quando o servidor está fora do ar", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED"); }));
    const r = await fetchLocalSnapshotMap();
    expect(r.ok).toBe(false);
    expect(r.message).toContain("dev:server");
  });

  it("ok=false quando o snapshot não tem commits nem branches", async () => {
    mockFetch({ ok: true, repoName: "vazio", files: [{ name: "git-status.txt", text: "" }], failed: [], generatedAt: "x" });
    const r = await fetchLocalSnapshotMap();
    expect(r.ok).toBe(false);
    expect(r.message).toContain("sem commits nem branches");
  });
});
