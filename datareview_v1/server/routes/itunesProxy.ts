import type { RequestHandler } from "express";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED = /^https:\/\/(itunes|apps)\.apple\.com\/|^https:\/\/rss\.marketingtools\.apple\.com\//;

export const itunesProxy: RequestHandler = async (req, res) => {
  try {
    const { url } = req.body ?? {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url" });
    }
    if (!ALLOWED.test(url)) {
      return res.status(400).json({ error: "URL not allowed" });
    }
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AppAnalytics/1.0)" },
    });
    const text = await upstream.text();
    res.set(corsHeaders);
    res.set("Content-Type", "application/json");
    try {
      const data = JSON.parse(text);
      return res.json(data);
    } catch {
      return res.json({ raw: text });
    }
  } catch (err) {
    console.error("itunes-proxy error:", err);
    return res.status(500).json({ error: String((err as Error)?.message || err) });
  }
};
