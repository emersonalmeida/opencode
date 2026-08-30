/** Testes do store de arquivos do usuário (contexto para a IA). */
import { describe, it, expect, beforeEach } from "vitest";
import {
  listUserFiles, addUserFile, removeUserFile, clearUserFiles,
  isTextExtractable, filesContextBlock, MAX_TEXT_CHARS,
} from "@/lib/userFiles";

describe("userFiles", () => {
  beforeEach(() => {
    localStorage.clear();
    clearUserFiles();
  });

  it("isTextExtractable reconhece texto e rejeita binários", () => {
    expect(isTextExtractable("dados.csv", "")).toBe(true);
    expect(isTextExtractable("notas.md", "")).toBe(true);
    expect(isTextExtractable("x.json", "application/json")).toBe(true);
    expect(isTextExtractable("log.txt", "text/plain")).toBe(true);
    expect(isTextExtractable("foto.png", "image/png")).toBe(false);
    expect(isTextExtractable("doc.pdf", "application/pdf")).toBe(false);
  });

  it("addUserFile persiste e lista newest-first", () => {
    addUserFile({ name: "a.csv", mime: "text/csv", size: 10, text: "x" });
    addUserFile({ name: "b.txt", mime: "text/plain", size: 20, text: "y" });
    const list = listUserFiles();
    expect(list.length).toBe(2);
    expect(list[0].name === "a.csv" || list[0].name === "b.txt").toBe(true);
    expect(list.every((f) => f.id.startsWith("file-"))).toBe(true);
  });

  it("removeUserFile e clearUserFiles", () => {
    const f = addUserFile({ name: "a.csv", mime: "text/csv", size: 10 });
    expect(listUserFiles().length).toBe(1);
    removeUserFile(f.id);
    expect(listUserFiles().length).toBe(0);
    addUserFile({ name: "a.csv", mime: "text/csv", size: 10 });
    clearUserFiles();
    expect(listUserFiles().length).toBe(0);
  });

  it("filesContextBlock monta seções delimitadas e respeita budget", () => {
    const a = addUserFile({ name: "a.csv", mime: "text/csv", size: 10, text: "col1,col2\n1,2" });
    const b = addUserFile({ name: "foto.png", mime: "image/png", size: 999, note: "Arquivo binário" });
    const block = filesContextBlock([a, b]);
    expect(block).toContain("ARQUIVOS DO USUÁRIO");
    expect(block).toContain("a.csv");
    expect(block).toContain("col1,col2");
    expect(block).toContain("foto.png");
    expect(block).toContain("sem texto extraível");
    expect(filesContextBlock([], 100)).toBe("");
    // budget apertado corta depois do primeiro
    const tight = filesContextBlock([a, b], 10);
    expect(tight.length).toBeLessThan(block.length);
  });

  it("texto acima do limite é truncado na constante exportada", () => {
    expect(MAX_TEXT_CHARS).toBeGreaterThan(0);
    const big = "x".repeat(MAX_TEXT_CHARS + 50);
    const f = addUserFile({ name: "big.txt", mime: "text/plain", size: big.length, text: big.slice(0, MAX_TEXT_CHARS) });
    expect(f.text!.length).toBe(MAX_TEXT_CHARS);
  });
});
