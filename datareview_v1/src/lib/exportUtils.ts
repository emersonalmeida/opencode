import type { AppInfo, ReviewEntry } from "./appStoreApi";

export function exportToJSON(app: AppInfo, reviews: ReviewEntry[], filename?: string) {
  const payload = { app, reviews, exportedAt: new Date().toISOString(), totalReviews: reviews.length };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  download(blob, filename || `${app.name.replace(/\s+/g, "_")}_data.json`);
}

export const XLSX_HEADERS = ["id", "store", "appId", "appName", "author", "rating", "title", "text", "date", "version", "country", "thumbsUp"];

/** Escapar valores para XML (SpreadsheetML) — só puro, testável. */
export function escapeXml(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Gera a planilha Excel XML (SpreadsheetML, abre no Excel/LibreOffice). */
export function buildSpreadsheetXml(headers: string[], rows: (string | number | undefined)[][]): string {
  const headerRow = headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("");
  const body = rows.map((r) => `<Row>${r.map((v) => {
    const s = v == null ? "" : (typeof v === "number" ? v : String(v));
    return `<Cell><Data ss:Type="${typeof s === "number" ? "Number" : "String"}">${escapeXml(String(s))}</Data></Cell>`;
  }).join("")}</Row>`).join("\n");
  return `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="reviews"><Table><Row>${headerRow}</Row>\n${body}</Table></Worksheet></Workbook>`;
}

export function exportToXLSX(reviews: ReviewEntry[], filename?: string) {
  const rows = reviews.map((r) => [r.id, r.store, r.appId, r.appName, r.author, r.rating, r.title, r.text, r.date, r.version, r.country, r.thumbsUp]);
  const xml = buildSpreadsheetXml(XLSX_HEADERS, rows);
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" });
  download(blob, filename || "reviews.xls");
}

/** Gera HTML de impressão (PDF via diálogo do navegador) — puro, testável. */
export function buildPrintHtml(title: string, summary: string[], tableHeaders: string[], rows: (string | number)[][]): string {
  const thead = `<tr>${tableHeaders.map((h) => `<th>${escapeXml(h)}</th>`).join("")}</tr>`;
  const tbody = rows.map((r) => `<tr>${r.map((v) => `<td>${escapeXml(String(v ?? ""))}</td>`).join("")}</tr>`).join("\n");
  const list = summary.map((s) => `<li>${escapeXml(s)}</li>`).join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(title)}</title><style>
body{font-family:system-ui,sans-serif;font-size:12px;margin:24px;color:#111}
h1{font-size:18px} table{border-collapse:collapse;width:100%} th,td{border:1px solid #ccc;padding:4px 6px;text-align:left} th{background:#eee}
</style></head><body><h1>${escapeXml(title)}</h1><ul>${list}</ul><table><thead>${thead}</thead><tbody>${tbody}</tbody></table></body></html>`;
}

export function exportToPDF(app: AppInfo, reviews: ReviewEntry[], filename?: string) {
  if (!reviews.length) return;
  const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2);
  const summary = [
    `App: ${app.name}`,
    `Loja: ${app.store === "apple" ? "App Store" : "Google Play"}`,
    `Total de reviews: ${reviews.length}`,
    `Nota média coletada: ${avg}`,
    `Exportado em: ${new Date().toLocaleString("pt-BR")}`,
  ];
  const headers = ["Autor", "Nota", "Título", "Data"];
  const rows = reviews.map((r) => [r.author || "Anônimo", r.rating, r.title || "—", r.date ? new Date(r.date).toLocaleDateString("pt-BR") : "—"]);
  const html = buildPrintHtml(`${app.name} — reviews`, summary, headers, rows);
  openPrint(html, filename);
}

/** PDF do dataset inteiro (vários apps) — útil no Dashboard/Decision Center. */
export function exportDatasetToPDF(entries: { app: AppInfo; reviews: ReviewEntry[] }[], filename?: string) {
  const allReviews = entries.flatMap((e) => e.reviews);
  if (!allReviews.length) return;
  const avg = (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(2);
  const summary = [
    `Apps: ${entries.length}`,
    `Total de reviews: ${allReviews.length}`,
    `Nota média coletada: ${avg}`,
    `Exportado em: ${new Date().toLocaleString("pt-BR")}`,
    ...entries.map((e) => `${e.app.name} (${e.app.store === "apple" ? "App Store" : "Google Play"}) — ${e.reviews.length} reviews`),
  ];
  const headers = ["App", "Loja", "Reviews"];
  const rows = entries.map((e) => [e.app.name, e.app.store === "apple" ? "App Store" : "Google Play", e.reviews.length]);
  const html = buildPrintHtml("Dataset — resumo por app", summary, headers, rows);
  openPrint(html, filename);
}

function openPrint(html: string, filename?: string): void {
  const w = window.open("", "_blank");
  if (!w) {
    if (filename) {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      download(blob, filename);
    }
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
  if (filename) {
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    download(blob, filename);
  }
}

export function exportToCSV(reviews: ReviewEntry[], filename?: string) {
  const headers = ["id", "store", "appId", "appName", "author", "rating", "title", "text", "date"];
  const rows = reviews.map(r =>
    headers.map(h => {
      const val = String((r as unknown as Record<string, unknown>)[h] || "");
      return `"${val.replace(/"/g, '""')}"`;
    }).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  download(blob, filename || "reviews.csv");
}

