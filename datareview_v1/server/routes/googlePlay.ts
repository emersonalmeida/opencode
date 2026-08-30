/* eslint-disable @typescript-eslint/no-explicit-any --
 * O pacote google-play-scraper não exporta tipos utilizáveis para o default
 * import nem para os payloads retornados — os casts `(gplay as any)` são a
 * fronteira com a lib; as respostas são normalizadas antes de sair da rota. */
import type { RequestHandler } from "express";
import gplay from "google-play-scraper";
// Camada RAW imutável (provenance): CollectionRun + RawArtifact por ação.
// Failure-safe por design — nunca muda o comportamento da rota.
import { startRun, finishRun, saveRawArtifact, type CollectionRun } from "../lib/rawStore.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Port of the Supabase edge function. google-play-scraper on Deno used the
 * `@jeromyfu` fork; the npm `google-play-scraper` package exposes the same API,
 * so the call sites (app/search/reviews/list) map 1:1.
 */
export const googlePlay: RequestHandler = async (req, res) => {
  let run: CollectionRun | null = null;
  try {
    const { action, appId, term, country, lang, num, collection, category, sort, fullDetail } = req.body ?? {};
    run = startRun({
      sourceId: "google",
      subjectKey: appId ? `google:app:${appId}` : undefined,
      collector: "google-play-scraper",
      collectorVersion: "1",
      params: { action, appId, term, country, lang, num, collection, category, sort, fullDetail },
      requested: action === "reviews" ? (Number(num) || 150) : undefined,
    });
    let result: unknown;

    switch (action) {
      case "app": {
        result = await fetchAppSafe(appId, country || "br", lang || "pt_BR");
        break;
      }
      case "search": {
        let searchRes: any[] = [];
        try {
          searchRes = await (gplay as any).search({
            term, num: num || 10, country: country || "br", lang: lang || "pt_BR",
            // fullDetail=true traz mais campos por resultado (mais lento).
            fullDetail: req.body?.fullDetail === true,
          });
        } catch (e) {
          console.error("gplay.search threw:", e);
        }
        if (!Array.isArray(searchRes) || searchRes.length === 0) {
          const gl = (country || "br").toLowerCase();
          const hl = (lang || "pt_BR").replace("_", "-");
          const url = `https://play.google.com/store/search?q=${encodeURIComponent(term)}&c=apps&hl=${encodeURIComponent(hl)}&gl=${encodeURIComponent(gl)}`;
          try {
            const resp = await fetch(url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                "Accept-Language": hl,
              },
            });
            const html = await resp.text();
            const ids = new Set<string>();
            const re = /\/store\/apps\/details\?id=([a-zA-Z][a-zA-Z0-9._]+)/g;
            let m: RegExpExecArray | null;
            while ((m = re.exec(html)) !== null) {
              ids.add(m[1]);
              if (ids.size >= (num || 10)) break;
            }
            const idArr = Array.from(ids).slice(0, num || 10);
            const details = await Promise.allSettled(
              idArr.map((id) => fetchAppSafe(id, country || "br", lang || "pt_BR"))
            );
            searchRes = details
              .filter((d) => d.status === "fulfilled")
              .map((d: any) => d.value)
              .filter(Boolean);
          } catch (e) {
            console.error("HTML fallback failed:", e);
          }
        }
        result = searchRes;
        break;
      }
      case "reviews": {
        // google-play-scraper auto-paginates when `paginate` is falsy: it keeps
        // fetching pages until `num` reviews are gathered or the token runs out.
        // Preferência de ordenação: o cliente envia um hint `sort` ("recent"|
        // "helpful"|"rating"|"mixed"). Quando um sort ESPECÍFICO é pedido,
        // buscamos apenas aquele (respeita a preferência do usuário, mais
        // rápido). Quando "mixed" (ou ausente), buscamos em NEWEST/RATING/
        // HELPFUL com dedupe para maximizar rendimento/variedade (comportamento
        // original).
        const reviewNum = Math.max(1, Math.min(Number(num) || 150, 10000));
        const SORT_MAP: Record<string, unknown> = {
          recent: (gplay as any).sort.NEWEST,
          helpful: (gplay as any).sort.HELPFUL,
          rating: (gplay as any).sort.RATING,
        };
        const sortOrders =
          typeof sort === "string" && SORT_MAP[sort]
            ? [SORT_MAP[sort]]
            : [(gplay as any).sort.NEWEST, (gplay as any).sort.RATING, (gplay as any).sort.HELPFUL];
        const seen = new Set<string>();
        const out: any[] = [];
        for (const sort of sortOrders) {
          if (out.length >= reviewNum) break;
          const before = out.length;
          let batch: any;
          try {
            batch = await (gplay as any).reviews({
              appId,
              sort,
              num: reviewNum - out.length,
              country: country || "br",
              lang: lang || "pt_BR",
            });
          } catch (e) {
            console.error("gplay.reviews threw:", String((e as any)?.message || e));
            continue;
          }
          const arr = batch?.data || batch || [];
          if (!Array.isArray(arr)) continue;
          for (const r of arr) {
            const rid = String(r?.id || r?.reviewId || "");
            if (rid && seen.has(rid)) continue;
            if (rid) seen.add(rid);
            out.push(r);
            if (out.length >= reviewNum) break;
          }
          // Stop trying more sorts if this one added nothing new.
          if (out.length === before) break;
        }
        result = out;
        break;
      }
      case "list": {
        const coll = (collection && (gplay as any).collection[collection]) || (gplay as any).collection.TOP_FREE;
        const cat = category ? (gplay as any).category[category] : undefined;
        // fullDetail=true enriquece cada item com a página de detalhes.
        const fullDetail = req.body?.fullDetail === true;
        try {
          const listRes = await (gplay as any).list({
            collection: coll, category: cat,
            country: country || "br", lang: lang || "pt_BR",
            num: num || 25,
            fullDetail: fullDetail ? true : false,
          });
          result = Array.isArray(listRes) ? listRes : [];
        } catch (e) {
          console.error("gplay.list threw:", e);
          result = [];
        }
        break;
      }
      default:
        if (run) finishRun(run, { status: "failed", errors: [{ endpoint: "google-play", message: "Invalid action" }] });
        return res
          .status(400)
          .set(corsHeaders)
          .json({ error: "Invalid action. Use: app, search, reviews, list" });
    }

    // RawArtifact imutável + finishRun (aditivo — nunca altera a resposta).
    if (run) {
      saveRawArtifact({
        runId: run.id,
        sourceId: "google",
        subjectKey: appId ? `google:app:${appId}` : undefined,
        endpoint: `google-play:${action}`,
        params: { action, appId, term, country, lang, num, collection, category, sort, fullDetail },
        payload: result,
        collector: "google-play-scraper",
        collectorVersion: "1",
      });
      const yielded = Array.isArray(result) ? result.length : result ? 1 : 0;
      finishRun(run, { status: yielded > 0 || action === "app" ? "completed" : "partial", yielded });
    }
    return res.set(corsHeaders).set("Content-Type", "application/json").json(result);
  } catch (err) {
    console.error("google-play-scraper error:", err);
    if (run) {
      finishRun(run, { status: "failed", errors: [{ endpoint: "google-play", message: String((err as any)?.message || err) }] });
    }
    return res
      .status(500)
      .set(corsHeaders)
      .json({ error: String((err as any)?.message || err) });
  }
};

