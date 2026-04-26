#!/usr/bin/env bash
# Libera el puerto 4178 (next dev / next start) para evitar EADDRINUSE.
set +e
PORT=4178

if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null
fi

sleep 0.3

if command -v lsof >/dev/null 2>&1; then
  PIDS=$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  for pid in $PIDS; do
    if [ -n "$pid" ] && [ "$pid" != "$$" ]; then
      kill -TERM "$pid" 2>/dev/null
    fi
  done
  sleep 0.5
  PIDS=$(lsof -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
  for pid in $PIDS; do
    if [ -n "$pid" ]; then
      kill -KILL "$pid" 2>/dev/null
    fi
  done
fi

exit 0
