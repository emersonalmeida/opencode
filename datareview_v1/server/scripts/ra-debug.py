#!/usr/bin/env python3
"""Diagnóstico do fetch ReclameAqui (curl_cffi) — roda na máquina do usuário.

Uso:  python3 server/scripts/ra-debug.py

Inspeciona EXATAMENTE o que o curl_cffi retorna no endpoint que falha
(companyComplains — resposta longa), para cada persona de impersonação:
status, content-encoding, tamanho do body, primeiros bytes. Imprime um
relatório para colar na issue/conversa.
"""
import sys


def probe(imp: str, url: str) -> dict:
    from curl_cffi import requests as cr
    s = cr.Session(impersonate=imp)
    try:
        s.get("https://www.reclameaqui.com.br/", timeout=15)
    except Exception as e:
        return {"imp": imp, "warmup_error": str(e)}
    try:
        r = s.get(url, timeout=20)
    except Exception as e:
        return {"imp": imp, "error": str(e)}
    body_bytes = r.content
    text = ""
    try:
        text = body_bytes.decode("utf-8", "replace")
    except Exception as e:
        text = f"<decode falhou: {e}>"
    return {
        "imp": imp,
        "status": r.status_code,
        "content_encoding": r.headers.get("content-encoding"),
        "content_type": r.headers.get("content-type"),
        "content_length_header": r.headers.get("content-length"),
        "transfer_encoding": r.headers.get("transfer-encoding"),
        "len_content": len(body_bytes),
        "len_text": len(text),
        "text_head": repr(text[:100]),
    }


def main() -> None:
    url = (
        "https://iosearch.reclameaqui.com.br/raichu-io-site-search-v1"
        "/query/companyComplains/30/0?company=88850"
    )
    print("== Diagnóstico ReclameAqui (companyComplains) ==")
    print("url:", url)
    for imp in ["chrome131", "chrome124", "chrome110"]:
        print(f"\n--- persona {imp} ---")
        try:
            info = probe(imp, url)
        except ImportError:
            print("curl_cffi não instalado — pip install curl_cffi")
            sys.exit(1)
        for k, v in info.items():
            print(f"  {k}: {v}")


if __name__ == "__main__":
    main()
