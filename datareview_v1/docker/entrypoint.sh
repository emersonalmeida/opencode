#!/usr/bin/env bash
# entrypoint do container all-in-one: Ollama + frontend + servidor local.
set -u

cd /app

# --- Ollama (IA local) ---------------------------------------------------
ollama serve &
OLLAMA_PID=$!

# Espera o Ollama subir (máx ~30s) e garante o modelo configurado.
if [ "${OLLAMA_PULL:-1}" = "1" ]; then
  for i in $(seq 1 30); do
    curl -fsS http://localhost:11434/api/version >/dev/null 2>&1 && break
    sleep 1
  done
  MODEL="${OLLAMA_MODEL:-gemma3:12b}"
  if ! ollama list 2>/dev/null | grep -q "${MODEL%%:*}"; then
    echo "[entrypoint] Baixando modelo de IA $MODEL (só na 1ª vez)…"
    ollama pull "$MODEL" || echo "[entrypoint] pull falhou — a IA ficará indisponível até: ollama pull $MODEL"
  fi
fi

# --- Servidor local (edge functions + IA + voz) ---------------------------
npx tsx server/index.ts &
SERVER_PID=$!

# --- Frontend (Vite, modo dev — serve :8080 com HMR) ----------------------
npm run dev -- --host 0.0.0.0 &
WEB_PID=$!

echo "[entrypoint] app em http://localhost:8080  ·  servidor em http://localhost:8787  ·  Ollama em :11434"

# Encerra tudo junto.
trap 'kill $OLLAMA_PID $SERVER_PID $WEB_PID 2>/dev/null' TERM INT
wait -n $OLLAMA_PID $SERVER_PID $WEB_PID
exit $?
