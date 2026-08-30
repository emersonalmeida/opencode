#!/usr/bin/env python3
"""Fetch helper do ReclameAqui com impersonação de TLS do Chrome (curl_cffi).

O Cloudflare que protege os endpoints iosearch/iosite barra o fingerprint TLS
do Node.js (Bot Fight Mode), mesmo em rede residencial. O curl_cffi replica o
handshake TLS/HTTP2 do Chrome, que é o que o webapp do RA usa.

Uso:  python3 ra-fetch.py <url>
Saída: JSON em stdout — {"ok": true, "status": 200, "body": "..."}
                       {"ok": false, "status": 403, "error": "..."}
Dependência: pip install curl_cffi (ou requirements-voice via setup).
"""
import json
import sys
import time

IMPERSONATIONS = ["chrome131", "chrome124", "chrome120", "chrome110"]
ATTEMPTS = 3  # por persona: o CF é inconsistente por requisição

HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9",
    # Sem brotli: o curl_cffi retorna body VAZIO em respostas br chunked
    # do Cloudflare (falha silenciosa de decode). gzip/deflate são seguros.
    "Accept-Encoding": "gzip, deflate",
    "Referer": "https://www.reclameaqui.com.br/",
    "Origin": "https://www.reclameaqui.com.br",
}


def main() -> None:
    url = sys.argv[1] if len(sys.argv) > 1 else ""
    if not url.startswith("https://"):
        print(json.dumps({"ok": False, "error": "url inválida"}))
        sys.exit(1)
    try:
        from curl_cffi import requests as crequests
    except ImportError:
        print(json.dumps({"ok": False, "error": "curl_cffi não instalado (pip install curl_cffi)"}))
        sys.exit(0)
    last = None
    for imp in IMPERSONATIONS:
        for attempt in range(ATTEMPTS):
            try:
                # Sessão com warm-up: a página pública primeiro (seta cookies
                # cf_*), depois a API — mesmo padrão do webapp do RA.
                s = crequests.Session(impersonate=imp, headers=HEADERS)
                try:
                    s.get("https://www.reclameaqui.com.br/", timeout=15)
                except Exception:
                    pass
                r = s.get(url, timeout=20)
            except Exception as exc:  # rede/timeout — tenta de novo
                last = {"ok": False, "error": str(exc)}
                time.sleep(1.5 * (attempt + 1))
                continue
            # Lê via content + decode manual: evita falha silenciosa de r.text
            # em respostas comprimidas/chunked (body vazio).
            try:
                body = r.content.decode("utf-8", "replace")
            except Exception:
                body = r.text or ""
            # 200 com body vazio = resposta não lida (brotli chunked / sessão)
            # — tenta de novo em vez de propagar "sucesso vazio".
            if r.status_code == 200 and body.strip():
                print(json.dumps({"ok": True, "status": 200, "body": body}))
                return
            if r.status_code == 200:
                last = {"ok": False, "status": 200, "error": "body vazio na resposta (decode/stream)"}
                time.sleep(1.5 * (attempt + 1))
                continue
            last = {"ok": False, "status": r.status_code, "body": body[:4000]}
            if r.status_code == 403:  # CF challenge: backoff e tenta de novo
                time.sleep(2.0 * (attempt + 1))
                continue
            break  # 429/500 etc.: não adianta insistir nesta persona
    print(json.dumps(last or {"ok": False, "error": "sem resposta"}))


if __name__ == "__main__":
    main()
