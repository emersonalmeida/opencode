/**
 * ReclameAqui (ponte v1 → SourcePort).
 * Endpoints JSON internos do webapp do RA (iosearch/…/raichu-io-*), sem auth:
 *   - companies/search/{term}        → busca de empresas
 *   - query/companyComplains/{n}/0?company={id} → reclamações da empresa
 *   - query/{termo}/{n}/1            → busca livre de reclamações
 * O RA fica atrás de Cloudflare (Bot Fight Mode barra o TLS do Node em
 * datacenter) — quando bloqueia, erro HONESTO orientando bypass/rede.
 *
 * engine = action: search (padrão, empresas) | complaints (query =
 * companyId|shortname) | term (busca livre). Convenção: nunca lança.
 */
import type { CollectOptions, NormalizedItem } from "@v5/contracts";
import type { SourcePort } from "@v5/domain";
import { cap, defineAdapter, item, num, str } from "./base.js";

const IOSEARCH = "https://iosearch.reclameaqui.com.br/raichu-io-site-search-v1";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const HEADERS = {
  "User-Agent": UA,
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9",
  Referer: "https://www.reclameaqui.com.br/",
  Origin: "https://www.reclameaqui.com.br",
};
const CF_MSG =
  "ReclameAqui bloqueou o acesso (Cloudflare). Instale o bypass de fingerprint com `pip install curl_cffi` e tente de novo; se persistir, teste de outra rede.";

export type RaStatus = "Resolvido" | "Não resolvido" | "Respondido" | "Não respondido" | "Réplica";

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

function looksLikeChallenge(status: number, body: string): boolean {
  return (status === 403 || status === 503) && /just a moment|challenges\.cloudflare\.com|<!DOCTYPE html>/i.test(body);
}

async function raFetchJson(url: string): Promise<unknown> {
  const resp = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  const body = await resp.text();
  if (!resp.ok || looksLikeChallenge(resp.status, body)) throw new Error(CF_MSG);
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new Error(CF_MSG);
  }
}

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

function raUrl(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  if (url.startsWith("http")) return url;
  return `https://www.reclameaqui.com.br/${url.replace(/^\/+/, "")}`;
}

interface RaCompany {
  id: string;
  name: string;
  shortname: string;
  city?: string;
  state?: string;
  url: string;
}

interface RaComplaint {
  id: string;
  title: string;
  text: string;
  created: string;
  status: RaStatus;
  score: number | null;
  city?: string;
  state?: string;
  url: string;
  companyName?: string;
}

function parseCompanySearch(data: unknown): RaCompany[] {
  const list = (data as { companies?: { id?: string | number; name?: string; shortname?: string; location?: { city?: string; state?: string } }[] })?.companies;
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
  titleMasked?: string;
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
  companyName?: string;
}

function toComplaint(c: RawComplaint, fallbackTitle: string): RaComplaint | null {
  const id = String(c?.id ?? "");
  const title = c?.titleMasked ?? c?.title ?? fallbackTitle;
  if (!id || !title) return null;
  return {
    id,
    title,
    text: stripHtml(c.description ?? ""),
    created: c.created ?? "",
    status: deriveStatus(c),
    score: c.score != null && c.score !== "" ? Number(c.score) : null,
    city: c.userCity,
    state: c.userState,
    url: raUrl(c.url, `https://www.reclameaqui.com.br/reclamar/${id}/`),
    companyName: c.companyName,
  };
}

function parseCompanyComplaints(data: unknown, limit: number): { complaints: RaComplaint[]; total: number } {
  const root = (data as { complainResult?: { complains?: { data?: RawComplaint[]; count?: number } } })?.complainResult?.complains;
  const raw = Array.isArray(root?.data) ? root.data : [];
  const total = Number(root?.count ?? raw.length) || raw.length;
  const complaints: RaComplaint[] = [];
  for (const c of raw) {
    if (complaints.length >= limit) break;
    const parsed = toComplaint(c, "");
    if (parsed) complaints.push(parsed);
  }
  return { complaints, total };
}

