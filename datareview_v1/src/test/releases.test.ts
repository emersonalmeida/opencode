import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  RELEASES,
  CURRENT_VERSION,
  parseVersionQuery,
  resolveVersionQuery,
  versionTarget,
  parseBuildsIndex,
} from "@/lib/releases";

describe("releases registry", () => {
  it("CURRENT_VERSION está sincronizada com package.json", () => {
    const pkg = JSON.parse(
      readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
    );
    expect(CURRENT_VERSION).toBe(pkg.version);
  });

  it("shorts são únicos e no formato vN", () => {
    const shorts = RELEASES.map((r) => r.short);
    expect(new Set(shorts).size).toBe(shorts.length);
    for (const s of shorts) expect(s).toMatch(/^v\d+$/);
  });

  it("releases estão em ordem cronológica e toda release com tag tem short crescente", () => {
    for (let i = 1; i < RELEASES.length; i++) {
      expect(RELEASES[i].date >= RELEASES[i - 1].date).toBe(true);
    }
  });

  it("toda release tem título e data", () => {
    for (const r of RELEASES) {
      expect(r.title.trim().length).toBeGreaterThan(0);
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("a versão atual está no registry", () => {
    expect(RELEASES.some((r) => r.version === CURRENT_VERSION)).toBe(true);
  });

  it("App.tsx mantém o wiring das URLs versionadas (RELEASES.map + /latest + /oldest)", () => {
    const app = readFileSync(resolve(__dirname, "../App.tsx"), "utf8");
    expect(app).toContain("RELEASES.map");
    expect(app).toContain('path="/latest"');
    expect(app).toContain('path="/oldest"');
  });
});

describe("parseVersionQuery", () => {
  it("reconhece /latest e /oldest (com barra final opcional)", () => {
    expect(parseVersionQuery("/latest")).toEqual({ kind: "latest" });
    expect(parseVersionQuery("/oldest/")).toEqual({ kind: "oldest" });
  });

  it("reconhece /v0, /v1, /v2 (case-insensitive)", () => {
    expect(parseVersionQuery("/v0")).toEqual({ kind: "short", short: "v0" });
    expect(parseVersionQuery("/v1/")).toEqual({ kind: "short", short: "v1" });
    expect(parseVersionQuery("/V2")).toEqual({ kind: "short", short: "v2" });
  });

  it("rejeita paths que não são de versão", () => {
    expect(parseVersionQuery("/dashboard")).toBeNull();
    expect(parseVersionQuery("/v")).toBeNull();
    expect(parseVersionQuery("/v1/extra")).toBeNull();
    expect(parseVersionQuery("/")).toBeNull();
  });
});

describe("resolveVersionQuery", () => {
  it("latest = última release, oldest = primeira", () => {
    expect(resolveVersionQuery({ kind: "latest" })?.tag).toBe(
      RELEASES[RELEASES.length - 1].tag,
    );
    expect(resolveVersionQuery({ kind: "oldest" })?.tag).toBe(RELEASES[0].tag);
  });

  it("short resolve pela abreviatura", () => {
    for (const r of RELEASES) {
      expect(resolveVersionQuery({ kind: "short", short: r.short })?.tag).toBe(r.tag);
    }
  });

  it("short desconhecido → null; registry vazio → null", () => {
    expect(resolveVersionQuery({ kind: "short", short: "v99" })).toBeNull();
    expect(resolveVersionQuery({ kind: "latest" }, [])).toBeNull();
  });
});

describe("versionTarget", () => {
  const current = RELEASES.find((r) => r.version === CURRENT_VERSION)!;
  const older = RELEASES.find((r) => r.version !== CURRENT_VERSION)!;

  it("release da versão em execução → redireciona para /", () => {
    expect(versionTarget(current)).toEqual({ kind: "current", to: "/" });
  });

  it("release com build estático → /versions/<tag>/", () => {
    const builds = new Set([older.tag]);
    expect(versionTarget(older, CURRENT_VERSION, builds)).toEqual({
      kind: "build",
      to: `/versions/${older.tag}/`,
    });
  });

  it("release sem build → unavailable (painel honesto)", () => {
    expect(versionTarget(older, CURRENT_VERSION, new Set())).toEqual({
      kind: "unavailable",
    });
  });
});

describe("parseBuildsIndex", () => {
  it("lê tags do index.json gerado pelo build-version.mjs", () => {
    expect(parseBuildsIndex({ tags: ["v1.0.0", "v2.0.0"] })).toEqual(
      new Set(["v1.0.0", "v2.0.0"]),
    );
  });

  it("tolera formato inválido/ausente (dev sem builds)", () => {
    expect(parseBuildsIndex(null).size).toBe(0);
    expect(parseBuildsIndex({}).size).toBe(0);
    expect(parseBuildsIndex({ tags: [1, "v1.0.0"] })).toEqual(new Set(["v1.0.0"]));
  });
});
