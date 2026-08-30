#!/usr/bin/env bash
# entrypoint sem Ollama embutido: só servidor local + frontend.
set -u
cd /app

echo "[entrypoint] IA externa em ${OLLAMA_URL:-http://host.docker.internal:11434}"

npx tsx server/index.ts &
SERVER_PID=$!

npm run dev -- --host 0.0.0.0 &
WEB_PID=$!

echo "[entrypoint] app em http://localhost:8080  ·  servidor em http://localhost:8787"

trap 'kill $SERVER_PID $WEB_PID 2>/dev/null' TERM INT
wait -n $SERVER_PID $WEB_PID
exit $?
