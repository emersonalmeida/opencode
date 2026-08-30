# syntax=docker/dockerfile:1
# ============================================================
# appdatareview — imagem all-in-one (frontend + backend + IA + voz)
#
#   Build:  docker build -t appdatareview .
#   Run:    docker compose up        (recomendado — ver docker-compose.yml)
#
# Um único container sobe: Ollama (IA) + backends de voz (Whisper + Piper) +
# servidor Express (:8787) + frontend Vite (:8080). Modelos de IA e de voz
# ficam em volumes persistentes (baixados só na 1ª vez).
#
# GPU NVIDIA (opcional, acelera Whisper/IA): instale o nvidia-container-
# toolkit no HOST e rode com `docker compose --profile gpu up`.
# ============================================================

FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

# --- Dependências de SO: Python (backends de voz), ffmpeg (whisper.cpp),
#     espeak-ng (TTS de emergência), curl/ca-certificates (instaladores). ---
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      ffmpeg espeak-ng \
      curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# --- Ollama (IA local) ---
RUN curl -fsSL https://ollama.com/install.sh | sh

# --- Backends de voz no venv do projeto (mesmo local que o servidor
#     procura em runtime: <app>/.venv) ---
WORKDIR /app
COPY requirements-voice.txt ./
RUN python3 -m venv .venv \
    && .venv/bin/pip install --no-cache-dir --upgrade pip \
    && .venv/bin/pip install --no-cache-dir -r requirements-voice.txt

# --- Dependências Node (camada cacheada: só refaz quando o lockfile muda) ---
COPY package.json package-lock.json ./
RUN npm ci

# --- Código + build de produção do frontend ---
COPY . .
ENV VITE_SUPABASE_PROJECT_ID=local \
    VITE_SUPABASE_PUBLISHABLE_KEY=local-anon-key \
    VITE_SUPABASE_URL=http://localhost:8787
RUN npm run build

# --- Entrypoint: sobe Ollama (baixa o modelo na 1ª vez) + app + servidor ---
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV PORT=8787 \
    OLLAMA_URL=http://localhost:11434 \
    OLLAMA_MODEL=gemma3:12b \
    WHISPER_MODEL=small \
    WHISPER_DEVICE=cuda \
    PIPER_MODEL=pt_BR-faber-medium

EXPOSE 8080 8787

# Modelos de IA e de voz em volumes (persistem entre containers).
VOLUME ["/root/.ollama", "/root/.local/share/piper-voices", "/root/.cache/huggingface"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD curl -fsS http://localhost:8787/health >/dev/null || exit 1

CMD ["/entrypoint.sh"]
