/**
 * Núcleo PURO do conector ReclameAqui — parsing e derivação de status.
 * Sem Node/DOM/fetch: testável em vitest. Baseado nos endpoints JSON internos
 * usados pelo próprio webapp do RA (iosearch/iosite …/raichu-io-*).
 */

export interface RaCompany {
  id: string;
  name: string;
  shortname: string;
  city?: string;
  state?: string;
  url: string;
}

export type RaStatus = "Resolvido" | "Não resolvido" | "Respondido" | "Não respondido" | "Réplica";

export interface RaComplaint {
  id: string;
  title: string;
  text: string;
  created: string;
  status: RaStatus;
  statusRaw: string;
  solved: boolean | null;
  evaluated: boolean;
  dealAgain: boolean | null;
  score: number | null;
  city?: string;
  state?: string;
  url: string;
  /** empresa da reclamação (presente na busca livre por termo). */
  companyName?: string;
}

/** Derivação de status idêntica ao web client do RA (getStatusComplain). */
export function deriveStatus(c: {
  evaluated?: boolean;
  solved?: boolean;
  status?: string;
  interactions?: unknown[];
}): RaStatus {
  const interactions = Array.isArray(c.interactions) ? c.interactions : [];
  if (!c.evaluated && interactions.length > 1) return "Réplica";
  if (c.evaluated) return c.solved ? "Resolvido" : "Não resolvido";
  if (c.status === "ANSWERED") return "Respondido";
  return "Não respondido";
}

interface RawCompany {
  id?: string | number;
  name?: string;
  shortname?: string;
  location?: { city?: string; state?: string };
}

/** companies/search/{name} → lista de empresas normalizada. */
export function parseCompanySearch(data: unknown): RaCompany[] {
  const list = (data as { companies?: RawCompany[] })?.companies;
  if (!Array.isArray(list)) return [];
  const out: RaCompany[] = [];
  for (const c of list) {
    if (!c?.shortname || !c?.name) continue;
    out.push({
      id: String(c.id ?? ""),
      name: c.name,
      shortname: c.shortname,
      city: c.location?.city,
      state: c.location?.state,
      url: `https://www.reclameaqui.com.br/empresa/${c.shortname}/`,
    });
  }
  return out;
}

interface RawComplaint {
  id?: string | number;
  title?: string;
  description?: string;
  created?: string;
  status?: string;
  solved?: boolean;
  evaluated?: boolean;
  dealAgain?: boolean;
  score?: number | string;
  userCity?: string;
  userState?: string;
  url?: string;
  interactions?: unknown[];
}

/** Normaliza URL do RA: absoluta ou relativa (com/sem barra inicial). */
function raUrl(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith("http")) return url;
  return `https://www.reclameaqui.com.br/${url.replace(/^\/+/, "")}`;
}

/** Converte o HTML do relato (<br/> etc.) em texto puro. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** query/companyComplains/{n}/{off}?company=id → reclamações normalizadas. */
export function parseCompanyComplaints(data: unknown, limit: number): { complaints: RaComplaint[]; total: number } {
  const root = (data as {
    complainResult?: { complains?: { data?: RawComplaint[]; count?: number } };
  })?.complainResult?.complains;
  const raw = Array.isArray(root?.data) ? root.data : [];
  const total = Number(root?.count ?? raw.length) || raw.length;
  const complaints: RaComplaint[] = [];
  for (const c of raw) {
    if (complaints.length >= limit) break;
    const id = String(c?.id ?? "");
    if (!id || !c?.title) continue;
    const url = raUrl(c.url, `https://www.reclameaqui.com.br/reclamar/${id}/`);
    complaints.push({
      id,
      title: c.title,
      text: stripHtml(c.description ?? ""),
      created: c.created ?? "",
      status: deriveStatus(c),
      statusRaw: c.status ?? "",
      solved: typeof c.solved === "boolean" ? c.solved : null,
      evaluated: !!c.evaluated,
      dealAgain: typeof c.dealAgain === "boolean" ? c.dealAgain : null,
      score: c.score != null && c.score !== "" ? Number(c.score) : null,
      city: c.userCity,
      state: c.userState,
      url,
    });
  }
  return { complaints, total };
}

/** query/{termo}/{size}/{page} — busca livre de reclamações.
 *  Shape real: complainResult.complains.data (mesmo do companyComplains,
 *  com `companyName` por item; título vem em `titleMasked`). */
export function parseTermSearch(data: unknown, limit: number): RaComplaint[] {
  const root = (data as {
    complainResult?: { complains?: { data?: RawComplaint[] } };
  })?.complainResult?.complains;
  const raw = Array.isArray(root?.data) ? root.data : [];
  const out: RaComplaint[] = [];
  for (const h of raw) {
    if (out.length >= limit) break;
    const id = String(h?.id ?? "");
    const title = (h as unknown as { titleMasked?: string }).titleMasked ?? h?.title ?? "";
    if (!id || !title) continue;
    const url = raUrl(h?.url, `https://www.reclameaqui.com.br/reclamar/${id}/`);
    out.push({
      id,
      title,
      text: stripHtml(h.description ?? ""),
      created: h.created ?? "",
      status: deriveStatus(h),
      statusRaw: h.status ?? "",
      solved: typeof h.solved === "boolean" ? h.solved : null,
      evaluated: !!h.evaluated,
      dealAgain: typeof h.dealAgain === "boolean" ? h.dealAgain : null,
      score: h.score != null && h.score !== "" ? Number(h.score) : null,
      city: h.userCity,
      state: h.userState,
      url,
      companyName: (h as unknown as { companyName?: string }).companyName,
    });
  }
  return out;
}

/** company/shortname/{shortname} ou company/{id}/public → perfil da empresa. */
export function parseCompanyProfile(data: unknown): {
  id: string;
  name: string;
  shortname: string;
  finalScore?: number | string;
  status?: string;
  reputation?: string;
  answerRate?: number | string;
  complaintsCount?: number;
} | null {
  const d = data as Record<string, unknown> | null;
  if (!d || typeof d !== "object") return null;
  const id = String(d.id ?? "");
  const name = String(d.name ?? "");
  if (!id || !name) return null;
  return {
    id,
    name,
    shortname: String(d.shortname ?? ""),
    finalScore: (d.finalScore as number | string | undefined) ?? undefined,
    status: (d.status as string | undefined) ?? undefined,
    reputation: (d.reputation as string | undefined) ?? undefined,
    answerRate: (d.answeredComplains as number | string | undefined) ?? undefined,
    complaintsCount: typeof d.complaintsCount === "number" ? d.complaintsCount : undefined,
  };
}

/** Detecção de bloqueio Cloudflare ("Just a moment" / HTML em vez de JSON). */
export function isCloudflareBlock(status: number, body: string): boolean {
  if (status === 403 || status === 503) {
    return /just a moment|challenges\.cloudflare\.com|<!DOCTYPE html>/i.test(body);
  }
  return false;
}
