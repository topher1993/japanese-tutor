#!/usr/bin/env bash
# start-tunnel.sh
# Launches Metro on localhost:8081 + a public cloudflared tunnel.
# Prints the public URL testers paste into Expo Go → "Enter URL manually".
#
# Usage:   ./start-tunnel.sh
# Stop:    Ctrl+C  (kills both processes)

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 1. Kill any stale Metro / cloudflared processes
echo "🔪 killing stale node / cloudflared processes..."
taskkill //F //IM node.exe 2>/dev/null || true
taskkill //F //IM cloudflared.exe 2>/dev/null || true
sleep 2

# 2. Make sure port 8081 is free
if netstat -ano | grep -q ":8081 .*LISTENING"; then
  echo "⚠ port 8081 still busy, waiting 5s..."
  sleep 5
fi

# 3. Start Metro in the background
echo ""
echo "🚀 starting Metro on port 8081..."
npx expo start --port 8081 --clear > /tmp/metro.log 2>&1 &
METRO_PID=$!
echo "   metro pid=$METRO_PID"

# 4. Wait for Metro to be ready
echo "⏳ waiting for Metro to come up..."
for i in {1..30}; do
  if curl -s -o /dev/null -w "%{http_code}" http://localhost:8081/ 2>/dev/null | grep -q "200"; then
    echo "✅ Metro is up (HTTP 200)"
    break
  fi
  sleep 1
done

# 5. Start cloudflared tunnel
echo ""
echo "🌐 starting cloudflared tunnel..."
echo ""
echo "============================================================"
echo "  PUBLIC URL — paste this into Expo Go → 'Enter URL manually'"
echo "============================================================"
echo ""

CLOUDFLARED="/c/Users/tophe/.local/bin/cloudflared.exe"
"$CLOUDFLARED" tunnel --no-autoupdate --url http://localhost:8081 2>&1 | tee /tmp/cloudflared.log &
CF_PID=$!

# 6. Trap to clean up on Ctrl+C
trap "echo ''; echo '🛑 shutting down...'; taskkill //F //IM cloudflared.exe 2>/dev/null || true; kill $METRO_PID 2>/dev/null || true; exit 0" INT TERM

# 7. Keep script alive until either child dies
wait
