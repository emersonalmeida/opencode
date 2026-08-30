#!/usr/bin/env bash
# setup-voice.sh — instala os backends de voz locais (Whisper + Piper) num
# venv DENTRO do projeto (`.venv/`), sem sudo e sem PEP 668.
#
#   scripts/setup-voice.sh           # cria .venv (se faltar) e instala
#   scripts/setup-voice.sh --check   # só verifica o que está instalado
#
# O servidor local (server/) detecta automaticamente o venv do projeto
# antes de procurar pacotes no sistema — não precisa ativar o venv.
set -u
cd "$(dirname "$0")/.."
VENV_DIR="${VOICE_VENV:-.venv}"

say()  { printf '%s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
err()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }

pick_python() {
  if [ -x "$VENV_DIR/bin/python" ]; then echo "$VENV_DIR/bin/python"; return 0; fi
  for c in python3 python; do
    command -v "$c" >/dev/null 2>&1 && { echo "$c"; return 0; }
  done
  return 1
}

PY="$(pick_python || true)"
if [ -z "$PY" ]; then
  err "Python 3 não encontrado. Instale (Debian/Ubuntu: sudo apt install python3 python3-venv; Arch: sudo pacman -S python; macOS: brew install python; Fedora: sudo dnf install python3)."
  exit 1
fi

if [ "${1:-}" = "--check" ]; then
  say "Verificando backends de voz ($PY):"
  "$PY" -c "import faster_whisper" 2>/dev/null && ok "faster-whisper instalado" || warn "faster-whisper FALTANDO (rode: scripts/setup-voice.sh)"
  "$PY" -c "import piper" 2>/dev/null && ok "piper-tts instalado" || warn "piper-tts FALTANDO (rode: scripts/setup-voice.sh)"
  command -v espeak-ng >/dev/null 2>&1 && ok "espeak-ng instalado (fallback TTS)" || true
  exit 0
fi

if [ ! -x "$VENV_DIR/bin/python" ]; then
  say "Criando ambiente virtual Python em $VENV_DIR ..."
  if ! "$PY" -m venv "$VENV_DIR" 2>/dev/null; then
    err "Falha ao criar o venv. Instale o suporte a venv:"
    err "  Debian/Ubuntu: sudo apt install python3-venv"
    err "  Fedora:        sudo dnf install python3"
    err "  Arch/BigLinux: sudo pacman -S python"
    exit 1
  fi
  ok "venv criado"
fi

say "Instalando backends de voz (faster-whisper + piper-tts)..."
"$VENV_DIR/bin/pip" install --upgrade pip >/dev/null 2>&1 || true
if "$VENV_DIR/bin/pip" install -r requirements-voice.txt; then
  ok "Backends de voz instalados em $VENV_DIR"
  say ""
  say "Pronto! O servidor local (npm run dev:server) detecta o venv"
  say "automaticamente — não precisa ativar nada. Na página Chat com voz,"
  say "aba Voz, clique em 'Verificar de novo' para confirmar."
else
  err "Falha ao instalar. Verifique sua conexão e tente de novo."
  exit 1
fi
