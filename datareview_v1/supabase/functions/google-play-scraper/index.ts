const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import gplay from "npm:@jeromyfu/google-play-scraper@10.0.2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, appId, term, country, lang, num, collection, category } = await req.json();

    let result: unknown;

    switch (action) {
      case "app": {
        result = await fetchAppSafe(appId, country || "br", lang || "pt_BR");
        break;
      }
      case "search": {
        let searchRes: any[] = [];
        try {
          searchRes = await gplay.search({ term, num: num || 10, country: country || "br", lang: lang || "pt_BR" });
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
            searchRes = details.filter((d) => d.status === "fulfilled").map((d: any) => d.value).filter(Boolean);
          } catch (e) {
            console.error("HTML fallback failed:", e);
          }
        }
        result = searchRes;
        break;
      }

      case "reviews": {
        const reviewResult = await gplay.reviews({
          appId,
          sort: gplay.sort.NEWEST,
          num: num || 150,
          country: country || "br",
          lang: lang || "pt_BR",
        });
        result = reviewResult.data || reviewResult;
        break;
      }

      case "list": {
        // Top charts. Optional category (e.g. "APPLICATION", "GAME", "SOCIAL"...).
        const coll = (collection && (gplay.collection as any)[collection]) || gplay.collection.TOP_FREE;
        const cat = category ? (gplay.category as any)[category] : undefined;
        try {
          const listRes = await gplay.list({
            collection: coll,
            category: cat,
            country: country || "br",
            lang: lang || "pt_BR",
            num: num || 25,
            fullDetail: false,
          });
          result = Array.isArray(listRes) ? listRes : [];
        } catch (e) {
          console.error("gplay.list threw:", e);
          result = [];
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: app, search, reviews, list" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-play-scraper error:", err);
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Try multiple lang/country combinations because @jeromyfu/google-play-scraper
 * throws on certain regional HTML shapes (e.g. "Cannot read properties of undefined (reading 'length')"
 * in extractCategories). On total failure, build a minimal payload by scraping
 * the public Play Store HTML directly so the app is still findable.
 */
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
      return await gplay.app({ appId, country: a.country, lang: a.lang });
    } catch (e) {
      lastErr = e;
    }
  }
  console.error(`gplay.app fallback for ${appId}:`, lastErr);
  // HTML fallback — minimal but valid payload
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
    const title = pick(/<meta property="og:title" content="([^"]+)"/) || pick(/<title>([^<]+)<\/title>/).replace(/ - Apps on Google Play.*/, "");
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
