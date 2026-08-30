import { describe, it, expect, beforeEach } from "vitest";
import { entryKey, SELECTION_SYNC_EVENT, readStored } from "@/context/SelectionContext";
import { selectKeysGlobally } from "@/context/SelectionContext";

/**
 * auto-seleção global: `selectKeysGlobally` grava `aso:selected-apps:v1` e
 * dispara o evento de re-sync — tanto em componentes React quanto em
 * comandos CLI que rodam fora da árvore (Terminal, OS).
 */
describe("Seleção global — auto-seleção por CLI", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("entryKey usa o mesmo shape do dataset (${store}:${id})", () => {
    expect(entryKey("apple", "814456780")).toBe("apple:814456780");
  });

  it("selectKeysGlobally grava as keys no storage", () => {
    selectKeysGlobally(["apple:1", "google:com.x"]);
    expect(readStored()).toEqual(["apple:1", "google:com.x"]);
  });

  it("selectKeysGlobally dispara o evento de re-sync", () => {
    let fired = 0;
    window.addEventListener(SELECTION_SYNC_EVENT, () => { fired++; });
    selectKeysGlobally(["apple:9"]);
    expect(fired).toBe(1);
  });

  it("readStored tolera storage corrompido/ausente", () => {
    expect(readStored()).toEqual([]);
    localStorage.setItem("aso:selected-apps:v1", "not-json");
    expect(readStored()).toEqual([]);
    localStorage.setItem("aso:selected-apps:v1", '["google:com.y","apple:2"]');
    expect(readStored()).toEqual(["google:com.y", "apple:2"]);
  });
});
