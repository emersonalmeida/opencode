#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""check-secrets.py — detector (e redator) de segredos commitados por engano.

Uso:
    python scripts/check-secrets.py [path ...]          # modo check (exit 1 se achar)
    python scripts/check-secrets.py --redact [path ...] # redige os achados como ****

Sem path: varre o repositório (docs/, src/, server/, scripts), ignorando
node_modules, dist e .git.

Padrões cobertos: OpenAI (sk-proj/sk-), OpenRouter (sk-or), GitHub
(github_pat/ghp_), Google (AIza…), HuggingFace (hf_…), blocos de chave
privada PEM, e atribuições genéricas de key/secret/token/password com valor
longo (>12 chars) entre aspas.

Roda sem dependências externas (stdlib). Impressão: apenas contagens e
localizações — valores de segredos nunca são exibidos.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

PLACEHOLDER = "****"

# (nome, regex, modo) — modo "value" redige só o valor; "block" redige o bloco.
PATTERNS: list[tuple[str, re.Pattern[str], str]] = [
    ("openai", re.compile(r"sk-proj-[A-Za-z0-9_-]+"), "value"),
    ("openrouter", re.compile(r"sk-or-[A-Za-z0-9_-]+"), "value"),
    ("openai-legacy", re.compile(r"sk-[A-Za-z0-9]{20,}"), "value"),
    ("github-pat", re.compile(r"github_pat_[A-Za-z0-9_]+"), "value"),
    ("github-oauth", re.compile(r"ghp_[A-Za-z0-9]{20,}"), "value"),
    ("google-api", re.compile(r"AIza[0-9A-Za-z_-]{35}"), "value"),
    ("huggingface", re.compile(r"hf_[A-Za-z0-9]{20,}"), "value"),
    (
        "private-key-block",
        re.compile(
            r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----.*?-----END (?:RSA |EC )?PRIVATE KEY-----",
            re.DOTALL,
        ),
        "block",
    ),
    (
        "atribuicao-generica",
        re.compile(
            r"(?i)(\b(?:api[_-]?key|secret|token|password|passwd|client[_-]?secret|private[_-]?key|auth[_-]?key)\b\s*[:=]\s*)([\"'])([^\"']{12,})(\2)"
        ),
        "generic",
    ),
]

TEXT_EXT = {".py", ".md", ".txt", ".json", ".yaml", ".yml", ".ts", ".tsx", ".js", ".env"}
DEFAULT_DIRS = ["docs", "src", "server", "scripts", "public"]
SKIP_DIRS = {"node_modules", "dist", ".git", ".venv", "build", "coverage"}

# Valores que são PLACEHOLDERS de documentação, não segredos reais.
PLACEHOLDER_VALUE = re.compile(
    r"(?i)^(?:\*+|x{4,}|your[_-].*|.*_here|changeme|change[_-]?me|example.*|placeholder.*|dummy.*|test.*|sample.*|<.*>|\.\.\.)$"
)


def _generic_is_real(m: re.Match[str]) -> bool:
    """True se o valor da atribuição genérica parece um segredo real."""
    return not PLACEHOLDER_VALUE.match(m.group(3).strip())


def scan_text(text: str) -> list[tuple[str, int]]:
    """Retorna [(padrao, ocorrências)] sem expor valores."""
    found: list[tuple[str, int]] = []
    for name, pattern, mode in PATTERNS:
        if mode == "generic":
            n = sum(1 for m in pattern.finditer(text) if _generic_is_real(m))
        else:
            n = len(pattern.findall(text))
        if n:
            found.append((name, n))
    return found


def redact_text(text: str) -> tuple[str, int]:
    """Aplica todas as redações; retorna (novo_texto, total_de_substituições)."""
    total = 0
    for name, pattern, mode in PATTERNS:
        if mode == "block":
            # placeholder sem os marcadores BEGIN/END — não casa com o próprio padrão
            text, n = pattern.subn("---- PRIVATE KEY REDACTED ----", text)
        elif mode == "generic":
            # redige apenas valores reais (3º grupo), preservando chave e aspas
            def _sub(m: re.Match[str]) -> str:
                if not _generic_is_real(m):
                    return m.group(0)
                return m.group(1) + m.group(2) + PLACEHOLDER + m.group(4)

            text, n = pattern.subn(_sub, text)
        else:
            text, n = pattern.subn(PLACEHOLDER, text)
        total += n
    return text, total


def iter_targets(paths: list[str]) -> list[Path]:
    """Expande diretórios/arquivos; filtra extensões e pastas irrelevantes."""
    if not paths:
        paths = DEFAULT_DIRS
    out: list[Path] = []
    for raw in paths:
        p = Path(raw)
        if p.is_file():
            out.append(p)
            continue
        for root, dirs, files in os.walk(p):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".")]
            for f in files:
                fp = Path(root) / f
                if fp.suffix.lower() in TEXT_EXT:
                    out.append(fp)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--redact", action="store_true", help="redige os achados em vez de só reportar")
    ap.add_argument("paths", nargs="*", help="arquivos/diretórios (default: dirs do projeto)")
    args = ap.parse_args()

    findings: list[tuple[Path, list[tuple[str, int]]]] = []
    for target in iter_targets(args.paths):
        try:
            text = target.read_text(encoding="utf-8", errors="replace")
        except (OSError, UnicodeDecodeError):
            continue
        found = scan_text(text)
        if not found:
            continue
        findings.append((target, found))
        if args.redact:
            new_text, n = redact_text(text)
            target.write_text(new_text, encoding="utf-8")
            print(f"REDACT {target} ({n} substituições)")

    for target, found in findings:
        detail = ", ".join(f"{name}×{n}" for name, n in found)
        status = "redigido" if args.redact else "ENCONTRADO"
        print(f"{status}: {target} → {detail}")

    if not findings:
        print("OK — nenhum segredo encontrado.")
        return 0

    total = sum(n for _, found in findings for _, n in found)
    if args.redact:
        print(f"OK — {total} segredo(s) redigidos.")
        return 0
    print(f"FALHA — {total} possível(is) segredo(s) em {len(findings)} arquivo(s).")
    return 1


if __name__ == "__main__":
    sys.exit(main())