function parseTermSearch(data: unknown, limit: number): RaComplaint[] {
  const root = (data as { complainResult?: { complains?: { data?: RawComplaint[] } } })?.complainResult?.complains;
  const raw = Array.isArray(root?.data) ? root.data : [];
  const out: RaComplaint[] = [];
  for (const h of raw) {
    if (out.length >= limit) break;
    const parsed = toComplaint(h, "");
    if (parsed) out.push(parsed);
  }
  return out;
}

async function resolveCompanyId(shortname: string): Promise<{ id: string; name: string }> {
  const companies = parseCompanySearch(await raFetchJson(`${IOSEARCH}/companies/search/${encodeURIComponent(shortname)}`));
  const exact = companies.find((c) => c.shortname === shortname) ?? companies[0];
  if (!exact?.id) throw new Error(`Empresa "${shortname}" não encontrada no ReclameAqui`);
  return { id: exact.id, name: exact.name };
}

export const reclameaqui = defineAdapter(
  {
    id: "reclameaqui",
    label: "ReclameAqui",
    kind: "complaint",
    description: "Reclamações e empresas do ReclameAqui (engine = search|complaints|term; query=empresa|companyId|termo).",
    capabilities: ["reviews"],
    rateLimit: { rps: 1, burst: 1 },
  },
  {
    async fetch(options: CollectOptions) {
      const action = options.engine || "search";
      const limit = cap(options.limit ?? 25, 100);
      const q = options.query.trim();
      if (!q) throw new Error("query vazia");

      if (action === "term") {
        const complaints = parseTermSearch(await raFetchJson(`${IOSEARCH}/query/${encodeURIComponent(q)}/${limit}/1`), limit);
        if (complaints.length === 0) throw new Error("nenhuma reclamação encontrada para o termo");
        return { action, query: q, complaints };
      }

      if (action === "complaints") {
        let id = q;
        let companyName = "";
        if (!/^[a-zA-Z0-9]+$/.test(q) || Number.isNaN(Number(q))) {
          const resolved = await resolveCompanyId(q);
          id = resolved.id;
          companyName = resolved.name;
        }
        const { complaints, total } = parseCompanyComplaints(
          await raFetchJson(`${IOSEARCH}/query/companyComplains/${limit}/0?company=${encodeURIComponent(id)}`),
          limit,
        );
        if (complaints.length === 0) throw new Error("nenhuma reclamação publicada para esta empresa");
        return { action, companyId: id, companyName, complaints, total };
      }

      const companies = parseCompanySearch(await raFetchJson(`${IOSEARCH}/companies/search/${encodeURIComponent(q)}`));
      if (companies.length === 0) throw new Error(`nenhuma empresa encontrada para "${q}"`);
      return { action: "search", query: q, companies };
    },
    map(data: unknown, options: CollectOptions): NormalizedItem[] {
      const r = (data ?? {}) as Record<string, unknown>;
      if (str(r.action) === "search") {
        return (Array.isArray(r.companies) ? r.companies : []).map((raw, i) => {
          const c = raw as RaCompany;
          const name = str(c.name) || "?";
          return item(
            {
              id: `ra:company:${str(c.shortname)}`,
              title: name,
              url: str(c.url) || undefined,
              score: Math.max(1, 1000 - i * 50),
              meta: { id: str(c.id), shortname: str(c.shortname), city: str(c.city) || undefined, state: str(c.state) || undefined },
            },
            "reclameaqui",
            "company",
          );
        });
      }
      const complaints = (Array.isArray(r.complaints) ? r.complaints : []) as RaComplaint[];
      return complaints.slice(0, cap(options.limit ?? 25, 100)).map((c) =>
        item(
          {
            id: `ra:complaint:${str(c.id)}`,
            title: str(c.title),
            text: str(c.text) || undefined,
            url: str(c.url) || undefined,
            author: str(c.companyName) || undefined,
            date: str(c.created) || undefined,
            score: num(c.score) ?? undefined,
            meta: {
              status: str(c.status),
              companyName: str(c.companyName) || undefined,
              city: str(c.city) || undefined,
              state: str(c.state) || undefined,
            },
          },
          "reclameaqui",
          "complaint",
        ),
      );
    },
  },
);

export const reclameaquiSources: Record<string, () => SourcePort> = {
  reclameaqui: () => reclameaqui,
};