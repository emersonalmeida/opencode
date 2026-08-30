import { describe, it, expect } from "vitest";
import { sanitizeComponentPath } from "../../server/routes/componentSource";

describe("componentSource — sanitização de path restrictivo a src/components/", () => {
  it("aceita caminho válido e resolve absoluto dentro do root", () => {
    const abs = sanitizeComponentPath("components/shared/EmptyState.tsx");
    expect(abs?.endsWith("components/shared/EmptyState.tsx")).toBe(true);
  });

  it("aceita prefixo src/ opcional", () => {
    expect(sanitizeComponentPath("src/components/AppHeader.tsx")).toBeTruthy();
  });

  it("rejeita fora do diretório de componentes", () => {
    expect(sanitizeComponentPath("pages/Index.tsx")).toBeNull();
    expect(sanitizeComponentPath("lib/utils.ts")).toBeNull();
    expect(sanitizeComponentPath("../secret.env")).toBeNull();
    expect(sanitizeComponentPath("components/../package.json")).toBeNull();
    expect(sanitizeComponentPath("/etc/passwd")).toBeNull();
  });

  it("rejeita não-TS e entradas vazias/inválidas", () => {
    expect(sanitizeComponentPath("components/AppHeader.css")).toBeNull();
    expect(sanitizeComponentPath("components/AppHeader")).toBeNull();
    expect(sanitizeComponentPath("")).toBeNull();
    expect(sanitizeComponentPath(123)).toBeNull();
    expect(sanitizeComponentPath(undefined)).toBeNull();
  });
});
