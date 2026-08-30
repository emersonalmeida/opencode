/**
 * Smoke do front — renderização SSR das rotas + helpers puros (sem browser).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { AppRoutes } from "../src/App.js";
import { formatCount, greeting, statusLabel } from "../src/lib/format.js";

function render(initialEntries: string[]): string {
  return renderToString(
    createElement(MemoryRouter, { initialEntries }, createElement(AppRoutes)),
  );
}

test("Home renderiza (SSR smoke) com identidade v4", () => {
  const html = render(["/"]);
  assert.match(html, /Coleta e análise multi-fonte de dados públicos/);
  assert.match(html, /DataReview/);
  assert.match(html, /Fontes/);
});

test("rota desconhecida cai no NotFound", () => {
  const html = render(["/nao-existe"]);
  assert.match(html, /Página não encontrada/);
});

test("/fontes renderiza o formulário de teste de fontes", () => {
  const html = render(["/fontes"]);
  assert.match(html, /Testes de fontes/);
  assert.match(html, /Coletar/);
});

test("/auditoria renderiza o resumo do registry", () => {
  const html = render(["/auditoria"]);
  assert.match(html, /Auditoria/);
  assert.match(html, /Registry declarativo/);
});

test("helpers puros de formatação", () => {
  assert.equal(formatCount(999), "999");
  assert.equal(formatCount(1500), "1.5k");
  assert.equal(formatCount(2_400_000), "2.4M");
  assert.equal(formatCount(Number.NaN), "—");
  assert.equal(statusLabel("implemented"), "PRONTO");
  assert.equal(statusLabel("bridge"), "PONTE(v1)");
  assert.equal(statusLabel("planned"), "PLANEJADO");
  assert.ok(["Bom dia", "Boa tarde", "Boa noite", "Boa madrugada"].includes(greeting()));
});