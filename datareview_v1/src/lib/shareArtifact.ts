/**
 * Compartilhamento de análise por link local (Onda 4.4): exporta um
 * artifact/insight do Pipeline como arquivo HTML único, autocontido e
 * abrível no browser — estilo deckToHTML. Sem rede, sem IA: serialização
 * pura com escape XSS obrigatório em todo texto.
 */
import type { PipelineArtifact } from "@/lib/pipeline/types";
import { STAGE_META } from "@/lib/pipeline/types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Markdown mínimo e seguro: headings, negrito/itálico inline, listas, código e blockquote. */
function mdToHtml(md: string): string {
  const lines = esc(md).split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  let codeBuf: string[] = [];
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = raw;
    if (line.startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(line); continue; }
    const inline = (t: string) =>
      t
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");
    if (line.startsWith("### ")) { closeList(); out.push(`<h3>${inline(line.slice(4))}</h3>`); }
    else if (line.startsWith("## ")) { closeList(); out.push(`<h2>${inline(line.slice(3))}</h2>`); }
    else if (line.startsWith("# ")) { closeList(); out.push(`<h1>${inline(line.slice(2))}</h1>`); }
    else if (line.startsWith("&gt; ")) { closeList(); out.push(`<blockquote>${inline(line.slice(5))}</blockquote>`); }
    else if (/^[-*] /.test(line)) { if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${inline(line.slice(2))}</li>`); }
    else if (/^\d+\. /.test(line)) { closeList(); out.push(`<p>${inline(line)}</p>`); }
    else if (line.trim() === "") { closeList(); }
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  closeList();
  if (inCode) out.push(`<pre><code>${codeBuf.join("\n")}</code></pre>`);
  return out.join("\n");
}

export function artifactToHTML(artifact: PipelineArtifact): string {
  const stage = STAGE_META[artifact.stage];
  const date = new Date(artifact.createdAt).toLocaleString("pt-BR");
  // Confidence do artefato é categórica ("alta" | "média" | "baixa");
  // a dos findings é numérica (0..1) — tratadas separadamente.
  const confidence = artifact.confidence ?? null;
  const findings = artifact.data?.findings ?? [];
  const anomalies = artifact.data?.anomalies ?? [];
  const markdown = artifact.markdown ?? "";

  const findingsHtml = findings.length
    ? `<section><h2>Achados (${findings.length})</h2>${findings
        .map((f) => {
          const parts: string[] = [];
          if (f.title) parts.push(`<strong>${esc(f.title)}</strong>`);
          if (f.evidence) parts.push(`<blockquote>${esc(f.evidence)}</blockquote>`);
          return `<div class="finding">${parts.join("")}<span class="conf">confiança ${Math.round((f.confidence ?? 0) * 100)}%</span></div>`;
        })
        .join("")}</section>`
    : "";

  const anomaliesHtml = anomalies.length
    ? `<section><h2>Anomalias (${anomalies.length})</h2>${anomalies
        .map((a) => `<div class="anomaly"><strong>${esc(a.title)}</strong> — ${esc(a.detail ?? "")}</div>`)
        .join("")}</section>`
    : "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(artifact.title)} — análise compartilhada</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, sans-serif; max-width: 760px; margin: 0 auto; padding: 2rem 1.25rem; line-height: 1.6; }
  header { border-bottom: 2px solid currentColor; padding-bottom: 1rem; margin-bottom: 1.5rem; opacity: .92; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  .meta { font-size: .8rem; opacity: .65; display: flex; gap: 1rem; flex-wrap: wrap; }
  .badge { display: inline-block; padding: .1rem .5rem; border-radius: 999px; border: 1px solid currentColor; font-size: .7rem; }
  h2 { font-size: 1.05rem; margin-top: 1.75rem; }
  blockquote { border-left: 3px solid #888; margin: .5rem 0; padding: .25rem 0 .25rem 1rem; opacity: .85; }
  pre { background: rgba(127,127,127,.12); padding: .75rem 1rem; border-radius: .5rem; overflow-x: auto; font-size: .85rem; }
  code { font-family: ui-monospace, monospace; font-size: .85em; background: rgba(127,127,127,.15); padding: .1em .3em; border-radius: .25em; }
  pre code { background: none; padding: 0; }
  .finding, .anomaly { border: 1px solid rgba(127,127,127,.35); border-radius: .5rem; padding: .6rem .8rem; margin: .5rem 0; }
  .conf { display: block; font-size: .7rem; opacity: .6; margin-top: .25rem; }
  footer { margin-top: 2.5rem; padding-top: 1rem; border-top: 1px solid rgba(127,127,127,.35); font-size: .75rem; opacity: .6; }
</style>
</head>
<body>
<header>
  <h1>${esc(artifact.title)}</h1>
  <div class="meta">
    <span class="badge">${esc(stage.label)}</span>
    <span>${esc(artifact.methodology)}</span>
    <span>${esc(date)}</span>
    ${confidence !== null ? `<span>confiança ${esc(confidence)}</span>` : ""}
  </div>
</header>
${findingsHtml}
${anomaliesHtml}
${markdown ? `<section>${mdToHtml(markdown)}</section>` : ""}
<footer>
  Gerado pelo sistema (local-first, sem IA na exportação) · ${esc(artifact.id)}
</footer>
</body>
</html>`;
}
