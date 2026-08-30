#!/usr/bin/env bash
# setup.sh — assistente de instalação "clone e rode" do appdatareview.
#
#   bash scripts/setup.sh             # instala tudo (Node, deps, IA, voz)
#   bash scripts/setup.sh --no-voice  # pula os backends de voz (Python)
#   bash scripts/setup.sh --no-ai     # pula o Ollama/modelo (sem IA local)
#
# Detecta o gerenciador de pacotes do SO (pacman/apt/dnf/brew/pipx) e
# instala o que falta. Seguro para rodar mais de uma vez (idempotente).
# Nada é forçado: falhas viram avisos com o comando manual sugerido.
set -u
cd "$(dirname "$0")/.."

say()  { printf '%s\n' "$*"; }
step() { printf '\n\033[1;36m==>\033[0m \033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
err()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }

WITH_VOICE=1
WITH_AI=1
for arg in "$@"; do
  case "$arg" in
    --no-voice) WITH_VOICE=0 ;;
    --no-ai)    WITH_AI=0 ;;
    -h|--help)
      say "Uso: bash scripts/setup.sh [--no-voice] [--no-ai]"
      exit 0 ;;
  esac
done

have() { command -v "$1" >/dev/null 2>&1; }

# ------------------------------------------------------------ gerenciador --
PKG=""
if   have pacman; then PKG="pacman"
elif have apt-get; then PKG="apt"
elif have dnf;     then PKG="dnf"
elif have brew;    then PKG="brew"
elif have zypper;  then PKG="zypper"
fi
[ -n "$PKG" ] && ok "Gerenciador de pacotes: $PKG" || warn "Nenhum gerenciador conhecido — instalações manuais abaixo."

pkg_install() {
  # pkg_install <pacote-pacman> <pacote-apt> <pacote-dnf> <pacote-brew>
  local p_pacman="$1" p_apt="$2" p_dnf="$3" p_brew="$4"
  case "$PKG" in
    pacman) sudo pacman -S --needed --noconfirm "$p_pacman" ;;
    apt)    sudo apt-get update -qq && sudo apt-get install -y "$p_apt" ;;
    dnf)    sudo dnf install -y "$p_dnf" ;;
    brew)   brew install "$p_brew" ;;
    zypper) sudo zypper install -y "$p_apt" ;;
    *)      return 1 ;;
  esac
}

# --------------------------------------------------------------- Node.js --
step "Node.js 20+"
if have node && [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -ge 20 ] 2>/dev/null; then
  ok "node $(node -v)"
else
  warn "Node.js ausente ou antigo — instalando…"
  case "$PKG" in
    pacman) pkg_install nodejs-lts-iron npm nodejs npm || pkg_install nodejs npm nodejs npm ;;
    apt)    pkg_install nodejs nodejs nodejs nodejs || warn "O Node do apt pode ser antigo. Melhor: https://nodejs.org ou nvm (curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash)" ;;
    dnf)    pkg_install nodejs nodejs nodejs nodejs ;;
    brew)   pkg_install node node node node ;;
    *)      warn "Instale Node 20+: https://nodejs.org" ;;
  esac
  have node && ok "node $(node -v)" || err "Node.js não instalado — instale manualmente: https://nodejs.org"
fi

# ----------------------------------------------------------- dependências --
step "Dependências do projeto (npm ci)"
if have npm; then
  npm ci && ok "node_modules pronto" || { warn "npm ci falhou — tentando npm install"; npm install && ok "node_modules pronto (npm install)"; }
else
  err "npm ausente — sem Node não dá para continuar. Rode de novo depois de instalar."
  exit 1
fi

# ------------------------------------------------------------------ .env --
step "Arquivo .env"
if [ -f .env ]; then
  ok ".env já existe (mantido)"
elif [ -f .env.example ]; then
  cp .env.example .env
  ok ".env criado a partir de .env.example (modo local: backend em :8787)"
else
  warn ".env.example não encontrado — pulando"
fi

# ----------------------------------------------------------------- Ollama --
if [ "$WITH_AI" = "1" ]; then
  step "IA local (Ollama)"
  if have ollama; then
    ok "ollama instalado ($(ollama --version 2>/dev/null | head -1))"
  else
    warn "Ollama ausente — instalando…"
    case "$PKG" in
      brew)   brew install ollama ;;
      pacman) sudo pacman -S --needed --noconfirm ollama ;;
      *)      curl -fsSL https://ollama.com/install.sh | sh ;;
    esac || true
    have ollama && ok "ollama instalado" || warn "Não consegui instalar o Ollama — baixe em https://ollama.com (a IA local ficará indisponível até instalar)."
  fi
  if have ollama; then
    if curl -fsS --max-time 2 http://localhost:11434/api/version >/dev/null 2>&1; then
      ok "Ollama rodando em :11434"
    else
      warn "Ollama não está rodando — suba com: ollama serve   (ou: systemctl enable --now ollama)"
    fi
    if ollama list 2>/dev/null | grep -q "gemma3"; then
      ok "modelo gemma3 presente"
    else
      say "  Baixando modelo de IA (gemma3:12b, ~8GB; em máquinas fracas use: ollama pull gemma3:4b)…"
      ollama pull gemma3:12b || warn "pull falhou — tente depois: ollama pull gemma3:12b"
    fi
  fi
else
  step "IA local — pulada (--no-ai)"
fi

# ------------------------------------------------------------------- voz --
if [ "$WITH_VOICE" = "1" ]; then
  step "Voz local (Whisper + Piper)"
  if have python3; then
    ok "python3 $(python3 --version 2>&1 | awk '{print $2}')"
    bash scripts/setup-voice.sh || warn "Setup de voz falhou — rode depois: scripts/setup-voice.sh"
  else
    warn "Python 3 ausente — instalando…"
    case "$PKG" in
      pacman) pkg_install python python python python ;;
      apt)    pkg_install python3-venv python3 python3 python ;;
      dnf)    pkg_install python3 python3 python3 python ;;
      brew)   pkg_install python python python python ;;
      *)      warn "Instale Python 3: https://python.org" ;;
    esac || true
    have python3 && bash scripts/setup-voice.sh || warn "Sem Python a voz local fica indisponível (o Chrome ainda faz STT/TTS pelo navegador)."
  fi
else
  step "Voz local — pulada (--no-voice)"
fi

# ----------------------------------------------------------------- final --
step "Resumo"
ok  "Frontend + servidor local:  npm run dev:all   →  http://localhost:8080"
[ "$WITH_AI" = "1" ] && say "  IA local:                     ollama serve     (em outro terminal, se não estiver rodando)"
[ "$WITH_VOICE" = "1" ] && say "  Voz:                          scripts/setup-voice.sh --check  (verificar)"
say ""
say "Produção:    npm run build && npm run preview"
say "Docker:      docker compose up --build   (ver GUIA-DE-INSTALACAO.md)"