export function exportAppMetaCSV(apps: AppInfo[], filename?: string) {
  const headers = ["id", "store", "name", "developer", "rating", "ratingCount", "price", "genre", "version", "releaseDate", "downloads", "contentRating", "size", "url"];
  const rows = apps.map(a =>
    headers.map(h => {
      const val = String((a as unknown as Record<string, unknown>)[h] ?? "");
      return `"${val.replace(/"/g, '""')}"`;
    }).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  download(blob, filename || "apps.csv");
}

export function exportToMarkdown(app: AppInfo, reviews: ReviewEntry[], filename?: string) {
  const esc = (s: string) => (s || "").replace(/\|/g, "\\|");
  const avg = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2) : "—";
  const pos = reviews.filter(r => r.rating >= 4).length;
  const neg = reviews.filter(r => r.rating <= 2).length;
  const dist = [5, 4, 3, 2, 1].map(n => `- ★${n}: ${reviews.filter(r => r.rating === n).length}`).join("\n");

  const meta: [string, string | number | undefined][] = [
    ["Loja", app.store === "apple" ? "App Store" : "Google Play"],
    ["ID", app.id],
    ["Desenvolvedor", app.developer],
    ["Gênero", app.genre],
    ["Preço", app.price],
    ["Versão", app.version],
    ["Lançamento", app.releaseDate],
    ["Atualizado", app.currentVersionReleaseDate || app.lastUpdated],
    ["Tamanho", app.size],
    ["Classificação", app.contentRating],
    ["OS Mínimo", app.minimumOsVersion],
    ["Downloads", app.downloads],
    ["Nota loja", app.rating],
    ["Qtd. avaliações", app.ratingCount],
    ["URL", app.url],
  ];

  const metaTable = [
    "| Campo | Valor |",
    "| --- | --- |",
    ...meta.filter(([, v]) => v !== undefined && v !== "" && v !== 0).map(([k, v]) => `| ${k} | ${esc(String(v))} |`),
  ].join("\n");

  const reviewsMd = reviews.slice(0, 500).map(r =>
    `### ★${r.rating} — ${r.title || "(sem título)"}\n\n_${r.author || "anônimo"} · ${r.date ? new Date(r.date).toLocaleDateString("pt-BR") : "—"}_\n\n${r.text || ""}\n`
  ).join("\n---\n\n");

  const md = `# ${app.name}

> Dossiê exportado de App Intelligence · ${new Date().toLocaleString("pt-BR")}

## Ficha técnica

${metaTable}

## Descrição

${app.description || "_Sem descrição publicada._"}

## Panorama de reviews coletados

- **Total coletado:** ${reviews.length}
- **Nota média (amostra):** ${avg}
- **Positivos (★4–5):** ${pos} (${reviews.length ? Math.round((pos / reviews.length) * 100) : 0}%)
- **Negativos (★1–2):** ${neg} (${reviews.length ? Math.round((neg / reviews.length) * 100) : 0}%)

### Distribuição de notas

${dist}

## Reviews

${reviewsMd || "_Nenhum review coletado._"}
`;

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  download(blob, filename || `${app.name.replace(/\s+/g, "_")}_dossie.md`);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