async function fetchAppSafe(appId: string, country: string, lang: string) {
  const attempts: Array<{ country: string; lang: string }> = [
    { country, lang },
    { country: "us", lang: "en" },
    { country: "br", lang: "pt" },
    { country: "us", lang: "en_US" },
  ];
  let lastErr: unknown;
  for (const a of attempts) {
    try {
      return await (gplay as any).app({ appId, country: a.country, lang: a.lang });
    } catch (e) {
      lastErr = e;
    }
  }
  console.error(`gplay.app fallback for ${appId}:`, lastErr);
  try {
    const url = `https://play.google.com/store/apps/details?id=${encodeURIComponent(appId)}&hl=${encodeURIComponent(lang)}&gl=${encodeURIComponent(country)}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": lang.replace("_", "-"),
      },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const html = await resp.text();
    const pick = (re: RegExp) => (html.match(re)?.[1] || "").trim();
    const title =
      pick(/<meta property="og:title" content="([^"]+)"/) ||
      pick(/<title>([^<]+)<\/title>/).replace(/ - Apps on Google Play.*/, "");
    const description = pick(/<meta name="description" content="([^"]+)"/);
    const icon = pick(/<meta property="og:image" content="([^"]+)"/);
    if (!title) throw new Error("Could not parse app page");
    return {
      appId,
      title,
      description,
      summary: description,
      icon,
      developer: pick(/"([^"]+)"\s*,\s*"https:\/\/play\.google\.com\/store\/apps\/dev/) || "",
      score: 0,
      ratings: 0,
      free: true,
      genre: "",
      version: "",
      url,
      _fallback: true,
    };
  } catch (e) {
    console.error(`HTML fallback for ${appId} also failed:`, e);
    throw lastErr || e;
  }
}
