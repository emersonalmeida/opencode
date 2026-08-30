#!/usr/bin/env python3
"""Fetch ReclameAqui via navegador real (Playwright) — bypass forte do CF.

O curl_cffi imita o fingerprint TLS, mas o Cloudflare pode challengar por
reputação de IP. O Playwright roda um Chromium real: o warm-up na página
pública resolve o challenge JavaScript e o cookie cf_clearance fica no
contexto — a API passa mesmo com IP marcado.

Uso:  python3 ra-fetch-pw.py <url>
Saída: JSON em stdout — {"ok": true, "status": 200, "body": "..."}
                       {"ok": false, "status": N|"error": "..."}
Dependência: pip install playwright && python3 -m playwright install chromium
"""
import json
import sys

# Mesmo UA do curl do sistema (que passa de IP residencial) — o CF cruza o
# UA com o fingerprint do browser; Chrome 131 num Chromium mais novo esvazia
# a resposta da API mesmo com o challenge resolvido.
UA = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def attempt(url: str) -> dict:
    """Uma tentativa completa: sobe o navegador, resolve o challenge, busca."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        # headless="new" (Chromium novo) é menos detectável que o headless
        # legado; --disable-blink-features=AutomationControlled remove a flag
        # navigator.webdriver que o Cloudflare usa para detectar automação.
        browser = p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        ctx = browser.new_context(
            user_agent=UA,
            locale="pt-BR",
            viewport={"width": 1366, "height": 768},
        )
        ctx.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', { get: () => undefined });"
        )
        page = ctx.new_page()
        page_title = ""
        # Warm-up: abre a página pública e AGUARDA o challenge JS do CF
        # resolver (o título sai de "Just a moment" para o título real).
        try:
            page.goto(
                "https://www.reclameaqui.com.br/",
                timeout=30000,
                wait_until="domcontentloaded",
            )
            for _ in range(12):
                t = (page.title() or "").lower()
                page_title = t
                if "just a moment" not in t and "moment" not in t:
                    break
                page.wait_for_timeout(1500)
        except Exception:
            pass
        # page.evaluate(fetch) com credentials:"include" — ESSENCIAL: sem isso o
        # cookie __cf_bm do warm-up NÃO vai no fetch cross-origin e o CF esvazia
        # a resposta longa (complaints). SEM Referer explícito (causa preflight
        # CORS que falha com "Failed to fetch"). Testado: 38737 chars.
        result = page.evaluate(
            """async (u) => {
                try {
                    const r = await fetch(u, { credentials: "include" });
                    const text = await r.text();
                    return { status: r.status, len: text.length, body: text };
                } catch (e) {
                    return { status: 0, len: 0, body: "", err: String(e && e.message ? e.message : e).slice(0, 120) };
                }
            }""",
            url,
        )
        browser.close()
    return {
        "status": result.get("status") or 0,
        "body": result.get("body") or "",
        "title": page_title,
        "diag": f"apiLen={result.get('len')} err={result.get('err','-')}",
    }


def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else ""
    if not url.startswith("https://"):
        print(json.dumps({"ok": False, "error": "url inválida"}))
        sys.exit(1)
    try:
        import playwright  # noqa: F401
    except ImportError:
        print(json.dumps({
            "ok": False,
            "error": "playwright não instalado (pip install playwright && python3 -m playwright install chromium)",
        }))
        sys.exit(0)
    # UMA tentativa: com o anti-detecção (webdriver oculto + UA consistente)
    # o warm-up resolve de primeira quando resolve. Retentar gasta reputação
    # do IP à toa (cada tentativa sobe um navegador e bate no CF).
    try:
        r = attempt(url)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": f"playwright: {str(exc)[:200]}"}))
        return
    if r["status"] == 200 and r["body"].strip():
        print(json.dumps({"ok": True, "status": 200, "body": r["body"]}))
        return
    out = {"ok": False, "status": r["status"],
           "error": "body vazio" if r["status"] == 200 else None,
           "body": r["body"][:4000],
           "debug": f"title={r.get('title','?')[:25]} {r.get('diag','')}"}
    print(json.dumps({k: v for k, v in out.items() if v is not None}))


if __name__ == "__main__":
    main()
