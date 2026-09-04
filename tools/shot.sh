#!/usr/bin/env bash
# Скриншот прототипа headless-Chrome: tools/shot.sh <out.png> [query] [w] [h]
set -u
OUT="${1:-/tmp/nalei.png}"
QUERY="${2:-}"
# headless-Chrome отдаёт вьюпорт шире окна на ~100px, поэтому окно берём с запасом
W="${3:-560}"
H="${4:-900}"
PROF="$(mktemp -d)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

"$CHROME" --headless=old --disable-gpu --no-sandbox --hide-scrollbars \
  --virtual-time-budget=5000 --window-size="$W,$H" --screenshot="$OUT" \
  --user-data-dir="$PROF" "http://localhost:5199/${QUERY}" >/dev/null 2>&1 &
PID=$!
sleep 14
kill "$PID" 2>/dev/null
rm -rf "$PROF"
ls -la "$OUT"
